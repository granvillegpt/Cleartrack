/**
 * Firebase Initialization for Frontend
 * 
 * This file initializes Firebase services for use in the browser.
 * Requires firebase-config.js to be loaded first to provide window.firebaseConfig.
 * 
 * Uses Firebase Compat SDK (loaded via CDN scripts in HTML).
 */

(function() {
  'use strict';
  
  // Check if Firebase SDK is loaded
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded. Please include Firebase compat scripts in your HTML.');
    return;
  }
  
  // Check if config is available
  if (!window.firebaseConfig) {
    console.error('Firebase config not found. Please load firebase-config.js before this script.');
    return;
  }
  
  // Initialize Firebase app - reuse existing app if available
  let app;
  if (firebase.apps.length > 0) {
    app = firebase.apps[0];
    console.log('Reusing existing Firebase app instance');
  } else {
    app = firebase.initializeApp(window.firebaseConfig);
    console.log('Initialized new Firebase app instance');
  }
  
  // Initialize Firebase services using Compat API
  const auth = firebase.auth();
  const db = firebase.firestore();
  
  // Expose globally for use by firebase-api.js and other scripts
  window.firebaseApp = app;
  window.firebaseAuth = auth;
  window.firebaseDb = db;
  
  console.log('Firebase initialized successfully');
  console.log('Available services:', {
    app: !!window.firebaseApp,
    auth: !!window.firebaseAuth,
    db: !!window.firebaseDb
  });
  
  // GLOBAL PRACTITIONER REDIRECT - Runs on EVERY page EXCEPT login
  // This ensures practitioners are ALWAYS redirected, even if login routing failed
  async function globalPractitionerRedirect() {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4ced639f-f705-4ba5-816f-e4d083213529',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase-init.js:53',message:'globalPractitionerRedirect ENTRY',data:{pathname:window.location.pathname,search:window.location.search,fullPath:window.location.pathname+window.location.search},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D'})}).catch(()=>{});
    // #endregion
    
    // Use window.firebaseAuth and window.firebaseDb (exposed globally)
    if (!window.firebaseAuth || !window.firebaseDb) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4ced639f-f705-4ba5-816f-e4d083213529',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase-init.js:56',message:'EXIT: Firebase services not available',data:{hasAuth:!!window.firebaseAuth,hasDb:!!window.firebaseDb},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D'})}).catch(()=>{});
      // #endregion
      return;
    }
    
    const user = window.firebaseAuth.currentUser;
    if (!user || !user.email) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4ced639f-f705-4ba5-816f-e4d083213529',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase-init.js:60',message:'EXIT: No user or email',data:{hasUser:!!user,hasEmail:!!(user&&user.email)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D'})}).catch(()=>{});
      // #endregion
      return;
    }
    
    // Skip if on login page (let login.js handle routing)
    const currentPath = window.location.pathname;
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4ced639f-f705-4ba5-816f-e4d083213529',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase-init.js:65',message:'BEFORE path check',data:{currentPath:currentPath,includesLogin:currentPath.includes('login.html'),includesPractitioner:currentPath.includes('practitioner-dashboard'),includesAdmin:currentPath.includes('admin-dashboard')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (currentPath.includes('login.html')) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4ced639f-f705-4ba5-816f-e4d083213529',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase-init.js:67',message:'EXIT: On login page',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D'})}).catch(()=>{});
      // #endregion
      return;
    }
    
    // Skip if already on practitioner/admin dashboard
    if (currentPath.includes('practitioner-dashboard') || currentPath.includes('admin-dashboard')) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4ced639f-f705-4ba5-816f-e4d083213529',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase-init.js:71',message:'EXIT: Already on dashboard (path check passed)',data:{currentPath:currentPath,includesPractitioner:currentPath.includes('practitioner-dashboard'),includesAdmin:currentPath.includes('admin-dashboard')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return;
    }
    
    try {
      const email = user.email.toLowerCase().trim();
      console.log('[GLOBAL REDIRECT] Checking user:', email, 'UID:', user.uid);
      
      // Check by email FIRST
      const emailDocs = await window.firebaseDb.collection('users')
        .where('email', '==', email)
        .get();
      
      console.log('[GLOBAL REDIRECT] Found', emailDocs.size, 'doc(s) by email');
      
      for (const doc of emailDocs.docs) {
        const data = doc.data();
        const role = String(data.role || '').toLowerCase().trim();
        console.log('[GLOBAL REDIRECT] Doc ID:', doc.id, 'Role:', role);
        
        if (role === 'practitioner') {
          console.log('[GLOBAL REDIRECT] ✅✅✅ REDIRECTING PRACTITIONER!');
          window.location.replace('/practitioner-dashboard.html?v=' + Date.now());
          return;
        } else if (role === 'admin') {
          console.log('[GLOBAL REDIRECT] ✅✅✅ REDIRECTING ADMIN!');
          window.location.replace('/admin-dashboard.html?v=' + Date.now());
          return;
        }
      }
      
      // Also check by UID
      const uidDoc = await window.firebaseDb.collection('users').doc(user.uid).get();
      if (uidDoc.exists) {
        const data = uidDoc.data();
        const role = String(data.role || '').toLowerCase().trim();
        console.log('[GLOBAL REDIRECT] UID doc role:', role);
        if (role === 'practitioner') {
          console.log('[GLOBAL REDIRECT] ✅✅✅ REDIRECTING PRACTITIONER (UID)!');
          window.location.replace('/practitioner-dashboard.html?v=' + Date.now());
        } else if (role === 'admin') {
          console.log('[GLOBAL REDIRECT] ✅✅✅ REDIRECTING ADMIN (UID)!');
          window.location.replace('/admin-dashboard.html?v=' + Date.now());
        }
      }
    } catch (e) {
      console.error('[GLOBAL REDIRECT] Error:', e);
    }
  }
  
  // Run once when Firebase is ready (not on login page)
  setTimeout(() => {
    if (!window.location.pathname.includes('login.html')) {
      globalPractitionerRedirect();
    }
  }, 1000);
  
  // Also run when auth state changes (but not on login page)
  if (window.firebaseAuth) {
    window.firebaseAuth.onAuthStateChanged(() => {
      if (!window.location.pathname.includes('login.html')) {
        setTimeout(globalPractitionerRedirect, 500);
      }
    });
  }
  
  // Trigger custom event for role checking
  setTimeout(() => {
    if (typeof window.dispatchEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('firebaseReady'));
    }
    
    // Also call global callback if it exists
    if (typeof window.onFirebaseReady === 'function') {
      window.onFirebaseReady();
    }
  }, 50);
})();
