const fetch = require('node-fetch'); // wait, node 18+ has global fetch, so we can use standard fetch or node-fetch
async function getAdmins() {
  console.log("=== FIRESTORE READ FOR ADMINS ===");
  try {
    const res = await fetch('https://firestore.googleapis.com/v1/projects/edappadi-kadai/databases/(default)/documents/ek_admin_accounts');
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error reading Firestore admins:", err);
  }
}
getAdmins();
