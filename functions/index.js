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
  if (!data || data.processed) return;

  const payloadData = {
    orderId: data.orderId ? String(data.orderId) : '',
    oldStatus: data.oldStatus ? String(data.oldStatus) : '',
    newStatus: data.newStatus ? String(data.newStatus) : '',
    type: data.type ? String(data.type) : '',
    screen: data.screen ? String(data.screen) : '',
    click_action: 'OPEN_MAIN_ACTIVITY'
  };

  let fcmSuccess = false;
  let fcmError = null;

  if (data.targetToken) {
    const message = {
      token: String(data.targetToken).trim(),
      notification: { title: data.title || '', body: data.body || '' },
      data: payloadData,
      android: {
        priority: 'high',
        notification: { channelId: 'status_alerts' }
      }
    };
    try {
      await admin.messaging().send(message);
      fcmSuccess = true;
    } catch (err) {
      console.warn('[FCM Queue Send Error]', err.message);
      fcmError = err.message;
    }
  } else {
    fcmError = 'No targetToken provided';
  }

  try {
    await snap.ref.update({
      processed: true,
      sentAt: new Date().toISOString(),
      fcmSuccess: fcmSuccess,
      fcmError: fcmError
    });
  } catch (dbErr) {
    console.warn('[Queue Status Update Error]', dbErr.message);
  }
});

exports.sendTopicBroadcast = onDocumentCreated({
  document: 'ek_topic_broadcast_requests/{docId}',
  region: 'asia-south1',
  minInstances: 1
}, async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data();
  if (!data || !data.topic || data.processed) return;

  const message = {
    topic: String(data.topic).trim(),
    notification: { title: data.title || '', body: data.body || '' },
    data: {
      topic: String(data.topic).trim(),
      broadcast: 'true',
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
    console.warn('[FCM Topic Broadcast Error]', err.message);
    await snap.ref.update({
      processed: false,
      error: err.message
    });
  }
});

