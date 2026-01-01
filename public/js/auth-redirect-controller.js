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
   * CT-AUTH-REDIRECT-STABILISATION: Determine redirect destination based on role
   */
  function getRedirectDestination(role, onboardingComplete = false) {
    if (role === 'practitioner') {
      return '/practitioner-dashboard.html';
    }
    if (role === 'admin') {
      return '/admin-dashboard.html';
    }
    if (role === 'user') {
      if (onboardingComplete) {
        return '/user-dashboard.html';
      } else {
        return '/client-onboarding.html';
      }
    }
    // Default fallback
    return '/client-onboarding.html';
  }

  /**
   * CT-AUTH-REDIRECT-STABILISATION: Execute redirect ONCE
   */
  function executeRedirect(destination) {
    // Check redirect gate
    if (window.__redirectHandled) {
      console.log('[auth-redirect] Redirect already handled, ignoring:', destination);
      return;
    }

    if (redirectInProgress) {
      console.log('[auth-redirect] Redirect already in progress, ignoring:', destination);
      return;
    }

    // Skip if already on destination page
    const currentPath = window.location.pathname;
    if (currentPath.includes(destination.replace('.html', '').replace('/', ''))) {
      console.log('[auth-redirect] Already on destination page:', destination);
      window.__redirectHandled = true;
      return;
    }

    redirectInProgress = true;
    window.__redirectHandled = true;

    console.log('[auth-redirect] ✅✅✅ REDIRECTING TO:', destination);
    
    // Unsubscribe from auth state to prevent re-triggering
    if (authUnsubscribe) {
      authUnsubscribe();
      authUnsubscribe = null;
    }

    // Execute redirect
    window.location.replace(destination + '?v=' + Date.now());
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

      // User not logged in - redirect to login
      if (!user) {
        if (!window.location.pathname.includes('login.html')) {
          executeRedirect('/login.html');
        }
        return;
      }

      // User is logged in - resolve role and redirect
      try {
        if (userRoleResolved) {
          return; // Already resolved
        }

        userRoleResolved = true;
        const role = await resolveUserRole(user.uid);
        console.log('[auth-redirect] User role resolved:', role);

        // Check onboarding status for users
        let onboardingComplete = false;
        if (role === 'user') {
          try {
            const userDoc = await window.firebaseDb.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
              const data = userDoc.data();
              onboardingComplete = data.onboardingComplete === true || data.onboardingStep >= 5;
            }
          } catch (err) {
            console.warn('[auth-redirect] Error checking onboarding status:', err);
          }
        }

        const destination = getRedirectDestination(role, onboardingComplete);
        const currentPath = window.location.pathname;

        // Only redirect if not already on correct page
        if (role === 'practitioner' && !currentPath.includes('practitioner-dashboard')) {
          executeRedirect(destination);
        } else if (role === 'admin' && !currentPath.includes('admin-dashboard')) {
          executeRedirect(destination);
        } else if (role === 'user') {
          if (onboardingComplete && !currentPath.includes('user-dashboard')) {
            executeRedirect(destination);
          } else if (!onboardingComplete && !currentPath.includes('client-onboarding')) {
            executeRedirect(destination);
          }
        }
      } catch (error) {
        console.error('[auth-redirect] Error in auth state handler:', error);
        // On error, redirect to login
        if (!window.location.pathname.includes('login.html')) {
          executeRedirect('/login.html');
        }
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

