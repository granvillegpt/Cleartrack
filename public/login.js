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
  console.log('[login.js] Safe redirect to:', url);
  
  // Set a timeout to reset the flag in case redirect fails
  redirectTimeout = setTimeout(() => {
    isRedirecting = false;
    console.warn('[login.js] Redirect timeout - resetting redirect flag');
  }, 5000);
  
  // Perform redirect
  window.location.href = url;
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
      try {
        // Wait for both in parallel
        const [userDoc, fetchedToken] = await Promise.all([
          Promise.race([userDocPromise, userDocTimeoutPromise]),
          Promise.race([tokenPromise, tokenTimeoutPromise])
        ]);
        
        // Store token immediately
        token = fetchedToken;
        localStorage.setItem('token', token);
        
        const step2Time = Date.now() - step2StartTime;
        console.log(`[login.js] ✅ Step 2: User document and token fetched in parallel (took ${step2Time}ms)`);
        
        if (userDoc.exists) {
          userData = userDoc.data();
          const existingRole = userData.role;
          console.log('[login.js] User document found, role:', existingRole);
          
          // Use existing role if it's already set correctly
          if (existingRole === 'practitioner' || existingRole === 'admin') {
            role = existingRole;
            console.log('[login.js] Using existing role:', role);
          } else if (existingRole && existingRole !== 'user') {
            // Invalid role - correct it (non-blocking, don't wait)
            console.log('[login.js] Correcting invalid role:', existingRole);
            window.firebaseDb.collection('users').doc(user.uid).update({ role: 'user' }).catch(err => {
              console.error('[login.js] Failed to update role:', err);
            });
            userData.role = 'user';
            role = 'user';
          } else {
            // Role is 'user' or undefined - check for approved practitioner application
            // Make this completely non-blocking - run in background
            const normalizedEmail = user.email.toLowerCase().trim();
            
            // Check practitioner application in background (don't wait)
            Promise.race([
              window.firebaseDb.collection('practitionerApplications')
                .where('email', '==', normalizedEmail)
                .where('status', '==', 'approved')
                .limit(1)
                .get(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1500))
            ]).then(practitionerAppSnapshot => {
              if (!practitionerAppSnapshot.empty) {
                const foundApprovedApp = practitionerAppSnapshot.docs[0].data();
                console.log('[login.js] ✅ Found approved practitioner application - updating role (background)');
                
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
                
                // Update in background
                window.firebaseDb.collection('users').doc(user.uid).set(updateData, { merge: true }).catch(err => {
                  console.error('[login.js] Failed to update practitioner role:', err);
                });
              }
            }).catch(appCheckError => {
              // Silently fail - this is non-critical
              console.warn('[login.js] Practitioner application check failed (non-blocking):', appCheckError.message);
            });
            
            // Continue with 'user' role - don't wait for practitioner check
            role = 'user';
          }
          console.log('[login.js] Final role:', role);
        } else {
          // User exists in Auth but not in Firestore - create default document (non-blocking)
          console.log('[login.js] User document not found - creating default document');
          
          const defaultUserData = {
            email: user.email,
            role: 'user',
            createdAt: new Date().toISOString()
          };
          
          // Create document without waiting (non-blocking)
          // Wrap in try-catch to prevent errors from blocking login
          window.firebaseDb.collection('users').doc(user.uid).set(defaultUserData).then(() => {
            console.log('[login.js] ✅ Created user document');
          }).catch(createError => {
            console.error('[login.js] Failed to create user document:', createError);
            // Don't throw - allow login to continue even if document creation fails
            // The document can be created later when needed
          });
          
          userData = defaultUserData;
          role = 'user';
        }
      } catch (firestoreError) {
        console.error('[login.js] Error reading user document or token:', firestoreError);
        console.error('[login.js] Firestore error code:', firestoreError.code);
        console.error('[login.js] Firestore error message:', firestoreError.message);
        
        // Check if it's a database space/quota error
        if (firestoreError.message && (
          firestoreError.message.includes('not enough space') ||
          firestoreError.message.includes('PutOrAdd') ||
          firestoreError.message.includes('resource-exhausted') ||
          firestoreError.code === 'resource-exhausted'
        )) {
          console.warn('[login.js] Database quota/space error detected - continuing with minimal data');
          // Continue with minimal user data - don't block login
          userData = {
            email: user.email,
            role: 'user'
          };
        }
        
        // Try to get token separately if it failed in parallel
        if (!token) {
          try {
            console.log('[login.js] Attempting to get token separately...');
            token = await Promise.race([
              user.getIdToken(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Token generation timeout')), 5000))
            ]);
            localStorage.setItem('token', token);
            console.log('[login.js] ✅ Token retrieved separately');
          } catch (tokenError) {
            console.error('[login.js] Failed to get token:', tokenError);
            // Continue without token - dashboard can regenerate it
          }
        }
        // Continue with default role 'user'
        role = 'user';
      }

      // Ensure token is stored (should be done above, but double-check)
      if (token && !localStorage.getItem('token')) {
        localStorage.setItem('token', token);
      }
      
      // Store user data
      localStorage.setItem('firebaseUser', JSON.stringify({ uid: user.uid, email: user.email, ...userData, role: role }));

      console.log('[login.js] Login successful - UID:', user.uid, 'Role:', role);
      
      // Clear timeout since login succeeded
      if (loginTimeout) {
        clearTimeout(loginTimeout);
        loginTimeout = null;
      }
      
      // Route user immediately - no delay
      console.log('[login.js] Step 3: Routing user with role:', role);
      setLoginLoading(true, 'Welcome to ClearTrack!', 'Redirecting to your dashboard');
      
      if (role === 'practitioner') {
        console.log('[login.js] Routing to practitioner dashboard');
        safeRedirect('/practitioner-dashboard.html');
      } else if (role === 'admin') {
        console.log('[login.js] Routing to admin dashboard');
        safeRedirect('/admin-dashboard.html');
      } else {
        // For regular users, route immediately using userData we already have
        const practitionerId = userData?.practitionerId || userData?.connectedPractitioner || null;
        
        // Fast path: if we already know practitioner status, route immediately
        if (practitionerId) {
          console.log('[login.js] Practitioner found in userData - routing to user dashboard');
          safeRedirect('/user-dashboard.html');
        } else {
          // No practitioner - check for pending invite quickly, then route
          const pendingInviteId = sessionStorage.getItem('pendingInviteId');
          if (pendingInviteId) {
            // Process invite in background, don't wait
            processPendingInvite(user.uid).then(inviteResult => {
              if (inviteResult.success) {
                console.log('[login.js] ✅ Auto-connected via invite (background)');
              }
            }).catch(err => {
              console.warn('[login.js] Invite processing failed (non-blocking):', err);
            });
          }
          
          // Route to onboarding immediately - don't wait for Firestore query
          console.log('[login.js] No practitioner found - routing to onboarding');
          safeRedirect('/client-onboarding.html');
        }
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
