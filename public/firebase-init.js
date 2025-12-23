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
  
  // GLOBAL PRACTITIONER REDIRECT - Only runs on non-dashboard pages
  // This ensures practitioners are redirected from onboarding/other pages
  // Dashboard pages have their own auth guards (dashboard-auth.js)
  let globalRedirectProcessing = false;
  let globalRedirectProcessed = false;
  
  async function globalPractitionerRedirect() {
    // Prevent multiple simultaneous redirects
    if (globalRedirectProcessing || globalRedirectProcessed) {
      return;
    }
    
    // Use window.firebaseAuth and window.firebaseDb (exposed globally)
    if (!window.firebaseAuth || !window.firebaseDb) {
      return;
    }
    
    const user = window.firebaseAuth.currentUser;
    if (!user || !user.email) {
      return;
    }
    
    const currentPath = window.location.pathname;
    
    // Skip if on login page (let login.js handle routing)
    if (currentPath.includes('login.html')) {
      return;
    }
    
    // Skip if already on dashboard pages (they have their own auth guards)
    if (currentPath.includes('practitioner-dashboard') || 
        currentPath.includes('admin-dashboard') || 
        currentPath.includes('user-dashboard')) {
      return;
    }
    
    globalRedirectProcessing = true;
    
    try {
      const email = user.email.toLowerCase().trim();
      console.log('[GLOBAL REDIRECT] Checking user:', email, 'UID:', user.uid);
      
      // Check by email FIRST
      const emailDocs = await window.firebaseDb.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();
      
      if (emailDocs.size > 0) {
        const data = emailDocs.docs[0].data();
        const role = String(data.role || '').toLowerCase().trim();
        
        if (role === 'practitioner') {
          console.log('[GLOBAL REDIRECT] ✅ Redirecting practitioner');
          globalRedirectProcessed = true;
          window.location.replace('/practitioner-dashboard.html');
          return;
        } else if (role === 'admin') {
          console.log('[GLOBAL REDIRECT] ✅ Redirecting admin');
          globalRedirectProcessed = true;
          window.location.replace('/admin-dashboard.html');
          return;
        }
      }
      
      // Also check by UID (faster fallback)
      const uidDoc = await window.firebaseDb.collection('users').doc(user.uid).get();
      if (uidDoc.exists) {
        const data = uidDoc.data();
        const role = String(data.role || '').toLowerCase().trim();
        if (role === 'practitioner') {
          console.log('[GLOBAL REDIRECT] ✅ Redirecting practitioner (UID)');
          globalRedirectProcessed = true;
          window.location.replace('/practitioner-dashboard.html');
          return;
        } else if (role === 'admin') {
          console.log('[GLOBAL REDIRECT] ✅ Redirecting admin (UID)');
          globalRedirectProcessed = true;
          window.location.replace('/admin-dashboard.html');
          return;
        }
      }
    } catch (e) {
      console.error('[GLOBAL REDIRECT] Error:', e);
    } finally {
      globalRedirectProcessing = false;
    }
  }
  
  // Only run on non-dashboard pages, and only once
  const currentPath = window.location.pathname;
  if (!currentPath.includes('login.html') && 
      !currentPath.includes('dashboard') &&
      !currentPath.includes('onboarding')) {
    setTimeout(() => {
      globalPractitionerRedirect();
    }, 1500);
  }
  
  // Only listen to auth changes on non-dashboard pages
  if (window.firebaseAuth && 
      !currentPath.includes('dashboard') && 
      !currentPath.includes('login.html')) {
    let authListenerActive = true;
    const unsubscribe = window.firebaseAuth.onAuthStateChanged(() => {
      if (authListenerActive && !globalRedirectProcessed) {
        setTimeout(() => {
          if (!window.location.pathname.includes('dashboard')) {
            globalPractitionerRedirect();
          } else {
            // If we're now on a dashboard, stop listening
            authListenerActive = false;
            unsubscribe();
          }
        }, 500);
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
