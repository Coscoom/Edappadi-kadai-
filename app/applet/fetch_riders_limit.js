const apiKey = "AIzaSyDtlKng15Cyixb6HJx-mToBXHVVy28SXSA";
const projectId = "edappadi-kadai";

async function run() {
  try {
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true })
    });
    const authData = await authRes.json();
    const token = authData.idToken;

    console.log("Listing ek_delivery_persons with structured query limit...");
    // Let's use standard list with pageSize=10
    const metaRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/ek_delivery_persons?pageSize=10`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const metaData = await metaRes.json();
    console.log("--- ek_delivery_persons documents ---");
    console.log(JSON.stringify(metaData, null, 2));

  } catch (err) {
    console.error("Error:", err);
  }
}

run();
