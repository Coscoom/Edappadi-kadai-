const admin = require('firebase-admin');
console.log("Keys of firebase-admin:", Object.keys(admin));
try {
  admin.initializeApp({
    projectId: 'edappadi-kadai'
  });
  console.log("Initialized.");
  // try classic getFirestore from sub-module
  const { getFirestore } = require('firebase-admin/firestore');
  const db = getFirestore();
  console.log("Firestore initialized successfully!");
  
  db.collection('ek_admin_accounts').limit(1).get().then(snap => {
    console.log("Successfully connected. Doc count:", snap.size);
    process.exit(0);
  }).catch(err => {
    console.error("Query failed:", err);
    process.exit(1);
  });
} catch(e) {
  console.error("Initialization failed:", e);
  process.exit(1);
}
