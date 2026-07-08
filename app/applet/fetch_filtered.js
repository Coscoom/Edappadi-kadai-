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
    console.log("Successfully signed in. Token obtained.");

    console.log("Querying ek_admin_accounts with limit 5...");
    const adminQuery = {
      structuredQuery: {
        from: [{ collectionId: "ek_admin_accounts" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "active" },
            op: "EQUAL",
            value: { booleanValue: true }
          }
        },
        limit: 5
      }
    };
    
    const adminRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(adminQuery)
    });
    const adminData = await adminRes.json();
    console.log("--- ADMINS QUERY RESULT ---");
    console.log(JSON.stringify(adminData, null, 2));

    console.log("Querying ek_delivery_persons with limit 5...");
    const riderQuery = {
      structuredQuery: {
        from: [{ collectionId: "ek_delivery_persons" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "isActive" },
            op: "EQUAL",
            value: { booleanValue: true }
          }
        },
        limit: 5
      }
    };
    
    const riderRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(riderQuery)
    });
    const riderData = await riderRes.json();
    console.log("--- RIDERS QUERY RESULT ---");
    console.log(JSON.stringify(riderData, null, 2));

  } catch (err) {
    console.error("Error:", err);
  }
}

run();
