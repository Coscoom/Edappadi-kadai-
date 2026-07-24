const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Keeping 1 instance warm 24/7 for instant FCM push notification dispatch.
// Note: minInstances: 1 keeps one instance warm 24/7 and incurs a small recurring Firebase billing cost.
exports.sendFcmOnQueue = onDocumentCreated({
  document: 'ek_fcm_queue/{docId}',
  region: 'asia-south1',
  minInstances: 1
}, async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data();
  if (!data || !data.targetToken || data.processed) return;
  const message = {
    token: data.targetToken,
    notification: { title: data.title || '', body: data.body || '' },
    data: {
      orderId: data.orderId || '',
      oldStatus: data.oldStatus || '',
      newStatus: data.newStatus || '',
      click_action: 'OPEN_MAIN_ACTIVITY'
    },
    android: {
      priority: 'high',
      notification: { channelId: 'status_alerts' }
    }
  };
  try {
    await admin.messaging().send(message);
    await snap.ref.update({
      processed: true,
      sentAt: new Date().toISOString()
    });
  } catch (err) {
    await snap.ref.update({
      processed: false,
      error: err.message
    });
  }
});

exports.sendOtpSms = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required.');
    }
    const { phoneNumber, otpCode } = data;
    if (!phoneNumber || !otpCode) {
      throw new functions.https.HttpsError('invalid-argument', 'phoneNumber and otpCode required.');
    }

    const axios = require('axios');

    // 1. Fetch provider configuration (non-secret)
    const settingsDoc = await admin.firestore().collection('ek_settings').doc('global_config').get();
    const settings = settingsDoc.data() || {};
    const provider = settings.smsProvider || 'fast2sms';

    if (provider === 'simulator') {
      return { success: true, message: 'Simulator mode active. SMS not sent.' };
    }

    // 2. Fetch secrets from secure collection
    const secretsDoc = await admin.firestore().collection('ek_secrets').doc('sms_gateway').get();
    if (!secretsDoc.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'SMS Gateway configuration is missing.');
    }
    const secrets = secretsDoc.data() || {};

    let cleanPhone = String(phoneNumber).replace(/\s+/g, '');
    if (cleanPhone.length === 10 && !cleanPhone.startsWith('+')) {
      cleanPhone = '91' + cleanPhone;
    }

    const messageText = `Edappadi Kadai security verification OTP is: ${otpCode}. Valid for 5 mins. Do not share.`;

    if (provider === 'fast2sms') {
      const apiKey = secrets.smsApiKey;
      if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Fast2SMS API key not configured.');
      }
      const targetUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&variables_values=${otpCode}&route=otp&numbers=${cleanPhone.replace(/^91/, '')}`;
      try {
        await axios.get(targetUrl);
        return { success: true, message: 'Fast2SMS OTP sent successfully' };
      } catch (err) {
        throw new functions.https.HttpsError('internal', 'Fast2SMS send failed: ' + err.message);
      }
    } else if (provider === 'twilio') {
      const sid = secrets.smsTwilioSid;
      const token = secrets.smsTwilioToken;
      const fromNum = secrets.smsTwilioFrom;
      if (!sid || !token || !fromNum) {
        throw new functions.https.HttpsError('failed-precondition', 'Twilio parameters are incomplete.');
      }

      let toWithPlus = cleanPhone;
      if (!toWithPlus.startsWith('+')) {
        toWithPlus = '+' + toWithPlus;
      }

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
      const authHeader = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');

      const params = new URLSearchParams();
      params.append('To', toWithPlus);
      params.append('From', fromNum);
      params.append('Body', messageText);

      try {
        await axios.post(twilioUrl, params.toString(), {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        return { success: true, message: 'Twilio OTP sent successfully' };
      } catch (err) {
        const responseData = err.response ? JSON.stringify(err.response.data) : '';
        throw new functions.https.HttpsError('internal', 'Twilio send failed: ' + err.message + ' ' + responseData);
      }
    } else if (provider === 'custom') {
      const customUrlTemplate = secrets.smsCustomUrl;
      if (!customUrlTemplate) {
        throw new functions.https.HttpsError('failed-precondition', 'Custom SMS template URL is empty.');
      }

      const phoneOnly = cleanPhone.replace(/^\+?91/, '');
      const replacedUrl = customUrlTemplate
        .replace('{PHONE}', encodeURIComponent(cleanPhone))
        .replace('{10_DIGIT_PHONE}', encodeURIComponent(phoneOnly))
        .replace('{OTP}', encodeURIComponent(otpCode))
        .replace('{MSG}', encodeURIComponent(messageText))
        .replace('{MESSAGE}', encodeURIComponent(messageText));

      try {
        await axios.get(replacedUrl);
        return { success: true, message: 'Custom Gateway SMS sent successfully' };
      } catch (err) {
        throw new functions.https.HttpsError('internal', 'Custom SMS send failed: ' + err.message);
      }
    } else {
      throw new functions.https.HttpsError('invalid-argument', 'Unsupported SMS provider: ' + provider);
    }
  });

exports.saveSmsGatewaySecrets = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required.');
    }
    const uid = context.auth.uid;
    const adminDoc = await admin.firestore().collection('ek_admin_accounts').doc(uid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied.');
    }
    const adminData = adminDoc.data();
    if (!adminData || (adminData.role !== 'admin' && adminData.role !== 'superadmin') || adminData.active === false) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied.');
    }

    const allowedKeys = ['smsProvider', 'smsApiKey', 'smsTwilioSid', 'smsTwilioToken', 'smsTwilioFrom', 'smsCustomUrl'];
    const secretsToSave = {};

    for (const key of Object.keys(data)) {
      if (!allowedKeys.includes(key)) {
        throw new functions.https.HttpsError('invalid-argument', `Field ${key} is not allowed.`);
      }
      if (data[key] !== undefined && data[key] !== null) {
        if (typeof data[key] !== 'string') {
          throw new functions.https.HttpsError('invalid-argument', `Field ${key} must be a string.`);
        }
        secretsToSave[key] = data[key];
      }
    }

    secretsToSave.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await admin.firestore().collection('ek_secrets').doc('sms_gateway').set(secretsToSave, { merge: true });

    return { success: true, message: "SMS gateway settings saved securely." };
  });

exports.getSmsGatewayStatus = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required.');
    }
    const uid = context.auth.uid;
    const adminDoc = await admin.firestore().collection('ek_admin_accounts').doc(uid).get();
    if (!adminDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied.');
    }
    const adminData = adminDoc.data();
    if (!adminData || (adminData.role !== 'admin' && adminData.role !== 'superadmin') || adminData.active === false) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied.');
    }

    const secretsDoc = await admin.firestore().collection('ek_secrets').doc('sms_gateway').get();
    const secrets = secretsDoc.exists ? secretsDoc.data() : {};

    return {
      provider: secrets.smsProvider || 'simulator',
      configured: true,
      hasApiKey: !!secrets.smsApiKey,
      hasTwilioSid: !!secrets.smsTwilioSid,
      hasTwilioToken: !!secrets.smsTwilioToken,
      hasTwilioFrom: !!secrets.smsTwilioFrom,
      hasCustomUrl: !!secrets.smsCustomUrl
    };
  });

const geoCache = new Map();

exports.geocodeDeliveryAddress = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Verification failed. Authentication required.');
    }
    const uid = context.auth.uid;

    // Server-side Firestore-backed rate limiting cooldown (3 seconds per user)
    const now = Date.now();
    const cooldownDocRef = admin.firestore().collection('ek_user_cooldowns').doc(uid);
    const cooldownDoc = await cooldownDocRef.get();
    if (cooldownDoc.exists) {
      const lastRequest = cooldownDoc.data().lastRequestTime || 0;
      if (now - lastRequest < 3000) {
        throw new functions.https.HttpsError('resource-exhausted', 'Please wait before trying to locate again.');
      }
    }
    await cooldownDocRef.set({ lastRequestTime: now }, { merge: true });

    const isReverse = data.lat !== undefined && data.lng !== undefined;
    const axios = require('axios');

    if (isReverse) {
      const lat = parseFloat(data.lat);
      const lng = parseFloat(data.lng);
      if (isNaN(lat) || isNaN(lng)) {
        throw new functions.https.HttpsError('invalid-argument', 'Latitude and longitude must be valid numbers.');
      }

      const cacheKey = `reverse_${lat.toFixed(6)}_${lng.toFixed(6)}`;
      const cached = geoCache.get(cacheKey);
      if (cached && (now - cached.timestamp < 600000)) {
        console.log(`[Geocode] Cache HIT (Reverse) for: ${cacheKey}`);
        return cached.result;
      }

      const targetUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      try {
        const response = await axios.get(targetUrl, {
          headers: {
            'User-Agent': 'EdappadiKadaiApp/1.0 (einsteinananth24@gmail.com)'
          },
          timeout: 5000
        });

        const item = response.data;
        if (item && item.display_name) {
          const addr = item.address || {};
          const parts = [];
          
          // House / Door Number
          const door = addr.house_number || addr.building || addr.house_name || '';
          if (door) parts.push(`Door No: ${door}`);
          
          // Street Name
          const street = addr.road || addr.street || addr.footway || addr.path || '';
          if (street) parts.push(street);
          
          // Area / Locality
          const area = addr.suburb || addr.neighbourhood || addr.neighbourhood_district || addr.village_district || addr.quarter || '';
          if (area) parts.push(area);
          
          // Village / Town
          const village = addr.village || addr.town || addr.hamlet || '';
          if (village) parts.push(village);
          
          // City
          const city = addr.city || addr.municipality || '';
          if (city && city !== village) parts.push(city);
          
          // District
          const district = addr.county || addr.district || '';
          if (district) parts.push(district);
          
          // State
          const state = addr.state || '';
          if (state) parts.push(state);
          
          // PIN Code
          const postcode = addr.postcode || '';
          if (postcode) parts.push(postcode);

          const formattedAddress = parts.filter(Boolean).join(', ');
          const displayName = formattedAddress || item.display_name;

          const result = {
            latitude: lat,
            longitude: lng,
            displayName: displayName
          };

          geoCache.set(cacheKey, {
            timestamp: now,
            result: result
          });

          return result;
        } else {
          return { latitude: lat, longitude: lng, displayName: null };
        }
      } catch (err) {
        console.error("[Reverse Geocode Function Error]", err);
        throw new functions.https.HttpsError('internal', 'Reverse geocoding service unavailable or timed out.');
      }
    } else {
      const address = data.address;
      if (typeof address !== 'string' || address.trim().length < 5 || address.trim().length > 250) {
        throw new functions.https.HttpsError('invalid-argument', 'Address must be between 5 and 250 characters.');
      }
      const normalizedAddress = address.trim().toLowerCase();

      const cached = geoCache.get(normalizedAddress);
      if (cached && (now - cached.timestamp < 600000)) {
        console.log(`[Geocode] Cache HIT (Forward) for: ${normalizedAddress}`);
        return cached.result;
      }

      const targetUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
      try {
        const response = await axios.get(targetUrl, {
          headers: {
            'User-Agent': 'EdappadiKadaiApp/1.0 (einsteinananth24@gmail.com)'
          },
          timeout: 5000
        });

        const geoData = response.data;
        if (geoData && geoData.length > 0) {
          const item = geoData[0];
          const result = {
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            displayName: item.display_name || address
          };

          geoCache.set(normalizedAddress, {
            timestamp: now,
            result: result
          });

          return result;
        } else {
          return { latitude: null, longitude: null, displayName: null };
        }
      } catch (err) {
        console.error("[Geocode Function Error]", err);
        throw new functions.https.HttpsError('internal', 'Geocoding service unavailable or timed out.');
      }
    }
  });

exports.deleteCustomerAccount = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    // 1. Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required.');
    }

    const callerUid = context.auth.uid;

    try {
      // 2. Verify caller is admin or superadmin
      const adminDoc = await admin.firestore().collection('ek_admin_accounts').doc(callerUid).get();
      if (!adminDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Access denied. Administrator privileges required.');
      }
      const adminData = adminDoc.data() || {};
      if ((adminData.role !== 'admin' && adminData.role !== 'superadmin') || adminData.active === false) {
        throw new functions.https.HttpsError('permission-denied', 'Access denied. Administrator account inactive or unauthorized.');
      }

      // 3. Validate input
      const targetUid = data.targetCustomerUid;
      if (!targetUid) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing targetCustomerUid.');
      }

      // 4. Critical Guard: Prevent deleting admin or rider accounts
      const isAdminCheck = await admin.firestore().collection('ek_admin_accounts').doc(targetUid).get();
      const isRiderCheck = await admin.firestore().collection('ek_delivery_persons').doc(targetUid).get();

      if (isAdminCheck.exists || isRiderCheck.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Security Violation: Cannot delete staff or rider accounts.');
      }

      const firestore = admin.firestore();

      // 5. Query and Anonymize Customer Orders to preserve financial statistics
      const ordersQuery = await firestore.collection('ek_orders')
        .where('userId', '==', targetUid)
        .get();

      const batch = firestore.batch();
      let ordersAnonymized = 0;

      ordersQuery.forEach(doc => {
        batch.update(doc.ref, {
          customerName: "Deleted Customer",
          customerPhone: "0000000000",
          deliveryAddress: "Anonymized for GDPR / Accounting",
          updatedAt: new Date().toISOString()
        });
        ordersAnonymized++;
      });

      // 6. Delete Customer Profiles
      const userDocRef = firestore.collection('ek_users').doc(targetUid);
      const legacyUserDocRef = firestore.collection('users').doc(targetUid);

      batch.delete(userDocRef);
      batch.delete(legacyUserDocRef);

      // Execute Firestore cleanup batch
      await batch.commit();

      // 7. Delete the Firebase Authentication User
      try {
        await admin.auth().deleteUser(targetUid);
      } catch (authErr) {
        if (authErr.code !== 'auth/user-not-found') {
          console.error("Firebase Auth user deletion error:", authErr);
          throw new functions.https.HttpsError('internal', `Failed to delete Auth account: ${authErr.message}`);
        }
      }

      return {
        success: true,
        deletedUid: targetUid,
        profileDeleted: true,
        ordersAnonymizedCount: ordersAnonymized,
        message: `Successfully deleted customer profile ${targetUid} from database and revoked authentication. ${ordersAnonymized} historical order records were fully anonymized for privacy retention.`
      };

    } catch (err) {
      console.error("[deleteCustomerAccount Error]", err);
      if (err instanceof functions.https.HttpsError) {
        throw err;
      }
      throw new functions.https.HttpsError('internal', err.message);
    }
  });

exports.deleteDeliveryPartner = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    // 1. Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required.');
    }

    const callerUid = context.auth.uid;

    try {
      // 2. Verify caller is admin or superadmin
      const adminDoc = await admin.firestore().collection('ek_admin_accounts').doc(callerUid).get();
      if (!adminDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Access denied. Administrator privileges required.');
      }
      const adminData = adminDoc.data() || {};
      if ((adminData.role !== 'admin' && adminData.role !== 'superadmin') || adminData.active === false) {
        throw new functions.https.HttpsError('permission-denied', 'Access denied. Administrator account inactive or unauthorized.');
      }

      // 3. Validate input
      const targetUid = data.targetUid;
      if (!targetUid) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing targetUid.');
      }

      const firestore = admin.firestore();

      // 4. Delete Firestore document under ek_delivery_persons
      await firestore.collection('ek_delivery_persons').doc(targetUid).delete();

      // 5. Delete the Firebase Authentication User
      try {
        await admin.auth().deleteUser(targetUid);
      } catch (authErr) {
        if (authErr.code !== 'auth/user-not-found') {
          console.error("Firebase Auth user deletion error:", authErr);
          throw new functions.https.HttpsError('internal', `Failed to delete Auth account: ${authErr.message}`);
        }
      }

      return {
        success: true,
        deletedUid: targetUid,
        message: `Successfully deleted delivery partner ${targetUid} from Firebase Auth and Firestore.`
      };

    } catch (err) {
      console.error("[deleteDeliveryPartner Error]", err);
      if (err instanceof functions.https.HttpsError) {
        throw err;
      }
      throw new functions.https.HttpsError('internal', err.message);
    }
  });

exports.repairDeliveryPartner = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required.');
    }
    const callerUid = context.auth.uid;
    try {
      const adminDoc = await admin.firestore().collection('ek_admin_accounts').doc(callerUid).get();
      if (!adminDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Access denied.');
      }
      const adminData = adminDoc.data() || {};
      if ((adminData.role !== 'admin' && adminData.role !== 'superadmin') || adminData.active === false) {
        throw new functions.https.HttpsError('permission-denied', 'Access denied.');
      }

      const targetId = data.targetId;
      if (!targetId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing targetId.');
      }

      const firestore = admin.firestore();
      const riderDocRef = firestore.collection('ek_delivery_persons').doc(targetId);
      const riderDoc = await riderDocRef.get();
      if (!riderDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Rider profile not found in Firestore.');
      }

      const riderData = riderDoc.data();
      const rawPhone = riderData.phone || "";
      const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);
      if (cleanPhone.length !== 10) {
        throw new functions.https.HttpsError('invalid-argument', 'Rider phone number is invalid.');
      }

      const expectedEmail = `rider_${cleanPhone}@lyo.delivery`;

      let authUser = null;
      let authExists = false;

      try {
        authUser = await admin.auth().getUserByEmail(expectedEmail);
        authExists = true;
      } catch (authErr) {
        if (authErr.code !== 'auth/user-not-found') {
          throw new functions.https.HttpsError('internal', 'Error checking Auth account: ' + authErr.message);
        }
      }

      let actionTaken = "";
      let finalUid = "";

      if (!authExists) {
        const securePass = Math.random().toString(36).slice(-10) + "A1!";
        authUser = await admin.auth().createUser({
          email: expectedEmail,
          password: securePass,
          displayName: riderData.name || "Delivery Partner"
        });
        actionTaken = "created_auth_account";
        finalUid = authUser.uid;
      } else {
        finalUid = authUser.uid;
        actionTaken = "auth_already_existed";
      }

      const payoutType = riderData.payoutType || riderData.salaryType || "per_order";
      const payoutAmount = parseFloat(riderData.payoutAmount || riderData.salaryRate || 35);
      const vehicleNo = riderData.vehicleNo || riderData.vehicle || "";

      if (targetId !== finalUid) {
        const newDocRef = firestore.collection('ek_delivery_persons').doc(finalUid);
        
        const updatedProfile = {
          ...riderData,
          id: finalUid,
          uid: finalUid,
          authEmail: expectedEmail,
          phone: cleanPhone,
          role: "RIDER",
          isActiveRider: true,
          active: true,
          isActive: true,
          payoutType: payoutType,
          payoutAmount: payoutAmount,
          vehicleNo: vehicleNo,
          updatedAt: new Date().toISOString()
        };

        await newDocRef.set(updatedProfile);

        const ordersQuery = await firestore.collection('ek_orders')
          .where('assignedTo', '==', targetId)
          .get();

        const batch = firestore.batch();
        ordersQuery.forEach(doc => {
          batch.update(doc.ref, {
            assignedTo: finalUid,
            updatedAt: new Date().toISOString()
          });
        });

        batch.delete(riderDocRef);
        await batch.commit();

        actionTaken += "_and_migrated_firestore_doc";
      } else {
        await riderDocRef.update({
          id: finalUid,
          uid: finalUid,
          authEmail: expectedEmail,
          phone: cleanPhone,
          role: "RIDER",
          isActiveRider: true,
          active: true,
          isActive: true,
          payoutType: payoutType,
          payoutAmount: payoutAmount,
          vehicleNo: vehicleNo,
          updatedAt: new Date().toISOString()
        });
        actionTaken += "_and_updated_firestore_doc";
      }

      return {
        success: true,
        action: actionTaken,
        uid: finalUid,
        email: expectedEmail,
        message: `Successfully repaired delivery partner ${riderData.name}. Final UID is ${finalUid}.`
      };

    } catch (err) {
      console.error("[repairDeliveryPartner Error]", err);
      if (err instanceof functions.https.HttpsError) {
        throw err;
      }
      throw new functions.https.HttpsError('internal', err.message);
    }
  });

exports.restoreStockOnOrderCancelled = functions
  .region('asia-south1')
  .firestore
  .document('ek_orders/{orderId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data() || {};
    const afterData = change.after.data() || {};

    const beforeStatus = String(beforeData.status || '').toUpperCase();
    const afterStatus = String(afterData.status || '').toUpperCase();

    // Check if status changed to CANCELLED
    if (afterStatus === 'CANCELLED' && beforeStatus !== 'CANCELLED') {
      console.log(`[Stock Restore Trigger] Order ${context.params.orderId} status changed to CANCELLED. Restoring stocks...`);
      
      const items = afterData.items || [];
      if (!Array.isArray(items) || items.length === 0) {
        console.log(`[Stock Restore Trigger] No items found in order ${context.params.orderId}.`);
        return null;
      }

      const firestore = admin.firestore();
      const batch = firestore.batch();
      
      for (const item of items) {
        if (!item.productId) continue;
        const prodRef = firestore.collection('ek_products').doc(item.productId);
        const prodSnap = await prodRef.get();
        if (prodSnap.exists) {
          const prodData = prodSnap.data() || {};
          const serverStock = parseFloat(prodData.stockKg || 0);
          const unit = prodData.unit || 'kg';
          const isWeight = !(unit === 'piece' || unit === 'packet' || unit === 'bunch' || unit === 'dozen' || unit === 'unit');
          const returnedQty = isWeight ? (parseFloat(item.weightGrams || 0) / 1000) : parseFloat(item.weightGrams || 0);
          const newStock = parseFloat((serverStock + returnedQty).toFixed(3));

          batch.update(prodRef, {
            stockKg: newStock,
            isOutOfStock: false,
            updatedAt: new Date().toISOString()
          });
          console.log(`[Stock Restore Trigger] Prepared stock update for product ${item.productId}: stock ${serverStock} -> ${newStock}`);
        } else {
          console.warn(`[Stock Restore Trigger] Product ${item.productId} not found.`);
        }
      }

      await batch.commit();
      console.log(`[Stock Restore Trigger] Successfully restored stocks for order ${context.params.orderId}.`);
    }
    return null;
  });

exports.sendEmailOtp = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    const email = data.email;
    if (!email) {
      throw new functions.https.HttpsError('invalid-argument', 'Email is required.');
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000;

    await admin.firestore().collection('ek_email_otps').doc(email).set({
      otp: otp,
      createdAt: now,
      expiresAt: expiresAt,
      attempts: 0
    });

    const nodemailer = require('nodemailer');
    const gmailUser = functions.config().gmail.user;
    const gmailPass = functions.config().gmail.pass;

    if (!gmailUser || !gmailPass) {
      throw new functions.https.HttpsError('failed-precondition', 'Gmail SMTP credentials are not configured.');
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass
      }
    });

    const mailOptions = {
      from: `"Edappadi Kadai" <${gmailUser}>`,
      to: email,
      subject: "Edappadi Kadai - Password Reset OTP",
      text: `Your Password Reset OTP is: ${otp}\n\nThis OTP is valid for 10 minutes. Do not share this code with anyone.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #f97316; text-align: center;">Edappadi Kadai</h2>
          <p>Hello,</p>
          <p>We received a request to reset your password. Use the following 6-digit One-Time Password (OTP) to proceed:</p>
          <div style="font-size: 24px; font-weight: bold; text-align: center; margin: 30px 0; padding: 15px; background: #fff7ed; border-radius: 8px; color: #ea580c; border: 1px dashed #fdba74; letter-spacing: 4px;">
            ${otp}
          </div>
          <p style="color: #666; font-size: 13px;">Please note: This OTP is valid for <strong>10 minutes</strong>. Do not share this OTP with anyone for security reasons.</p>
          <p style="color: #666; font-size: 13px; border-top: 1px solid #eee; padding-top: 15px; margin-top: 25px;">If you did not request a password reset, you can safely ignore this email.</p>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true };
    } catch (err) {
      console.error("Error sending OTP email:", err);
      throw new functions.https.HttpsError('internal', 'Failed to send OTP email: ' + err.message);
    }
  });

exports.verifyEmailOtpAndResetPassword = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    const { email, otp, newPassword } = data;
    if (!email || !otp || !newPassword) {
      throw new functions.https.HttpsError('invalid-argument', 'Email, OTP, and new password are required.');
    }

    const docRef = admin.firestore().collection('ek_email_otps').doc(email);
    const snap = await docRef.get();

    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', 'No OTP request found for this email.');
    }

    const otpData = snap.data();
    const now = Date.now();

    if (now > otpData.expiresAt) {
      throw new functions.https.HttpsError('failed-precondition', 'OTP expired');
    }

    if (otpData.attempts >= 5) {
      throw new functions.https.HttpsError('resource-exhausted', 'Too many attempts');
    }

    if (String(otp).trim() !== String(otpData.otp).trim()) {
      await docRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
      throw new functions.https.HttpsError('invalid-argument', 'Invalid OTP');
    }

    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(userRecord.uid, { password: newPassword });
      await docRef.delete();
      return { success: true };
    } catch (err) {
      console.error("Error resetting password:", err);
      throw new functions.https.HttpsError('internal', err.message);
    }
  });


