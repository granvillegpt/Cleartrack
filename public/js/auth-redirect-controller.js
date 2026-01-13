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

  // Idempotent redirect guard - ensures redirects happen exactly ONCE
  if (typeof window.__ctDidRedirect === 'undefined') {
    window.__ctDidRedirect = false;
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
   * Ensure user document exists in Firestore with safe defaults
   * @param {string} uid - Firebase Auth UID
   * @param {string} email - User email (optional)
   * @returns {Promise<boolean>} - true if doc exists/created, false on error
   */
  async function ensureUserDoc(uid, email) {
    if (!window.firebaseDb) {
      console.error('[ensureUserDoc] Firestore not available');
      return false;
    }

    try {
      const userRef = window.firebaseDb.collection('users').doc(uid);
      const userDoc = await userRef.get();
      
      // Get FieldValue reference safely (consistent with admin-dashboard.html pattern)
      const FieldValue = (window.firebaseDb && window.firebaseDb.app) 
        ? window.firebaseDb.app.firestore().FieldValue 
        : (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore.FieldValue : null);
      
      if (!userDoc.exists) {
        // Create new user document with safe defaults
        // Note: If document doesn't exist, it's likely a new client signup
        // (practitioners are created via admin approval with role already set)
        const serverTimestamp = FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString();
        await userRef.set({
          uid: uid,
          email: email || null,
          onboardingState: 'NEW', // Safe to set for new documents (will be client)
          createdAt: serverTimestamp,
          updatedAt: serverTimestamp
        }, { merge: false }); // Use set, not merge, for new docs
        console.debug('[ensureUserDoc] Created user document with onboardingState: NEW');
        return true;
      } else {
        // Document exists - check if it needs onboardingState
        const existingData = userDoc.data();
        const existingRole = existingData.role;
        
        // Only add onboardingState to clients (not practitioners/admins)
        // Practitioners are created via admin approval, so they shouldn't have onboardingState
        if (existingRole !== 'practitioner' && existingRole !== 'admin' && !existingData.onboardingState) {
          // Check if user is already set up (has practitioner connection)
          const hasPractitioner = existingData.practitionerId || 
                                 existingData.connectedPractitioner || 
                                 existingData.connectionStatus === 'approved';
          
          // Check if user has completed profile setup
          const hasProfile = existingData.clientRole && 
                            existingData.firstName && 
                            existingData.lastName;
          
          // Determine appropriate onboardingState based on user's current setup
          let newOnboardingState = 'NEW'; // Default for truly new users
          
          if (hasPractitioner && existingData.connectionStatus === 'approved') {
            // Already connected and approved → mark as ACTIVE
            newOnboardingState = 'ACTIVE';
          } else if (hasPractitioner && existingData.connectionStatus === 'pending') {
            // Connection pending → mark as CONNECTION_PENDING
            newOnboardingState = 'CONNECTION_PENDING';
          } else if (hasProfile && !hasPractitioner) {
            // Profile complete but no practitioner → mark as MATCHING
            newOnboardingState = 'MATCHING';
          } else if (existingData.clientRole && !hasProfile) {
            // Role selected but profile incomplete → mark as PROFILE_PENDING
            newOnboardingState = 'PROFILE_PENDING';
          }
          
          // Update with appropriate state
          const serverTimestamp = FieldValue ? FieldValue.serverTimestamp() : new Date().toISOString();
          await userRef.update({
            onboardingState: newOnboardingState,
            updatedAt: serverTimestamp
          });
          console.debug(`[ensureUserDoc] Added onboardingState: ${newOnboardingState} to existing client document (hasPractitioner: ${hasPractitioner}, hasProfile: ${hasProfile})`);
        }
        return true;
      }
    } catch (error) {
      console.error('[ensureUserDoc] Error ensuring user document:', error);
      return false; // Never throw - return boolean
    }
  }

  /**
   * CT-AUTH-REDIRECT-STABILISATION: Resolve user role from users/{uid} ONLY
   * NO email queries - exactly one document per user
   */
  async function resolveUserRole(uid, email) {
    if (!window.firebaseDb) {
      throw new Error('Firestore not available');
    }

    try {
      // Ensure user document exists with safe defaults
      await ensureUserDoc(uid, email);

      // Now read the role from the document
      const userDoc = await window.firebaseDb.collection('users').doc(uid).get();
      
      if (!userDoc.exists) {
        // Should not happen after ensureUserDoc, but fallback to client
        console.warn('[auth-redirect] User document still missing after ensureUserDoc, defaulting to client');
        return 'client';
      }

      const data = userDoc.data();
      const role = String(data.role || 'client').toLowerCase().trim();
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
   * 
   * NOTE: Practitioner approval check happens in initializeAuthRedirect() BEFORE calling this function.
   * Non-approved practitioners have their role overridden to 'client', so if role === 'practitioner' here,
   * we know they are approved.
   * 
   * REFINED FOR ONBOARDING PAGE: Check onboardingState before routing clients to dashboard
   */
  function getRedirectDestination(role, profileReady = false, onboardingState = null, userData = null) {
    if (role === 'practitioner') {
      return '/practitioner-dashboard.html';
    }
    if (role === 'admin') {
      return '/admin-dashboard.html';
    }
    if (normalizeRole(role) === 'client') {
      const hasSubmittedRequest = Boolean(userData?.matchingProfile);

      if (!hasSubmittedRequest) {
        return '/onboarding.html';
      }

      return '/user-dashboard.html';
    }
    // Default fallback
    return '/user-dashboard.html';
  }

  /**
   * CT-AUTH-REDIRECT-STABILISATION: Execute redirect with idempotent guard
   * This is the ONLY function that performs redirects in the application
   */
  function executeRedirect(destination) {
    // Idempotent guard - ensure redirect happens exactly ONCE
    if (window.__ctDidRedirect) {
      console.debug('[auth-redirect] Redirect already executed, ignoring:', destination);
      return;
    }

    if (!destination) {
      console.warn('[auth-redirect] No destination provided for redirect');
      return;
    }

    // Set guard immediately to prevent duplicate redirects
    window.__ctDidRedirect = true;
    window.__redirectHandled = true;
    
    console.debug('[auth-redirect] Executing redirect to:', destination);
    window.location.replace(destination);
  }

  /**
   * CT-AUTH-REDIRECT-STABILISATION: Main auth state handler
   * This is the ONLY place that listens to onAuthStateChanged
   */
  function initializeAuthRedirect() {
    // CRITICAL: Check if on user-dashboard - but allow initialization if we need to check role
    // Only skip if we've already confirmed the user is a client
    if (window.location.pathname.includes('user-dashboard')) {
      // Only skip if we've already confirmed they're a client (prevents infinite loops for clients)
      if (sessionStorage.getItem('ct_user_role_confirmed') === 'client') {
        console.log('[AUTH] Skipping redirect controller initialization on user-dashboard (confirmed client)');
        window.__ctDidRedirect = true;
        window.__redirectHandled = true;
        sessionStorage.setItem('ct_redirect_done', 'true');
        return;
      }
      // Otherwise, continue to check role and redirect practitioners/admins if needed
    }
    
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

    console.log('[AUTH] Initializing auth state listener');

    authUnsubscribe = window.firebaseAuth.onAuthStateChanged(async function(user) {
      // Skip if redirect already handled
      if (window.__redirectHandled) {
        return;
      }

      // User not logged in - firebase-init.js handles redirect to login
      if (!user) {
        console.debug('[auth-redirect] No user logged in (redirect handled by firebase-init.js)');
        // DO NOT redirect - firebase-init.js handles this
        return;
      }

      // User is logged in - ensure user doc, resolve role, and redirect
      try {
        if (userRoleResolved || window.__ctDidRedirect) {
          return; // Already resolved or redirected
        }

        // Step 1: Ensure user document exists with safe defaults
        const userDocEnsured = await ensureUserDoc(user.uid, user.email);
        if (!userDocEnsured) {
          console.error('[auth-redirect] Failed to ensure user document, cannot proceed with redirect');
          return;
        }

        // Step 2: Resolve user role (ensureUserDoc already called inside resolveUserRole, but we call it explicitly first)
        userRoleResolved = true;
        let role = await resolveUserRole(user.uid, user.email);
        // Normalize role: "user" → "client" (in memory only)
        if (role === 'user') {
          role = 'client';
        }
        console.log('[AUTH] Role resolved:', role);

        // Step 2.5: Fetch user document to check practitionerStatus and profile readiness
        let userDoc = null;
        let practitionerStatus = null;
        let profileReady = false;
        let onboardingState = null;
        try {
          userDoc = await window.firebaseDb.collection('users').doc(user.uid).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            practitionerStatus = userData.practitionerStatus || null;
            // REFINED FOR ONBOARDING PAGE: Get onboardingState
            onboardingState = userData.onboardingState || null;
            // Use isProfileReady helper if available, otherwise fallback to basic check
            profileReady = window.isProfileReady ? window.isProfileReady(userData) : Boolean(userData && userData.role);
            // STEP 5: Removed duplicate [PHASE3D] log - single check is sufficient
          }
        } catch (err) {
          console.warn('[auth-redirect] Error fetching user document for practitionerStatus:', err);
        }

        // Step 2.6: Check if user is an approved practitioner
        const isApprovedPractitioner = 
          role === 'practitioner' && 
          practitionerStatus === 'approved';

        // If practitioner but not approved, treat as client
        if (role === 'practitioner' && !isApprovedPractitioner) {
          console.debug('[auth-redirect] Practitioner not approved, routing to client flow');
          role = 'client'; // Override role for routing purposes
        }

        // Add mandatory debug log
        console.log('[AUTH] Redirect decision', {
          role: role,
          practitionerStatus: practitionerStatus,
          isApprovedPractitioner: isApprovedPractitioner
        });

        // Step 4: Determine redirect destination and execute redirect
        const currentPath = window.location.pathname;
        
        // CRITICAL: If user is already on user-dashboard, check role before blocking redirect
        // Allow redirects AWAY from user-dashboard if user is practitioner/admin
        if (currentPath.includes('user-dashboard')) {
          // If user is practitioner or admin, they shouldn't be on user-dashboard - allow redirect
          if (role === 'practitioner' || role === 'admin') {
            console.log('[auth-redirect] Practitioner/admin on user-dashboard, redirecting to correct dashboard');
            const destination = getRedirectDestination(role, profileReady, onboardingState, userData);
            executeRedirect(destination);
            return;
          }
          // If user is a client and already on user-dashboard, prevent redirect to avoid loop
          if (role === 'client' || normalizeRole(role) === 'client') {
            console.debug('[auth-redirect] Client already on user-dashboard, preventing redirect to avoid loop');
            sessionStorage.setItem('ct_user_role_confirmed', 'client');
            window.__ctDidRedirect = true;
            sessionStorage.setItem('ct_redirect_done', 'true');
            window.__redirectHandled = true;
            return;
          }
        }
        
        // REFINED FOR ONBOARDING PAGE: Pass onboardingState to getRedirectDestination
        const destination = getRedirectDestination(role, profileReady, onboardingState, userData);
        
        // Check if already on correct page
        if (currentPath.includes(destination.replace('/', '').replace('.html', ''))) {
          console.debug('[auth-redirect] Already on correct page, no redirect needed');
          window.__ctDidRedirect = true; // Set guard to prevent future redirects
          sessionStorage.setItem('ct_redirect_done', 'true');
          window.__redirectHandled = true;
          return;
        }
        
        // Execute redirect (with idempotent guard inside executeRedirect)
        executeRedirect(destination);
      } catch (error) {
        console.error('[auth-redirect] Error in auth state handler:', error);
        // Do not redirect on error - let user stay on current page
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

