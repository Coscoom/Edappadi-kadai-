const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendFcmOnQueue = functions
  .region('asia-south1')
  .firestore
  .document('ek_fcm_queue/{docId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    if (!data.targetToken || data.processed) return;
    const message = {
      token: data.targetToken,
      notification: { title: data.title, body: data.body },
      data: {
        orderId: data.orderId,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        click_action: 'OPEN_MAIN_ACTIVITY'
      },
      android: { priority: 'high',
        notification: { channelId: 'status_alerts' }
      }
    };
    try {
      await admin.messaging().send(message);
      await snap.ref.update({ processed: true,
        sentAt: new Date().toISOString() });
    } catch (err) {
      await snap.ref.update({ processed: false,
        error: err.message });
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
    const settingsDoc = await admin.firestore().collection('ek_settings').doc('global_config').get();
    const settings = settingsDoc.data() || {};
    const apiKey = settings.smsApiKey;
    if (!apiKey) {
      throw new functions.https.HttpsError('failed-precondition', 'SMS API key not configured.');
    }
    let cleanPhone = String(phoneNumber).replace(/\s+/g, '');
    if (cleanPhone.length === 10 && !cleanPhone.startsWith('+')) {
      cleanPhone = cleanPhone;
    }
    const axios = require('axios');
    const targetUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&variables_values=${otpCode}&route=otp&numbers=${cleanPhone.replace(/^91/, '')}`;
    try {
      const response = await axios.get(targetUrl);
      return { success: true, response: response.data };
    } catch (err) {
      throw new functions.https.HttpsError('internal', 'SMS send failed: ' + err.message);
    }
  });

