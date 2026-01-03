/**
 * CT-AUTH-REDIRECT-STABILISATION: Centralized Auth & Redirect Controller
 * 
 * SINGLE SOURCE OF TRUTH for:
 * - Firebase auth state monitoring
 * - User role resolution (users/{uid} ONLY)
 * - Redirect routing logic
 * 
 * Rules:
 * - Only ONE onAuthStateChanged listener in entire app
 * - Redirect happens ONCE per page load
 * - No email-based Firestore queries
 * - User document = users/{uid} (exactly one per user)
 */

(function() {
  'use strict';

  // CT-AUTH-REDIRECT-STABILISATION: Global redirect gate
  if (typeof window.__redirectHandled === 'undefined') {
    window.__redirectHandled = false;
  }

  // Prevent multiple instances
  if (window.__authRedirectControllerInitialized) {
    return;
  }
  window.__authRedirectControllerInitialized = true;

  let authUnsubscribe = null;
  let redirectInProgress = false;
  let userRoleResolved = false;

  /**
   * CT-AUTH-REDIRECT-STABILISATION: Resolve user role from users/{uid} ONLY
   * NO email queries - exactly one document per user
   */
  async function resolveUserRole(uid) {
    if (!window.firebaseDb) {
      throw new Error('Firestore not available');
    }

    try {
      const userDoc = await window.firebaseDb.collection('users').doc(uid).get();
      
      if (!userDoc.exists) {
        // Create default user document if missing
        await window.firebaseDb.collection('users').doc(uid).set({
          role: 'user',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return 'user';
      }

      const data = userDoc.data();
      const role = String(data.role || 'user').toLowerCase().trim();
      return role;
    } catch (error) {
      console.error('[auth-redirect] Error resolving user role:', error);
      throw error;
    }
  }

  /**
   * Normalize legacy role "user" to "client" for routing/guard comparisons
   */
  function normalizeRole(role) {
    if (role === 'user') return 'client';
    return role;
  }

  /**
   * CT-AUTH-REDIRECT-STABILISATION: Determine redirect destination based on role
   * PHASE3D: Parameter renamed from onboardingComplete to profileReady for clarity
   */
  function getRedirectDestination(role, profileReady = false) {
    if (role === 'practitioner') {
      return '/practitioner-dashboard.html';
    }
    if (role === 'admin') {
      return '/admin-dashboard.html';
    }
    if (normalizeRole(role) === 'client') {
      // PHASE3D: Always route to user dashboard (wizard handles incomplete profiles)
      return '/user-dashboard.html';
    }
    // Default fallback
    return '/user-dashboard.html';
  }

  /**
   * CT-AUTH-REDIRECT-STABILISATION: DISABLED - Redirects handled by firebase-init.js
   * This function now only validates role, never redirects
   */
  function executeRedirect(destination) {
    // DISABLED - firebase-init.js is the sole redirect authority
    console.log('[auth-redirect] Redirect request ignored (handled by firebase-init.js):', destination);
    // DO NOT redirect - firebase-init.js handles all redirects
    return;
  }

  /**
   * CT-AUTH-REDIRECT-STABILISATION: Main auth state handler
   * This is the ONLY place that listens to onAuthStateChanged
   */
  function initializeAuthRedirect() {
    // Skip if already handled
    if (window.__redirectHandled) {
      return;
    }

    // Skip on login page (let login.js handle it)
    if (window.location.pathname.includes('login.html')) {
      return;
    }

    if (!window.firebaseAuth || !window.firebaseDb) {
      // Wait for Firebase to be ready
      setTimeout(initializeAuthRedirect, 200);
      return;
    }

    // Only set up ONE listener
    if (authUnsubscribe) {
      return; // Already initialized
    }

    console.log('[auth-redirect] Initializing auth state listener (ONCE)');

    authUnsubscribe = window.firebaseAuth.onAuthStateChanged(async function(user) {
      // Skip if redirect already handled
      if (window.__redirectHandled) {
        return;
      }

      // User not logged in - firebase-init.js handles redirect to login
      if (!user) {
        console.log('[auth-redirect] No user logged in (redirect handled by firebase-init.js)');
        // DO NOT redirect - firebase-init.js handles this
        return;
      }

      // User is logged in - resolve role and redirect
      try {
        if (userRoleResolved) {
          return; // Already resolved
        }

        userRoleResolved = true;
        let role = await resolveUserRole(user.uid);
        // Normalize role: "user" → "client" (in memory only)
        if (role === 'user') {
          role = 'client';
        }
        console.log('[auth-redirect] User role resolved:', role);

        // PHASE3D: Check profile readiness instead of onboarding status
        let profileReady = false;
        try {
          const userDoc = await window.firebaseDb.collection('users').doc(user.uid).get();
          if (userDoc.exists) {
            const data = userDoc.data();
            // Use isProfileReady helper if available, otherwise fallback to basic check
            profileReady = window.isProfileReady ? window.isProfileReady(data) : Boolean(data && data.role);
            console.log('[PHASE3D] [auth-redirect] Profile readiness check:', { role, profileReady, migrationComplete: data.migrationComplete });
          }
        } catch (err) {
          console.warn('[PHASE3D] [auth-redirect] Error checking profile readiness:', err);
        }

        // DISABLED - firebase-init.js handles all redirects
        // Only validate role here, never redirect
        const currentPath = window.location.pathname;
        const destination = getRedirectDestination(role, profileReady);
        
        // Skip redirect enforcement if user not yet hydrated
        if (!window.currentUser) {
          console.log("[auth-redirect] Skipped redirect — user not hydrated yet");
          return;
        }
        
        // PHASE3D: Role validation only - show error if on wrong page, but don't redirect
        // Note: role is already normalized above, so use it directly
        if (role === 'practitioner' && !currentPath.includes('practitioner-dashboard')) {
          console.warn('[PHASE3D] [auth-redirect] Role mismatch: practitioner on wrong page (redirect handled by firebase-init.js)');
        } else if (role === 'admin' && !currentPath.includes('admin-dashboard')) {
          console.warn('[PHASE3D] [auth-redirect] Role mismatch: admin on wrong page (redirect handled by firebase-init.js)');
        } else if (role === 'client') {
          // PHASE3D: Clients should always be on user-dashboard (wizard handles incomplete profiles)
          if (!currentPath.includes('user-dashboard')) {
            console.warn('[PHASE3D] [auth-redirect] Role mismatch: client on wrong page (redirect handled by firebase-init.js)');
          }
        }
        // DO NOT call executeRedirect - firebase-init.js handles redirects
      } catch (error) {
        console.error('[auth-redirect] Error in auth state handler:', error);
        // DO NOT redirect on error - firebase-init.js handles redirects
      }
    });
  }

  // Initialize when Firebase is ready
  if (window.firebaseAuth && window.firebaseDb) {
    initializeAuthRedirect();
  } else {
    // Wait for Firebase
    const checkFirebase = setInterval(() => {
      if (window.firebaseAuth && window.firebaseDb) {
        clearInterval(checkFirebase);
        initializeAuthRedirect();
      }
    }, 100);

    // Timeout after 5 seconds
    setTimeout(() => {
      clearInterval(checkFirebase);
    }, 5000);
  }

  // Export for external use
  window.authRedirectController = {
    resolveUserRole: resolveUserRole,
    getRedirectDestination: getRedirectDestination,
    executeRedirect: executeRedirect
  };
})();

