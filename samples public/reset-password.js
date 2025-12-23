/**
 * Password Reset Handler for ClearTrack
 * 
 * Handles password reset using Firebase Auth
 * Version: 1.0
 */

document.addEventListener('DOMContentLoaded', function() {
  const resetPasswordForm = document.getElementById('resetPasswordForm');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const submitBtn = document.getElementById('submitBtn');
  const errorMessageElement = document.getElementById('errorMessage');
  const successMessageElement = document.getElementById('successMessage');

  // Get the reset token from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const actionCode = urlParams.get('oobCode');
  const mode = urlParams.get('mode');
  const noTokenMessage = document.getElementById('noTokenMessage');
  const subtitleText = document.getElementById('subtitleText');

  // Check if we have the required parameters
  if (!actionCode || mode !== 'resetPassword') {
    // Hide the form and show appropriate message
    resetPasswordForm.style.display = 'none';
    if (subtitleText) {
      subtitleText.style.display = 'none';
    }
    
    if (noTokenMessage) {
      noTokenMessage.style.display = 'block';
    }
    
    // If there are parameters but they're invalid, show error
    if (actionCode || mode) {
      showError('Invalid or expired reset link. Please request a new password reset from the login page.');
    }
    return;
  }

  // Helper function to show error
  function showError(message) {
    if (errorMessageElement) {
      errorMessageElement.textContent = message;
      errorMessageElement.classList.add('show');
    }
    if (successMessageElement) {
      successMessageElement.classList.remove('show');
    }
  }

  // Helper function to hide error
  function hideError() {
    if (errorMessageElement) {
      errorMessageElement.classList.remove('show');
      errorMessageElement.textContent = '';
    }
  }

  // Helper function to show success
  function showSuccess() {
    if (successMessageElement) {
      successMessageElement.classList.add('show');
    }
    hideError();
  }

  // Helper function to set loading state
  function setLoading(isLoading) {
    if (submitBtn) {
      submitBtn.disabled = isLoading;
      submitBtn.textContent = isLoading ? 'Resetting password...' : 'Reset Password';
    }
  }

  // Helper function to get user-friendly error message
  function getAuthErrorMessage(error) {
    const code = error.code || '';
    const messages = {
      'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
      'auth/expired-action-code': 'The password reset link has expired. Please request a new one.',
      'auth/invalid-action-code': 'The password reset link is invalid or has already been used.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-not-found': 'User account not found.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
    };
    return messages[code] || error.message || 'An error occurred. Please try again.';
  }

  // Handle form submission
  resetPasswordForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    hideError();

    // Check Firebase is available
    if (!window.firebaseAuth) {
      showError('Firebase is not initialized. Please refresh the page.');
      return;
    }

    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Validation
    if (!password || !confirmPassword) {
      showError('Please fill in both password fields.');
      return;
    }

    if (password.length < 6) {
      showError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      showError('Passwords do not match. Please try again.');
      return;
    }

    setLoading(true);

    try {
      console.log('[reset-password.js] Attempting to reset password...');
      
      // Verify the action code and reset the password
      await window.firebaseAuth.confirmPasswordReset(actionCode, password);
      
      console.log('[reset-password.js] ✅ Password reset successful');
      
      // Show success message
      showSuccess();
      setLoading(false);
      
      // Redirect to login page after 2 seconds
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 2000);

    } catch (error) {
      console.error('[reset-password.js] Password reset error:', error);
      const errorMsg = getAuthErrorMessage(error);
      showError(errorMsg);
      setLoading(false);
    }
  });

  console.log('[reset-password.js] Password reset page initialized');
});

