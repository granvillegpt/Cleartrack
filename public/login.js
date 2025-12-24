/**
 * Login and Registration Handler for ClearTrack
 * 
 * Uses Firebase Authentication and Firestore directly (no wrapper)
 * Version: 2.0 - Direct Firebase (no firebase-api.js)
 * Updated: 2025-01-XX
 */

// Global error message element reference
let errorMessageElement = null;

// Helper function to hide error
function hideError() {
  if (errorMessageElement) {
    errorMessageElement.classList.remove('show');
    errorMessageElement.textContent = '';
  }
}

// Helper function to show error
function showError(message) {
  if (errorMessageElement) {
    errorMessageElement.textContent = message;
    errorMessageElement.classList.add('show');
  }
  // Hide success message when showing error
  const successMessageElement = document.getElementById('successMessage');
  if (successMessageElement) {
    successMessageElement.classList.remove('show');
  }
}

// Helper function to show success
function showSuccess() {
  const successMessageElement = document.getElementById('successMessage');
  if (successMessageElement) {
    successMessageElement.classList.add('show');
  }
  // Hide error message when showing success
  hideError();
}

// Global functions for form switching
window.switchToSignIn = function() {
  const signInTab = document.getElementById('signInTab');
  const registerTab = document.getElementById('registerTab');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const formTitleText = document.getElementById('formTitleText');
  const formDescription = document.getElementById('formDescription');
  
  if (signInTab) signInTab.classList.add('active');
  if (registerTab) registerTab.classList.remove('active');
  if (loginForm) loginForm.classList.add('active');
  if (registerForm) registerForm.classList.remove('active');
  if (formTitleText) formTitleText.textContent = 'Sign In';
  if (formDescription) formDescription.textContent = 'Sign in to your ClearTrack account to view your travel logbook, vehicles, and tax documents.';
  hideError();
};

window.switchToRegister = function() {
  const signInTab = document.getElementById('signInTab');
  const registerTab = document.getElementById('registerTab');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const formTitleText = document.getElementById('formTitleText');
  const formDescription = document.getElementById('formDescription');
  
  if (signInTab) signInTab.classList.remove('active');
  if (registerTab) registerTab.classList.add('active');
  if (loginForm) loginForm.classList.remove('active');
  if (registerForm) registerForm.classList.add('active');
  if (formTitleText) formTitleText.textContent = 'Create Account';
  if (formDescription) formDescription.textContent = 'Sign up to get started with ClearTrack';
  hideError();
};

// Helper function to route user based on role
/**
 * Process pending invite and connect user to practitioner
 * @param {string} userId - Firebase user UID
 * @returns {Promise<{success: boolean, practitionerId: string|null, error: string|null}>}
 */
