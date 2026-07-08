const apiKey = "AIzaSyDtlKng15Cyixb6HJx-mToBXHVVy28SXSA";
const projectId = "edappadi-kadai";
const region = "asia-south1";

async function run() {
  try {
    // 1. Sign in anonymously to get an idToken
    const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true })
    });
    const authData = await authRes.json();
    const token = authData.idToken;

    if (!token) {
      console.error("Failed to sign up / get ID token:", authData);
      return;
    }

    console.log("Calling listAllAuthUsers callable function...");
    const url = `https://${region}-${projectId}.cloudfunctions.net/listAllAuthUsers`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ data: {} })
    });

    const text = await res.text();
    console.log("Response status:", res.status);
    console.log("Result text:", text);

  } catch (err) {
    console.error("Error:", err);
  }
}

run();
