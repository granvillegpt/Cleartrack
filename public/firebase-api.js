/**
 * Firebase API Wrapper for Frontend
 * 
 * This provides a Firebase-based API that mirrors my old REST calls.
 */

const firebaseApi = {
  // Authentication ---------------------
  async login(email, password) {
    // Ensure Firebase is initialized
    if (!window.firebaseAuth || !window.firebaseDb) {
      throw new Error('Firebase is not initialized. Please refresh the page.');
    }
    
    try {
      // Step 1: Authenticate with Firebase Auth
      const userCredential = await window.firebaseAuth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      // Step 2: Get or create user document in Firestore
      let userData = {};
      try {
        const userDoc = await window.firebaseDb.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
          userData = userDoc.data();
          console.log('[firebase-api] User document found');
        } else {
          // User exists in Auth but not in Firestore - create default document
          console.log('[firebase-api] Creating default user document');
          const defaultUserData = {
            email: user.email,
            role: 'user',
            createdAt: new Date().toISOString()
          };
          try {
            await window.firebaseDb.collection('users').doc(user.uid).set(defaultUserData);
            userData = defaultUserData;
            console.log('[firebase-api] Default user document created');
          } catch (createError) {
            console.error('[firebase-api] Failed to create default document:', createError);
            // Continue with empty userData
          }
        }
      } catch (firestoreError) {
        console.error('[firebase-api] Error reading user document:', firestoreError);
        // Continue with empty userData - don't block login
      }
      
      // Step 3: Store token and user data
      const token = await user.getIdToken();
      localStorage.setItem('token', token);
      localStorage.setItem('firebaseUser', JSON.stringify({ uid: user.uid, email: user.email, ...userData }));
      
      return {
        token,
        user: {
          uid: user.uid,
          email: user.email,
          ...userData
        }
      };
    } catch (error) {
      console.error('[firebase-api] Login error:', error);
      throw new Error(this.getAuthErrorMessage(error.code));
    }
  },

  async signup(email, password, extraData = {}) {
    // Ensure Firebase is initialized
    if (!window.firebaseAuth || !window.firebaseDb) {
      throw new Error('Firebase is not initialized. Please refresh the page.');
    }
    
    try {
      // Step 1: Create user in Firebase Authentication
      console.log('[firebase-api] Creating user in Firebase Authentication...');
      const userCredential = await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      console.log('[firebase-api] User created in Auth, UID:', user.uid);
      
      // Step 2: Prepare user data for Firestore
      // Always set role to 'user' for new registrations (unless admin/practitioner)
      const finalRole = (extraData.role === 'admin' || extraData.role === 'practitioner') 
        ? extraData.role 
        : 'user';
      
      const userData = {
        email: user.email,
        role: finalRole,
        createdAt: new Date().toISOString(),
        ...extraData,
        role: finalRole // Ensure role is correct
      };
      
      // Step 3: Create user document in Firestore
      // User is automatically signed in after createUserWithEmailAndPassword
      console.log('[firebase-api] Creating user document in Firestore...');
      console.log('[firebase-api] User UID:', user.uid);
      console.log('[firebase-api] User data:', userData);
      console.log('[firebase-api] Auth state - current user:', window.firebaseAuth.currentUser?.uid);
      
      try {
        await window.firebaseDb.collection('users').doc(user.uid).set(userData);
        console.log('[firebase-api] ✅ User document created successfully in Firestore');
      } catch (firestoreError) {
        console.error('[firebase-api] ❌ Firestore error:', firestoreError);
        console.error('[firebase-api] Error code:', firestoreError.code);
        console.error('[firebase-api] Error message:', firestoreError.message);
        
        // Re-throw Firestore errors so they can be handled
        throw new Error(`Failed to create user profile: ${firestoreError.message || 'Unknown error'}`);
      }
      
      // Step 4: Store token and user data
      const token = await user.getIdToken();
      localStorage.setItem('token', token);
      localStorage.setItem('firebaseUser', JSON.stringify({ uid: user.uid, ...userData }));
      
      console.log('[firebase-api] ✅ Signup completed successfully');
      
      return {
        token,
        user: {
          uid: user.uid,
          email: user.email,
          ...userData
        }
      };
    } catch (error) {
      console.error('[firebase-api] Signup error:', error);
      console.error('[firebase-api] Error code:', error.code);
      console.error('[firebase-api] Error message:', error.message);
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email is already registered. Please use a different email or try logging in.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Password is too weak. Please use at least 6 characters.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address. Please check your email format.');
      } else if (error.code === 'auth/operation-not-allowed') {
        throw new Error('Email/Password authentication is not enabled. Please contact support.');
      }
      
      // Re-throw the error with a user-friendly message
      throw new Error(error.message || this.getAuthErrorMessage(error.code));
    }
  },

  async logout() {
    if (!window.firebaseAuth) {
      throw new Error('Firebase is not initialized. Please refresh the page.');
    }
    await window.firebaseAuth.signOut();
    localStorage.removeItem('token');
    localStorage.removeItem('firebaseUser');
  },

  getCurrentUser() {
    const stored = localStorage.getItem('firebaseUser');
    if (!stored) return null;
    try { return JSON.parse(stored); } catch { return null; }
  },

  // Firestore Helpers ---------------------
  async saveData(collection, docId, data) {
    if (!window.firebaseDb) {
      throw new Error('Firebase is not initialized. Please refresh the page.');
    }
    
    // Prevent non-admins from changing their own role
    if (collection === 'users' && data.role) {
      const currentUser = window.firebaseAuth?.currentUser;
      if (currentUser) {
        const currentRole = await this.getCurrentUserRole(currentUser.uid);
        if (currentRole !== 'admin' && docId === currentUser.uid) {
          console.warn('[firebase-api] Non-admin cannot change role. Removing role from update.');
          delete data.role;
        }
      }
    }
    
    await window.firebaseDb.collection(collection).doc(docId).set(data, { merge: true });
    return { success: true };
  },

  async getData(collection, docId) {
    if (!window.firebaseDb) {
      throw new Error('Firebase is not initialized. Please refresh the page.');
    }
    const doc = await window.firebaseDb.collection(collection).doc(docId).get();
    if (!doc.exists) return null;
    return doc.data();
  },

  async list(collection, queryBuilder = null) {
    if (!window.firebaseDb) {
      throw new Error('Firebase is not initialized. Please refresh the page.');
    }
    let ref = window.firebaseDb.collection(collection);
    if (typeof queryBuilder === 'function') ref = queryBuilder(ref);

    const snapshot = await ref.get();
    const items = [];
    snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
    return items;
  },

  async update(collection, docId, data) {
    if (!window.firebaseDb) {
      throw new Error('Firebase is not initialized. Please refresh the page.');
    }
    await window.firebaseDb.collection(collection).doc(docId).update(data);
    return { success: true };
  },

  getAuthErrorMessage(code) {
    const m = {
      'auth/user-not-found': 'No user found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
      'auth/email-already-in-use': 'Email already used.',
      'auth/weak-password': 'Password too weak.',
      'auth/operation-not-allowed': 'This sign-in method is not enabled.',
    };
    return m[code] || `Authentication failed. ${code ? `(Error: ${code})` : ''}`;
  },

  // Role helper function
  async getCurrentUserRole(uid) {
    if (!window.firebaseDb) {
      console.warn('[roles] Firebase not initialized');
      return null;
    }
    
    try {
      const userDoc = await window.firebaseDb.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        console.warn('[roles] No user doc for uid', uid);
        return null;
      }
      const data = userDoc.data();
      return data.role || null;
    } catch (error) {
      console.error('[roles] Error getting user role:', error);
      return null;
    }
  }
};

