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
async function routeUser(role, userId) {
  console.log('[routeUser] Called with role:', role, 'userId:', userId);
  
  // Ensure role is a string and lowercase for comparison
  const normalizedRole = String(role || 'user').toLowerCase().trim();
  console.log('[routeUser] Normalized role:', normalizedRole);
  
  if (normalizedRole === 'practitioner') {
    console.log('[routeUser] Routing to practitioner dashboard');
    window.location.href = '/practitioner-dashboard.html';
  } else if (normalizedRole === 'admin') {
    console.log('[routeUser] Routing to admin dashboard');
    window.location.href = '/admin-dashboard.html';
  } else {
    // For regular users (default), check if they have a practitioner
    console.log('[routeUser] Routing regular user - checking for practitioner connection');
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

document.addEventListener('DOMContentLoaded', function() {
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
  if (!errorMessageElement || !loginForm || !registerForm || !registerBtn) {
    console.error('[login.js] Required form elements not found');
    return;
  }

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
  loginForm.addEventListener('submit', async function(e) {
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
          
          // Only allow 'admin' or 'practitioner' if explicitly set by admin
          // For security, if role is 'practitioner' or 'admin', verify it's legitimate
          if (existingRole === 'practitioner' || existingRole === 'admin') {
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
          console.log('[login.js] Final role after check:', role);
        } else {
          // User exists in Auth but not in Firestore - create default document
          console.log('[login.js] User document NOT found in Firestore - creating default document');
          const defaultUserData = {
            email: user.email,
            role: 'user', // ALWAYS 'user' for new registrations
            createdAt: new Date().toISOString()
          };
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
            role = 'user'; // Explicitly set to 'user'
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
      
      // Final verification: Check if document actually exists in Firestore
      try {
        const finalCheck = await window.firebaseDb.collection('users').doc(user.uid).get();
        if (finalCheck.exists) {
          console.log('[login.js] ✅ FINAL CHECK: User document EXISTS in Firestore');
          console.log('[login.js] Document data:', finalCheck.data());
        } else {
          console.error('[login.js] ❌ FINAL CHECK: User document DOES NOT EXIST in Firestore!');
          console.error('[login.js] This means document creation failed silently.');
        }
      } catch (checkError) {
        console.error('[login.js] ❌ FINAL CHECK: Error verifying document:', checkError);
      }
      
      // Step 4: Route based on role
      await routeUser(role, user.uid);

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