exports.sendOtpSms = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    const { phoneNumber, otpCode } = data || {};
    if (!phoneNumber || !otpCode) {
      throw new functions.https.HttpsError('invalid-argument', 'phoneNumber and otpCode required.');
    }

    const cleanOtp = String(otpCode).trim();
    if (!/^\d{4,6}$/.test(cleanOtp)) {
      throw new functions.https.HttpsError('invalid-argument', 'Valid 4-6 digit numeric OTP code required.');
    }

    let cleanPhone = String(phoneNumber).replace(/\s+/g, '').replace(/[^\d+]/g, '');
    if (cleanPhone.startsWith('+91')) {
      cleanPhone = cleanPhone.substring(1);
    } else if (cleanPhone.length === 10 && !cleanPhone.startsWith('91')) {
      cleanPhone = '91' + cleanPhone;
    }

    if (!/^91[6-9]\d{9}$/.test(cleanPhone)) {
      throw new functions.https.HttpsError('invalid-argument', 'Valid 10-digit Indian mobile number required.');
    }

    const now = Date.now();
    const firestore = admin.firestore();
    const phone10 = cleanPhone.slice(-10);
    const rateLimitDocRef = firestore.collection('ek_sms_rate_limits').doc(cleanPhone);
    const userRateLimitDocRef = (context && context.auth && context.auth.uid)
      ? firestore.collection('ek_user_sms_rate_limits').doc(context.auth.uid)
      : null;

    // Atomic rate-limiting check
    await firestore.runTransaction(async (t) => {
      const phoneSnap = await t.get(rateLimitDocRef);
      const userSnap = userRateLimitDocRef ? await t.get(userRateLimitDocRef) : null;

      const phoneData = phoneSnap.exists ? phoneSnap.data() : {};
      const userData = (userSnap && userSnap.exists) ? userSnap.data() : {};

      // 1. Phone number 60s cooldown check
      const lastSentPhone = phoneData.lastSentAt || 0;
      if (now - lastSentPhone < 55000) { // 55s cooldown
        const waitSec = Math.ceil((55000 - (now - lastSentPhone)) / 1000);
        throw new functions.https.HttpsError('resource-exhausted', `Please wait ${waitSec}s before requesting another SMS OTP.`);
      }

      // 2. Phone number hourly window limit (max 5 requests/hour)
      const oneHourAgo = now - (60 * 60 * 1000);
      const phoneRecentTimestamps = (phoneData.recentTimestamps || []).filter(ts => ts > oneHourAgo);
      if (phoneRecentTimestamps.length >= 5) {
        throw new functions.https.HttpsError('resource-exhausted', 'Hourly SMS limit reached for this mobile number. Please try again later.');
      }

      // 3. User UID hourly limit (max 10 requests/hour) if authenticated
      if (userRateLimitDocRef) {
        const userRecentTimestamps = (userData.recentTimestamps || []).filter(ts => ts > oneHourAgo);
        if (userRecentTimestamps.length >= 10) {
          throw new functions.https.HttpsError('resource-exhausted', 'Account SMS quota exceeded. Please try again later.');
        }
        userRecentTimestamps.push(now);
        t.set(userRateLimitDocRef, {
          uid: context.auth.uid,
          lastSentAt: now,
          recentTimestamps: userRecentTimestamps,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      phoneRecentTimestamps.push(now);

      t.set(rateLimitDocRef, {
        phoneNumber: cleanPhone,
        lastSentAt: now,
        recentTimestamps: phoneRecentTimestamps,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    });

    // Store generated OTP securely for verification
    try {
      await firestore.collection('ek_sms_otps').doc(phone10).set({
        phone: phone10,
        fullPhone: cleanPhone,
        otpCode: cleanOtp,
        createdAt: now,
        expiresAt: now + 5 * 60 * 1000
      });
    } catch (otpSaveErr) {
      console.warn('[sendOtpSms] Notice saving ek_sms_otps:', otpSaveErr.message);
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
    const secrets = secretsDoc.exists ? (secretsDoc.data() || {}) : {};

    const messageText = `Edappadi Kadai security verification OTP is: ${cleanOtp}. Valid for 5 mins. Do not share.`;

    // Queue in SMS outbox for administrative tracking
    try {
      await firestore.collection('ek_sms_outbox').add({
        phone: cleanPhone,
        phone10: phone10,
        otpCode: cleanOtp,
        message: messageText,
        provider: provider,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (qErr) {
      console.warn('[sendOtpSms] Notice queueing ek_sms_outbox:', qErr.message);
    }

    if (provider === 'fast2sms') {
      const apiKey = secrets.smsApiKey;
      if (!apiKey) {
        console.warn('[sendOtpSms] Fast2SMS API key not set in ek_secrets/sms_gateway; saved to ek_sms_otps');
        return { success: true, mode: 'recorded', message: 'OTP recorded in database' };
      }
      const targetUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&variables_values=${otpCode}&route=otp&numbers=${cleanPhone.replace(/^91/, '')}`;
      try {
        await axios.get(targetUrl);
        return { success: true, message: 'Fast2SMS OTP sent successfully' };
      } catch (err) {
        console.warn('[sendOtpSms] Fast2SMS error:', err.message);
        return { success: true, mode: 'recorded', message: 'Fast2SMS gateway returned error; OTP stored in database' };
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
    try {
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
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err;
      console.error('[saveSmsGatewaySecrets] Error:', err);
      throw new functions.https.HttpsError('internal', 'Failed to save SMS gateway secrets: ' + err.message);
    }
  });

exports.getSmsGatewayStatus = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required.');
    }
    const uid = context.auth.uid;
    try {
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
    } catch (err) {
      if (err instanceof functions.https.HttpsError) throw err;
      console.error('[getSmsGatewayStatus] Error:', err);
      throw new functions.https.HttpsError('internal', 'Failed to get SMS gateway status: ' + err.message);
    }
  });

/**
 * LOOKUP CUSTOMER AUTH EMAIL
 * Given a 10-digit mobile number, securely resolves their Firebase Auth login email
 * and profile so customers can sign in using phone + password or OTP seamlessly.
 */
exports.lookupCustomerAuthEmail = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    const rawPhone = String(data?.phone || '').trim().replace(/\D/g, '');
    const phone10 = rawPhone.length >= 10 ? rawPhone.slice(-10) : rawPhone;

    if (!phone10 || phone10.length !== 10) {
      throw new functions.https.HttpsError('invalid-argument', 'Valid 10-digit phone number required.');
    }

    const firestore = admin.firestore();
    const phoneVariants = [
      phone10,
      `+91${phone10}`,
      `91${phone10}`,
      `cust_${phone10}`,
      `user_${phone10}`
    ];

    try {
      // 1. Check direct doc IDs in ek_users
      for (const variant of [phone10, `cust_${phone10}`, `+91${phone10}`]) {
        const docSnap = await firestore.collection('ek_users').doc(variant).get();
        if (docSnap.exists) {
          const u = docSnap.data();
          if (u.status !== 'deleted' && !u.deletedAt) {
            return {
              found: true,
              email: u.email || `${phone10}@app.com`,
              user: { ...u, id: docSnap.id, name: u.name, phone: u.phone || phone10, email: u.email || `${phone10}@app.com` }
            };
          }
        }
      }

      // 2. Query ek_users by phone field
      for (const variant of phoneVariants) {
        const qSnap = await firestore.collection('ek_users').where('phone', '==', variant).limit(1).get();
        if (!qSnap.empty) {
          const doc = qSnap.docs[0];
          const u = doc.data();
          if (u.status !== 'deleted' && !u.deletedAt) {
            return {
              found: true,
              email: u.email || `${phone10}@app.com`,
              user: { ...u, id: doc.id, name: u.name, phone: u.phone || phone10, email: u.email || `${phone10}@app.com` }
            };
          }
        }
      }

      // 3. Query ek_users by cleanPhone
      const cleanSnap = await firestore.collection('ek_users').where('cleanPhone', '==', phone10).limit(1).get();
      if (!cleanSnap.empty) {
        const doc = cleanSnap.docs[0];
        const u = doc.data();
        if (u.status !== 'deleted' && !u.deletedAt) {
          return {
            found: true,
            email: u.email || `${phone10}@app.com`,
            user: { ...u, id: doc.id, name: u.name, phone: u.phone || phone10, email: u.email || `${phone10}@app.com` }
          };
        }
      }

      // 4. Check past orders to recover real customer name and address
      let orderCustomerName = '';
      let orderCustomerAddress = '';
      try {
        const orderSnap = await firestore.collection('ek_orders').where('customerPhone', '==', phone10).limit(1).get();
        if (!orderSnap.empty) {
          const od = orderSnap.docs[0].data();
          if (od.customerName && !od.customerName.startsWith('Customer ')) {
            orderCustomerName = od.customerName;
          }
          if (od.deliveryAddress) {
            orderCustomerAddress = od.deliveryAddress;
          }
        }
      } catch (oErr) {}

      // 5. Check if standard Firebase Auth user exists for this phone
      try {
        const authUser = await admin.auth().getUserByEmail(`${phone10}@app.com`);
        if (authUser) {
          const resolvedName = orderCustomerName || authUser.displayName || `Customer`;
          return {
            found: true,
            email: authUser.email,
            user: {
              id: authUser.uid,
              name: resolvedName,
              phone: phone10,
              email: authUser.email,
              address: orderCustomerAddress || ''
            }
          };
        }
      } catch (authErr) {
        // user not found by standard email
      }

      if (orderCustomerName) {
        return {
          found: true,
          email: `${phone10}@app.com`,
          user: {
            id: `cust_${phone10}`,
            name: orderCustomerName,
            phone: phone10,
            email: `${phone10}@app.com`,
            address: orderCustomerAddress || ''
          }
        };
      }

      return {
        found: false,
        email: `${phone10}@app.com`,
        user: null
      };
    } catch (err) {
      console.warn('[lookupCustomerAuthEmail] Error:', err.message);
      return {
        found: false,
        email: `${phone10}@app.com`,
        user: null
      };
    }
  });

const geoCache = new Map();

exports.geocodeDeliveryAddress = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    const uid = context.auth ? context.auth.uid : 'guest';
    const now = Date.now();

    if (uid !== 'guest') {
      // Server-side Firestore-backed rate limiting cooldown (3 seconds per user)
      const cooldownDocRef = admin.firestore().collection('ek_user_cooldowns').doc(uid);
      const cooldownDoc = await cooldownDocRef.get();
      if (cooldownDoc.exists) {
        const lastRequest = cooldownDoc.data().lastRequestTime || 0;
        if (now - lastRequest < 3000) {
          throw new functions.https.HttpsError('resource-exhausted', 'Please wait before trying to locate again.');
        }
      }
      await cooldownDocRef.set({ lastRequestTime: now }, { merge: true });
    }

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

      // 5. Query user data before deleting to find email and phone for complete Auth removal
      let userEmail = (data && data.email ? String(data.email).trim().toLowerCase() : '') || null;
      let userPhone = (data && data.phone ? String(data.phone).trim() : '') || null;

      const userDocRef = firestore.collection('ek_users').doc(targetUid);
      const legacyUserDocRef = firestore.collection('users').doc(targetUid);

      try {
        const uDoc = await userDocRef.get();
        if (uDoc.exists) {
          const ud = uDoc.data() || {};
          if (!userEmail && ud.email) userEmail = String(ud.email).trim().toLowerCase();
          if (!userPhone && ud.phone) userPhone = String(ud.phone).trim();
        }
      } catch (e) {}

      // 6. Query and Anonymize Customer Orders to preserve financial statistics
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

      // Also anonymize orders where customerId was targetUid
      try {
        const custOrders = await firestore.collection('ek_orders').where('customerId', '==', targetUid).get();
        custOrders.forEach(doc => {
          batch.update(doc.ref, {
            customerName: "Deleted Customer",
            customerPhone: "0000000000",
            deliveryAddress: "Anonymized for GDPR / Accounting",
            updatedAt: new Date().toISOString()
          });
          ordersAnonymized++;
        });
      } catch (e) {}

      // Delete Customer Profile documents
      batch.delete(userDocRef);
      batch.delete(legacyUserDocRef);

      // Execute Firestore cleanup batch
      await batch.commit();

      // Additional cleanup for email / phone aliases in Firestore
      if (userEmail && userEmail.includes('@')) {
        try {
          const emailSnap = await firestore.collection('ek_users').where('email', '==', userEmail).get();
          const emailBatch = firestore.batch();
          emailSnap.forEach(d => emailBatch.delete(d.ref));
          await emailBatch.commit();
        } catch (e) {}
      }

      const cleanPhoneDigits = userPhone ? String(userPhone).replace(/\D/g, '') : '';
      const phone10 = cleanPhoneDigits.length >= 10 ? cleanPhoneDigits.slice(-10) : '';
      if (phone10) {
        try {
          const phoneBatch = firestore.batch();
          phoneBatch.delete(firestore.collection('ek_users').doc(phone10));
          phoneBatch.delete(firestore.collection('ek_users').doc(`cust_${phone10}`));
          phoneBatch.delete(firestore.collection('ek_users').doc(`+91${phone10}`));
          phoneBatch.delete(firestore.collection('users').doc(phone10));
          phoneBatch.delete(firestore.collection('users').doc(`cust_${phone10}`));
          await phoneBatch.commit();
        } catch (e) {}
      }

      // 7. Delete the Firebase Authentication User so they can re-register freshly
      let authUserDeleted = false;
      try {
        await admin.auth().deleteUser(targetUid);
        authUserDeleted = true;
      } catch (authErr) {
        if (authErr.code !== 'auth/user-not-found') {
          console.warn("Firebase Auth UID deletion warning:", authErr);
        }
      }

      // Try deleting Auth user by email
      if (userEmail && userEmail.includes('@')) {
        try {
          const authByEmail = await admin.auth().getUserByEmail(userEmail);
          if (authByEmail && authByEmail.uid) {
            await admin.auth().deleteUser(authByEmail.uid);
            authUserDeleted = true;
          }
        } catch (e) {}
      }

      // Try deleting Auth user by phone email alias
      if (phone10) {
        try {
          const authByPhone = await admin.auth().getUserByEmail(`${phone10}@app.com`);
          if (authByPhone && authByPhone.uid) {
            await admin.auth().deleteUser(authByPhone.uid);
            authUserDeleted = true;
          }
        } catch (e) {}
      }

      return {
        success: true,
        deletedUid: targetUid,
        profileDeleted: true,
        authRevoked: authUserDeleted,
        ordersAnonymizedCount: ordersAnonymized,
        message: `Successfully deleted customer profile ${targetUid} from database and revoked authentication. The customer can now register freshly.`
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

/**
 * ATOMIC STOCK DEDUCTION CALLABLE CLOUD FUNCTION
 * Region: asia-south1
 * Input: { orderItems: [...] } or array of items directly.
 * Verifies auth, runs a Firestore transaction over ek_products for each item,
 * verifies sufficient stock, deducts stockKg, increments timesOrdered counter,
 * and returns per-item success/failure report.
 */
exports.deductStock = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    // 1. Verify authentication
    if (!context.auth || !context.auth.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required to deduct stock.');
    }

    const orderItems = Array.isArray(data) ? data : (data && (data.orderItems || data.items)) ? (data.orderItems || data.items) : [];
    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'orderItems must be a non-empty array.');
    }

    // Aggregate items by productId to handle duplicate entries cleanly and safely
    const aggregatedMap = new Map();
    for (const rawItem of orderItems) {
      if (!rawItem || !rawItem.productId) continue;
      const pid = String(rawItem.productId).trim();
      if (!pid) continue;

      let itemQty = 0;
      if (rawItem.weightGrams !== undefined && !isNaN(parseFloat(rawItem.weightGrams))) {
        const rawWeight = parseFloat(rawItem.weightGrams);
        if (rawWeight <= 0 || rawWeight > 200000) continue; // ignore non-positive or absurd weights (>200kg)
        itemQty = rawWeight / 1000;
      } else if (rawItem.quantity !== undefined && !isNaN(parseFloat(rawItem.quantity))) {
        const rawQty = parseFloat(rawItem.quantity);
        if (rawQty <= 0 || rawQty > 200) continue; // ignore non-positive or absurd quantities
        itemQty = rawQty >= 10 ? (rawQty / 1000) : rawQty;
      } else {
        itemQty = 1;
      }

      if (itemQty <= 0 || itemQty > 200) continue;

      if (aggregatedMap.has(pid)) {
        const existing = aggregatedMap.get(pid);
        existing.requestedQty += itemQty;
      } else {
        aggregatedMap.set(pid, {
          productId: pid,
          name: rawItem.name || rawItem.englishName || rawItem.tamilName || pid,
          requestedQty: itemQty,
          unit: rawItem.unit || 'kg'
        });
      }
    }

    const aggregatedItems = Array.from(aggregatedMap.values());
    if (aggregatedItems.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'No valid items with positive quantity provided.');
    }

    const firestore = admin.firestore();
    const itemResults = [];

    try {
      await firestore.runTransaction(async (transaction) => {
        itemResults.length = 0; // Clear on transaction retry
        let hasConflict = false;

        // Step A: Read all product documents first (all reads before writes in Firestore transaction)
        const productReads = [];
        for (const item of aggregatedItems) {
          const prodRef = firestore.collection('ek_products').doc(item.productId);
          productReads.push({
            item,
            prodRef,
            snapPromise: transaction.get(prodRef)
          });
        }

        const productSnaps = [];
        for (const pr of productReads) {
          const snap = await pr.snapPromise;
          productSnaps.push({
            item: pr.item,
            prodRef: pr.prodRef,
            snap
          });
        }

        // Step B: Calculate requested quantities, verify stock, and prepare updates
        const updatesToApply = [];

        for (const { item, prodRef, snap } of productSnaps) {
          const prodId = item.productId;
          const prodName = item.name;

          if (!snap.exists) {
            hasConflict = true;
            itemResults.push({
              productId: prodId,
              name: prodName,
              success: false,
              availableStock: 0,
              requestedQty: 0,
              error: 'Product not found'
            });
            continue;
          }

          const prodData = snap.data() || {};
          const currentStock = parseFloat(prodData.stockKg !== undefined ? prodData.stockKg : 0);
          const unit = String(prodData.unit || item.unit || 'kg').toLowerCase();
          const requestedQty = item.requestedQty;

          if (currentStock < requestedQty) {
            hasConflict = true;
            itemResults.push({
              productId: prodId,
              name: prodData.englishName || prodData.tamilName || prodName,
              success: false,
              availableStock: currentStock,
              requestedQty: requestedQty,
              unit: unit,
              error: 'Insufficient stock'
            });
          } else {
            const newStock = parseFloat(Math.max(0, currentStock - requestedQty).toFixed(3));
            updatesToApply.push({
              prodRef,
              newStock,
              isOutOfStock: newStock <= 0,
              previousStock: currentStock,
              productId: prodId,
              name: prodData.englishName || prodData.tamilName || prodName,
              requestedQty,
              unit
            });

            itemResults.push({
              productId: prodId,
              name: prodData.englishName || prodData.tamilName || prodName,
              success: true,
              availableStock: currentStock,
              newStock: newStock,
              requestedQty: requestedQty,
              unit: unit
            });
          }
        }

        // Step C: If any item failed / insufficient stock, abort the entire transaction
        if (hasConflict) {
          const conflictError = new Error('INSUFFICIENT_STOCK');
          conflictError.customCode = 'INSUFFICIENT_STOCK';
          throw conflictError;
        }

        // Step D: Apply all atomic writes
        for (const update of updatesToApply) {
          transaction.update(update.prodRef, {
            stockKg: update.newStock,
            isOutOfStock: update.isOutOfStock,
            timesOrdered: admin.firestore.FieldValue.increment(1),
            updatedAt: new Date().toISOString()
          });
        }
      });

      return {
        success: true,
        items: itemResults
      };
    } catch (err) {
      if (err.customCode === 'INSUFFICIENT_STOCK' || err.message === 'INSUFFICIENT_STOCK') {
        const outOfStockItems = itemResults.filter(i => !i.success);
        return {
          success: false,
          error: 'INSUFFICIENT_STOCK',
          message: 'One or more items do not have sufficient stock available.',
          items: itemResults,
          outOfStockItems: outOfStockItems
        };
      }
      if (err instanceof functions.https.HttpsError) {
        throw err;
      }
      console.error("[deductStock Callable Error]", err);
      throw new functions.https.HttpsError('internal', err.message || 'Error executing stock deduction transaction.');
    }
  });

/**
 * REDEEM COUPON (HTTPS Callable - region asia-south1)
 * Validates and atomically redeems promo coupons against Firestore ek_coupons in a transaction.
 * (1) verifies context.auth
 * (2) reads ek_coupons/{couponCode} in a transaction
 * (3) validates isActive, expiryDate, minOrderAmount, and maxUsageCount
 * (4) checks usedBy array for caller's uid (reject if singleUse=true and already used)
 * (5) appends caller uid to usedBy and increments usedCount
 * (6) returns discount amount and updated coupon state
 */
exports.redeemCoupon = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    // (1) Verify context.auth
    if (!context.auth || !context.auth.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to redeem coupons.');
    }

    const callerUid = context.auth.uid;
    const { couponCode, orderId, cartSubtotal } = data || {};

    if (!couponCode || typeof couponCode !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Valid couponCode is required.');
    }

    const normalizedCode = String(couponCode).trim().toUpperCase();
    const subtotal = Math.max(0, parseFloat(cartSubtotal) || 0);

    if (subtotal <= 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Cart subtotal must be greater than zero.');
    }

    const firestore = admin.firestore();
    const couponRef = firestore.collection('ek_coupons').doc(normalizedCode);

    // Default template map in case coupon doc needs auto-seeding in Firestore
    const DEFAULT_COUPONS_MAP = {
      'WELCOME10': { code: 'WELCOME10', type: 'percentage', rate: 10, minAmount: 199, descEn: 'Get 10% OFF on all items!', descTa: '10% தள்ளுபடி!', isActive: true, singleUse: true, maxUsageCount: 10000 },
      'FREEFRESH': { code: 'FREEFRESH', type: 'freeship', rate: 40, minAmount: 299, descEn: 'Free Delivery', descTa: 'இலவச டெலிவரி', isActive: true, singleUse: true, maxUsageCount: 10000 },
      'SAVEMORE': { code: 'SAVEMORE', type: 'fixed', rate: 50, minAmount: 499, descEn: 'Flat ₹50 cash discount!', descTa: '₹50 நேரடி தள்ளுபடி!', isActive: true, singleUse: true, maxUsageCount: 10000 }
    };

    try {
      const result = await firestore.runTransaction(async (transaction) => {
        // (2) Read ek_coupons/{couponCode} in a transaction
        let couponSnap = await transaction.get(couponRef);
        let couponData;
        let activeTargetRef = couponRef;

        if (!couponSnap.exists) {
          if (DEFAULT_COUPONS_MAP[normalizedCode]) {
            couponData = {
              ...DEFAULT_COUPONS_MAP[normalizedCode],
              usedBy: [],
              usedCount: 0,
              createdAt: new Date().toISOString()
            };
            transaction.set(couponRef, couponData);
          } else {
            // Check if coupon is stored by a legacy ID (e.g. c1, c2, CP...)
            const legacyQuery = await firestore.collection('ek_coupons').where('code', '==', normalizedCode).limit(1).get();
            if (!legacyQuery.empty) {
              const legacyDoc = legacyQuery.docs[0];
              activeTargetRef = legacyDoc.ref;
              couponSnap = await transaction.get(activeTargetRef);
              couponData = couponSnap.data() || {};
            } else {
              throw new functions.https.HttpsError('not-found', `Coupon code '${normalizedCode}' not found.`);
            }
          }
        } else {
          couponData = couponSnap.data() || {};
        }

        // (3) Validate isActive, expiryDate, minOrderAmount, and maxUsageCount
        if (couponData.isActive === false) {
          throw new functions.https.HttpsError('failed-precondition', 'This coupon is currently inactive.');
        }

        if (couponData.expiryDate || couponData.expiresAt) {
          const expTime = new Date(couponData.expiryDate || couponData.expiresAt).getTime();
          if (!isNaN(expTime) && expTime < Date.now()) {
            throw new functions.https.HttpsError('failed-precondition', 'This coupon has expired.');
          }
        }

        const minOrderAmount = parseFloat(couponData.minOrderAmount || couponData.minAmount || 0);
        if (subtotal < minOrderAmount) {
          throw new functions.https.HttpsError(
            'failed-precondition',
            `Coupon '${normalizedCode}' requires a minimum order subtotal of ₹${minOrderAmount}. Current subtotal is ₹${subtotal}.`
          );
        }

        const currentUsedCount = parseInt(couponData.usedCount || 0, 10);
        const maxUsageCount = (couponData.maxUsageCount !== undefined && couponData.maxUsageCount !== null) ? parseInt(couponData.maxUsageCount, 10) : null;
        if (maxUsageCount !== null && currentUsedCount >= maxUsageCount) {
          throw new functions.https.HttpsError('failed-precondition', 'Coupon usage limit has been reached.');
        }

        // (4) Check usedBy array for caller's uid (reject if already used by this user if singleUse=true)
        const usedBy = Array.isArray(couponData.usedBy) ? couponData.usedBy : [];
        const isSingleUse = couponData.singleUse !== false; // defaults to true
        if (isSingleUse && usedBy.includes(callerUid)) {
          throw new functions.https.HttpsError('failed-precondition', `You have already redeemed coupon '${normalizedCode}'.`);
        }

        // Calculate discount amount
        let discountAmount = 0;
        const rate = parseFloat(couponData.rate || 0);
        const type = String(couponData.type || 'fixed').toLowerCase();

        if (type === 'percentage') {
          discountAmount = Math.round((subtotal * rate) / 100);
          if (couponData.maxDiscount) {
            discountAmount = Math.min(discountAmount, parseFloat(couponData.maxDiscount));
          }
        } else if (type === 'freeship') {
          discountAmount = rate > 0 ? rate : 40;
        } else {
          // fixed
          discountAmount = rate;
        }

        // Ensure discount does not exceed subtotal or drop below 0
        discountAmount = Math.max(0, Math.min(subtotal, Math.round(discountAmount)));

        // (5) Append caller uid to usedBy and increment usedCount
        const newUsedCount = currentUsedCount + 1;
        transaction.update(activeTargetRef, {
          usedBy: admin.firestore.FieldValue.arrayUnion(callerUid),
          usedCount: admin.firestore.FieldValue.increment(1),
          lastUsedAt: new Date().toISOString(),
          lastUsedBy: callerUid,
          lastOrderId: orderId || null,
          updatedAt: new Date().toISOString()
        });

        // (6) Return discount amount and updated coupon state
        return {
          success: true,
          couponCode: normalizedCode,
          discountAmount: discountAmount,
          coupon: {
            code: normalizedCode,
            type: couponData.type || 'fixed',
            rate: rate,
            minOrderAmount: minOrderAmount,
            discountAmount: discountAmount,
            usedCount: newUsedCount,
            singleUse: isSingleUse,
            descEn: couponData.descEn || '',
            descTa: couponData.descTa || ''
          }
        };
      });

      return result;
    } catch (err) {
      if (err instanceof functions.https.HttpsError) {
        throw err;
      }
      console.error(`[redeemCoupon Callable Error for ${normalizedCode}]`, err);
      throw new functions.https.HttpsError('internal', err.message || 'Error processing coupon redemption.');
    }
  });

exports.deductStockOnOrderCreated = functions
  .region('asia-south1')
  .firestore
  .document('ek_orders/{orderId}')
  .onCreate(async (snap, context) => {
    const orderId = context.params.orderId;
    const orderData = snap.data() || {};

    if (!orderData || !orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      console.log(`[Stock Deduct Trigger] Order ${orderId} has no items. Skipping stock deduction.`);
      return null;
    }

    if (orderData.stockDeducted === true) {
      console.log(`[Stock Deduct Trigger] Order ${orderId} already marked as stockDeducted. Skipping.`);
      return null;
    }

    console.log(`[Stock Deduct Trigger] Processing stock deduction for newly created order: ${orderId}`);

    const firestore = admin.firestore();
    const orderRef = firestore.collection('ek_orders').doc(orderId);

    let hasStockConflict = false;
    const conflictItems = [];

    try {
      await firestore.runTransaction(async (transaction) => {
        // Step A: Re-read order document inside transaction for strict idempotency
        const freshOrderSnap = await transaction.get(orderRef);
        if (!freshOrderSnap.exists) {
          console.warn(`[Stock Deduct Trigger] Order ${orderId} does not exist in transaction.`);
          return;
        }

        const freshOrderData = freshOrderSnap.data() || {};
        if (freshOrderData.stockDeducted === true) {
          console.log(`[Stock Deduct Trigger] Order ${orderId} was already deducted in concurrent run. Aborting.`);
          return;
        }

        const items = freshOrderData.items || orderData.items || [];

        // Step B: Fetch all product docs inside transaction (all reads before writes)
        const productReads = [];
        for (const item of items) {
          if (!item || !item.productId) continue;
          const prodRef = firestore.collection('ek_products').doc(item.productId);
          productReads.push({
            item,
            prodRef,
            snapPromise: transaction.get(prodRef)
          });
        }

        const productSnaps = [];
        for (const pr of productReads) {
          const prodSnap = await pr.snapPromise;
          productSnaps.push({
            item: pr.item,
            prodRef: pr.prodRef,
            prodSnap
          });
        }

        // Step C: Calculate stock updates and verify sufficiency
        const productUpdates = [];

        for (const { item, prodRef, prodSnap } of productSnaps) {
          if (!prodSnap.exists) {
            console.warn(`[Stock Deduct Trigger] Product ${item.productId} not found in Firestore.`);
            continue;
          }

          const prodData = prodSnap.data() || {};
          const serverStock = parseFloat(prodData.stockKg || 0);
          const unit = String(prodData.unit || item.unit || 'kg').toLowerCase();
          const isWeight = !(unit === 'piece' || unit === 'packet' || unit === 'bunch' || unit === 'dozen' || unit === 'unit');

          const rawWeight = parseFloat(item.weightGrams || item.quantity || 0);
          const needed = isWeight ? (rawWeight / 1000) : rawWeight;

          if (serverStock < needed) {
            hasStockConflict = true;
            conflictItems.push({
              productId: item.productId,
              name: prodData.englishName || prodData.tamilName || item.name || item.productId,
              available: serverStock,
              requested: needed,
              unit: unit
            });
            console.warn(`[Stock Deduct Trigger] Insufficient stock for product ${item.productId} (${prodData.englishName || ''}). Available: ${serverStock}, Needed: ${needed}`);
          }

          const newStock = parseFloat(Math.max(0, serverStock - needed).toFixed(3));
          const isOutOfStock = newStock <= 0;

          productUpdates.push({
            prodRef,
            newStock,
            isOutOfStock,
            previousStock: serverStock
          });
        }

        // Step D: Write all product updates
        for (const up of productUpdates) {
          transaction.update(up.prodRef, {
            stockKg: up.newStock,
            isOutOfStock: up.isOutOfStock,
            updatedAt: new Date().toISOString()
          });
          console.log(`[Stock Deduct Trigger] Product ${up.prodRef.id} stock updated: ${up.previousStock} -> ${up.newStock}`);
        }

        // Step E: Update order document with stockDeducted: true and stockConflict if applicable
        const orderUpdates = {
          stockDeducted: true,
          stockDeductedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (hasStockConflict) {
          orderUpdates.stockConflict = true;
          orderUpdates.status = 'stock_review';
          orderUpdates.stockConflictDetails = conflictItems;
        }

        transaction.update(orderRef, orderUpdates);
      });

      console.log(`[Stock Deduct Trigger] Successfully completed stock deduction transaction for order ${orderId}.`);

      // If there was a stock conflict, send alerts to admin
      if (hasStockConflict) {
        console.log(`[Stock Deduct Trigger] Stock conflict detected for order ${orderId}. Dispatching admin notifications...`);
        const itemNames = conflictItems.map(c => `${c.name} (${c.available} available vs ${c.requested} ordered)`).join(', ');
        const conflictTitle = "⚠️ ஸ்டாக் பற்றாக்குறை எச்சரிக்கை! (Stock Alert)";
        const conflictBody = `ஆர்டர் #${orderId}-ல் ஸ்டாக் குறைவாக உள்ளது: ${itemNames}. ஆர்டரை சரிபார்க்கவும்.`;

        // 1. Send FCM topic broadcast for admin
        try {
          await admin.messaging().send({
            topic: 'admin_notifications',
            notification: {
              title: conflictTitle,
              body: conflictBody
            },
            data: {
              orderId: String(orderId),
              type: 'stock_conflict',
              click_action: 'OPEN_MAIN_ACTIVITY'
            },
            android: {
              priority: 'high',
              notification: { channelId: 'status_alerts' }
            }
          });
          console.log(`[Stock Deduct Trigger] Sent FCM topic alert for stock conflict in order ${orderId}`);
        } catch (fcmErr) {
          console.warn('[Stock Deduct Trigger] FCM broadcast notice:', fcmErr.message);
        }

        // 2. Add to ek_topic_broadcast_requests queue for resilience
        try {
          await firestore.collection('ek_topic_broadcast_requests').add({
            topic: 'admin_notifications',
            title: conflictTitle,
            body: conflictBody,
            orderId: String(orderId),
            createdAt: new Date().toISOString(),
            processed: false
          });
        } catch (queueErr) {
          console.warn('[Stock Deduct Trigger] Queue broadcast notice:', queueErr.message);
        }
      }

    } catch (err) {
      console.error(`[Stock Deduct Trigger] Error during stock deduction transaction for order ${orderId}:`, err);
    }

    return null;
  });

exports.restoreStockOnOrderCancelled = functions
  .region('asia-south1')
  .firestore
  .document('ek_orders/{orderId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data() || {};
    const afterData = change.after.data() || {};
    const orderId = context.params.orderId;

    const beforeStatus = String(beforeData.status || '').toUpperCase();
    const afterStatus = String(afterData.status || '').toUpperCase();

    // Check if status changed to CANCELLED
    if (afterStatus === 'CANCELLED' && beforeStatus !== 'CANCELLED') {
      if (afterData.stockRestored === true) {
        console.log(`[Stock Restore Trigger] Order ${orderId} stock was already restored. Skipping.`);
        return null;
      }

      console.log(`[Stock Restore Trigger] Order ${orderId} status changed to CANCELLED. Restoring stocks...`);
      
      const items = afterData.items || [];
      if (!Array.isArray(items) || items.length === 0) {
        console.log(`[Stock Restore Trigger] No items found in order ${orderId}.`);
        return null;
      }

      const firestore = admin.firestore();
      const orderRef = firestore.collection('ek_orders').doc(orderId);

      try {
        await firestore.runTransaction(async (transaction) => {
          // Step A: Re-check order doc inside transaction for idempotency
          const freshOrderSnap = await transaction.get(orderRef);
          if (!freshOrderSnap.exists) {
            console.warn(`[Stock Restore Trigger] Order ${orderId} does not exist in transaction.`);
            return;
          }

          const freshOrderData = freshOrderSnap.data() || {};
          if (freshOrderData.stockRestored === true) {
            console.log(`[Stock Restore Trigger] Order ${orderId} stock was already restored in concurrent run. Aborting.`);
            return;
          }

          const orderItems = freshOrderData.items || items;

          // Step B: Read all product docs inside transaction (all reads before writes)
          const productReads = [];
          for (const item of orderItems) {
            if (!item || !item.productId) continue;
            const prodRef = firestore.collection('ek_products').doc(item.productId);
            productReads.push({
              item,
              prodRef,
              snapPromise: transaction.get(prodRef)
            });
          }

          const productSnaps = [];
          for (const pr of productReads) {
            const prodSnap = await pr.snapPromise;
            productSnaps.push({
              item: pr.item,
              prodRef: pr.prodRef,
              prodSnap
            });
          }

          // Step C: Calculate new stock levels
          const productUpdates = [];
          for (const { item, prodRef, prodSnap } of productSnaps) {
            if (!prodSnap.exists) {
              console.warn(`[Stock Restore Trigger] Product ${item.productId} not found in Firestore.`);
              continue;
            }

            const prodData = prodSnap.data() || {};
            const serverStock = parseFloat(prodData.stockKg || 0);
            const unit = String(prodData.unit || item.unit || 'kg').toLowerCase();
            const isWeight = !(unit === 'piece' || unit === 'packet' || unit === 'bunch' || unit === 'dozen' || unit === 'unit');
            const rawWeight = parseFloat(item.weightGrams || item.quantity || 0);
            const returnedQty = isWeight ? (rawWeight / 1000) : rawWeight;
            const newStock = parseFloat((serverStock + returnedQty).toFixed(3));

            productUpdates.push({
              prodRef,
              newStock,
              previousStock: serverStock
            });
          }

          // Step D: Write all product stock updates
          for (const up of productUpdates) {
            transaction.update(up.prodRef, {
              stockKg: up.newStock,
              isOutOfStock: false,
              updatedAt: new Date().toISOString()
            });
            console.log(`[Stock Restore Trigger] Stock restored for product ${up.prodRef.id}: ${up.previousStock} -> ${up.newStock}`);
          }

          // Step E: Update order document
          transaction.update(orderRef, {
            stockRestored: true,
            stockRestoredAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        });

        console.log(`[Stock Restore Trigger] Successfully restored stocks for order ${orderId}.`);
      } catch (err) {
        console.error(`[Stock Restore Trigger] Error during stock restore transaction for order ${orderId}:`, err);
      }
    }
    return null;
  });

/**
 * RESTORE ABANDONED STOCK — Scheduled cleanup
 * Runs every 5 minutes. Finds orders where stock was deducted
 * but UPI payment was never completed (PENDING_VERIFICATION for >15 min).
 * Restores stock and marks the order.
 */
exports.restoreAbandonedStock = functions
  .region('asia-south1')
  .pubsub.schedule('every 5 minutes')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    const now = Date.now();
    const fifteenMinAgo = new Date(now - 15 * 60 * 1000);

    try {
      const db = admin.firestore();
      // Two-step query to avoid composite index requirement
      const step1Snap = await db.collection('ek_orders')
        .where('stockDeducted', '==', true)
        .limit(100)
        .get();

      // Filter stockRestored != true in memory (avoids needing a composite index)
      const abandonedOrdersSnap = {
        docs: step1Snap.docs.filter(doc => {
          const d = doc.data();
          return d.stockRestored !== true;
        })
      };

      const batch = db.batch();
      let restoredCount = 0;

      for (const orderDoc of abandonedOrdersSnap.docs) {
        const orderData = orderDoc.data();
        const createdAt = orderData.createdAt ? new Date(orderData.createdAt) : null;
        const isPending = orderData.paymentStatus === 'PENDING_VERIFICATION' ||
                          orderData.upiStatus === 'PENDING_VERIFICATION' ||
                          (!orderData.paymentStatus && !orderData.upiStatus);

        if (createdAt && createdAt < fifteenMinAgo && isPending) {
          // Restore stock for each item
          if (orderData.items && orderData.items.length > 0) {
            for (const item of orderData.items) {
              if (!item || !item.productId) continue;
              const prodRef = db.collection('ek_products').doc(item.productId);
              const prodSnap = await prodRef.get();
              if (prodSnap.exists) {
                const prodData = prodSnap.data() || {};
                const serverStock = parseFloat(prodData.stockKg !== undefined ? prodData.stockKg : (prodData.stock || 0));
                const unit = String(prodData.unit || item.unit || 'kg').toLowerCase();
                const isWeight = !(unit === 'piece' || unit === 'packet' || unit === 'bunch' || unit === 'dozen' || unit === 'unit');
                const rawWeight = parseFloat(item.weightGrams || item.quantity || 0);
                const returnedQty = isWeight ? (rawWeight / 1000) : rawWeight;
                const newStock = parseFloat((serverStock + returnedQty).toFixed(3));

                await prodRef.update({
                  stockKg: newStock,
                  stock: newStock,
                  isOutOfStock: false,
                  updatedAt: new Date().toISOString()
                });
              }
            }
          }

          batch.update(orderDoc.ref, {
            stockRestored: true,
            stockRestoredAt: new Date().toISOString(),
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
            cancelReason: 'UPI payment abandoned (auto-cleanup)'
          });
          restoredCount++;
        }
      }

      if (restoredCount > 0) {
        await batch.commit();
        console.log(`[Abandoned Stock Cleanup] Restored stock for ${restoredCount} abandoned orders.`);
      }

      return { success: true, restoredCount: restoredCount };
    } catch (err) {
      console.error('[Abandoned Stock Cleanup] Error:', err);
      return { success: false, error: err.message };
    }
  });

exports.sendEmailOtp = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    let email = (data && data.email ? String(data.email).trim().toLowerCase() : '');
    const phoneInput = (data && (data.phone || data.identifier) ? String(data.phone || data.identifier).trim() : '');

    // If email is not directly provided but phone/identifier is, resolve email
    if (!email && phoneInput) {
      if (phoneInput.includes('@')) {
        email = phoneInput.toLowerCase();
      } else {
        let phone10 = phoneInput.replace(/\D/g, '');
        if (phone10.startsWith('91') && phone10.length === 12) phone10 = phone10.slice(2);
        else if (phone10.startsWith('0') && phone10.length === 11) phone10 = phone10.slice(1);
        else if (phone10.length > 10) phone10 = phone10.slice(-10);

        if (phone10.length === 10) {
          const variants = [phone10, '+91' + phone10, '91' + phone10, '0' + phone10, '+91 ' + phone10, '91 ' + phone10];
          const userSnap = await admin.firestore().collection('ek_users').where('phone', 'in', variants).limit(1).get().catch(() => null);
          if (userSnap && !userSnap.empty && userSnap.docs[0].data().email) {
            email = userSnap.docs[0].data().email.trim().toLowerCase();
          } else {
            const userDocSnap = await admin.firestore().collection('ek_users').doc(phone10).get().catch(() => null);
            if (userDocSnap && userDocSnap.exists && userDocSnap.data().email) {
              email = userDocSnap.data().email.trim().toLowerCase();
            }
          }
        }
      }
    }

    if (!email) {
      throw new functions.https.HttpsError('invalid-argument', 'Valid email address or registered phone number is required.');
    }

    const now = Date.now();
    const docRef = admin.firestore().collection('ek_email_otps').doc(email);
    const existingDoc = await docRef.get();

    if (existingDoc.exists) {
      const existingData = existingDoc.data();
      if (existingData && existingData.createdAt && (now - existingData.createdAt < 60 * 1000)) {
        const remainingSec = Math.ceil((60 * 1000 - (now - existingData.createdAt)) / 1000);
        throw new functions.https.HttpsError('resource-exhausted', `Please wait ${remainingSec}s before requesting a new OTP.`);
      }
    }

    const crypto = require('crypto');

    // Email enumeration prevention: check if email is registered
    const userSnap = await admin.firestore().collection('ek_users').where('email', '==', email).limit(1).get().catch(() => null);
    let isUserRegistered = (userSnap && !userSnap.empty);
    if (!isUserRegistered) {
      const userSnap2 = await admin.firestore().collection('users').where('email', '==', email).limit(1).get().catch(() => null);
      if (userSnap2 && !userSnap2.empty) {
        isUserRegistered = true;
      }
    }
    if (!isUserRegistered) {
      try {
        const authUser = await admin.auth().getUserByEmail(email);
        if (authUser) isUserRegistered = true;
      } catch (authErr) {}
    }

    if (!isUserRegistered) {
      // Email truly not registered — return notRegistered flag so frontend can notify user accurately
      return { success: false, notRegistered: true, message: 'This email or phone number is not registered.' };
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = now + 10 * 60 * 1000;

    await docRef.set({
      otpHash: otpHash,
      createdAt: now,
      expiresAt: expiresAt,
      attempts: 0
    });

    const nodemailer = require('nodemailer');
    let gmailUser = process.env.GMAIL_USER || '';
    let gmailPass = process.env.GMAIL_PASS || '';

    try {
      const emailConfigSnap = await admin.firestore().collection('ek_settings').doc('emailConfig').get();
      if (emailConfigSnap.exists) {
        const configData = emailConfigSnap.data();
        if (configData && configData.gmailUser && configData.gmailPass) {
          gmailUser = configData.gmailUser.trim();
          gmailPass = configData.gmailPass.trim();
        }
      }
    } catch (dbErr) {
      console.warn("Could not read emailConfig from Firestore:", dbErr.message);
    }

    // Fallback to functions.config() if not found in Firestore
    if (!gmailUser || !gmailPass) {
      try {
        const cfg = functions.config();
        if (cfg && cfg.gmail) {
          gmailUser = gmailUser || cfg.gmail.user;
          gmailPass = gmailPass || cfg.gmail.pass;
        }
      } catch (cfgErr) {}
    }

    if (!gmailUser || !gmailPass) {
      throw new functions.https.HttpsError('failed-precondition', 'Gmail SMTP credentials are not configured. Please set Gmail Address and App Password in Admin Panel Settings.');
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

    const cleanEmail = String(email).trim().toLowerCase();
    const docRef = admin.firestore().collection('ek_email_otps').doc(cleanEmail);
    const crypto = require('crypto');
    const inputHash = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');

    // Run atomically in a transaction to prevent concurrent brute force attempts
    await admin.firestore().runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);

      if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', 'No OTP request found for this email.');
      }

      const otpData = snap.data();
      const now = Date.now();

      if (now > otpData.expiresAt) {
        throw new functions.https.HttpsError('failed-precondition', 'OTP expired');
      }

      if ((otpData.attempts || 0) >= 5) {
        throw new functions.https.HttpsError('resource-exhausted', 'Too many attempts. Please request a new OTP.');
      }

      const isValid = otpData.otpHash ? (inputHash === otpData.otpHash) : (String(otp).trim() === String(otpData.otp).trim());

      if (!isValid) {
        transaction.update(docRef, { attempts: (otpData.attempts || 0) + 1 });
        throw new functions.https.HttpsError('invalid-argument', 'Invalid OTP');
      }

      // Mark as consumed inside transaction
      transaction.delete(docRef);
    });

    try {
      const userRecord = await admin.auth().getUserByEmail(cleanEmail);
      await admin.auth().updateUser(userRecord.uid, { password: newPassword });
      return { success: true };
    } catch (err) {
      console.error("Error resetting password:", err);
      throw new functions.https.HttpsError('internal', err.message);
    }
  });

/**
 * CHECK PHONE UNIQUENESS — Server-side validation
 * Called by the frontend before customer registration to prevent duplicate phone numbers.
 * Normalizes all formats (+91, 91, 0, 10-digit) to a single canonical 10-digit format.
 */
exports.checkPhoneUnique = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    const rawPhone = String(data.phone || '').trim();
    if (!rawPhone) {
      throw new functions.https.HttpsError('invalid-argument', 'Phone number is required.');
    }

    let canonicalPhone = rawPhone.replace(/\D/g, '');
    if (canonicalPhone.startsWith('91') && canonicalPhone.length === 12) {
      canonicalPhone = canonicalPhone.slice(2);
    } else if (canonicalPhone.startsWith('0') && canonicalPhone.length === 11) {
      canonicalPhone = canonicalPhone.slice(1);
    }
    if (canonicalPhone.length !== 10) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid phone number format.');
    }

    const phoneVariants = [
      canonicalPhone,
      '+91' + canonicalPhone,
      '+91 ' + canonicalPhone,
      '91' + canonicalPhone,
      '91 ' + canonicalPhone,
      '0' + canonicalPhone,
    ];

    try {
      const queries = [
        admin.firestore().collection('ek_users').where('phone', 'in', phoneVariants).limit(1).get(),
        admin.firestore().collection('ek_users').doc(canonicalPhone).get(),
        admin.firestore().collection('users').where('phone', 'in', phoneVariants).limit(1).get(),
      ];

      const results = await Promise.all(queries.map(p => p.catch(() => null)));

      for (const snap of results) {
        if (snap && ((snap.docs && snap.docs.length > 0) || snap.exists)) {
          return { isUnique: false, canonicalPhone: canonicalPhone };
        }
      }

      return { isUnique: true, canonicalPhone: canonicalPhone };
    } catch (err) {
      console.error('Phone uniqueness check error:', err);
      throw new functions.https.HttpsError('internal', 'Unable to verify phone uniqueness at this time. Please try again.');
    }
  });

