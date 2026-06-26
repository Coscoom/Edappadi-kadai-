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
