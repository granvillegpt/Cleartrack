/**
 * Firebase Initialization for Frontend
 * 
 * PRODUCTION ARCHITECTURE LOCK:
 * =============================
 * This app uses EXACTLY ONE Firebase project for ALL runtime services:
 *   Project ID: cleartrack-1f6c6
 *   Services: Auth, Firestore, Functions, AI/Gemini, Storage
 * 
 * A separate project (cleartrack-hosting) is used ONLY for hosting deployment.
 * cleartrack-hosting MUST NEVER be initialized in code - it is deployment-only.
 * 
 * ALL Firebase initialization MUST use window.firebaseConfig from firebase-config.js.
 * This ensures we always connect to cleartrack-1f6c6.
 * 
 * DO NOT:
 * - Initialize additional Firebase projects
 * - Hardcode project IDs or configs
 * - Create named/secondary apps for different projects
 * - Reference cleartrack-hosting in code
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
  // ARCHITECTURE: This MUST use window.firebaseConfig (cleartrack-1f6c6)
  // DO NOT initialize cleartrack-hosting or any other project here
  let app;
  if (firebase.apps.length > 0) {
    app = firebase.apps[0];
    console.log('Reusing existing Firebase app instance');
  } else {
    // Guard: Ensure we're using the correct config (cleartrack-1f6c6)
    if (!window.firebaseConfig || window.firebaseConfig.projectId !== 'cleartrack-1f6c6') {
      console.error('[ARCHITECTURE] Firebase config must use project cleartrack-1f6c6');
      return;
    }
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
  
  // Initialize Firestore data layer if available
  if (typeof window.initFirestoreData === 'function') {
    window.initFirestoreData();
    console.log('[firebase-init] Firestore data layer initialized');
  }
  
  // PHASE3D: Profile readiness helper function
  // Checks if user has role and migration is complete (or not explicitly false)
  // Practitioner linking is handled separately by the wizard
  function isProfileReady(user) {
    return Boolean(user && user.role && user.migrationComplete !== false);
  }
  
  // Expose globally for cross-file access
  window.isProfileReady = isProfileReady;
  
  // CT-AUTH-REDIRECT-STABILISATION: SINGLE SOURCE OF TRUTH for redirects
  // Global redirect guard flag (in-memory, resets on page load)
  if (typeof window.__CLEARTRACK_REDIRECTED__ === 'undefined') {
    window.__CLEARTRACK_REDIRECTED__ = false;
  }

  // Single redirect function - runs ONCE per session
  async function performRoleBasedRedirect() {

    // Check sessionStorage guard first (always read dynamically)
    if (sessionStorage.getItem('ct_redirect_done') === 'true') {
      console.log('[firebase-init] Redirect already done this session, skipping');
      return;
    }

    // Check in-memory guard
    if (window.__CLEARTRACK_REDIRECTED__) {
      return;
    }

    // Skip on login page and public pages
    const pathname = window.location.pathname;
    if (pathname.includes('login.html') || 
        pathname.includes('index.html') ||
        pathname === '/' || 
        pathname === '') {
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
      const uid = user.uid;
      const email = user.email;
      let redirectTarget = null;
      let userDoc = null;
      let userData = null;

      // USER DOCUMENT RESOLUTION: UID first, email fallback
      // ALWAYS resolve Firestore user by Auth UID first
      userDoc = await window.firebaseDb.collection('users').doc(uid).get();
      
      if (userDoc.exists) {
        userData = userDoc.data();
      } else if (email) {
        // Use email lookup ONLY as fallback
        const emailQuery = await window.firebaseDb.collection('users')
          .where('email', '==', email)
          .limit(1)
          .get();
        
        if (!emailQuery.empty) {
          // If multiple email matches exist, ignore them if UID doc exists (already checked above)
          userDoc = emailQuery.docs[0];
          userData = userDoc.data();
        }
      }
      
      if (!userData) {
        // No user document = unlinked client → user dashboard (wizard handles onboarding)
        if (!pathname.includes('user-dashboard')) {
          redirectTarget = '/user-dashboard.html';
          console.log("[route] role: client (no doc) -> /user-dashboard.html");
        }
      } else {
        // Normalize roles: "user" → "client"
        let role = userData.role || null;
        if (role === 'user') {
          role = 'client';
        }
        
        // PHASE3D: Use isProfileReady instead of onboardingComplete
        const profileReady = window.isProfileReady ? window.isProfileReady(userData) : Boolean(userData && userData.role);
        console.log("[PHASE3D] Profile readiness check:", { role, profileReady, migrationComplete: userData.migrationComplete });
        
        // ROLE RESOLUTION RULES
        if (role === 'admin') {
          // Admin → admin dashboard
          if (!pathname.includes('admin-dashboard')) {
            redirectTarget = '/admin-dashboard.html';
            console.log("[PHASE3D] [route] role: admin -> /admin-dashboard.html");
          }
        } else if (role === 'practitioner') {
          // Practitioner → practitioner dashboard
          if (!pathname.includes('practitioner-dashboard')) {
            redirectTarget = '/practitioner-dashboard.html';
            console.log("[PHASE3D] [route] role: practitioner -> /practitioner-dashboard.html");
          }
        } else if (role === 'client') {
          // Client: always route to user dashboard (wizard handles incomplete profiles)
          if (!pathname.includes('user-dashboard')) {
            redirectTarget = '/user-dashboard.html';
            console.log("[PHASE3D] [route] role: client -> /user-dashboard.html (wizard handles profile completion)");
          }
        } else {
          // Unknown role or no role = default to user dashboard (wizard handles onboarding)
          if (!pathname.includes('user-dashboard')) {
            redirectTarget = '/user-dashboard.html';
            console.log("[PHASE3D] [route] role: unknown -> /user-dashboard.html");
          }
        }
      }

      // Redirect ownership: Only auth-redirect-controller.js may redirect
      // Set flags but do not redirect here
      if (redirectTarget) {
        // Delegate redirect to auth-redirect-controller if available
        if (window.authRedirectController && typeof window.authRedirectController.executeRedirect === 'function') {
          console.log('[firebase-init] Delegating redirect to auth-redirect-controller:', redirectTarget);
          window.authRedirectController.executeRedirect(redirectTarget);
        } else {
          // If auth-redirect-controller not available, set flags only (no redirect)
          console.log('[firebase-init] Redirect target determined but auth-redirect-controller not available, setting flags only:', redirectTarget);
          window.__CLEARTRACK_REDIRECTED__ = true;
          sessionStorage.setItem('ct_redirect_done', 'true');
        }
      } else {
        // Already on correct page - set guards to prevent future redirects
        window.__CLEARTRACK_REDIRECTED__ = true;
        sessionStorage.setItem('ct_redirect_done', 'true');
      }
    } catch (error) {
      console.error('[firebase-init] Redirect error:', error);
    }
  }

  // Single onAuthStateChanged listener - runs ONCE
  let authListenerInitialized = false;
  if (window.firebaseAuth && !authListenerInitialized) {
    authListenerInitialized = true;
    window.firebaseAuth.onAuthStateChanged(function(user) {
      if (user && sessionStorage.getItem('ct_redirect_done') !== 'true' && !window.__CLEARTRACK_REDIRECTED__) {
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
