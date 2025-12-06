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
  
  try {
    let inviteData = null;
    let practitionerId = null;
    
    // Try Firestore first (if available)
    if (window.firebaseDb) {
      try {
        const inviteDoc = await window.firebaseDb.collection('clientInvites').doc(pendingInviteId).get();
        if (inviteDoc.exists) {
          inviteData = inviteDoc.data();
          practitionerId = inviteData.practitionerId;
          
          // Check if invite is still valid
          const now = new Date();
          const expiresAt = inviteData.expiresAt?.toDate ? inviteData.expiresAt.toDate() : new Date(inviteData.expiresAt);
          
          if (expiresAt > now && inviteData.status === 'pending') {
            // Update user document with practitioner connection
            // Use set with merge to handle case where document might not exist yet
            await window.firebaseDb.collection('users').doc(userId).set({
              practitionerId: inviteData.practitionerId,
              connectedPractitioner: inviteData.practitionerId,
              connectedAt: firebase.firestore.FieldValue.serverTimestamp(),
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            // Create connection document
            await window.firebaseDb.collection('connections').add({
              userId: userId,
              practitionerId: inviteData.practitionerId,
              connectedAt: firebase.firestore.FieldValue.serverTimestamp(),
              status: 'active'
            });
            
            // Update invite status
            await inviteDoc.ref.update({
              status: 'accepted',
              clientUid: userId,
              acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
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

async function routeUser(role, userId) {
  console.log('[routeUser] ========================================');
  console.log('[routeUser] Called with role:', role, 'userId:', userId);
  console.log('[routeUser] Role type:', typeof role);
  
  // Ensure role is a string and lowercase for comparison
  const normalizedRole = String(role || 'user').toLowerCase().trim();
  console.log('[routeUser] Normalized role:', normalizedRole);
  
  // Double-check role from Firestore if it's not 'practitioner' or 'admin'
  if (normalizedRole !== 'practitioner' && normalizedRole !== 'admin' && window.firebaseDb && userId) {
    console.log('[routeUser] Role is not practitioner/admin - double-checking Firestore...');
    try {
      const userDoc = await window.firebaseDb.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const firestoreRole = (userData.role || '').toLowerCase().trim();
        console.log('[routeUser] Role from Firestore:', firestoreRole);
        
        if (firestoreRole === 'practitioner') {
          console.log('[routeUser] ✅ Found practitioner role in Firestore - routing to practitioner dashboard');
          window.location.href = '/practitioner-dashboard.html';
          return;
        } else if (firestoreRole === 'admin') {
          console.log('[routeUser] ✅ Found admin role in Firestore - routing to admin dashboard');
          window.location.href = '/admin-dashboard.html';
          return;
        }
        
        // Also check for approved application if role still doesn't match
        if (userData.email) {
          const normalizedEmail = userData.email.toLowerCase().trim();
          const allApprovedApps = await window.firebaseDb.collection('practitionerApplications')
            .where('status', '==', 'approved')
            .get();
          
          allApprovedApps.forEach(doc => {
            const appData = doc.data();
            const appEmail = (appData.email || '').toLowerCase().trim();
            if (appEmail === normalizedEmail) {
              console.log('[routeUser] ✅ Found approved application - updating role and routing to practitioner dashboard');
              // Update role
              window.firebaseDb.collection('users').doc(userId).update({
                role: 'practitioner',
                practitionerStatus: 'approved'
              });
              window.location.href = '/practitioner-dashboard.html';
              return;
            }
          });
        }
      }
    } catch (checkError) {
      console.error('[routeUser] Error double-checking role:', checkError);
    }
  }
  
  if (normalizedRole === 'practitioner') {
    console.log('[routeUser] ✅ Routing to practitioner dashboard');
    window.location.href = '/practitioner-dashboard.html';
    return;
  } else if (normalizedRole === 'admin') {
    console.log('[routeUser] ✅ Routing to admin dashboard');
    window.location.href = '/admin-dashboard.html';
    return;
  } else {
    // For regular users (default), check if they have a practitioner
    console.log('[routeUser] Routing regular user - checking for practitioner connection');
    
    // Check for pending invite link (works with both Firestore and localStorage)
    const inviteResult = await processPendingInvite(userId);
    if (inviteResult.success && inviteResult.practitionerId) {
      console.log('[routeUser] ✅ Auto-connected via invite to practitioner:', inviteResult.practitionerId);
      // Connection established - go to dashboard
      window.location.href = '/user-dashboard.html';
      return;
    } else if (inviteResult.error && inviteResult.error !== 'No pending invite') {
      console.warn('[routeUser] Invite processing failed:', inviteResult.error);
      // Fall through to normal routing
    }
    
    if (window.firebaseDb && userId) {
      try {
        const userDoc = await window.firebaseDb.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          const practitionerId = userData.practitionerId || userData.connectedPractitioner || null;
          console.log('[routeUser] Practitioner ID:', practitionerId);
          if (!practitionerId) {
            // No practitioner - redirect to onboarding
            console.log('[routeUser] No practitioner found - routing to onboarding');
            window.location.href = '/client-onboarding.html';
            return;
          }
        } else {
          console.log('[routeUser] User document not found - routing to onboarding');
          window.location.href = '/client-onboarding.html';
          return;
        }
      } catch (error) {
        console.error('[routeUser] Error checking practitioner:', error);
        // On error, go to onboarding
        console.log('[routeUser] Error occurred - routing to onboarding');
        window.location.href = '/client-onboarding.html';
        return;
      }
    } else {
      console.log('[routeUser] Firebase DB not available or no userId - routing to onboarding');
      window.location.href = '/client-onboarding.html';
      return;
    }
    // Has practitioner - go to user dashboard
    console.log('[routeUser] Practitioner found - routing to user dashboard');
    window.location.href = '/user-dashboard.html';
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
  };
  return messages[code] || error.message || 'An error occurred. Please try again.';
}

console.log('[login.js] ✅ Script file loaded');
document.addEventListener('DOMContentLoaded', function() {
  console.log('[login.js] ✅ DOMContentLoaded - initializing login handlers');
  
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

  console.log('[login.js] Initializing login handlers...');

  // Helper function to set loading state for login
  function setLoginLoading(isLoading) {
    if (submitBtn) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? 'Signing in...' : 'Sign In';
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

    setLoginLoading(true);

    try {
      console.log('[login.js] Attempting login for:', email);
      
      // Step 1: Sign in with Firebase Auth
      const userCredential = await window.firebaseAuth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      console.log('[login.js] Authentication successful, UID:', user.uid);

      // Step 2: Get user document from Firestore
      let userData = {};
      let role = 'user'; // ALWAYS default to 'user'
      
      try {
        const userDoc = await window.firebaseDb.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
          userData = userDoc.data();
          const existingRole = userData.role;
          console.log('[login.js] User document found in Firestore');
          console.log('[login.js] Existing role in document:', existingRole);
          console.log('[login.js] Full user data:', userData);
          
          // Check if there's an approved practitioner application for this email
          // This ensures that if admin approved after user document was created, role gets updated
          // Normalize email to handle case sensitivity issues
          const normalizedEmail = user.email.toLowerCase().trim();
          const userEmailVariations = [
            user.email,
            normalizedEmail,
            user.email.trim(),
            user.email.toLowerCase(),
            user.email.toUpperCase()
          ];
          
          console.log('[login.js] Checking for approved practitioner application...');
          console.log('[login.js] User email:', user.email);
          console.log('[login.js] Email variations to try:', userEmailVariations);
          
          try {
            // First, try to get ALL approved applications and match in JavaScript
            // This is more reliable than multiple where clauses
            let foundApprovedApp = null;
            
            try {
              const allApprovedApps = await window.firebaseDb.collection('practitionerApplications')
                .where('status', '==', 'approved')
                .get();
              
              console.log('[login.js] Found', allApprovedApps.size, 'approved applications total');
              
              // Check each approved app for email match (case-insensitive)
              allApprovedApps.forEach(doc => {
                const appData = doc.data();
                const appEmail = (appData.email || '').toLowerCase().trim();
                console.log('[login.js] Checking app email:', appEmail, 'against user email:', normalizedEmail);
                
                if (appEmail === normalizedEmail) {
                  foundApprovedApp = appData;
                  console.log('[login.js] ✅ MATCH FOUND! Application ID:', doc.id);
                }
              });
            } catch (allAppsError) {
              console.warn('[login.js] Could not fetch all approved apps, trying individual queries:', allAppsError);
              
              // Fallback: Try individual queries with email variations
              for (const emailVar of userEmailVariations) {
                if (foundApprovedApp) break;
                
                try {
                  const practitionerAppSnapshot = await window.firebaseDb.collection('practitionerApplications')
                    .where('email', '==', emailVar)
                    .where('status', '==', 'approved')
                    .limit(1)
                    .get();
                  
                  if (!practitionerAppSnapshot.empty) {
                    foundApprovedApp = practitionerAppSnapshot.docs[0].data();
                    console.log('[login.js] ✅ Found approved app with email variation:', emailVar);
                    break;
                  }
                } catch (queryError) {
                  console.warn('[login.js] Query failed for email:', emailVar, queryError);
                }
              }
            }
            
            if (foundApprovedApp) {
              // Found approved application - set role to practitioner and copy all application data
              role = 'practitioner';
              console.log('[login.js] ✅✅✅ Found approved practitioner application - updating role to practitioner');
              console.log('[login.js] Application email:', foundApprovedApp.email);
              console.log('[login.js] Application status:', foundApprovedApp.status);
              try {
                // Prepare update data with all application fields
                const updateData = {
                  role: 'practitioner',
                  practitionerStatus: 'approved',
                  // IMPORTANT: Use practitionerCode from approved application (generated during approval)
                  // This ensures the code is device-independent and unique to this practitioner
                  practitionerCode: foundApprovedApp.practitionerCode || null,
                  // Copy all application data to user profile
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
                
                // Remove null values to avoid overwriting with null
                Object.keys(updateData).forEach(key => {
                  if (updateData[key] === null) {
                    delete updateData[key];
                  }
                });
                
                // Use set with merge to handle case where document might not exist yet
                await window.firebaseDb.collection('users').doc(user.uid).set(updateData, { merge: true });
                console.log('[login.js] ✅✅✅ Updated user document with practitioner role and application data');
                console.log('[login.js] Data saved:', updateData);
                
                // Re-read the document to get updated data
                const updatedDoc = await window.firebaseDb.collection('users').doc(user.uid).get();
                if (updatedDoc.exists) {
                  userData = updatedDoc.data();
                  userData.role = 'practitioner';
                  userData.practitionerStatus = 'approved';
                }
              } catch (updateError) {
                console.error('[login.js] ❌❌❌ Failed to update role to practitioner:', updateError);
              }
            } else {
              console.log('[login.js] ❌ No approved practitioner application found for email:', user.email);
              
              // If we didn't find an approved app, check existing role
          if (existingRole === 'practitioner' || existingRole === 'admin') {
                // User already has elevated role - keep it
            console.warn('[login.js] ⚠️ User has elevated role:', existingRole);
            console.warn('[login.js] ⚠️ This should only be set by an admin');
            role = existingRole;
          } else {
            // Default to 'user' for any other role value
            role = 'user';
            // Update the document to ensure role is 'user' if it was something else
            if (existingRole !== 'user') {
              console.log('[login.js] Correcting role from', existingRole, 'to user');
              try {
                await window.firebaseDb.collection('users').doc(user.uid).update({ role: 'user' });
                userData.role = 'user';
              } catch (updateError) {
                console.error('[login.js] Failed to update role:', updateError);
              }
                }
              }
            }
          } catch (appCheckError) {
            console.log('[login.js] Could not check practitioner application:', appCheckError);
            // Fallback to existing role logic
            if (existingRole === 'practitioner' || existingRole === 'admin') {
              role = existingRole;
            } else {
              role = 'user';
            }
          }
          console.log('[login.js] Final role after check:', role);
        } else {
          // User exists in Auth but not in Firestore - create default document
          console.log('[login.js] User document NOT found in Firestore - creating default document');
          
          // Check if there's an approved practitioner application for this email
          // Normalize email to handle case sensitivity issues
          const normalizedEmail = user.email.toLowerCase().trim();
          let defaultRole = 'user';
          let practitionerStatus = null;
          let foundApprovedApp = null;
          
          console.log('[login.js] User document not found - checking for approved application...');
          console.log('[login.js] User email:', user.email);
          
          try {
            // Get ALL approved applications and match in JavaScript (more reliable)
            try {
              const allApprovedApps = await window.firebaseDb.collection('practitionerApplications')
                .where('status', '==', 'approved')
                .get();
              
              console.log('[login.js] Found', allApprovedApps.size, 'approved applications total');
              
              // Check each approved app for email match (case-insensitive)
              allApprovedApps.forEach(doc => {
                const appData = doc.data();
                const appEmail = (appData.email || '').toLowerCase().trim();
                console.log('[login.js] Checking app email:', appEmail, 'against user email:', normalizedEmail);
                
                if (appEmail === normalizedEmail) {
                  foundApprovedApp = appData;
                  console.log('[login.js] ✅ MATCH FOUND! Application ID:', doc.id);
                }
              });
            } catch (allAppsError) {
              console.warn('[login.js] Could not fetch all approved apps, trying individual queries:', allAppsError);
              
              // Fallback: Try individual queries
              const userEmailVariations = [
                user.email,
                normalizedEmail,
                user.email.trim(),
                user.email.toLowerCase(),
                user.email.toUpperCase()
              ];
              
              for (const emailVar of userEmailVariations) {
                if (foundApprovedApp) break;
                
                try {
                  const practitionerAppSnapshot = await window.firebaseDb.collection('practitionerApplications')
                    .where('email', '==', emailVar)
                    .where('status', '==', 'approved')
                    .limit(1)
                    .get();
                  
                  if (!practitionerAppSnapshot.empty) {
                    foundApprovedApp = practitionerAppSnapshot.docs[0].data();
                    console.log('[login.js] ✅ Found approved app with email variation:', emailVar);
                    break;
                  }
                } catch (queryError) {
                  console.warn('[login.js] Query failed for email:', emailVar, queryError);
                }
              }
            }
            
            if (foundApprovedApp) {
              defaultRole = 'practitioner';
              practitionerStatus = 'approved';
              console.log('[login.js] ✅✅✅ Found approved practitioner application - setting role to practitioner');
              console.log('[login.js] Application email:', foundApprovedApp.email);
              console.log('[login.js] Application status:', foundApprovedApp.status);
            } else {
              console.log('[login.js] ❌ No approved practitioner application found for email:', user.email);
            }
          } catch (appCheckError) {
            console.error('[login.js] ❌ Could not check practitioner application:', appCheckError);
            // Continue with default role 'user'
          }
          
          // Create default user data object
          const defaultUserData = {
            email: user.email,
            role: defaultRole,
            createdAt: new Date().toISOString()
          };
          
          if (practitionerStatus) {
            defaultUserData.practitionerStatus = practitionerStatus;
          }
          
          // If approved app found, include all application data
          if (foundApprovedApp) {
            defaultUserData.firstName = foundApprovedApp.firstName || '';
            defaultUserData.lastName = foundApprovedApp.lastName || '';
            defaultUserData.name = `${foundApprovedApp.firstName || ''} ${foundApprovedApp.lastName || ''}`.trim() || '';
            defaultUserData.phone = foundApprovedApp.phone || '';
            defaultUserData.practiceName = foundApprovedApp.practiceName || '';
            defaultUserData.practiceNumber = foundApprovedApp.practiceNumber || null;
            defaultUserData.sarsNumber = foundApprovedApp.sarsNumber || null;
            defaultUserData.yearsExperience = foundApprovedApp.yearsExperience || 0;
            defaultUserData.qualifications = foundApprovedApp.qualifications || '';
            defaultUserData.specializations = foundApprovedApp.specializations || [];
            defaultUserData.bio = foundApprovedApp.bio || null;
            // Use practitioner code from application if available (generated during approval)
            defaultUserData.practitionerCode = foundApprovedApp.practitionerCode || null;
            
            // Check for pending user document with email-based ID and migrate it
            if (foundApprovedApp.practitionerCode) {
              try {
                const emailBasedId = 'pending_' + user.email.replace(/[^a-zA-Z0-9]/g, '_');
                const pendingDocRef = window.firebaseDb.collection('users').doc(emailBasedId);
                const pendingDoc = await pendingDocRef.get();
                
                if (pendingDoc.exists && pendingDoc.data()._isPending) {
                  // Migrate data from pending document
                  const pendingData = pendingDoc.data();
                  if (pendingData.practitionerCode) {
                    defaultUserData.practitionerCode = pendingData.practitionerCode;
                  }
                  // Merge any other pending data
                  Object.keys(pendingData).forEach(key => {
                    if (key !== '_isPending' && key !== '_pendingEmail' && !defaultUserData[key]) {
                      defaultUserData[key] = pendingData[key];
                    }
                  });
                  // Delete the pending document after migration
                  await pendingDocRef.delete();
                  console.log('[login.js] ✅ Migrated pending user document to actual UID');
                }
              } catch (migrationError) {
                console.warn('[login.js] Could not migrate pending document (non-critical):', migrationError);
              }
            }
          }
          
          try {
            console.log('[login.js] Attempting to create document in Firestore...');
            console.log('[login.js] Collection: users');
            console.log('[login.js] Document ID:', user.uid);
            console.log('[login.js] Data to save:', defaultUserData);
            console.log('[login.js] Current user UID:', window.firebaseAuth.currentUser?.uid);
            console.log('[login.js] Firebase DB available:', !!window.firebaseDb);
            
            // Try to create the document
            const docRef = window.firebaseDb.collection('users').doc(user.uid);
            await docRef.set(defaultUserData);
            
            // Verify it was created
            const verifyDoc = await docRef.get();
            if (verifyDoc.exists) {
              console.log('[login.js] ✅ Document created and verified in Firestore');
              console.log('[login.js] Verified document data:', verifyDoc.data());
            } else {
              console.error('[login.js] ❌ Document creation appeared to succeed but document does not exist!');
            }
            
            userData = defaultUserData;
            role = defaultRole; // Use the determined role
            console.log('[login.js] User UID:', user.uid);
            console.log('[login.js] User data:', defaultUserData);
          } catch (createError) {
            console.error('[login.js] ❌❌❌ FAILED TO CREATE DEFAULT DOCUMENT ❌❌❌');
            console.error('[login.js] Error code:', createError.code);
            console.error('[login.js] Error message:', createError.message);
            console.error('[login.js] Error name:', createError.name);
            console.error('[login.js] Full error object:', createError);
            console.error('[login.js] Stack trace:', createError.stack);
            
            // Log additional debugging info
            console.error('[login.js] Current user:', window.firebaseAuth.currentUser);
            console.error('[login.js] Firebase DB:', window.firebaseDb);
            console.error('[login.js] Firebase App:', window.firebaseApp);
            
            // Continue with default role 'user' - user can still log in
            role = 'user'; // Ensure role is 'user' even if document creation fails
            showError(`Failed to save profile: ${createError.message || 'Unknown error'}. Check console for details.`);
          }
        }
      } catch (firestoreError) {
        console.error('[login.js] Error reading user document:', firestoreError);
        // Continue with default role 'user'
        role = 'user';
      }

      // Step 3: Store token and user data
      const token = await user.getIdToken();
      localStorage.setItem('token', token);
      localStorage.setItem('firebaseUser', JSON.stringify({ uid: user.uid, email: user.email, ...userData, role: role }));

      console.log('[login.js] ========================================');
      console.log('[login.js] Login successful');
      console.log('[login.js] User UID:', user.uid);
      console.log('[login.js] User Email:', user.email);
      console.log('[login.js] Final Role:', role);
      console.log('[login.js] Firebase Project ID:', window.firebaseApp?.options?.projectId);
      console.log('[login.js] User document exists in Firestore:', !!userData && Object.keys(userData).length > 0);
      console.log('[login.js] Routing to dashboard based on role...');
      console.log('[login.js] ========================================');
      
      // Final verification: Re-read the document AND check for approved applications again
      let finalRole = role;
      try {
        const finalCheck = await window.firebaseDb.collection('users').doc(user.uid).get();
        if (finalCheck.exists) {
          const finalData = finalCheck.data();
          console.log('[login.js] ✅ FINAL CHECK: User document EXISTS in Firestore');
          console.log('[login.js] Document data:', finalData);
          
          // Use the role from the document if it exists
          if (finalData.role) {
            finalRole = finalData.role;
            console.log('[login.js] Using role from Firestore document:', finalRole);
          } else {
            console.log('[login.js] No role in document, checking approved applications again...');
            
            // Double-check for approved application if no role in document
            const normalizedEmail = user.email.toLowerCase().trim();
            try {
              const allApprovedApps = await window.firebaseDb.collection('practitionerApplications')
                .where('status', '==', 'approved')
                .get();
              
              let foundApprovedApp = null;
              allApprovedApps.forEach(doc => {
                const appData = doc.data();
                const appEmail = (appData.email || '').toLowerCase().trim();
                if (appEmail === normalizedEmail) {
                  foundApprovedApp = appData;
                }
              });
              
              if (foundApprovedApp) {
                finalRole = 'practitioner';
                console.log('[login.js] ✅ Found approved app in final check - setting role to practitioner');
                // Update the document
                await window.firebaseDb.collection('users').doc(user.uid).update({
                  role: 'practitioner',
                  practitionerStatus: 'approved'
                });
              } else {
                console.log('[login.js] No approved app found, using determined role:', finalRole);
              }
            } catch (finalAppCheckError) {
              console.error('[login.js] Error in final app check:', finalAppCheckError);
            }
          }
        } else {
          console.error('[login.js] ❌ FINAL CHECK: User document DOES NOT EXIST in Firestore!');
          console.error('[login.js] This means document creation failed silently.');
        }
      } catch (checkError) {
        console.error('[login.js] ❌ FINAL CHECK: Error verifying document:', checkError);
        // Continue with the role we determined
      }
      
      // Step 4: Route based on role (use finalRole which is the most up-to-date)
      console.log('[login.js] ========================================');
      console.log('[login.js] FINAL ROUTING DECISION');
      console.log('[login.js] Role variable:', role);
      console.log('[login.js] Final role:', finalRole);
      console.log('[login.js] Role type:', typeof finalRole);
      console.log('[login.js] Role normalized:', String(finalRole || 'user').toLowerCase().trim());
      console.log('[login.js] User UID:', user.uid);
      console.log('[login.js] User Email:', user.email);
      console.log('[login.js] ========================================');
      
      // ALERT: Show role in alert before redirecting (for debugging)
      if (String(finalRole || 'user').toLowerCase().trim() !== 'practitioner') {
        console.warn('[login.js] ⚠️⚠️⚠️ WARNING: Role is NOT practitioner! Role is:', finalRole);
        console.warn('[login.js] This will route to onboarding. Checking Firestore one more time...');
        
        // Last chance check - read Firestore document directly
        try {
          const lastChanceDoc = await window.firebaseDb.collection('users').doc(user.uid).get();
          if (lastChanceDoc.exists) {
            const lastChanceData = lastChanceDoc.data();
            console.log('[login.js] Last chance check - Firestore document:', lastChanceData);
            if (lastChanceData.role === 'practitioner') {
              console.log('[login.js] ✅✅✅ LAST CHANCE: Found practitioner role! Routing to practitioner dashboard');
              window.location.href = '/practitioner-dashboard.html';
              return;
            }
          }
        } catch (lastChanceError) {
          console.error('[login.js] Last chance check failed:', lastChanceError);
        }
      }
      
      // Check for inviteId in URL before routing
      const urlParams = new URLSearchParams(window.location.search);
      const inviteId = urlParams.get('inviteId');
      
      await routeUser(finalRole, user.uid);

    } catch (error) {
      console.error('[login.js] Login error:', error);
      const errorMsg = getAuthErrorMessage(error);
      showError(errorMsg);
      setLoginLoading(false);
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
        window.location.href = '/user-dashboard.html';
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