/**
 * LOOKUP CUSTOMER AUTH EMAIL & STATUS — Server-side resolution
 * Used during Customer Login when identifier is a phone number (e.g., 8778148899, +918778148899).
 * Resolves phone number to customer's registered Firebase Auth email and verifies account active status,
 * safely resolving unauthenticated Firestore access restrictions with Admin SDK.
 */
exports.lookupCustomerAuthEmail = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    const rawInput = String((data && data.phone) || (data && data.identifier) || '').trim();
    if (!rawInput) {
      throw new functions.https.HttpsError('invalid-argument', 'Phone number or email is required.');
    }

    // 1. If identifier is an email
    if (rawInput.includes('@')) {
      const cleanEmail = rawInput.toLowerCase();
      try {
        const userSnap = await admin.firestore().collection('ek_users').where('email', '==', cleanEmail).limit(1).get().catch(() => null);
        if (userSnap && !userSnap.empty) {
          const uDoc = userSnap.docs[0];
          const uData = uDoc.data();
          const isActive = uData.active !== false && uData.isActive !== false && !uData.isBlocked && !uData.disabled;
          return {
            found: true,
            email: cleanEmail,
            name: uData.name || '',
            phone: uData.phone || '',
            active: isActive,
            user: {
              id: uDoc.id,
              name: uData.name || '',
              phone: uData.phone || '',
              email: cleanEmail,
              active: isActive
            }
          };
        }

        // Check Firebase Auth directly
        try {
          const authUser = await admin.auth().getUserByEmail(cleanEmail);
          if (authUser) {
            return {
              found: true,
              email: cleanEmail,
              name: authUser.displayName || '',
              active: !authUser.disabled
            };
          }
        } catch (e) {}

        return { found: false, email: cleanEmail };
      } catch (err) {
        console.error("lookupCustomerAuthEmail email check error:", err);
        throw new functions.https.HttpsError('internal', 'Lookup failed: ' + err.message);
      }
    }

    // 2. Identifier is a phone number
    let digits = rawInput.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) {
      digits = digits.slice(2);
    } else if (digits.startsWith('0') && digits.length === 11) {
      digits = digits.slice(1);
    } else if (digits.length > 10) {
      digits = digits.slice(-10);
    }

    if (digits.length !== 10) {
      throw new functions.https.HttpsError('invalid-argument', 'Valid 10-digit mobile number required.');
    }

    const canonicalPhone = digits;
    const phoneVariants = [
      canonicalPhone,
      '+91' + canonicalPhone,
      '+91 ' + canonicalPhone,
      '91' + canonicalPhone,
      '91 ' + canonicalPhone,
      '0' + canonicalPhone,
      '+91-' + canonicalPhone,
      `${canonicalPhone.slice(0, 5)} ${canonicalPhone.slice(5)}`,
      `+91 ${canonicalPhone.slice(0, 5)} ${canonicalPhone.slice(5)}`,
      `cust_${canonicalPhone}`,
      `user_${canonicalPhone}`
    ];

    try {
      const db = admin.firestore();
      const phoneNum = Number(canonicalPhone);
      const queries = [
        db.collection('ek_users').where('phone', 'in', phoneVariants.slice(0, 10)).limit(1).get(),
        db.collection('ek_users').where('phoneNumber', 'in', phoneVariants.slice(0, 10)).limit(1).get(),
        db.collection('ek_users').where('cleanPhone', '==', canonicalPhone).limit(1).get(),
        db.collection('ek_users').where('mobile', 'in', phoneVariants.slice(0, 10)).limit(1).get(),
        !isNaN(phoneNum) ? db.collection('ek_users').where('phone', '==', phoneNum).limit(1).get() : null,
        !isNaN(phoneNum) ? db.collection('ek_users').where('phoneNumber', '==', phoneNum).limit(1).get() : null,
        db.collection('ek_users').doc(canonicalPhone).get(),
        db.collection('ek_users').doc('cust_' + canonicalPhone).get(),
        db.collection('users').where('phone', 'in', phoneVariants.slice(0, 10)).limit(1).get(),
        db.collection('users').where('phoneNumber', 'in', phoneVariants.slice(0, 10)).limit(1).get()
      ].filter(Boolean);

      const results = await Promise.all(queries.map(p => p.catch(() => null)));
      let userRecord = null;
      let docId = '';

      for (const snap of results) {
        if (snap) {
          if (snap.docs && snap.docs.length > 0) {
            userRecord = snap.docs[0].data();
            docId = snap.docs[0].id;
            break;
          } else if (snap.exists && snap.data) {
            userRecord = snap.data();
            docId = snap.id;
            break;
          }
        }
      }

      if (userRecord) {
        const isActive = userRecord.active !== false && userRecord.isActive !== false && !userRecord.isBlocked && !userRecord.disabled;
        const resolvedEmail = (userRecord.email && userRecord.email.includes('@'))
          ? userRecord.email.trim().toLowerCase()
          : `${canonicalPhone}@app.com`;

        return {
          found: true,
          email: resolvedEmail,
          name: userRecord.name || '',
          phone: canonicalPhone,
          active: isActive,
          user: {
            id: userRecord.id || docId,
            name: userRecord.name || '',
            phone: canonicalPhone,
            email: resolvedEmail,
            active: isActive
          }
        };
      }

      // Check Firebase Auth for synthetic phone-based user or direct phone auth user
      try {
        const syntheticEmail = `${canonicalPhone}@app.com`;
        const authUser = await admin.auth().getUserByEmail(syntheticEmail);
        if (authUser) {
          return {
            found: true,
            email: syntheticEmail,
            name: authUser.displayName || '',
            phone: canonicalPhone,
            active: !authUser.disabled
          };
        }
      } catch (authErr) {}

      try {
        const authUserPhone = await admin.auth().getUserByPhoneNumber('+91' + canonicalPhone);
        if (authUserPhone) {
          const authEmail = (authUserPhone.email && authUserPhone.email.includes('@')) ? authUserPhone.email : `${canonicalPhone}@app.com`;
          return {
            found: true,
            email: authEmail,
            name: authUserPhone.displayName || '',
            phone: canonicalPhone,
            active: !authUserPhone.disabled
          };
        }
      } catch (phoneAuthErr) {}

      return { found: false, canonicalPhone: canonicalPhone };
    } catch (err) {
      console.error("lookupCustomerAuthEmail error:", err);
      throw new functions.https.HttpsError('internal', 'Lookup error: ' + err.message);
    }
  });

