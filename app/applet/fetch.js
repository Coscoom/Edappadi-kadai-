const admin = require('firebase-admin');
admin.initializeApp({
  projectId: 'edappadi-kadai'
});
const db = admin.firestore();

async function run() {
  try {
    console.log('--- ADMINS ---');
    const admins = await db.collection('ek_admin_accounts').get();
    admins.forEach(doc => {
      console.log(doc.id, '=>', JSON.stringify(doc.data()));
    });

    console.log('--- RIDERS ---');
    const riders = await db.collection('ek_delivery_persons').get();
    riders.forEach(doc => {
      console.log(doc.id, '=>', JSON.stringify(doc.data()));
    });
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
