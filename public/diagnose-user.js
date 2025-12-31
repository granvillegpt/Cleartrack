/**
 * Diagnostic script to check user role in Firestore
 * Run this in the browser console to see what's in Firestore
 */
async function diagnoseUser() {
  if (!window.firebaseAuth || !window.firebaseDb) {
    console.error('Firebase not initialized');
    return;
  }
  
  const user = window.firebaseAuth.currentUser;
  if (!user) {
    console.error('No user logged in');
    return;
  }
  
  console.log('=== USER DIAGNOSTIC ===');
  console.log('UID:', user.uid);
  console.log('Email:', user.email);
  console.log('');
  
  // Check by UID
  console.log('--- Checking by UID ---');
  try {
    const uidDoc = await window.firebaseDb.collection('users').doc(user.uid).get();
    if (uidDoc.exists) {
      const data = uidDoc.data();
      console.log('✅ Document exists by UID');
      console.log('Document ID:', uidDoc.id);
      console.log('Role:', data.role, 'type:', typeof data.role);
      console.log('Full data:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ No document found by UID');
    }
  } catch (e) {
    console.error('Error checking UID:', e);
  }
  
  console.log('');
  
  // Check by email
  console.log('--- Checking by Email ---');
  try {
    const email = user.email.toLowerCase().trim();
    console.log('Searching for email:', email);
    const emailDocs = await window.firebaseDb.collection('users')
      .where('email', '==', email)
      .get();
    
    console.log('Found', emailDocs.size, 'document(s) by email');
    
    if (emailDocs.empty) {
      console.log('❌ No documents found by email');
    } else {
      emailDocs.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`Document ${index + 1}:`);
        console.log('  ID:', doc.id);
        console.log('  Role:', data.role, 'type:', typeof data.role);
        console.log('  Email in doc:', data.email);
        console.log('  Full data:', JSON.stringify(data, null, 2));
      });
    }
  } catch (e) {
    console.error('Error checking email:', e);
  }
  
  console.log('');
  console.log('=== END DIAGNOSTIC ===');
}

// Make it available globally
window.diagnoseUser = diagnoseUser;
console.log('✅ Diagnostic function loaded. Run diagnoseUser() in console.');