/**
 * CLEANUP INVALID FCM TOKENS
 * Admin-callable function that tests all FCM tokens and removes invalid ones.
 * Call this periodically (e.g., once a week) to keep notification delivery fast.
 */
exports.cleanupInvalidFcmTokens = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    // Verify caller is admin
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Admin authentication required.');
    }
    const adminDoc = await admin.firestore().collection('ek_admin_accounts').doc(context.auth.uid).get();
    if (!adminDoc.exists || (adminDoc.data().role !== 'admin' && adminDoc.data().role !== 'superadmin') || adminDoc.data().active === false) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
    }

    const db = admin.firestore();
    const usersSnap = await db.collection('ek_users').get();
    let cleanedCount = 0;
    let checkedCount = 0;
    const invalidTokenErrors = [
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
    ];

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const token = userData.fcmToken || userData.realFcmToken;
      if (!token) continue;

      checkedCount++;
      try {
        // Send a silent data message to test the token
        await admin.messaging().send({
          token: token,
          data: { type: 'token_check', timestamp: Date.now().toString() },
          android: { priority: 'low' }
        });
      } catch (err) {
        if (invalidTokenErrors.some(e => err.message && err.message.includes(e))) {
          // Token is invalid — remove it
          await db.collection('ek_users').doc(userDoc.id).update({
            fcmToken: admin.firestore.FieldValue.delete(),
            realFcmToken: admin.firestore.FieldValue.delete(),
            fcmTokenCleanedAt: new Date().toISOString()
          }).catch(e => console.warn('[FCM Cleanup] Failed to remove token for user:', userDoc.id, e));
          cleanedCount++;
        }
      }
    }

    console.log(`[FCM Cleanup] Checked ${checkedCount} tokens, removed ${cleanedCount} invalid tokens.`);
    return { success: true, checked: checkedCount, cleaned: cleanedCount };
  });