async function processPendingInvite(userId) {
  const pendingInviteId = sessionStorage.getItem('pendingInviteId');
  if (!pendingInviteId) {
    return { success: false, practitionerId: null, error: 'No pending invite' };
  }

  console.log('[processPendingInvite] Processing invite:', pendingInviteId);
  
  // Fast return if no Firebase DB available
  if (!window.firebaseDb) {
    return { success: false, practitionerId: null, error: 'Firebase DB not available' };
  }
  
  try {
    let inviteData = null;
    let practitionerId = null;
    
    // Try Firestore first (if available) with timeout
    if (window.firebaseDb) {
      try {
        const inviteDocPromise = window.firebaseDb.collection('clientInvites').doc(pendingInviteId).get();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Invite query timeout')), 5000)
        );
        
        const inviteDoc = await Promise.race([inviteDocPromise, timeoutPromise]);
        
        if (inviteDoc.exists) {
          inviteData = inviteDoc.data();
          practitionerId = inviteData.practitionerId;
          
          // Check if invite is still valid
          const now = new Date();
          const expiresAt = inviteData.expiresAt?.toDate ? inviteData.expiresAt.toDate() : new Date(inviteData.expiresAt);
          
          if (expiresAt > now && inviteData.status === 'pending') {
            // Batch all Firestore writes together for better performance
            const batch = window.firebaseDb.batch();
            
            // Update user document
            const userRef = window.firebaseDb.collection('users').doc(userId);
            batch.set(userRef, {
              practitionerId: inviteData.practitionerId,
              connectedPractitioner: inviteData.practitionerId,
              connectedAt: firebase.firestore.FieldValue.serverTimestamp(),
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            // Create connection document
            const connectionRef = window.firebaseDb.collection('connections').doc();
            batch.set(connectionRef, {
              userId: userId,
              practitionerId: inviteData.practitionerId,
              connectedAt: firebase.firestore.FieldValue.serverTimestamp(),
              status: 'active'
            });
            
            // Update invite status
            batch.update(inviteDoc.ref, {
              status: 'accepted',
              clientUid: userId,
              acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Execute all writes in a single batch
            await batch.commit();
            
            // Remove from sessionStorage
            sessionStorage.removeItem('pendingInviteId');
            
            console.log('[processPendingInvite] ✅ Auto-connected via Firestore invite to practitioner:', inviteData.practitionerId);
            return { success: true, practitionerId: inviteData.practitionerId, error: null };
          } else {
            console.warn('[processPendingInvite] Invite expired or not pending');
            return { success: false, practitionerId: null, error: 'Invite expired or not pending' };
          }
        }
      } catch (firestoreError) {
        console.warn('[processPendingInvite] Firestore invite check failed, trying localStorage:', firestoreError);
      }
    }
    
    // Fallback to localStorage invite system
    if (window.cleartrackData && typeof window.cleartrackData.getInvite === 'function') {
      const invite = window.cleartrackData.getInvite(pendingInviteId);
      if (invite && invite.status === 'pending') {
        const now = new Date();
        const expiresAt = new Date(invite.expiresAt);
        
        if (expiresAt > now) {
          practitionerId = invite.practitionerId;
          
          // Connect user to practitioner using localStorage
          if (window.cleartrackData && typeof window.cleartrackData.connectUserToPractitioner === 'function') {
            // Get or create user in localStorage
            const data = window.cleartrackData.getData();
            let localUserId = userId;
            
            // If user doesn't exist in localStorage, create them with Firebase UID
            if (!data.users || !data.users[userId]) {
              const userData = {
                firstName: invite.clientFirstName || '',
                lastName: invite.clientLastName || '',
                email: invite.clientEmail || '',
                phone: invite.clientPhone || '',
                taxNumber: invite.clientTaxNumber || '',
                role: 'user',
                connectedPractitioner: practitionerId,
                connectedAt: new Date().toISOString()
              };
              // Use createUserWithId to ensure Firebase UID is used
              if (window.cleartrackData.createUserWithId) {
                const newUser = window.cleartrackData.createUserWithId(userId, userData);
                localUserId = newUser.id;
              } else {
                // Fallback to createUser if createUserWithId doesn't exist
                const newUser = window.cleartrackData.createUser(userData);
                localUserId = newUser.id;
              }
            } else {
              // Update existing user
              window.cleartrackData.connectUserToPractitioner(userId, practitionerId);
            }
            
            // Update invite status
            window.cleartrackData.updateInviteStatus(pendingInviteId, 'accepted', localUserId);
            
            // Also sync to Firestore if available
            if (window.firebaseDb) {
              try {
                // Update user document in Firestore with practitioner connection
                // Use set with merge to handle case where document might not exist yet
                await window.firebaseDb.collection('users').doc(userId).set({
                  practitionerId: practitionerId,
                  connectedPractitioner: practitionerId,
                  connectedAt: firebase.firestore.FieldValue.serverTimestamp(),
                  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                
                // Create connection document in Firestore
                await window.firebaseDb.collection('connections').add({
                  userId: userId,
                  practitionerId: practitionerId,
                  connectedAt: firebase.firestore.FieldValue.serverTimestamp(),
                  status: 'active'
                });
                
                console.log('[processPendingInvite] ✅ Synced connection to Firestore');
              } catch (firestoreSyncError) {
                console.warn('[processPendingInvite] Could not sync to Firestore (non-critical):', firestoreSyncError);
                // Non-critical - localStorage connection is still valid
              }
            }
            
            // Remove from sessionStorage
            sessionStorage.removeItem('pendingInviteId');
            
            console.log('[processPendingInvite] ✅ Auto-connected via localStorage invite to practitioner:', practitionerId);
            return { success: true, practitionerId: practitionerId, error: null };
          }
        } else {
          console.warn('[processPendingInvite] Invite expired');
          return { success: false, practitionerId: null, error: 'Invite expired' };
        }
      }
    }
    
    return { success: false, practitionerId: null, error: 'Invite not found' };
  } catch (error) {
    console.error('[processPendingInvite] Error processing invite:', error);
    return { success: false, practitionerId: null, error: error.message || 'Unknown error' };
  }
}

async function routeUser(role, userId, userData = null) {
  console.log('[routeUser] ========================================');
  console.log('[routeUser] Called with role:', role, 'userId:', userId);
  console.log('[routeUser] Role type:', typeof role);
  
  // Ensure role is a string and lowercase for comparison
  const normalizedRole = String(role || 'user').toLowerCase().trim();
  console.log('[routeUser] Normalized role:', normalizedRole);
  
  // Skip redundant Firestore check if role is already known
  // The role was already checked during login, so we can trust it
  
  if (normalizedRole === 'practitioner') {
    console.log('[routeUser] ✅ Routing to practitioner dashboard');
    safeRedirect('/practitioner-dashboard.html');
    return;
  } else if (normalizedRole === 'admin') {
    console.log('[routeUser] ✅ Routing to admin dashboard');
    safeRedirect('/admin-dashboard.html');
    return;
  } else {
    // For regular users (default), check if they have a practitioner
    console.log('[routeUser] Routing regular user - checking for practitioner connection');
    
    // Use userData if provided to avoid redundant Firestore query
    let practitionerId = null;
    if (userData) {
      practitionerId = userData.practitionerId || userData.connectedPractitioner || null;
      console.log('[routeUser] Practitioner ID from userData:', practitionerId);
    }
    
    // Only check Firestore if we don't have userData or no practitioner found
    if (!practitionerId && window.firebaseDb && userId) {
      // Quick check for pending invite (non-blocking, fast timeout)
      const pendingInviteId = sessionStorage.getItem('pendingInviteId');
      if (pendingInviteId) {
        // Process invite in background, don't wait
        processPendingInvite(userId).then(inviteResult => {
          if (inviteResult.success) {
            console.log('[routeUser] ✅ Auto-connected via invite (background)');
          }
        }).catch(err => {
          console.warn('[routeUser] Invite processing failed (non-blocking):', err);
        });
      }
      
      // Check practitioner connection with very short timeout
      try {
        const userDocPromise = window.firebaseDb.collection('users').doc(userId).get();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 3000)
        );
        
        const userDoc = await Promise.race([userDocPromise, timeoutPromise]);
        
        if (userDoc.exists) {
          const docData = userDoc.data();
          practitionerId = docData.practitionerId || docData.connectedPractitioner || null;
          console.log('[routeUser] Practitioner ID from Firestore:', practitionerId);
        }
      } catch (error) {
        console.warn('[routeUser] Error checking practitioner (non-blocking):', error);
        // Continue with routing - dashboard will handle practitioner check
      }
    }
    
    // Route based on practitioner status
    if (!practitionerId) {
      console.log('[routeUser] No practitioner found - routing to onboarding');
      safeRedirect('/client-onboarding.html');
      return;
    } else {
      console.log('[routeUser] Practitioner found - routing to user dashboard');
      safeRedirect('/user-dashboard.html');
      return;
    }
  }
}

// Helper function to get user-friendly error message
function getAuthErrorMessage(error) {
  const code = error.code || '';
  const messages = {
    'auth/user-not-found': 'No user found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/email-already-in-use': 'This email is already registered. Please use a different email or try logging in.',
    'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
    'auth/operation-not-allowed': 'Email/Password authentication is not enabled. Please contact support.',
    'auth/invalid-login-credentials': 'Invalid email or password. Please check your credentials.',
    'auth/missing-email': 'Please enter your email address.',
    'resource-exhausted': 'Database storage limit reached. Please contact support.',
    'permission-denied': 'You do not have permission to perform this action.',
    'unavailable': 'Service temporarily unavailable. Please try again later.',
    'deadline-exceeded': 'Request timed out. Please try again.',
  };
  
  // Check for database space errors in the message
  if (error.message && (
    error.message.includes('not enough space') ||
    error.message.includes('PutOrAdd') ||
    error.message.includes('resource-exhausted')
  )) {
    return 'Database storage limit reached. Please contact support or try again later.';
  }
  
  return messages[code] || error.message || 'An error occurred. Please try again.';
}

console.log('[login.js] ✅ Script file loaded');

// Prevent redirect loops - check if we're already redirecting
let isRedirecting = false;
let redirectTimeout = null;

// Guard against multiple redirects
/**
 * Routes user after successful login based on their role
 * ABSOLUTELY BULLETPROOF: ALWAYS checks by email FIRST before routing
 */
async function routeUserAfterLogin(user, role, userData) {
  console.log('[login.js] ========================================');
  console.log('[login.js] routeUserAfterLogin() - Starting');
  console.log('[login.js] User UID:', user.uid);
  console.log('[login.js] User email:', user.email);
  console.log('[login.js] Role parameter:', role);
  
  // Set overall timeout for routing (max 10 seconds)
  const routingTimeout = setTimeout(() => {
    console.error('[login.js] ⚠️ Routing timeout - forcing redirect to onboarding');
    setLoginLoading(false);
    safeRedirect('/client-onboarding.html');
  }, 10000);
  
  try {
    setLoginLoading(true, 'Welcome to ClearTrack!', 'Redirecting to your dashboard');
    
    const email = user.email?.toLowerCase().trim();
    let finalRole = String(role || userData?.role || 'user').toLowerCase().trim();
    
    // OPTIMIZATION: For regular users without practitioner, skip complex queries
    // If role is 'user' and no practitioner connection, route directly to onboarding
    if (finalRole === 'user' && !userData?.practitionerId && !userData?.connectedPractitioner) {
      console.log('[login.js] ✅ Regular user detected - routing directly to onboarding (skipping complex queries)');
      clearTimeout(routingTimeout);
      setLoginLoading(false);
      setTimeout(() => {
        safeRedirect('/client-onboarding.html');
      }, 300);
      return;
    }
    
    // CRITICAL: ALWAYS check by email FIRST - this is the most reliable method
    if (email) {
      console.log('[login.js] 🔍🔍🔍 CHECKING BY EMAIL FIRST (MOST RELIABLE) 🔍🔍🔍');
      console.log('[login.js] 🔍 Email to check:', email);
      
      try {
        const emailQuery = window.firebaseDb.collection('users')
          .where('email', '==', email);
        
        console.log('[login.js] 🔍 Executing email query...');
        const emailDocs = await Promise.race([
          emailQuery.get(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
      
      console.log('[login.js] 🔍 Query completed. Found', emailDocs.size, 'document(s) by email');
      
      if (emailDocs.empty) {
        console.log('[login.js] ⚠️ NO DOCUMENTS FOUND BY EMAIL!');
      } else {
        // Check ALL documents found by email
        for (const doc of emailDocs.docs) {
          const data = doc.data();
          const docRole = String(data.role || 'user').toLowerCase().trim();
          console.log('[login.js] 🔍 Email doc ID:', doc.id);
          console.log('[login.js] 🔍 Email doc data:', JSON.stringify(data, null, 2));
          console.log('[login.js] 🔍 Email doc role:', docRole, 'type:', typeof docRole);
          
          if (docRole === 'practitioner' || docRole === 'admin') {
            console.log('[login.js] ✅✅✅✅✅ FOUND', docRole.toUpperCase(), 'BY EMAIL - ID:', doc.id);
            
            // Migrate to UID immediately
            try {
              await window.firebaseDb.collection('users').doc(user.uid).set(data, { merge: true });
              console.log('[login.js] ✅ Migrated to UID document');
              
              if (doc.id !== user.uid) {
                await doc.ref.delete();
                console.log('[login.js] ✅ Deleted old document:', doc.id);
              }
            } catch (migrateError) {
              console.warn('[login.js] Migration error (continuing anyway):', migrateError);
            }
            
            finalRole = docRole;
            console.log('[login.js] ✅✅✅✅✅ FINAL ROLE SET TO:', finalRole);
            break; // Found practitioner/admin, stop checking
          } else {
            console.log('[login.js] ⚠️ Doc role is not practitioner/admin:', docRole);
          }
        }
      }
    } catch (err) {
      console.error('[login.js] ❌ Email check error:', err);
      console.error('[login.js] Error details:', err.message, err.stack);
      // Continue with role from userData if email check fails
    }
  } else {
    console.log('[login.js] ⚠️ No email available to check');
  }
  
  // Also check UID document as backup (only if we haven't found practitioner/admin yet)
  if (finalRole !== 'practitioner' && finalRole !== 'admin') {
    try {
      const uidDoc = await Promise.race([
        window.firebaseDb.collection('users').doc(user.uid).get(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);
      
      if (uidDoc.exists) {
        const uidRole = String(uidDoc.data().role || 'user').toLowerCase().trim();
        console.log('[login.js] 🔍 UID doc role:', uidRole);
        
        if (uidRole === 'practitioner' || uidRole === 'admin') {
          finalRole = uidRole;
          console.log('[login.js] ✅ Using UID doc role:', finalRole);
        }
      }
    } catch (uidError) {
      console.warn('[login.js] UID check error:', uidError.message);
      // Continue with existing role
    }
  }
  
    // Route based on final role
    console.log('[login.js] ========================================');
    console.log('[login.js] FINAL ROLE FOR ROUTING:', finalRole);
    console.log('[login.js] ========================================');
    
    // Clear timeout since we're routing successfully
    clearTimeout(routingTimeout);
    
    // Hide loading screen before redirect to prevent it from persisting
    setLoginLoading(false);
    
    if (finalRole === 'practitioner') {
      console.log('[login.js] ✅✅✅✅✅ ROUTING TO PRACTITIONER DASHBOARD');
      setTimeout(() => {
        safeRedirect('/practitioner-dashboard.html');
      }, 200);
      return;
    }
    
    if (finalRole === 'admin') {
      console.log('[login.js] ✅✅✅✅✅ ROUTING TO ADMIN DASHBOARD');
      setTimeout(() => {
        safeRedirect('/admin-dashboard.html');
      }, 200);
      return;
    }
    
    // Regular users
    const practitionerId = userData?.practitionerId || userData?.connectedPractitioner || null;
    if (practitionerId) {
      console.log('[login.js] ✅ User has practitioner - routing to user dashboard');
      setTimeout(() => {
        safeRedirect('/user-dashboard.html');
      }, 200);
      return;
    }
    
    // Default: onboarding (only for regular users)
    console.log('[login.js] ✅ Routing to client onboarding (regular user)');
    setTimeout(() => {
      safeRedirect('/client-onboarding.html');
    }, 200);
    
  } catch (routingError) {
    console.error('[login.js] ❌ Error in routeUserAfterLogin:', routingError);
    clearTimeout(routingTimeout);
    setLoginLoading(false);
    // Fallback: redirect to onboarding
    setTimeout(() => {
      safeRedirect('/client-onboarding.html');
    }, 200);
  }
}

function safeRedirect(url) {
  if (isRedirecting) {
    console.warn('[login.js] Already redirecting, ignoring duplicate redirect to:', url);
    return;
  }
  
  // Clear any existing redirect timeout
  if (redirectTimeout) {
    clearTimeout(redirectTimeout);
  }
  
  isRedirecting = true;
  console.log('[login.js] ✅✅✅ REDIRECTING TO:', url);
  
  // Set a timeout to reset the flag in case redirect fails
  redirectTimeout = setTimeout(() => {
    isRedirecting = false;
    console.warn('[login.js] Redirect timeout - resetting redirect flag');
  }, 5000);
  
  // Perform redirect with cache bust - use replace to avoid back button
  const cacheBust = '?v=' + Date.now();
  const finalUrl = url.includes('?') ? url + '&v=' + Date.now() : url + cacheBust;
  window.location.replace(finalUrl);
}

document.addEventListener('DOMContentLoaded', function() {
  console.log('[login.js] ✅ DOMContentLoaded - initializing login handlers');
  
  // Prevent multiple initializations
  if (window.loginInitialized) {
    console.warn('[login.js] Already initialized, skipping');
    return;
  }
  window.loginInitialized = true;
  
  // Check for inviteId in URL and store it for after login
  const urlParams = new URLSearchParams(window.location.search);
  const inviteId = urlParams.get('inviteId');
  if (inviteId) {
    console.log('[login.js] Invite link detected, storing inviteId:', inviteId);
    sessionStorage.setItem('pendingInviteId', inviteId);
    
    // Show message to user
    const formDescription = document.getElementById('formDescription');
    if (formDescription) {
      formDescription.textContent = 'Sign in or create an account to connect with your practitioner.';
    }
  }
  
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submitBtn');
  const registerBtn = document.getElementById('registerBtn');
  errorMessageElement = document.getElementById('errorMessage');
  
  // Remember Me functionality for PWA
  const rememberMeContainer = document.getElementById('rememberMeContainer');
  const rememberMeCheckbox = document.getElementById('rememberMe');
  
  // Check if app is running as PWA
  function isPWA() {
    // Check for standalone display mode (iOS Safari, Android Chrome)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    // Check for iOS standalone mode (older method)
    const isIOSStandalone = window.navigator.standalone === true;
    // Check if launched from home screen (Android)
    const isAndroidPWA = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.matchMedia('(display-mode: fullscreen)').matches && 
                          !window.matchMedia('(display-mode: browser)').matches);
    
    return isStandalone || isIOSStandalone || isAndroidPWA;
  }
  
  // Show Remember Me checkbox only in PWA mode
  if (rememberMeContainer && rememberMeCheckbox) {
    if (isPWA()) {
      console.log('[login.js] PWA detected - showing Remember Me checkbox');
      rememberMeContainer.style.display = 'flex';
      
      // Load saved email if Remember Me was previously checked
      const savedEmail = localStorage.getItem('cleartrack_remembered_email');
      if (savedEmail) {
        emailInput.value = savedEmail;
        rememberMeCheckbox.checked = true;
        console.log('[login.js] Loaded saved email:', savedEmail);
      }
    } else {
      rememberMeContainer.style.display = 'none';
    }
  }
  
  // Add event listeners for tab buttons
  const signInTab = document.getElementById('signInTab');
  const registerTab = document.getElementById('registerTab');
  
  if (signInTab) {
    signInTab.addEventListener('click', function(e) {
      e.preventDefault();
      window.switchToSignIn();
    });
  }
  
  if (registerTab) {
    registerTab.addEventListener('click', function(e) {
      e.preventDefault();
      window.switchToRegister();
    });
  }

  // Handle forgot password link
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  const forgotPasswordSuccess = document.getElementById('forgotPasswordSuccess');
  
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', async function(e) {
      e.preventDefault();
      console.log('[login.js] Forgot password link clicked');
      
      // Hide any previous messages
      hideError();
      if (forgotPasswordSuccess) {
        forgotPasswordSuccess.style.display = 'none';
      }
      
      // Check Firebase is available
      if (!window.firebaseAuth) {
        console.error('[login.js] Firebase Auth not available');
        showError('Firebase is not initialized. Please refresh the page.');
        return;
      }

      // Get email from the email input field
      const email = emailInput ? emailInput.value.trim() : '';
      console.log('[login.js] Email from input:', email);
      
      let emailToUse = email;
      
      // If no email in field, prompt for it
      if (!email) {
        const userEmail = prompt('Please enter your email address to reset your password:');
        if (!userEmail || !userEmail.trim()) {
          console.log('[login.js] User cancelled or entered empty email');
          return; // User cancelled
        }
        emailToUse = userEmail.trim();
      }
      
      console.log('[login.js] Sending password reset email to:', emailToUse);
      
      try {
        await window.firebaseAuth.sendPasswordResetEmail(emailToUse);
        console.log('[login.js] Password reset email sent successfully');
        
        // Show success message
        if (forgotPasswordSuccess) {
          forgotPasswordSuccess.style.display = 'block';
          // Scroll to show the message
          forgotPasswordSuccess.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          // Fallback to alert if element not found
          alert('Password reset email sent! Please check your inbox and follow the instructions to reset your password.');
        }
        
        hideError();
      } catch (error) {
        console.error('[login.js] Password reset error:', error);
        console.error('[login.js] Error code:', error.code);
        console.error('[login.js] Error message:', error.message);
        const errorMsg = getAuthErrorMessage(error);
        showError(errorMsg);
        if (forgotPasswordSuccess) {
          forgotPasswordSuccess.style.display = 'none';
        }
      }
    });
  } else {
    console.error('[login.js] Forgot password link element not found!');
  }

  // Validate all required elements exist
  console.log('[login.js] Checking for required elements...');
  console.log('[login.js] errorMessageElement:', !!errorMessageElement);
  console.log('[login.js] loginForm:', !!loginForm);
  console.log('[login.js] registerForm:', !!registerForm);
  console.log('[login.js] registerBtn:', !!registerBtn);
  
  if (!errorMessageElement || !loginForm || !registerForm || !registerBtn) {
    console.error('[login.js] ❌❌❌ Required form elements not found!');
    console.error('[login.js] errorMessageElement:', errorMessageElement);
    console.error('[login.js] loginForm:', loginForm);
    console.error('[login.js] registerForm:', registerForm);
    console.error('[login.js] registerBtn:', registerBtn);
    return;
  }
  
  console.log('[login.js] ✅ All required elements found');

  // Reset button state on page load (in case it was stuck from previous attempt)
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
  }
  if (registerBtn) {
    registerBtn.disabled = false;
    registerBtn.textContent = 'Create Account';
  }

  console.log('[login.js] Initializing login handlers...');

  // Helper function to set loading state for login
  let loginTimeout = null;
  
  // Reset loading overlay on page load to ensure it's ready
  function resetLoadingOverlay() {
    try {
      const overlay = document.getElementById('loadingOverlay');
      if (overlay) {
        overlay.classList.remove('show');
        // Don't set inline styles - let CSS handle it
      }
    } catch (error) {
      console.warn('[login.js] Error resetting loading overlay:', error);
    }
  }
  
  // Reset immediately when DOM is ready
  try {
    resetLoadingOverlay();
  } catch (initError) {
    console.warn('[login.js] Error initializing loading overlay:', initError);
  }
  
  // Get loading overlay elements - use function to ensure they're found
  function getLoadingElements() {
    return {
      overlay: document.getElementById('loadingOverlay'),
      text: document.getElementById('loadingText'),
      subtext: document.getElementById('loadingSubtext')
    };
  }
  
  function setLoginLoading(isLoading, message = 'Signing in to ClearTrack...', submessage = 'Please wait') {
    try {
      if (submitBtn) {
        submitBtn.disabled = isLoading;
        submitBtn.textContent = isLoading ? 'Signing in...' : 'Sign In';
      }
    } catch (btnError) {
      console.warn('[login.js] Error updating submit button:', btnError);
    }
    
    // Get elements fresh each time to ensure they exist
    let loadingOverlay, loadingText, loadingSubtext;
    try {
      const elements = getLoadingElements();
      loadingOverlay = elements.overlay;
      loadingText = elements.text;
      loadingSubtext = elements.subtext;
    } catch (elementError) {
      console.error('[login.js] Error getting loading elements:', elementError);
      return; // Can't proceed without overlay
    }
    
    // If overlay doesn't exist, create it (fallback only)
    if (!loadingOverlay) {
      console.warn('[login.js] Loading overlay not found, creating...');
      loadingOverlay = document.createElement('div');
      loadingOverlay.id = 'loadingOverlay';
      loadingOverlay.className = 'loading-overlay';
      loadingOverlay.innerHTML = `
        <div class="loading-spinner-wrapper" style="position: relative !important; width: 100px !important; height: 100px !important; margin: 0 auto 1.5rem !important; display: flex !important; align-items: center !important; justify-content: center !important;">
          <div class="loading-spinner" style="width: 100px !important; height: 100px !important; border: 4px solid #e5e7eb !important; border-top: 4px solid #0b7285 !important; border-radius: 50% !important; animation: spin 1s linear infinite !important; margin: 0 !important; position: absolute !important; top: 0 !important; left: 0 !important; background: transparent !important; z-index: 1 !important;"></div>
          <div class="loading-spinner-logo" id="loginLoadingLogo" style="position: absolute !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; width: 75px !important; height: 75px !important; z-index: 10 !important; display: flex !important; align-items: center !important; justify-content: center !important; visibility: visible !important; opacity: 1 !important; background: transparent !important;">
            <img src="/assets/images/icon%20logo.png" alt="ClearTrack Logo" id="loadingLogoImg" style="width: 100% !important; height: 100% !important; display: block !important; visibility: visible !important; opacity: 1 !important; z-index: 10 !important; object-fit: contain !important; object-position: center center !important; border: none !important;" onload="console.log('✅ LOGO LOADED:', this.src);" onerror="console.error('❌ LOGO FAILED:', this.src);">
          </div>
        </div>
        <div class="loading-text" id="loadingText">${message}</div>
        <div class="loading-subtext" id="loadingSubtext">${submessage}</div>
      `;
      document.body.appendChild(loadingOverlay);
      // Update references
      const newText = document.getElementById('loadingText');
      const newSubtext = document.getElementById('loadingSubtext');
      if (newText) newText.textContent = message;
      if (newSubtext) newSubtext.textContent = submessage;
    } else {
      // Overlay exists in HTML - ensure only ONE logo exists and it's the correct one
      try {
        const existingLogos = loadingOverlay.querySelectorAll('.loading-spinner-logo');
        const existingImages = loadingOverlay.querySelectorAll('.loading-spinner-logo img, #loadingLogoImg');
        
        // Remove all logo containers except the first one
        if (existingLogos.length > 1) {
          console.warn('[login.js] Found multiple logo containers, removing duplicates');
          for (let i = 1; i < existingLogos.length; i++) {
            try {
              existingLogos[i].remove();
            } catch (removeError) {
              console.warn('[login.js] Error removing duplicate logo:', removeError);
            }
          }
        }
        
        // Ensure the logo image is correct
        const logoImg = loadingOverlay.querySelector('#loadingLogoImg') || loadingOverlay.querySelector('.loading-spinner-logo img');
        if (logoImg) {
          try {
            // Force reload the correct logo
            logoImg.src = '/assets/images/icon%20logo.png';
            logoImg.alt = 'ClearTrack Logo';
            logoImg.id = 'loadingLogoImg';
            // Remove any other images
            existingImages.forEach((img, index) => {
              if (index > 0 && img !== logoImg) {
                try {
                  img.remove();
                } catch (imgRemoveError) {
                  console.warn('[login.js] Error removing duplicate image:', imgRemoveError);
                }
              }
            });
          } catch (logoError) {
            console.warn('[login.js] Error updating logo:', logoError);
          }
        } else {
          // No logo found, create it
          const logoContainer = loadingOverlay.querySelector('.loading-spinner-logo');
          if (logoContainer) {
            try {
              logoContainer.innerHTML = '<img src="/assets/images/icon%20logo.png" alt="ClearTrack Logo" id="loadingLogoImg" onerror="this.style.display=\'none\';">';
            } catch (createLogoError) {
              console.warn('[login.js] Error creating logo:', createLogoError);
            }
          }
        }
      } catch (logoCheckError) {
        console.warn('[login.js] Error checking/updating logo:', logoCheckError);
        // Continue anyway - logo is not critical
      }
    }
    
    // Show/hide loading overlay - keep it visible during transitions
    if (!loadingOverlay) {
      console.error('[login.js] Loading overlay not available');
      return;
    }
    
    try {
      if (isLoading) {
        // Update messages immediately
        try {
          if (loadingText) loadingText.textContent = message || 'Loading...';
          if (loadingSubtext) loadingSubtext.textContent = submessage || '';
        } catch (textError) {
          console.warn('[login.js] Error updating text:', textError);
        }
        
        // Force reset any previous state first
        loadingOverlay.classList.remove('show');
        
        // Remove inline styles that might hide it
        try {
          loadingOverlay.style.removeProperty('display');
          loadingOverlay.style.removeProperty('visibility');
          loadingOverlay.style.removeProperty('opacity');
        } catch (styleError) {
          console.warn('[login.js] Error removing styles:', styleError);
        }
        
        // Show immediately - no requestAnimationFrame delay
        // Force visibility with inline styles for immediate display
        // Set individual properties to preserve background-image from CSS
        try {
          loadingOverlay.style.position = 'fixed';
          loadingOverlay.style.top = '0';
          loadingOverlay.style.left = '0';
          loadingOverlay.style.right = '0';
          loadingOverlay.style.bottom = '0';
          loadingOverlay.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
          loadingOverlay.style.backdropFilter = 'blur(1px)';
          loadingOverlay.style.webkitBackdropFilter = 'blur(1px)';
          loadingOverlay.style.display = 'flex';
          loadingOverlay.style.alignItems = 'center';
          loadingOverlay.style.justifyContent = 'center';
          loadingOverlay.style.flexDirection = 'column';
          loadingOverlay.style.zIndex = '99999';
          loadingOverlay.style.opacity = '1';
          loadingOverlay.style.visibility = 'visible';
          loadingOverlay.style.pointerEvents = 'auto';
          // Don't set background or backgroundImage - let CSS handle the splash screen
          loadingOverlay.classList.add('show');
        } catch (showError) {
          console.error('[login.js] Error showing overlay:', showError);
          // Fallback: just add the show class
          loadingOverlay.classList.add('show');
        }
        
        // Ensure logo is visible (non-critical, don't fail if this errors)
        try {
          const logoImg = loadingOverlay.querySelector('#loadingLogoImg');
          const logoContainer = loadingOverlay.querySelector('.loading-spinner-logo');
          if (logoImg) {
            logoImg.style.cssText = 'width: 100% !important; height: 100% !important; display: block !important; visibility: visible !important; opacity: 1 !important; z-index: 10 !important; object-fit: contain !important; object-position: center center !important;';
          }
          if (logoContainer) {
            logoContainer.style.cssText = 'position: absolute !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; width: 75px !important; height: 75px !important; z-index: 10 !important; display: flex !important; align-items: center !important; justify-content: center !important; visibility: visible !important; opacity: 1 !important;';
          }
        } catch (logoError) {
          console.warn('[login.js] Error ensuring logo visibility:', logoError);
          // Continue - logo is not critical
        }
      } else {
        // Only hide if explicitly set to false (not during transitions)
        try {
          loadingOverlay.classList.remove('show');
          // Use setTimeout to ensure smooth transition
          setTimeout(() => {
            try {
              if (loadingOverlay && !loadingOverlay.classList.contains('show')) {
                loadingOverlay.style.display = 'none';
                loadingOverlay.style.visibility = 'hidden';
                loadingOverlay.style.opacity = '0';
              }
            } catch (hideError) {
              console.warn('[login.js] Error hiding overlay:', hideError);
            }
          }, 300);
        } catch (hideError) {
          console.warn('[login.js] Error hiding overlay:', hideError);
        }
      }
    } catch (overlayError) {
      console.error('[login.js] Critical error in setLoginLoading:', overlayError);
      // Try basic fallback
      try {
        if (isLoading) {
          loadingOverlay.classList.add('show');
        } else {
          loadingOverlay.classList.remove('show');
        }
      } catch (fallbackError) {
        console.error('[login.js] Fallback also failed:', fallbackError);
      }
    }
    
    // Clear any existing timeout
    if (loginTimeout) {
      clearTimeout(loginTimeout);
      loginTimeout = null;
    }
    
    // If loading, set a timeout to reset button after 50 seconds (safety net)
    // Increased to 50s to account for slow networks, but operations have individual timeouts
    if (isLoading) {
      loginTimeout = setTimeout(() => {
        console.error('[login.js] Login timeout - resetting button state');
        setLoginLoading(false);
        showError('Login is taking longer than expected. Please check your connection and try again.');
      }, 50000); // 50 second timeout (safety net, should not normally trigger)
    }
  }

  // Helper function to set loading state for registration
  function setRegisterLoading(isLoading) {
    if (registerBtn) {
    registerBtn.disabled = isLoading;
    registerBtn.textContent = isLoading ? 'Creating account...' : 'Create Account';
    }
  }

  // Handle login form submission
  console.log('[login.js] Setting up login form submit handler');
  if (!loginForm) {
    console.error('[login.js] ❌❌❌ LOGIN FORM NOT FOUND! Cannot attach submit handler.');
    return;
  }
  
  loginForm.addEventListener('submit', async function(e) {
    console.log('[login.js] ========================================');
    console.log('[login.js] 🔵 LOGIN FORM SUBMITTED!');
    console.log('[login.js] ========================================');
    e.preventDefault();
    hideError();

    // Check Firebase is available
    if (!window.firebaseAuth || !window.firebaseDb) {
      showError('Firebase is not initialized. Please refresh the page.');
      console.error('[login.js] Firebase not available');
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Please enter both email and password.');
      return;
    }

    // Handle Remember Me checkbox (PWA only)
    if (rememberMeCheckbox && rememberMeContainer && rememberMeContainer.style.display !== 'none') {
      if (rememberMeCheckbox.checked) {
        // Store email for future auto-fill
        localStorage.setItem('cleartrack_remembered_email', email);
        console.log('[login.js] Remember Me checked - email saved');
        
        // Ensure Firebase uses persistent auth (it's the default, but we'll set it explicitly)
        if (window.firebaseAuth && window.firebaseAuth.setPersistence) {
          try {
            // Firebase Auth persistence is already LOCAL by default, but we'll ensure it
            // Note: In Firebase v9+, persistence is handled automatically
            console.log('[login.js] Ensuring persistent authentication');
          } catch (persistError) {
            console.warn('[login.js] Could not set persistence (may not be needed):', persistError);
          }
        }
      } else {
        // Remove saved email if unchecked
        localStorage.removeItem('cleartrack_remembered_email');
        console.log('[login.js] Remember Me unchecked - email removed');
      }
    }

    // Show loading screen IMMEDIATELY - no delays, synchronous
    setLoginLoading(true, 'Signing in to ClearTrack...', 'Please wait');
    console.log('[login.js] ✅ Loading screen activated');

    try {
      console.log('[login.js] Attempting login for:', email);
      
      // Check Firebase is actually available and initialized
      if (!window.firebaseAuth || !window.firebaseDb) {
        throw new Error('Firebase is not initialized. Please refresh the page.');
      }
      
      // Verify Firebase Auth is ready
      if (typeof window.firebaseAuth.signInWithEmailAndPassword !== 'function') {
        throw new Error('Firebase Authentication is not available. Please refresh the page.');
      }
      
      // Step 1: Sign in with Firebase Auth (with timeout)
      console.log('[login.js] Step 1: Starting Firebase Auth sign-in...');
      setLoginLoading(true, 'Signing in to ClearTrack...', 'Verifying your credentials');
      const startTime = Date.now();
      
      // Check network connectivity first
      if (!navigator.onLine) {
        setLoginLoading(false);
        throw new Error('No internet connection. Please check your network and try again.');
      }
      
      // Start auth immediately - no delays
      const authPromise = window.firebaseAuth.signInWithEmailAndPassword(email, password);
      const authTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => {
          const elapsed = Date.now() - startTime;
          console.error(`[login.js] Authentication timeout after ${elapsed}ms`);
          // Keep loading screen visible during error
          setLoginLoading(true, 'Connection timeout', 'Please check your internet connection');
          reject(new Error('Authentication is taking longer than expected. This may be due to a slow connection or Firebase service issues. Please check your internet connection and try again.'));
        }, 45000) // Increased to 45 seconds for slower connections
      );
      
      const userCredential = await Promise.race([authPromise, authTimeoutPromise]);
      const user = userCredential.user;
      const authTime = Date.now() - startTime;
      console.log(`[login.js] ✅ Step 1: Authentication successful, UID: ${user.uid} (took ${authTime}ms)`);

      // Step 2 & 3: Parallelize user doc fetch and token generation for speed
      console.log('[login.js] Step 2: Fetching user document and generating token in parallel...');
      setLoginLoading(true, 'Loading your profile...', 'Setting up your ClearTrack account');
      const step2StartTime = Date.now();
      let userData = {};
      let role = 'user'; // ALWAYS default to 'user'
      
      // Start both operations in parallel
      const userDocPromise = window.firebaseDb.collection('users').doc(user.uid).get();
      const tokenPromise = user.getIdToken();
      
      // Race both with timeouts
      const userDocTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('User document query timeout')), 8000)
      );
      const tokenTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Token generation timeout')), 8000)
      );
      
      let token = null;
      let userDoc = null;
      
      console.log('[login.js] 🔍 Starting Step 2 - fetching token and user document...');
      
      // Get token (non-blocking)
      tokenPromise.then(t => {
        token = t;
        localStorage.setItem('token', token);
        console.log('[login.js] ✅ Token retrieved');
      }).catch(err => {
        console.warn('[login.js] ⚠️ Token retrieval failed:', err);
      });
      
      // Get user document with timeout - don't let it hang
      try {
        userDoc = await Promise.race([
          userDocPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
        console.log('[login.js] ✅ User document retrieved, exists:', userDoc.exists);
      } catch (docError) {
        console.warn('[login.js] ⚠️ User document query timed out or failed:', docError.message);
        userDoc = { exists: false };
      }
      
      // Get token if not already set
      if (!token) {
        try {
          token = await Promise.race([tokenPromise, new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))]);
          localStorage.setItem('token', token);
          console.log('[login.js] ✅ Token retrieved (delayed)');
        } catch (err) {
          console.warn('[login.js] ⚠️ Token not available, continuing anyway');
        }
      }
      
      const step2Time = Date.now() - step2StartTime;
      console.log(`[login.js] ✅ Step 2: Completed (took ${step2Time}ms)`);
      
      try {
        
        if (userDoc && userDoc.exists) {
          userData = userDoc.data();
          const existingRole = userData.role;
          console.log('[login.js] User document found, role:', existingRole, 'type:', typeof existingRole);
          
          // Normalize role for comparison (handle case sensitivity and whitespace)
          const normalizedExistingRole = String(existingRole || '').toLowerCase().trim();
          console.log('[login.js] Normalized existing role:', normalizedExistingRole);
          
          // Use existing role if it's already set correctly
          if (normalizedExistingRole === 'practitioner' || normalizedExistingRole === 'admin') {
            role = normalizedExistingRole;
            console.log('[login.js] ✅ Using existing role:', role);
          } else if (existingRole && normalizedExistingRole !== 'user' && normalizedExistingRole !== '') {
            // Invalid role - correct it (non-blocking, don't wait)
            console.log('[login.js] Correcting invalid role:', existingRole);
            window.firebaseDb.collection('users').doc(user.uid).update({ role: 'user' }).catch(err => {
              console.error('[login.js] Failed to update role:', err);
            });
            userData.role = 'user';
            role = 'user';
          } else {
            // Role is 'user' or undefined - check for practitioner document by email FIRST
            const normalizedEmail = user.email.toLowerCase().trim();
            console.log('[login.js] ⚠️ UID document has role "user" - checking users collection by email...');
            
            try {
              // CRITICAL: Check users collection by email - NO ROLE FILTER (get all docs by email)
              console.log('[login.js] 🔍🔍🔍 Checking ALL documents by email (no role filter)...');
              const emailUserCheck = await Promise.race([
                window.firebaseDb.collection('users')
                  .where('email', '==', normalizedEmail)
                  .get(), // Get ALL documents, not just practitioner
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
              ]);
              
              console.log('[login.js] 🔍 Found', emailUserCheck.size, 'total document(s) by email');
              
              if (!emailUserCheck.empty) {
                // Check ALL documents found by email
                for (const emailDoc of emailUserCheck.docs) {
                  const emailData = emailDoc.data();
                  const emailRole = String(emailData.role || 'user').toLowerCase().trim();
                  console.log('[login.js] 🔍 Email doc ID:', emailDoc.id, 'Role:', emailRole);
                  
                  if (emailRole === 'practitioner' || emailRole === 'admin') {
                    console.log('[login.js] ✅✅✅ FOUND', emailRole.toUpperCase(), 'DOCUMENT BY EMAIL - ID:', emailDoc.id);
                    console.log('[login.js] 🔍 Email document data:', JSON.stringify(emailData, null, 2));
                    
                    // Migrate to UID-based document
                    await window.firebaseDb.collection('users').doc(user.uid).set(emailData, { merge: true });
                    
                    // Delete old document if it's not the UID
                    if (emailDoc.id !== user.uid) {
                      await emailDoc.ref.delete();
                      console.log('[login.js] ✅ Deleted old document:', emailDoc.id);
                    }
                    
                    role = emailRole;
                    userData = emailData;
                    console.log('[login.js] ✅✅✅ MIGRATED AND SET ROLE TO:', role);
                    break; // Found practitioner/admin, stop checking
                  }
                }
                
                // If we didn't find practitioner/admin in email docs, continue to application check
                if (role !== 'practitioner' && role !== 'admin') {
                  console.log('[login.js] ⚠️ No practitioner/admin found in email documents, checking applications...');
                  
                  // Check practitioner applications
                  const practitionerAppSnapshot = await Promise.race([
                    window.firebaseDb.collection('practitionerApplications')
                      .where('email', '==', normalizedEmail)
                      .where('status', '==', 'approved')
                      .limit(1)
                      .get(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                  ]);
                
                  if (!practitionerAppSnapshot.empty) {
                    const foundApprovedApp = practitionerAppSnapshot.docs[0].data();
                    console.log('[login.js] ✅ Found approved practitioner application - updating role immediately');
                  
                    const updateData = {
                      role: 'practitioner',
                      practitionerStatus: 'approved',
                      practitionerCode: foundApprovedApp.practitionerCode || null,
                      firstName: foundApprovedApp.firstName || null,
                      lastName: foundApprovedApp.lastName || null,
                      name: `${foundApprovedApp.firstName || ''} ${foundApprovedApp.lastName || ''}`.trim() || null,
                      email: user.email,
                      phone: foundApprovedApp.phone || null,
                      practiceName: foundApprovedApp.practiceName || null,
                      practiceNumber: foundApprovedApp.practiceNumber || null,
                      sarsNumber: foundApprovedApp.sarsNumber || null,
                      yearsExperience: foundApprovedApp.yearsExperience || null,
                      qualifications: foundApprovedApp.qualifications || null,
                      specializations: foundApprovedApp.specializations || [],
                      bio: foundApprovedApp.bio || null
                    };
                    
                    // Remove null values
                    Object.keys(updateData).forEach(key => {
                      if (updateData[key] === null) delete updateData[key];
                    });
                    
                    // Update immediately and wait for it
                    await window.firebaseDb.collection('users').doc(user.uid).set(updateData, { merge: true });
                    console.log('[login.js] ✅ Updated user document with practitioner role');
                    
                    // Update role for routing
                    role = 'practitioner';
                    userData = { ...userData, ...updateData };
                  } else {
                    // No practitioner application found - continue with 'user' role
                    role = 'user';
                  }
                }
              } else {
                // No documents found by email - check practitioner applications
                console.log('[login.js] No documents found by email - checking applications...');
                
                const practitionerAppSnapshot = await Promise.race([
                  window.firebaseDb.collection('practitionerApplications')
                    .where('email', '==', normalizedEmail)
                    .where('status', '==', 'approved')
                    .limit(1)
                    .get(),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
                ]);
              
                if (!practitionerAppSnapshot.empty) {
                  const foundApprovedApp = practitionerAppSnapshot.docs[0].data();
                  console.log('[login.js] ✅ Found approved practitioner application - updating role immediately');
                
                  const updateData = {
                    role: 'practitioner',
                    practitionerStatus: 'approved',
                    practitionerCode: foundApprovedApp.practitionerCode || null,
                    firstName: foundApprovedApp.firstName || null,
                    lastName: foundApprovedApp.lastName || null,
                    name: `${foundApprovedApp.firstName || ''} ${foundApprovedApp.lastName || ''}`.trim() || null,
                    email: user.email,
                    phone: foundApprovedApp.phone || null,
                    practiceName: foundApprovedApp.practiceName || null,
                    practiceNumber: foundApprovedApp.practiceNumber || null,
                    sarsNumber: foundApprovedApp.sarsNumber || null,
                    yearsExperience: foundApprovedApp.yearsExperience || null,
                    qualifications: foundApprovedApp.qualifications || null,
                    specializations: foundApprovedApp.specializations || [],
                    bio: foundApprovedApp.bio || null
                  };
                  
                  // Remove null values
                  Object.keys(updateData).forEach(key => {
                    if (updateData[key] === null) delete updateData[key];
                  });
                  
                  // Update immediately and wait for it
                  await window.firebaseDb.collection('users').doc(user.uid).set(updateData, { merge: true });
                  console.log('[login.js] ✅ Updated user document with practitioner role');
                  
                  // Update role for routing
                  role = 'practitioner';
                  userData = { ...userData, ...updateData };
                } else {
                  // No practitioner application found - continue with 'user' role
                  role = 'user';
                }
              }
            } catch (appCheckError) {
              console.warn('[login.js] Application check failed:', appCheckError.message);
              role = 'user';
            }
          }
          console.log('[login.js] Final role after all checks:', role, 'type:', typeof role);
          console.log('[login.js] Final userData:', JSON.stringify(userData, null, 2));
          
          // CRITICAL: One more check - if role is still 'user', check practitioner applications one more time
          if (role === 'user' || !role || role === '') {
            console.log('[login.js] ⚠️ Role is still user/empty - doing final practitioner check');
            const finalEmail = user.email?.toLowerCase().trim();
            if (finalEmail) {
              try {
                const finalCheck = await Promise.race([
                  window.firebaseDb.collection('practitionerApplications')
                    .where('email', '==', finalEmail)
                    .where('status', '==', 'approved')
                    .limit(1)
                    .get(),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1500))
                ]);
                
                if (!finalCheck.empty) {
                  const appData = finalCheck.docs[0].data();
                  console.log('[login.js] ✅✅✅ FINAL CHECK - FOUND APPROVED PRACTITIONER APPLICATION');
                  
                  const finalUpdateData = {
                    role: 'practitioner',
                    practitionerStatus: 'approved',
                    practitionerCode: appData.practitionerCode || null,
                    firstName: appData.firstName || null,
                    lastName: appData.lastName || null,
                    name: `${appData.firstName || ''} ${appData.lastName || ''}`.trim() || null,
                    email: user.email,
                    phone: appData.phone || null,
                    practiceName: appData.practiceName || null,
                    practiceNumber: appData.practiceNumber || null,
                    sarsNumber: appData.sarsNumber || null,
                    yearsExperience: appData.yearsExperience || null,
                    qualifications: appData.qualifications || null,
                    specializations: appData.specializations || [],
                    bio: appData.bio || null
                  };
                  
                  Object.keys(finalUpdateData).forEach(key => {
                    if (finalUpdateData[key] === null) delete finalUpdateData[key];
                  });
                  
                  await window.firebaseDb.collection('users').doc(user.uid).set(finalUpdateData, { merge: true });
                  console.log('[login.js] ✅✅✅ UPDATED USER DOCUMENT WITH PRACTITIONER ROLE');
                  
                  role = 'practitioner';
                  userData = { ...userData, ...finalUpdateData };
                  console.log('[login.js] ✅✅✅ ROLE SET TO PRACTITIONER - WILL ROUTE CORRECTLY');
                }
              } catch (finalCheckError) {
                console.warn('[login.js] Final check failed:', finalCheckError);
              }
            }
          }
        }
        // If userDoc does NOT exist in Firestore for this UID
        if (!userDoc || !userDoc.exists) {
          // User exists in Auth but not in Firestore - check for practitioner application first
          console.log('[login.js] User document not found in Firestore - checking for practitioner application');
          
          // Check for approved practitioner application before creating default user document
          const normalizedEmail = user.email.toLowerCase().trim();
          console.log('[login.js] 🔍 No UID doc - checking by email and applications...');
          
          // FIRST: Check users collection by email (might have practitioner doc with different ID)
          try {
            const emailUserCheck = await Promise.race([
              window.firebaseDb.collection('users')
                .where('email', '==', normalizedEmail)
                .get(), // Get ALL documents
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
            ]);
            
            console.log('[login.js] 🔍 Found', emailUserCheck.size, 'user document(s) by email');
            
            if (!emailUserCheck.empty) {
              for (const emailDoc of emailUserCheck.docs) {
                const emailData = emailDoc.data();
                const emailRole = String(emailData.role || 'user').toLowerCase().trim();
                console.log('[login.js] 🔍 Email doc ID:', emailDoc.id, 'Role:', emailRole);
                
                if (emailRole === 'practitioner' || emailRole === 'admin') {
                  console.log('[login.js] ✅✅✅ FOUND', emailRole.toUpperCase(), 'BY EMAIL (no UID doc) - ID:', emailDoc.id);
                  
                  // Migrate to UID
                  await window.firebaseDb.collection('users').doc(user.uid).set(emailData, { merge: true });
                  if (emailDoc.id !== user.uid) {
                    await emailDoc.ref.delete();
                  }
                  
                  role = emailRole;
                  userData = emailData;
                  console.log('[login.js] ✅✅✅ MIGRATED AND SET ROLE TO:', role);
                  break;
                }
              }
            }
          } catch (emailError) {
            console.warn('[login.js] Email check error (no UID doc):', emailError);
          }
          
          // If still not found, check applications
          if (role !== 'practitioner' && role !== 'admin') {
            try {
              const practitionerAppSnapshot = await Promise.race([
                window.firebaseDb.collection('practitionerApplications')
                  .where('email', '==', normalizedEmail)
                  .where('status', '==', 'approved')
                  .limit(1)
                  .get(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
              ]);
            
              if (!practitionerAppSnapshot.empty) {
                const foundApprovedApp = practitionerAppSnapshot.docs[0].data();
                console.log('[login.js] ✅ Found approved practitioner application - creating practitioner document');
                
                const practitionerData = {
                  role: 'practitioner',
                  practitionerStatus: 'approved',
                  practitionerCode: foundApprovedApp.practitionerCode || null,
                  firstName: foundApprovedApp.firstName || null,
                  lastName: foundApprovedApp.lastName || null,
                  name: `${foundApprovedApp.firstName || ''} ${foundApprovedApp.lastName || ''}`.trim() || null,
                  email: user.email,
                  phone: foundApprovedApp.phone || null,
                  practiceName: foundApprovedApp.practiceName || null,
                  practiceNumber: foundApprovedApp.practiceNumber || null,
                  sarsNumber: foundApprovedApp.sarsNumber || null,
                  yearsExperience: foundApprovedApp.yearsExperience || null,
                  qualifications: foundApprovedApp.qualifications || null,
                  specializations: foundApprovedApp.specializations || [],
                  bio: foundApprovedApp.bio || null,
                  createdAt: new Date().toISOString()
                };
                
                // Remove null values
                Object.keys(practitionerData).forEach(key => {
                  if (practitionerData[key] === null) delete practitionerData[key];
                });
                
                await window.firebaseDb.collection('users').doc(user.uid).set(practitionerData);
                console.log('[login.js] ✅ Created practitioner document');
                
                userData = practitionerData;
                role = 'practitioner';
              } else {
                // Check for pending document
                const emailBasedId = 'pending_' + normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_');
                const pendingDoc = await window.firebaseDb.collection('users').doc(emailBasedId).get();
                
                if (pendingDoc.exists && pendingDoc.data().role === 'practitioner') {
                  const pendingData = pendingDoc.data();
                  await window.firebaseDb.collection('users').doc(user.uid).set(pendingData, { merge: true });
                  await window.firebaseDb.collection('users').doc(emailBasedId).delete();
                  userData = pendingData;
                  role = 'practitioner';
                  console.log('[login.js] ✅ Migrated pending practitioner document');
                } else {
                  // No practitioner found - create default user document
                  console.log('[login.js] No practitioner found - creating default user document');
                  
                  const defaultUserData = {
                    email: user.email,
                    role: 'user',
                    createdAt: new Date().toISOString()
                  };
                  
                  // Create document without waiting (non-blocking)
                  window.firebaseDb.collection('users').doc(user.uid).set(defaultUserData).then(() => {
                    console.log('[login.js] ✅ Created user document');
                  }).catch(createError => {
                    console.error('[login.js] Failed to create user document:', createError);
                  });
                  
                  userData = defaultUserData;
                  role = 'user';
                }
              }
            } catch (noDocError) {
              console.warn('[login.js] Error checking for practitioner application:', noDocError);
              // Fallback to creating default user document
              const defaultUserData = {
                email: user.email,
                role: 'user',
                createdAt: new Date().toISOString()
              };
              
              window.firebaseDb.collection('users').doc(user.uid).set(defaultUserData).catch(createError => {
                console.error('[login.js] Failed to create user document:', createError);
              });
              
              userData = defaultUserData;
              role = 'user';
            }
          }
        }
      } catch (firestoreError) {
        console.error('[login.js] Error in Step 2 processing:', firestoreError);
        // Continue with defaults - routing function will check by email
        if (!userData || Object.keys(userData).length === 0) {
          userData = { email: user.email, role: 'user' };
        }
        role = role || 'user';
      }

      // Ensure token is stored (should be done above, but double-check)
      if (token && !localStorage.getItem('token')) {
        localStorage.setItem('token', token);
      }
      
      // CRITICAL FINAL CHECK: Before storing and routing, verify role one more time
      // This catches cases where role wasn't set correctly during the checks above
      if (role !== 'practitioner' && role !== 'admin') {
        console.log('[login.js] ⚠️⚠️⚠️ FINAL VERIFICATION - Role is not practitioner/admin, doing absolute final check');
        try {
          // Check user document one more time
          const finalUserDoc = await Promise.race([
            window.firebaseDb.collection('users').doc(user.uid).get(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
          ]);
          
          if (finalUserDoc.exists) {
            const finalUserData = finalUserDoc.data();
            const finalRole = (finalUserData.role || 'user').toLowerCase().trim();
            console.log('[login.js] 🔍 Final verification - role from document:', finalRole);
            
            if (finalRole === 'practitioner' || finalRole === 'admin') {
              console.log('[login.js] ✅✅✅ FINAL VERIFICATION FOUND CORRECT ROLE:', finalRole);
              role = finalRole;
              userData = { ...userData, ...finalUserData };
            }
          } else {
            console.log('[login.js] Final verification: User document does not exist');
          }
          
          // If still not found, check by email (with timeout protection)
          if (role !== 'practitioner' && role !== 'admin') {
            console.log('[login.js] Final verification: Role is still user, checking by email...');
            const finalEmail = user.email?.toLowerCase().trim();
            if (finalEmail) {
              try {
                console.log('[login.js] Starting final email check with timeout...');
                const finalEmailCheck = await Promise.race([
                  window.firebaseDb.collection('users')
                    .where('email', '==', finalEmail)
                    .where('role', 'in', ['practitioner', 'admin'])
                    .limit(1)
                    .get(),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
                ]);
                
                console.log('[login.js] Final email check completed, results:', finalEmailCheck.empty ? 'empty' : 'found');
                
                if (!finalEmailCheck.empty) {
                  const finalEmailDoc = finalEmailCheck.docs[0];
                  const finalEmailData = finalEmailDoc.data();
                  const finalEmailRole = (finalEmailData.role || 'user').toLowerCase().trim();
                  console.log('[login.js] ✅✅✅ FINAL EMAIL CHECK FOUND ROLE:', finalEmailRole);
                  
                  // Migrate to UID
                  await window.firebaseDb.collection('users').doc(user.uid).set(finalEmailData, { merge: true });
                  if (finalEmailDoc.id !== user.uid) {
                    await finalEmailDoc.ref.delete();
                  }
                  
                  role = finalEmailRole;
                  userData = { ...userData, ...finalEmailData };
                } else {
                  console.log('[login.js] Final email check: No practitioner/admin found');
                }
              } catch (finalEmailError) {
                console.warn('[login.js] Final email check failed or timed out:', finalEmailError.message);
                // Continue with current role (user)
              }
            } else {
              console.log('[login.js] Final verification: No email available for check');
            }
          } else {
            console.log('[login.js] Final verification: Role is already practitioner/admin, skipping email check');
          }
          
          console.log('[login.js] ✅ Final verification complete, final role:', role);
        } catch (finalVerificationError) {
          console.warn('[login.js] Final verification failed:', finalVerificationError);
        }
      }
      
      // Store user data
      localStorage.setItem('firebaseUser', JSON.stringify({ uid: user.uid, email: user.email, ...userData, role: role }));

      console.log('[login.js] ========================================');
      console.log('[login.js] Login successful - UID:', user.uid);
      console.log('[login.js] Final Role variable:', role, 'type:', typeof role);
      console.log('[login.js] Final Role from userData:', userData?.role);
      console.log('[login.js] ========================================');
      
      // Clear timeout since login succeeded
      if (loginTimeout) {
        clearTimeout(loginTimeout);
        loginTimeout = null;
      }
      
      // DIAGNOSTIC: Log everything about the user before routing
      console.log('[login.js] ========================================');
      console.log('[login.js] 🔍 DIAGNOSTIC INFO BEFORE ROUTING');
      console.log('[login.js] User UID:', user.uid);
      console.log('[login.js] User Email:', user.email);
      console.log('[login.js] Role variable:', role, 'type:', typeof role);
      console.log('[login.js] UserData:', JSON.stringify(userData, null, 2));
      console.log('[login.js] ========================================');
      
      // CRITICAL: Always route - routing function will check by email if needed
      console.log('[login.js] 🚀 Calling routeUserAfterLogin with role:', role);
      try {
        await routeUserAfterLogin(user, role, userData);
      } catch (routingError) {
        console.error('[login.js] Routing error:', routingError);
        console.error('[login.js] Routing error stack:', routingError.stack);
        // Fallback: redirect to onboarding
        safeRedirect('/client-onboarding.html');
      }

    } catch (error) {
      console.error('[login.js] ❌ Login error:', error);
      console.error('[login.js] Error code:', error.code);
      console.error('[login.js] Error message:', error.message);
      console.error('[login.js] Error stack:', error.stack);
      
      // Clear timeout
      if (loginTimeout) {
        clearTimeout(loginTimeout);
        loginTimeout = null;
      }
      
      // Provide more specific error messages
      let errorMsg;
      if (error.message && error.message.includes('timeout')) {
        if (error.message.includes('Authentication timeout') || error.message.includes('taking longer than expected')) {
          // Use the exact error message from the timeout
          errorMsg = error.message || 'Connection to authentication service timed out. Please check your internet connection and try again.';
        } else if (error.message.includes('User document query timeout')) {
          errorMsg = 'Connection to database timed out. Please check your internet connection and try again.';
        } else if (error.message.includes('Token generation timeout')) {
          errorMsg = 'Token generation timed out. Please try again.';
        } else {
          errorMsg = 'Login is taking longer than expected. Please check your connection and try again.';
        }
      } else if (error.message && (
        error.message.includes('not enough space') ||
        error.message.includes('PutOrAdd') ||
        error.message.includes('resource-exhausted') ||
        error.code === 'resource-exhausted'
      )) {
        // Database quota/space error - provide user-friendly message
        errorMsg = 'Database storage limit reached. Please contact support or try again later. Your login was successful, but some data could not be saved.';
        console.error('[login.js] Database quota error - login may have partially succeeded');
        // Don't block login completely - user might still be able to proceed
      } else {
        errorMsg = getAuthErrorMessage(error);
      }
      
      // Hide loading screen before showing error
      setLoginLoading(false);
      showError(errorMsg);
    }
  });

  // Handle registration form submission
  registerForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[login.js] Register form submitted');
    hideError();

    // Check Firebase is available
    if (!window.firebaseAuth || !window.firebaseDb) {
      showError('Firebase is not initialized. Please refresh the page.');
      console.error('[login.js] Firebase not available');
      return;
    }

    const firstNameEl = document.getElementById('registerFirstName');
    const lastNameEl = document.getElementById('registerLastName');
    const emailEl = document.getElementById('registerEmail');
    const passwordEl = document.getElementById('registerPassword');

    if (!firstNameEl || !lastNameEl || !emailEl || !passwordEl) {
      console.error('[login.js] Registration form fields not found');
      showError('Form fields not found. Please refresh the page.');
      return;
    }

    const firstName = firstNameEl.value.trim();
    const lastName = lastNameEl.value.trim();
    const email = emailEl.value.trim();
    const password = passwordEl.value;

    // Validation
    if (!firstName || !lastName || !email || !password) {
      showError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      showError('Password must be at least 6 characters long.');
      return;
    }

    setRegisterLoading(true);

    try {
      console.log('[login.js] Starting registration for:', email);
      
      // Step 1: Create user in Firebase Authentication
      console.log('[login.js] Creating user in Firebase Authentication...');
      const userCredential = await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      console.log('[login.js] User created in Auth, UID:', user.uid);

      // Step 2: Prepare user data for Firestore
      const userData = {
        email: user.email,
        firstName: firstName,
        lastName: lastName,
        name: `${firstName} ${lastName}`,
        role: 'user', // Always 'user' for new registrations
        createdAt: new Date().toISOString()
      };

      // Step 3: Create user document in Firestore
      console.log('[login.js] Creating user document in Firestore...');
      console.log('[login.js] User data:', userData);
      
      try {
        await window.firebaseDb.collection('users').doc(user.uid).set(userData);
        console.log('[login.js] ✅ User document created successfully in Firestore');
      } catch (firestoreError) {
        console.error('[login.js] ❌ Firestore error:', firestoreError);
        console.error('[login.js] Error code:', firestoreError.code);
        console.error('[login.js] Error message:', firestoreError.message);
        
        // If Firestore fails, we still have the Auth user, but show error
        throw new Error(`Account created but failed to save profile: ${firestoreError.message || 'Unknown error'}`);
      }

      console.log('[login.js] ✅ Registration completed successfully');
      console.log('[login.js] User UID:', user.uid);
      console.log('[login.js] User role:', userData.role);

      // Check for pending invite and process it immediately
      const inviteResult = await processPendingInvite(user.uid);
      
      if (inviteResult.success && inviteResult.practitionerId) {
        // Invite processed successfully - user is now connected
        console.log('[login.js] ✅ Invite processed successfully, user connected to practitioner:', inviteResult.practitionerId);
        console.log('[login.js] Redirecting to user dashboard...');
        
        // Update user data in Firestore with invite information if available
        // Note: invite data is already merged during processPendingInvite, but we can add any additional fields here
        // The connection is already established, so this is just for additional data enrichment
        
        // Redirect to dashboard immediately (user is already authenticated)
        safeRedirect('/user-dashboard.html');
        return; // Exit early - don't sign out or show success message
      } else {
        // No invite or invite processing failed - use normal flow
        console.log('[login.js] No pending invite or invite processing failed, using normal registration flow');
        if (inviteResult.error && inviteResult.error !== 'No pending invite') {
          console.warn('[login.js] Invite processing error:', inviteResult.error);
        }
        
        // Sign out the user so they need to sign in manually
        try {
          await window.firebaseAuth.signOut();
          localStorage.removeItem('token');
          localStorage.removeItem('firebaseUser');
          console.log('[login.js] User signed out - ready for manual sign in');
        } catch (signOutError) {
          console.error('[login.js] Error signing out:', signOutError);
        }

        // Show success notification
        showSuccess();
        setRegisterLoading(false);
        
        // Clear the registration form
        registerForm.reset();
        
        // Switch to sign-in form after 2 seconds
        setTimeout(() => {
          window.switchToSignIn();
          // Hide success message after switching
          const successMessageElement = document.getElementById('successMessage');
          if (successMessageElement) {
            successMessageElement.classList.remove('show');
          }
        }, 2000);
      }

    } catch (error) {
      console.error('[login.js] Registration error:', error);
      console.error('[login.js] Error code:', error.code);
      console.error('[login.js] Error message:', error.message);
      
      const errorMsg = getAuthErrorMessage(error);
      showError(errorMsg);
      setRegisterLoading(false);
    }
  });

  console.log('[login.js] All handlers initialized');
});
