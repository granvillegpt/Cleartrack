/**
 * Client Linking Module for ClearTrack
 * 
 * Wraps Firebase Cloud Functions for practitioner-client linking
 * Requires: firebase-init.js (provides window.firebaseApp)
 */

(function() {
  'use strict';

  // Verify Firebase is available
  if (!window.firebaseApp) {
    console.error('client-linking: window.firebaseApp is not available. Ensure firebase-init.js is loaded first.');
    return;
  }

  // Initialize Firebase Functions
  const functions = firebase.functions();

  /**
   * Create a client invite (practitioner only)
   * @param {string} mobile - Client mobile number
   * @param {string} [clientName] - Optional client name
   * @param {string} [note] - Optional note
   * @returns {Promise<Object>} Invite details with inviteId, code, expiresAt
   */
  async function createClientInvite(mobile, clientName, note) {
    try {
      const createInvite = functions.httpsCallable('createClientInvite');
      const result = await createInvite({
        mobile,
        clientName: clientName || null,
        note: note || null
      });
      return result.data;
    } catch (error) {
      console.error('createClientInvite error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      
      // Preserve the original error with code and details
      const enhancedError = new Error(error.message || 'Failed to create client invite');
      enhancedError.code = error.code;
      enhancedError.details = error.details;
      throw enhancedError;
    }
  }

  /**
   * Verify a client invite code
   * @param {string} mobile - Client mobile number
   * @param {string} code - Verification code
   * @returns {Promise<Object>} Practitioner ID and invite ID
   */
  async function verifyClientInvite(mobile, code) {
    try {
      const verifyInvite = functions.httpsCallable('verifyClientInvite');
      const result = await verifyInvite({
        mobile,
        code
      });
      return result.data;
    } catch (error) {
      console.error('verifyClientInvite error:', error);
      throw new Error(error.message || 'Failed to verify invite code');
    }
  }

  /**
   * Create a client request for practitioner assignment
   * @param {string[]} needs - Array of need tags
   * @param {string} [message] - Optional message
   * @returns {Promise<Object>} Request ID and assigned practitioner ID
   */
  async function createClientRequest(needs, message) {
    try {
      const createRequest = functions.httpsCallable('createClientRequest');
      const result = await createRequest({
        needs,
        message: message || null
      });
      return result.data;
    } catch (error) {
      console.error('createClientRequest error:', error);
      throw new Error(error.message || 'Failed to create client request');
    }
  }

  /**
   * Respond to a client request (practitioner only)
   * @param {string} requestId - Request ID
   * @param {string} action - 'accept' or 'decline'
   * @returns {Promise<Object>} Updated status and assigned practitioner ID
   */
  async function respondToClientRequest(requestId, action) {
    try {
      const respondRequest = functions.httpsCallable('respondToClientRequest');
      const result = await respondRequest({
        requestId,
        action
      });
      return result.data;
    } catch (error) {
      console.error('respondToClientRequest error:', error);
      throw new Error(error.message || 'Failed to respond to client request');
    }
  }

  // Expose on global namespace
  window.CTClientLinking = {
    createClientInvite,
    verifyClientInvite,
    createClientRequest,
    respondToClientRequest
  };

  console.log('CTClientLinking module loaded');
})();