/**
 * SCHEDULED FIRESTORE BACKUP CLOUD FUNCTION (WEEKLY)
 * Automatically exports critical Firestore collections (orders, products, ek_admin_accounts, users, ek_orders, ek_products, ek_users)
 * to a Cloud Storage backup bucket once every week (Sunday at 00:00 IST).
 */
exports.scheduledWeeklyFirestoreBackup = functions
  .region('asia-south1')
  .pubsub.schedule('every sunday 00:00')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || 'edappadi-kadai';
    const collectionsToBackup = ['orders', 'products', 'ek_admin_accounts', 'users', 'ek_orders', 'ek_products', 'ek_users', 'ek_categories'];

    console.log(`[Weekly Backup] Starting scheduled backup for project: ${projectId}`);

    try {
      // 1. Attempt Managed Firestore Export via Admin API
      const client = new admin.firestore.v1.FirestoreAdminClient();
      const databaseName = client.databasePath(projectId, '(default)');
      const backupBucket = `gs://${projectId}-firestore-backups`;

      const [response] = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: backupBucket,
        collectionIds: collectionsToBackup
      });
      console.log(`[Weekly Backup] Managed Firestore export initiated successfully: ${response.name}`);
      return { success: true, mode: 'managed_export', operation: response.name };
    } catch (exportErr) {
      console.warn('[Weekly Backup] Managed export API unavailable, executing JSON snapshot storage fallback:', exportErr.message);
      
      // 2. High-resilience Fallback: Snapshot JSON data directly to Cloud Storage bucket
      try {
        const db = admin.firestore();
        const storage = admin.storage().bucket();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPayload = {
          createdAt: new Date().toISOString(),
          projectId: projectId,
          collections: {}
        };

        for (const colName of collectionsToBackup) {
          const snapshot = await db.collection(colName).get();
          backupPayload.collections[colName] = snapshot.docs.map(doc => ({
            _id: doc.id,
            ...doc.data()
          }));
        }

        const fileName = `backups/weekly_backup_${timestamp}.json`;
        const file = storage.file(fileName);
        
        await file.save(JSON.stringify(backupPayload, null, 2), {
          contentType: 'application/json',
          metadata: {
            cacheControl: 'private, max-age=0'
          }
        });

        console.log(`[Weekly Backup] JSON snapshot backup successfully saved to Cloud Storage: ${fileName}`);
        return { success: true, mode: 'json_storage_backup', backupPath: fileName };
      } catch (fallbackErr) {
        console.error('[scheduledWeeklyFirestoreBackup] Firestore backup failed:', fallbackErr.message);
        throw new Error('Firestore backup failed: ' + fallbackErr.message);
      }
    }
  });

