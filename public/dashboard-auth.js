/**
 * Dashboard Authentication Guard
 * 
 * Protects both user and practitioner dashboards behind Firebase Authentication
 * and role-based access control.
 * 
 * Requires:
 * - firebase-init.js (provides window.firebaseAuth, window.firebaseDb)
 * - firebase-api.js (provides window.cleartrackAuthApi)
 */

// Check for dev mode IMMEDIATELY (before DOMContentLoaded) to prevent any auth checks
// Add ?dev=true to URL or set localStorage.setItem('devMode', 'true') to bypass auth
(function() {
  const urlParams = new URLSearchParams(window.location.search);
  const devModeParam = urlParams.get('dev') === 'true';
  const devModeStorage = localStorage.getItem('devMode') === 'true';
  window.DEV_MODE = devModeParam || devModeStorage;
  
  if (window.DEV_MODE) {
    console.warn('[dashboard-auth] ⚠️ DEVELOPMENT MODE: Authentication bypassed');
    console.log('[dashboard-auth] To disable dev mode, remove ?dev=true from URL or run: localStorage.removeItem("devMode")');
  }
})();

document.addEventListener('DOMContentLoaded', function() {
  // Check dev mode again (in case it was set via localStorage after page load)
  const urlParams = new URLSearchParams(window.location.search);
  const devModeParam = urlParams.get('dev') === 'true';
  const devModeStorage = localStorage.getItem('devMode') === 'true';
  const DEV_MODE = devModeParam || devModeStorage || window.DEV_MODE;
  
  if (DEV_MODE) {
    console.warn('[dashboard-auth] ⚠️ DEVELOPMENT MODE: Authentication bypassed');
    console.log('[dashboard-auth] To disable dev mode, remove ?dev=true from URL or run: localStorage.removeItem("devMode")');
    return; // Skip all authentication checks
  }

  // Verify dependencies
  if (!window.firebaseAuth) {
    console.error('[dashboard-auth] window.firebaseAuth is not available. Ensure firebase-init.js is loaded first.');
    console.log('[dashboard-auth] 💡 TIP: Add ?dev=true to URL to bypass authentication for development');
    return;
  }

  if (!window.cleartrackAuthApi) {
    console.error('[dashboard-auth] window.cleartrackAuthApi is not available. Ensure firebase-api.js is loaded first.');
    console.log('[dashboard-auth] 💡 TIP: Add ?dev=true to URL to bypass authentication for development');
    return;
  }

  // Determine which page we are on
  const pathname = window.location.pathname;
  const isPractitionerPage = pathname.includes('practitioner-dashboard');
  const isUserPage = pathname.includes('user-dashboard');
  const isAdminPage = pathname.includes('admin-dashboard');

  // If not on a dashboard page, do nothing
  if (!isPractitionerPage && !isUserPage && !isAdminPage) {
    return;
  }

  // Prevent multiple redirects
  let isProcessingAuth = false;
  let authProcessed = false;
  let authUnsubscribe = null;
  
  // CT-AUTH-REDIRECT-STABILISATION: Auth state handling moved to auth-redirect-controller.js
  // This file now only handles access control for already-loaded pages
  // Check redirect gate - if redirect already handled, skip auth checks
  if (window.__redirectHandled) {
    console.log('[dashboard-auth] Redirect already handled, skipping auth checks');
    return;
  }

  // Observe authentication state - only listen once
  authUnsubscribe = window.firebaseAuth.onAuthStateChanged(async function(user) {
    // Prevent multiple simultaneous auth checks
    if (isProcessingAuth) {
      console.log('[dashboard-auth] Auth check already in progress, skipping...');
      return;
    }
    
    // User is not logged in - redirect to login page
    if (!user) {
      if (authProcessed) {
        console.log('[dashboard-auth] Auth already processed, skipping redirect');
        return;
      }
      // Guard: Check if redirect already handled by auth-redirect-controller
      if (window.__ctDidRedirect) {
        console.log('[dashboard-auth] Redirect already handled by auth-redirect-controller, skipping');
        return;
      }
      console.log('[dashboard-auth] No user logged in, redirecting to login page');
      authProcessed = true;
      if (authUnsubscribe) authUnsubscribe();
      // Delegate to auth-redirect-controller if available, otherwise redirect (login page is safe)
      if (window.authRedirectController && typeof window.authRedirectController.executeRedirect === 'function') {
        window.authRedirectController.executeRedirect('/login.html');
      } else {
        window.location.href = '/login.html';
      }
      return;
    }
    
    // Mark as processing
    isProcessingAuth = true;

    // User is logged in - check their role
    try {
      // Load user profile from Firestore
      let profile;
      let role = 'client'; // Default role (changed from 'user' to 'client')
      
      try {
        profile = await window.cleartrackAuthApi.getUserProfile(user.uid);
        if (profile && profile.role) {
          role = profile.role;
        } else {
          console.warn('[dashboard-auth] User profile missing role, defaulting to "client"');
          // Create default user document if it doesn't exist
          if (window.firebaseDb) {
            try {
              const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
              await window.firebaseDb.collection('users').doc(user.uid).set({
                uid: user.uid,
                email: user.email || null,
                role: 'client', // Default to client, not user
                createdAt: serverTimestamp,
                updatedAt: serverTimestamp
              }, { merge: true });
              console.log('[dashboard-auth] Created default user document with role: client');
            } catch (createError) {
              console.error('[dashboard-auth] Failed to create default user document:', createError);
            }
          }
        }
      } catch (profileError) {
        console.warn('[dashboard-auth] Error loading user profile, creating default:', profileError);
        // User document doesn't exist - create a default one
        if (window.firebaseDb) {
          try {
            const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp();
            await window.firebaseDb.collection('users').doc(user.uid).set({
              uid: user.uid,
              email: user.email || null,
              role: 'client', // Default to client, not user
              createdAt: serverTimestamp,
              updatedAt: serverTimestamp
            }, { merge: true });
            console.log('[dashboard-auth] Created default user document after error with role: client');
            role = 'client';
          } catch (createError) {
            console.error('[dashboard-auth] Failed to create default user document:', createError);
            // Continue with default role
          }
        }
      }

      // Check access based on page and role
      if (isAdminPage) {
        // On admin dashboard
        if (role !== 'admin') {
          console.log(`[dashboard-auth] Access denied: User role "${role}" cannot access admin dashboard. Redirecting...`);
          if (!authProcessed) {
            // Guard: Check if redirect already handled
            if (window.__ctDidRedirect) {
              console.log('[dashboard-auth] Redirect already handled, skipping redirectByRole');
              return;
            }
            authProcessed = true;
            isProcessingAuth = false;
            if (authUnsubscribe) {
              authUnsubscribe();
              authUnsubscribe = null;
            }
            window.cleartrackAuthApi.redirectByRole(role);
          }
          return;
        }
        // Role is admin and on admin page - access granted
        console.log('[dashboard-auth] Access granted for role: admin');
        authProcessed = true;
        isProcessingAuth = false;
        // Unsubscribe after successful auth check to prevent re-triggering
        if (authUnsubscribe) {
          authUnsubscribe();
          authUnsubscribe = null;
        }
      } else if (isPractitionerPage) {
        // On practitioner dashboard
        if (role !== 'practitioner') {
          console.log(`[dashboard-auth] Access denied: User role "${role}" cannot access practitioner dashboard. Redirecting...`);
          // Guard: Check if redirect already handled
          if (window.__ctDidRedirect) {
            console.log('[dashboard-auth] Redirect already handled, skipping redirectByRole');
            return;
          }
          window.cleartrackAuthApi.redirectByRole(role);
          return;
        }
        
        // Check if practitioner is suspended or fraud-tagged
        const practitionerStatus = profile ? profile.practitionerStatus : null;
        const isFraudTagged = profile ? (profile.fraudTagged === true || profile.practitionerStatus === 'fraud') : false;
        
        console.log('[dashboard-auth] Practitioner status check:', {
          practitionerStatus: practitionerStatus,
          fraudTagged: isFraudTagged,
          profileExists: !!profile
        });
        
        if (practitionerStatus === 'suspended') {
          console.log('[dashboard-auth] Access denied: Practitioner account is suspended.');
          alert('Your practitioner account has been suspended. Please contact support for assistance.');
          // Guard: Check if redirect already handled (but allow security redirects)
          if (!window.__ctDidRedirect) {
            window.firebaseAuth.signOut().then(() => {
              if (window.authRedirectController && typeof window.authRedirectController.executeRedirect === 'function') {
                window.authRedirectController.executeRedirect('/login.html');
              } else {
                window.location.href = '/login.html';
              }
            }).catch(() => {
              if (window.authRedirectController && typeof window.authRedirectController.executeRedirect === 'function') {
                window.authRedirectController.executeRedirect('/login.html');
              } else {
                window.location.href = '/login.html';
              }
            });
          }
          return;
        }
        
        if (isFraudTagged) {
          console.log('[dashboard-auth] Access denied: Practitioner account is fraud-tagged.');
          alert('Your practitioner account has been flagged. Please contact support for assistance.');
          // Guard: Check if redirect already handled (but allow security redirects)
          if (!window.__ctDidRedirect) {
            window.firebaseAuth.signOut().then(() => {
              if (window.authRedirectController && typeof window.authRedirectController.executeRedirect === 'function') {
                window.authRedirectController.executeRedirect('/login.html');
              } else {
                window.location.href = '/login.html';
              }
            }).catch(() => {
              if (window.authRedirectController && typeof window.authRedirectController.executeRedirect === 'function') {
                window.authRedirectController.executeRedirect('/login.html');
              } else {
                window.location.href = '/login.html';
              }
            });
          }
          return;
        }
        
        // Role is practitioner and on practitioner page - access granted
        console.log('[dashboard-auth] Access granted for role: practitioner');
        authProcessed = true;
        isProcessingAuth = false;
        // Unsubscribe after successful auth check to prevent re-triggering
        if (authUnsubscribe) {
          authUnsubscribe();
          authUnsubscribe = null;
        }
      } else if (isUserPage) {
        // On user dashboard
        if (role === 'practitioner' || role === 'admin') {
          console.log('[dashboard-auth] Access denied: Practitioner/Admin cannot access user dashboard. Redirecting...');
          if (!authProcessed) {
            // Guard: Check if redirect already handled
            if (window.__ctDidRedirect) {
              console.log('[dashboard-auth] Redirect already handled, skipping redirectByRole');
              return;
            }
            authProcessed = true;
            isProcessingAuth = false;
            if (authUnsubscribe) {
              authUnsubscribe();
              authUnsubscribe = null;
            }
            window.cleartrackAuthApi.redirectByRole(role);
          }
          return;
        }
        // Role is user and on user page - access granted
        console.log(`[dashboard-auth] Access granted for role: ${role}`);
        authProcessed = true;
        isProcessingAuth = false;
        // Unsubscribe after successful auth check to prevent re-triggering
        if (authUnsubscribe) {
          authUnsubscribe();
          authUnsubscribe = null;
        }
      }

    } catch (error) {
      console.error('[dashboard-auth] Error loading user profile:', error);
      // On error, redirect to login page (only once)
      if (!authProcessed) {
        // Guard: Check if redirect already handled
        if (window.__ctDidRedirect) {
          console.log('[dashboard-auth] Redirect already handled, skipping error redirect');
          return;
        }
        authProcessed = true;
        isProcessingAuth = false;
        if (authUnsubscribe) {
          authUnsubscribe();
          authUnsubscribe = null;
        }
        // Delegate to auth-redirect-controller if available
        if (window.authRedirectController && typeof window.authRedirectController.executeRedirect === 'function') {
          window.authRedirectController.executeRedirect('/login.html');
        } else {
          window.location.href = '/login.html';
        }
      }
    }
  });
});

