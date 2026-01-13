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

  // Check if Firebase Functions is available (optional - will use Firestore fallback if not)
  const functionsAvailable = typeof firebase !== 'undefined' && typeof firebase.functions === 'function';
  const functions = functionsAvailable ? firebase.functions() : null;
  
  if (!functionsAvailable) {
    console.warn('[client-linking] Firebase Functions not available — will use Firestore fallback methods');
  }

  /**
   * Create a client invite (practitioner only)
   * @param {string} mobile - Client mobile number
   * @param {string} [clientName] - Optional client name
   * @param {string} [note] - Optional note
   * @returns {Promise<Object>} Invite details with inviteId, code, expiresAt
   */
  async function createClientInvite(mobile, clientName, note) {
    if (!functions) {
      throw new Error('Firebase Functions is not available. Client invite creation requires Firebase Functions SDK.');
    }
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
    if (!functions) {
      throw new Error('Firebase Functions is not available. Invite verification requires Firebase Functions SDK.');
    }
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
   * Create a client request for practitioner assignment (with Firestore fallback)
   * @param {string[]} needs - Array of need tags
   * @param {string} [message] - Optional message
   * @returns {Promise<Object>} Request ID and assigned practitioner ID
   */
  async function createClientRequest(needs, message) {
    // If Functions not available, use Firestore fallback directly
    if (!functions) {
      return await createClientRequestFallback(needs, message);
    }
    
    // Try Cloud Function first
    try {
      const createRequest = functions.httpsCallable('createClientRequest');
      const result = await createRequest({
        needs,
        message: message || null
      });
      return result.data;
    } catch (error) {
      console.warn('Cloud Function failed, trying Firestore fallback:', error);
      
      // Check if function is not deployed or unavailable - use fallback
      if (error.code === 'not-found' || 
          error.code === 'failed-precondition' ||
          error.code === 'internal' ||
          (error.message && (error.message.includes('not found') || 
                             error.message.includes('not deployed') ||
                             error.message.includes('Failed to create client request')))) {
        
        // Fallback: Use Firestore directly
        return await createClientRequestFallback(needs, message);
      }
      
      // For other errors (auth, permission), throw them
      if (error.code === 'unauthenticated') {
        throw new Error('You must be logged in to send a request. Please log in and try again.');
      } else if (error.code === 'permission-denied') {
        throw new Error('You do not have permission to perform this action.');
      } else if (error.code === 'invalid-argument') {
        throw new Error(error.message || 'Invalid request. Please check your selections and try again.');
      }
      
      // Try fallback for any other error
      return await createClientRequestFallback(needs, message);
    }
  }

  /**
   * Fallback: Create client request directly in Firestore
   * @param {string[]} needs - Array of need tags
   * @param {string} [message] - Optional message
   * @returns {Promise<Object>} Request ID and assigned practitioner ID
   */
  async function createClientRequestFallback(needs, message) {
    if (!window.firebaseDb || !window.firebaseAuth) {
      throw new Error('Firebase is not initialized. Please refresh the page.');
    }

    const user = window.firebaseAuth.currentUser;
    if (!user) {
      throw new Error('You must be logged in to send a request.');
    }

    const clientUid = user.uid;

    // Validate input
    if (!needs || !Array.isArray(needs) || needs.length === 0) {
      throw new Error('Please select at least one service need.');
    }

    // Ensure user role is set to client
    await window.firebaseDb.collection('users').doc(clientUid).set({
      role: 'client'
    }, { merge: true });

    // Find appropriate practitioner
    let assignedPractitionerId = null;

    try {
      // Query practitioners
      const practitionersSnapshot = await window.firebaseDb.collection('users')
        .where('role', '==', 'practitioner')
        .get();

      if (!practitionersSnapshot.empty) {
        const practitioners = practitionersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Sort by rotationIndex (default 0) or createdAt
        practitioners.sort((a, b) => {
          const aIndex = a.rotationIndex || 0;
          const bIndex = b.rotationIndex || 0;
          if (aIndex !== bIndex) return aIndex - bIndex;
          const aCreated = a.createdAt?.toMillis ? a.createdAt.toMillis() : 
                          (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const bCreated = b.createdAt?.toMillis ? b.createdAt.toMillis() : 
                          (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return aCreated - bCreated;
        });

        // Try to match by specializations
        let matchingPractitioners = practitioners;
        if (needs && needs.length > 0) {
          const matching = practitioners.filter(p => {
            const practitionerSpecs = p.specializations || [];
            return needs.some(need => practitionerSpecs.includes(need));
          });
          if (matching.length > 0) {
            matchingPractitioners = matching;
          }
        }

        // Sort matching practitioners by rotationIndex
        matchingPractitioners.sort((a, b) => {
          const aIndex = a.rotationIndex || 0;
          const bIndex = b.rotationIndex || 0;
          if (aIndex !== bIndex) return aIndex - bIndex;
          const aCreated = a.createdAt?.toMillis ? a.createdAt.toMillis() : 
                          (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const bCreated = b.createdAt?.toMillis ? b.createdAt.toMillis() : 
                          (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return aCreated - bCreated;
        });

        // Pick the first matching practitioner
        if (matchingPractitioners.length > 0) {
          assignedPractitionerId = matchingPractitioners[0].id;

          // Increment rotation index for next time
          const currentIndex = matchingPractitioners[0].rotationIndex || 0;
          await window.firebaseDb.collection('users').doc(assignedPractitionerId).update({
            rotationIndex: currentIndex + 1
          });
        }
      }
    } catch (practitionerError) {
      console.error('Error finding practitioner:', practitionerError);
      // Continue without assignment - request will be unassigned
    }

    // Create request
    const requestId = window.firebaseDb.collection('clientRequests').doc().id;
    const now = window.firebase.firestore ? 
                window.firebase.firestore.FieldValue.serverTimestamp() : 
                new Date();

    const requestData = {
      requestId,
      clientUid,
      needs,
      message: message || null,
      assignedPractitionerId,
      declinedBy: [],
      roundAttempt: 1,
      status: assignedPractitionerId ? 'pending' : 'unassigned',
      createdAt: now,
      updatedAt: now
    };

    await window.firebaseDb.collection('clientRequests').doc(requestId).set(requestData);

    console.log('✅ Client request created via Firestore fallback:', requestId);

    return {
      requestId,
      assignedPractitionerId
    };
  }

  /**
   * Respond to a client request (practitioner only) - with Firestore fallback
   * @param {string} requestId - Request ID
   * @param {string} action - 'accept' or 'decline'
   * @returns {Promise<Object>} Updated status and assigned practitioner ID
   */
  async function respondToClientRequest(requestId, action) {
    // If Functions not available, use Firestore fallback directly
    if (!functions) {
      return await respondToClientRequestFallback(requestId, action);
    }
    
    // Try Cloud Function first
    try {
      const respondRequest = functions.httpsCallable('respondToClientRequest');
      const result = await respondRequest({
        requestId,
        action
      });
      return result.data;
    } catch (error) {
      console.warn('Cloud Function failed, trying Firestore fallback:', error);
      
      // Use fallback if function not available
      if (error.code === 'not-found' || 
          error.code === 'failed-precondition' ||
          error.code === 'internal') {
        return await respondToClientRequestFallback(requestId, action);
      }
      
      // For auth/permission errors, throw them
      if (error.code === 'unauthenticated') {
        throw new Error('You must be logged in to respond to requests.');
      } else if (error.code === 'permission-denied') {
        throw new Error('You do not have permission to perform this action.');
      }
      
      // Try fallback for other errors
      return await respondToClientRequestFallback(requestId, action);
    }
  }

  /**
   * Fallback: Respond to client request directly in Firestore
   * @param {string} requestId - Request ID
   * @param {string} action - 'accept' or 'decline'
   * @returns {Promise<Object>} Updated status and assigned practitioner ID
   */
  async function respondToClientRequestFallback(requestId, action) {
    if (!window.firebaseDb || !window.firebaseAuth) {
      throw new Error('Firebase is not initialized. Please refresh the page.');
    }

    const user = window.firebaseAuth.currentUser;
    if (!user) {
      throw new Error('You must be logged in to respond to requests.');
    }

    const currentPractitionerId = user.uid;

    // Validate input
    if (!requestId || typeof requestId !== 'string') {
      throw new Error('Request ID is required');
    }
    if (action !== 'accept' && action !== 'decline') {
      throw new Error('Action must be "accept" or "decline"');
    }

    // Load request
    const requestRef = window.firebaseDb.collection('clientRequests').doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      throw new Error('Request not found');
    }

    const requestData = requestDoc.data();

    // Verify this request is assigned to this practitioner
    if (requestData.assignedPractitionerId !== currentPractitionerId) {
      throw new Error('This request is not assigned to you');
    }

    const now = window.firebase.firestore ? 
                window.firebase.firestore.FieldValue.serverTimestamp() : 
                new Date();

    if (action === 'accept') {
      // Accept: link client to practitioner
      await requestRef.update({
        status: 'accepted',
        updatedAt: now
      });

      // Update client user document
      await window.firebaseDb.collection('users').doc(requestData.clientUid).set({
        practitionerId: currentPractitionerId
      }, { merge: true });

      // Create notification for client
      try {
        await window.firebaseDb.collection('notifications').add({
          userId: requestData.clientUid,
          type: 'request_accepted',
          title: 'Request Accepted',
          message: `Your request has been accepted! You are now connected to a practitioner.`,
          read: false,
          createdAt: now
        });
      } catch (notifError) {
        console.error('Error creating client notification:', notifError);
      }

      return {
        status: 'accepted',
        assignedPractitionerId: currentPractitionerId
      };
    } else {
      // Decline: reassign to next practitioner
      const declinedBy = requestData.declinedBy || [];
      declinedBy.push(currentPractitionerId);
      const roundAttempt = requestData.roundAttempt || 1;

      // Find next practitioner
      const practitionersSnapshot = await window.firebaseDb.collection('users')
        .where('role', '==', 'practitioner')
        .get();

      let nextPractitionerId = null;
      let shouldRetryRound = false;

      if (!practitionersSnapshot.empty) {
        const allPractitioners = practitionersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // If all practitioners have declined, start round 2
        if (declinedBy.length >= allPractitioners.length && roundAttempt === 1) {
          shouldRetryRound = true;
          const practitioners = allPractitioners;
          
          if (practitioners.length > 0) {
            practitioners.sort((a, b) => {
              const aIndex = a.rotationIndex || 0;
              const bIndex = b.rotationIndex || 0;
              if (aIndex !== bIndex) return aIndex - bIndex;
              const aCreated = a.createdAt?.toMillis ? a.createdAt.toMillis() : 
                              (a.createdAt ? new Date(a.createdAt).getTime() : 0);
              const bCreated = b.createdAt?.toMillis ? b.createdAt.toMillis() : 
                              (b.createdAt ? new Date(b.createdAt).getTime() : 0);
              return aCreated - bCreated;
            });

            nextPractitionerId = practitioners[0].id;
            const currentIndex = practitioners[0].rotationIndex || 0;
            await window.firebaseDb.collection('users').doc(nextPractitionerId).update({
              rotationIndex: currentIndex + 1
            });
          }
        } else {
          const practitioners = allPractitioners.filter(p => !declinedBy.includes(p.id));

          if (practitioners.length > 0) {
            practitioners.sort((a, b) => {
              const aIndex = a.rotationIndex || 0;
              const bIndex = b.rotationIndex || 0;
              if (aIndex !== bIndex) return aIndex - bIndex;
              const aCreated = a.createdAt?.toMillis ? a.createdAt.toMillis() : 
                              (a.createdAt ? new Date(a.createdAt).getTime() : 0);
              const bCreated = b.createdAt?.toMillis ? b.createdAt.toMillis() : 
                              (b.createdAt ? new Date(b.createdAt).getTime() : 0);
              return aCreated - bCreated;
            });

            nextPractitionerId = practitioners[0].id;
            const currentIndex = practitioners[0].rotationIndex || 0;
            await window.firebaseDb.collection('users').doc(nextPractitionerId).update({
              rotationIndex: currentIndex + 1
            });
          }
        }
      }

      // Update request
      if (nextPractitionerId) {
        await requestRef.update({
          assignedPractitionerId: nextPractitionerId,
          declinedBy: shouldRetryRound ? [] : declinedBy,
          roundAttempt: shouldRetryRound ? 2 : roundAttempt,
          status: 'pending',
          updatedAt: now
        });
        
        // Create new connectionRequest for the next practitioner
        try {
          const connectionRequestData = {
            userId: requestData.clientUid,
            practitionerId: nextPractitionerId,
            clientRequestId: requestId,
            status: 'pending',
            timestamp: now
          };
          
          await window.firebaseDb.collection('connectionRequests').add(connectionRequestData);
          console.log('✅ New connectionRequest created for next practitioner:', nextPractitionerId);
        } catch (connReqError) {
          console.error('Error creating new connectionRequest:', connReqError);
          // Don't fail the rollover if connectionRequest creation fails
        }
      } else {
        // No practitioners available - check if this is round 2 failure
        if (roundAttempt >= 2) {
          // Set status to ESCALATED
          await requestRef.update({
            assignedPractitionerId: null,
            declinedBy,
            roundAttempt: roundAttempt,
            status: 'ESCALATED',
            updatedAt: now
          });
          
          // Notify admin
          try {
            const adminUsersSnapshot = await window.firebaseDb.collection('users')
              .where('role', '==', 'admin')
              .get();
            
            if (!adminUsersSnapshot.empty) {
              const batch = window.firebaseDb.batch();
              adminUsersSnapshot.docs.forEach(adminDoc => {
                const notifRef = window.firebaseDb.collection('notifications').doc();
                batch.set(notifRef, {
                  userId: adminDoc.id,
                  type: 'unassigned_request',
                  title: 'Unassigned Client Request',
                  message: `Client request ${requestId} could not be assigned after 2 rounds. All practitioners have declined.`,
                  requestId: requestId,
                  clientUid: requestData.clientUid,
                  read: false,
                  createdAt: now
                });
              });
              await batch.commit();
            }
          } catch (adminError) {
            console.error('Error notifying admin:', adminError);
          }
        } else {
          await requestRef.update({
            assignedPractitionerId: null,
            declinedBy,
            roundAttempt: roundAttempt,
            status: 'unassigned',
            updatedAt: now
          });
        }
      }

      // Notify client about decline/reassignment
      try {
        await window.firebaseDb.collection('notifications').add({
          userId: requestData.clientUid,
          type: nextPractitionerId ? 'request_reassigned' : 'request_unassigned',
          title: nextPractitionerId ? 'Request Reassigned' : 'Request Unassigned',
          message: nextPractitionerId 
            ? 'Your request has been reassigned to another practitioner for review.'
            : 'Your request could not be assigned at this time. Please try again later or contact support.',
          read: false,
          createdAt: now
        });
      } catch (notifError) {
        console.error('Error creating client notification:', notifError);
      }

      console.log('✅ Client request response processed via Firestore fallback');

      return {
        status: nextPractitionerId ? 'reassigned' : 'unassigned',
        assignedPractitionerId: nextPractitionerId,
        roundAttempt: shouldRetryRound ? 2 : roundAttempt
      };
    }
  }

  /**
   * Connect client to practitioner using a practitioner code
   * @param {string} code - Practitioner code
   * @returns {Promise<void>} Resolves on success
   */
  async function connectWithPractitionerCode(code) {
    // Require Firebase Auth and Firestore
    if (!window.firebaseDb || !window.firebaseAuth) {
      throw new Error('Firebase is not initialized. Please refresh the page.');
    }

    // Require authenticated user
    const user = window.firebaseAuth.currentUser;
    if (!user) {
      throw new Error('You must be logged in to connect with a practitioner code.');
    }

    const clientUid = user.uid;

    // Normalize the code
    const normalizedCode = code.trim().toUpperCase();
    
    if (!normalizedCode) {
      throw new Error('Practitioner code cannot be empty.');
    }

    // Query practitioners collection for matching code
    const practitionersSnapshot = await window.firebaseDb.collection('practitioners')
      .where('practitionerCode', '==', normalizedCode)
      .limit(1)
      .get();

    if (practitionersSnapshot.empty) {
      throw new Error('Invalid practitioner code');
    }

    // Get the practitioner ID
    const practitionerId = practitionersSnapshot.docs[0].id;

    // Load current user document
    const userRef = window.firebaseDb.collection('users').doc(clientUid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error('User document not found. Please refresh the page.');
    }

    const userData = userDoc.data();

    // Check if already connected
    if (userData.practitionerLink && userData.practitionerLink.status === 'active') {
      throw new Error('You are already connected to a practitioner');
    }

    // Get server timestamp
    const now = window.firebase.firestore ? 
                window.firebase.firestore.FieldValue.serverTimestamp() : 
                new Date();

    // Update user document with practitioner link
    await userRef.set({
      practitionerLink: {
        practitionerId,
        practitionerCode: normalizedCode,
        status: 'active',
        connectedAt: now,
        connectedVia: 'code'
      }
    }, { merge: true });

    console.log('✅ Client connected to practitioner via code:', normalizedCode);
  }

  // Expose on global namespace
  window.CTClientLinking = {
    createClientInvite,
    verifyClientInvite,
    createClientRequest,
    respondToClientRequest,
    connectWithPractitionerCode
  };

  console.log('CTClientLinking module loaded');
})();

