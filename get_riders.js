async function getRiders() {
  console.log("=== FIRESTORE READ VIA REST API ===");
  try {
    const res = await fetch('https://firestore.googleapis.com/v1/projects/edappadi-kadai/databases/(default)/documents/ek_delivery_persons');
    const data = await res.json();
    if (data.documents) {
      console.log(`Found ${data.documents.length} delivery persons:`);
      for (const doc of data.documents) {
        const fields = doc.fields;
        console.log(`\nDocument Path: ${doc.name}`);
        const name = fields.name ? fields.name.stringValue : 'N/A';
        const phone = fields.phone ? fields.phone.stringValue : 'N/A';
        const email = fields.authEmail ? fields.authEmail.stringValue : 'N/A';
        const active = fields.active ? fields.active.booleanValue : fields.isActive ? fields.isActive.booleanValue : 'N/A';
        console.log(`- Name: ${name}`);
        console.log(`- Phone: ${phone}`);
        console.log(`- Auth Email: ${email}`);
        console.log(`- Active: ${active}`);
      }
    } else {
      console.log("No delivery persons documents found or error:", data);
    }
  } catch (err) {
    console.error("Error reading Firestore:", err);
  }
}

getRiders();
