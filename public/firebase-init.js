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
})();
