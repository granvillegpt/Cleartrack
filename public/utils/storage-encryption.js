/**
 * Storage Encryption Utility
 * Provides encryption and decryption functions for sensitive data stored in localStorage
 * 
 * @module storage-encryption
 * @created 2025-12-09
 */

/**
 * Generates a base64-encoded encryption key from a passphrase
 * Uses a simple approach with crypto.subtle for key derivation
 * 
 * @async
 * @param {string} passphrase - The passphrase to derive the key from
 * @returns {Promise<string>} Base64-encoded key
 */
async function generateKey(passphrase) {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(passphrase);
    
    // Use SubtleCrypto to generate a digest
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert to base64
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const base64Key = btoa(hashHex);
    
    return base64Key;
  } catch (error) {
    console.error('Error generating encryption key:', error);
    throw error;
  }
}

/**
 * Encrypts data using AES-GCM encryption
 * Stores both IV and encrypted data in a structured format
 * 
 * @async
 * @param {string} data - The data to encrypt
 * @param {string} passphrase - The passphrase for encryption
 * @returns {Promise<string>} JSON string containing encrypted data and IV
 */
async function encrypt(data, passphrase) {
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Generate key from passphrase
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    // Derive a key suitable for AES-GCM
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('cleartrack-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the data
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encoder.encode(data)
    );
    
    // Convert to base64 for storage
    const encryptedArray = Array.from(new Uint8Array(encryptedData));
    const encryptedBase64 = btoa(String.fromCharCode(...encryptedArray));
    
    const ivArray = Array.from(iv);
    const ivBase64 = btoa(String.fromCharCode(...ivArray));
    
    // Return structured encrypted data
    return JSON.stringify({
      encrypted: encryptedBase64,
      iv: ivBase64,
      version: 1
    });
  } catch (error) {
    console.error('Error encrypting data:', error);
    throw error;
  }
}

/**
 * Decrypts data that was encrypted using the encrypt function
 * 
 * @async
 * @param {string} encryptedPayload - JSON string containing encrypted data and IV
 * @param {string} passphrase - The passphrase for decryption
 * @returns {Promise<string>} The decrypted data
 */
async function decrypt(encryptedPayload, passphrase) {
  try {
    const encoder = new TextEncoder();
    
    // Parse the encrypted payload
    const payload = JSON.parse(encryptedPayload);
    const { encrypted, iv } = payload;
    
    // Convert from base64
    const encryptedArray = Uint8Array.from(
      atob(encrypted),
      c => c.charCodeAt(0)
    );
    
    const ivArray = Uint8Array.from(
      atob(iv),
      c => c.charCodeAt(0)
    );
    
    // Derive the same key using the same passphrase
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('cleartrack-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivArray },
      key,
      encryptedArray
    );
    
    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    console.error('Error decrypting data:', error);
    throw error;
  }
}

/**
 * Stores encrypted data in localStorage
 * 
 * @async
 * @param {string} key - The localStorage key
 * @param {string} value - The value to encrypt and store
 * @param {string} passphrase - The passphrase for encryption
 * @returns {Promise<void>}
 */
async function setEncryptedItem(key, value, passphrase) {
  try {
    const encryptedValue = await encrypt(value, passphrase);
    localStorage.setItem(key, encryptedValue);
  } catch (error) {
    console.error(`Error storing encrypted item at key "${key}":`, error);
    throw error;
  }
}

/**
 * Retrieves and decrypts data from localStorage
 * 
 * @async
 * @param {string} key - The localStorage key
 * @param {string} passphrase - The passphrase for decryption
 * @returns {Promise<string|null>} The decrypted value or null if key doesn't exist
 */
async function getEncryptedItem(key, passphrase) {
  try {
    const encryptedValue = localStorage.getItem(key);
    
    if (!encryptedValue) {
      return null;
    }
    
    return await decrypt(encryptedValue, passphrase);
  } catch (error) {
    console.error(`Error retrieving encrypted item from key "${key}":`, error);
    throw error;
  }
}

/**
 * Removes an encrypted item from localStorage
 * 
 * @param {string} key - The localStorage key
 * @returns {void}
 */
function removeEncryptedItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing item at key "${key}":`, error);
    throw error;
  }
}

/**
 * Clears all encrypted items from localStorage
 * Warning: This will clear all localStorage data
 * 
 * @returns {void}
 */
function clearAllEncryptedItems() {
  try {
    localStorage.clear();
  } catch (error) {
    console.error('Error clearing localStorage:', error);
    throw error;
  }
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateKey,
    encrypt,
    decrypt,
    setEncryptedItem,
    getEncryptedItem,
    removeEncryptedItem,
    clearAllEncryptedItems
  };
} else {
  // Browser global export
  window.StorageEncryption = {
    generateKey,
    encrypt,
    decrypt,
    setEncryptedItem,
    getEncryptedItem,
    removeEncryptedItem,
    clearAllEncryptedItems
  };
}
