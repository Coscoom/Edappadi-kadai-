const apiKey = "AIzaSyDtlKng15Cyixb6HJx-mToBXHVVy28SXSA";
const projectId = "edappadi-kadai";

async function run() {
  try {
    console.log("Signing in anonymously...");
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true })
    });
    const authData = await authRes.json();
    if (!authData.idToken) {
      console.error("Auth failed:", authData);
      return;
    }
    const token = authData.idToken;
    console.log("Successfully signed in anonymously. User ID:", authData.localId);

    console.log("Fetching admin accounts...");
    const adminRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/ek_admin_accounts`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const adminData = await adminRes.json();
    console.log("--- ADMINS ---");
    if (adminData.documents) {
      adminData.documents.forEach(doc => {
        const name = doc.fields.name ? doc.fields.name.stringValue : "N/A";
        const phone = doc.fields.phone ? doc.fields.phone.stringValue : "N/A";
        const role = doc.fields.role ? doc.fields.role.stringValue : "N/A";
        const active = doc.fields.active ? doc.fields.active.booleanValue : null;
        console.log(`ID: ${doc.name.split("/").pop()} | Name: ${name} | Phone: ${phone} | Role: ${role} | Active: ${active}`);
      });
    } else {
      console.log("No admins found:", adminData);
    }

    console.log("Fetching delivery persons...");
    const riderRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/ek_delivery_persons`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const riderData = await riderRes.json();
    console.log("--- RIDERS ---");
    if (riderData.documents) {
      riderData.documents.forEach(doc => {
        const name = doc.fields.name ? doc.fields.name.stringValue : "N/A";
        const phone = doc.fields.phone ? doc.fields.phone.stringValue : "N/A";
        const isActive = doc.fields.isActive ? doc.fields.isActive.booleanValue : null;
        console.log(`ID: ${doc.name.split("/").pop()} | Name: ${name} | Phone: ${phone} | IsActive: ${isActive}`);
      });
    } else {
      console.log("No riders found:", riderData);
    }

  } catch (err) {
    console.error("Error:", err);
  }
}

run();