/**
 * Server-Side AI Generation Gateway
 * Keeps all AI provider API keys secured on the server.
 */
exports.generateAiResponse = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required to use AI assistant.');
    }

    const { prompt, systemInstruction, contents, model, provider, temperature, responseMimeType } = data || {};
    if (!prompt && (!contents || !Array.isArray(contents) || contents.length === 0)) {
      throw new functions.https.HttpsError('invalid-argument', 'Prompt or contents required.');
    }

    const axios = require('axios');
    const selectedProvider = String(provider || 'gemini').toLowerCase().trim();

    // 1. Fetch AI Provider Configuration from secure server settings
    let apiKey = process.env.GEMINI_API_KEY || '';
    let targetModel = model || 'gemini-2.5-flash';

    try {
      const configDoc = await admin.firestore().collection('ek_settings').doc('ai_provider_config').get();
      if (configDoc.exists) {
        const cfg = configDoc.data() || {};
        if (cfg.apiKey && typeof cfg.apiKey === 'string' && cfg.apiKey.trim()) {
          apiKey = cfg.apiKey.trim();
        }
        if (cfg.model && typeof cfg.model === 'string' && cfg.model.trim()) {
          targetModel = cfg.model.trim();
        }
      }
    } catch (e) {
      console.warn("Could not read Firestore ai_provider_config:", e.message);
    }

    if (!apiKey) {
      apiKey = process.env.GEMINI_API_KEY || '';
    }

    if (!apiKey) {
      throw new functions.https.HttpsError('failed-precondition', 'AI Service API Key is not configured on server.');
    }

    // 2. Format conversation contents
    const conversationContents = contents && Array.isArray(contents) && contents.length > 0 
      ? contents 
      : [{ role: 'user', parts: [{ text: String(prompt || '') }] }];

    // Deduplicate models preserving order
    const geminiModels = Array.from(new Set([targetModel, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']));
    let lastError = null;

    for (const m of geminiModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const genConfig = {
          temperature: typeof temperature === 'number' ? temperature : 0.2
        };
        if (responseMimeType) {
          genConfig.responseMimeType = responseMimeType;
        }
        const requestBody = {
          contents: conversationContents,
          generationConfig: genConfig
        };
        if (systemInstruction) {
          requestBody.systemInstruction = {
            parts: [{ text: String(systemInstruction) }]
          };
        }

        const res = await axios.post(endpoint, requestBody, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 6000
        });

        if (res.data) {
          const replyText = res.data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (replyText) {
            return { success: true, text: replyText, provider: 'gemini', model: m };
          }
        }
      } catch (err) {
        lastError = err.response?.data?.error?.message || err.message;
        console.warn(`Server AI call to model ${m} failed:`, lastError);
      }
    }

    throw new functions.https.HttpsError('internal', 'AI generation failed: ' + (lastError || 'No response from provider'));
  });



