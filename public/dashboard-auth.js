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

document.addEventListener('DOMContentLoaded', function() {
  // Verify dependencies
  if (!window.firebaseAuth) {
    console.error('[dashboard-auth] window.firebaseAuth is not available. Ensure firebase-init.js is loaded first.');
    return;
  }

  if (!window.cleartrackAuthApi) {
    console.error('[dashboard-auth] window.cleartrackAuthApi is not available. Ensure firebase-api.js is loaded first.');
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

  // Observe authentication state
  window.firebaseAuth.onAuthStateChanged(async function(user) {
    // User is not logged in - redirect to login page
    if (!user) {
      console.log('[dashboard-auth] No user logged in, redirecting to login page');
      window.location.href = '/login.html';
      return;
    }

    // User is logged in - check their role
    try {
      // Load user profile from Firestore
      let profile;
      let role = 'user'; // Default role
      
      try {
        profile = await window.cleartrackAuthApi.getUserProfile(user.uid);
        if (profile && profile.role) {
          role = profile.role;
        } else {
          console.warn('[dashboard-auth] User profile missing role, defaulting to "user"');
          // Create default user document if it doesn't exist
          if (window.firebaseDb) {
            try {
              await window.firebaseDb.collection('users').doc(user.uid).set({
                email: user.email || '',
                role: 'user',
                createdAt: new Date().toISOString()
              }, { merge: true });
              console.log('[dashboard-auth] Created default user document');
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
            await window.firebaseDb.collection('users').doc(user.uid).set({
              email: user.email || '',
              role: 'user',
              createdAt: new Date().toISOString()
            }, { merge: true });
            console.log('[dashboard-auth] Created default user document after error');
            role = 'user';
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
          window.cleartrackAuthApi.redirectByRole(role);
          return;
        }
        // Role is admin and on admin page - access granted
        console.log('[dashboard-auth] Access granted for role: admin');
      } else if (isPractitionerPage) {
        // On practitioner dashboard
        if (role !== 'practitioner') {
          console.log(`[dashboard-auth] Access denied: User role "${role}" cannot access practitioner dashboard. Redirecting...`);
          window.cleartrackAuthApi.redirectByRole(role);
          return;
        }
        // Role is practitioner and on practitioner page - access granted
        console.log('[dashboard-auth] Access granted for role: practitioner');
      } else if (isUserPage) {
        // On user dashboard
        if (role === 'practitioner' || role === 'admin') {
          console.log('[dashboard-auth] Access denied: Practitioner/Admin cannot access user dashboard. Redirecting...');
          window.cleartrackAuthApi.redirectByRole(role);
          return;
        }
        // Role is user and on user page - access granted
        console.log(`[dashboard-auth] Access granted for role: ${role}`);
      }

    } catch (error) {
      console.error('[dashboard-auth] Error loading user profile:', error);
      // On error, redirect to login page
      window.location.href = '/login.html';
    }
  });
});

