// public/firebase-config.js

/**
 * PRODUCTION ARCHITECTURE LOCK:
 * =============================
 * This config defines the SINGLE Firebase project used for ALL runtime services:
 *   Project ID: cleartrack-1f6c6
 *   Services: Auth, Firestore, Functions, AI/Gemini, Storage
 * 
 * A separate project (cleartrack-hosting) exists ONLY for hosting deployment.
 * cleartrack-hosting MUST NEVER be initialized in code - it is deployment-only.
 * 
 * DO NOT:
 * - Change this projectId to cleartrack-hosting
 * - Create additional configs for other projects
 * - Initialize multiple Firebase projects in code
 * 
 * ALL Firebase initialization MUST use this window.firebaseConfig.
 */

const firebaseConfig = {
  apiKey: "AIzaSyAacjIUCyGRHvY2BnPawkLiWp1IYjJKPjk",
  authDomain: "cleartrack-1f6c6.firebaseapp.com",
  projectId: "cleartrack-1f6c6", // ARCHITECTURE: This MUST remain cleartrack-1f6c6
  storageBucket: "cleartrack-1f6c6.appspot.com",
  messagingSenderId: "634138353416",
  appId: "1:634138353416:web:4b799295c2d17450f896bd"
};

// Expose config so firebase-init.js and firebase-api.js can use it
// ALL Firebase initialization MUST use this config (cleartrack-1f6c6)
window.firebaseConfig = firebaseConfig;