// Expose globally
window.firebaseApi = firebaseApi;

/**
 * ClearTrack Auth API - Focused auth + profile helper API for login flow
 * 
 * Provides simplified authentication helpers for the ClearTrack login system.
 */
(function() {
  'use strict';

  // Verify Firebase instances are available
  if (!window.firebaseAuth) {
    console.error('cleartrackAuthApi: window.firebaseAuth is not available. Ensure firebase-init.js is loaded first.');
    return;
  }

  if (!window.firebaseDb) {
    console.error('cleartrackAuthApi: window.firebaseDb is not available. Ensure firebase-init.js is loaded first.');
    return;
  }

  /**
   * Get user profile from Firestore
   * @param {string} uid - User ID
   * @returns {Promise<Object>} User profile data
   * @throws {Error} If user document does not exist
   */
  async function getUserProfile(uid) {
    try {
      const userDoc = await window.firebaseDb.collection('users').doc(uid).get();
      
      if (!userDoc.exists) {
        throw new Error(`User profile not found for uid: ${uid}`);
      }

      return userDoc.data();
    } catch (error) {
      console.error('cleartrackAuthApi.getUserProfile error:', error);
      throw error;
    }
  }

  /**
   * Redirect user based on their role
   * @param {string} role - User role ('practitioner', 'admin', or other)
   */
  function redirectByRole(role) {
    if (role === 'practitioner') {
      window.location.href = '/practitioner-dashboard.html';
    } else if (role === 'admin') {
      window.location.href = '/admin-dashboard.html';
    } else {
      window.location.href = '/user-dashboard.html';
    }
  }

  // Expose the API globally (for backward compatibility)
  window.cleartrackAuthApi = {
    getUserProfile,
    redirectByRole
  };

  console.log('cleartrackAuthApi initialized successfully');
})();

/* ---- ClearTrack Shim: CT-AUTH-DEBUG-2025-11 ---- */
(function () {
  try {
    if (!window.firebase && typeof firebase === "undefined") {
      console.error("[CT] firebase-api: firebase global is not available");
      return;
    }

    var app =
      window.firebaseApp ||
      (window.firebase && window.firebase.apps && window.firebase.apps.length
        ? window.firebase.app()
        : (window.firebase && window.firebase.initializeApp
            ? window.firebase.initializeApp(window.firebaseConfig)
            : null));

    if (!app) {
      console.error("[CT] firebase-api: could not get or create Firebase app");
      return;
    }

    var auth = window.firebaseAuth || window.firebase.auth();
    var db =
      window.firebaseDb ||
      (window.firebase.firestore ? window.firebase.firestore() : null);

    window.firebaseApp = app;
    window.firebaseAuth = auth;
    window.firebaseDb = db;

    if (!window.firebaseApi) window.firebaseApi = {};
    window.firebaseApi.app = app;
    window.firebaseApi.auth = auth;
    window.firebaseApi.db = db;

    console.log("[CT] firebase-api ready:", !!app, !!auth, !!db);
  } catch (e) {
    console.error("[CT] firebase-api error", e);
  }
})();
