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
  
  // CT-AUTH-REDIRECT-STABILISATION: SINGLE SOURCE OF TRUTH for redirects
  // Global redirect guard flag
  if (typeof window.__CLEARTRACK_REDIRECTED__ === 'undefined') {
    window.__CLEARTRACK_REDIRECTED__ = false;
  }

  // Single redirect function - runs ONCE per auth session
  async function performRoleBasedRedirect() {
    // Check redirect guard
    if (window.__CLEARTRACK_REDIRECTED__) {
      return;
    }

    // Skip on login page
    if (window.location.pathname.includes('login.html')) {
      return;
    }

    if (!window.firebaseAuth || !window.firebaseDb) {
      return;
    }

    const user = window.firebaseAuth.currentUser;
    if (!user) {
      return;
    }

    try {
      // Use UID document ONLY - no email queries
      const userDoc = await window.firebaseDb.collection('users').doc(user.uid).get();
      
      if (!userDoc.exists) {
        return; // No document = no redirect
      }

      const data = userDoc.data();
      const role = String(data.role || '').toLowerCase().trim();

      // Set redirect flag BEFORE redirecting
      window.__CLEARTRACK_REDIRECTED__ = true;

      if (role === 'practitioner') {
        window.location.replace('/practitioner-dashboard.html?v=' + Date.now());
        return;
      }

      if (role === 'admin') {
        window.location.replace('/admin-dashboard.html?v=' + Date.now());
        return;
      }

      // role === 'user' - DO NOT redirect, stay on current page
    } catch (error) {
      console.error('[firebase-init] Redirect error:', error);
    }
  }

  // Single onAuthStateChanged listener - runs ONCE
  let authListenerInitialized = false;
  if (window.firebaseAuth && !authListenerInitialized) {
    authListenerInitialized = true;
    window.firebaseAuth.onAuthStateChanged(function(user) {
      if (user && !window.__CLEARTRACK_REDIRECTED__) {
        performRoleBasedRedirect();
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
