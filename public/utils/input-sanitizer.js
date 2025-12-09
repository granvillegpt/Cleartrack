/**
 * Input Sanitizer Utility
 * Provides comprehensive input validation and sanitization functions
 * to prevent XSS attacks and data corruption.
 *
 * @module input-sanitizer
 */

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string
 */
function escapeHtml(str) {
  if (typeof str !== 'string') {
    return '';
  }
  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
  };
  return str.replace(/[&<>"'\/]/g, (char) => htmlEscapes[char]);
}

/**
 * Sanitizes text input by removing potentially harmful content
 * @param {string} input - The input string to sanitize
 * @param {Object} options - Configuration options
 * @param {boolean} options.trim - Whether to trim whitespace (default: true)
 * @param {boolean} options.removeScripts - Whether to remove script tags (default: true)
 * @param {number} options.maxLength - Maximum allowed length (default: null)
 * @returns {string} - The sanitized string
 */
function sanitizeText(input, options = {}) {
  const {
    trim = true,
    removeScripts = true,
    maxLength = null
  } = options;

  if (typeof input !== 'string') {
    return '';
  }

  let result = input;

  // Trim whitespace if requested
  if (trim) {
    result = result.trim();
  }

  // Remove script tags and event handlers
  if (removeScripts) {
    result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    result = result.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
    result = result.replace(/on\w+\s*=\s*[^\s>]*/gi, '');
  }

  // Enforce maximum length
  if (maxLength && result.length > maxLength) {
    result = result.substring(0, maxLength);
  }

  return result;
}

/**
 * Validates and sanitizes email addresses
 * @param {string} email - The email to validate
 * @returns {Object} - Object with isValid boolean and sanitized email
 */
function sanitizeEmail(email) {
  if (typeof email !== 'string') {
    return { isValid: false, value: '' };
  }

  const sanitized = email.trim().toLowerCase();
  // RFC 5322 simplified regex for email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return {
    isValid: emailRegex.test(sanitized),
    value: sanitized
  };
}

/**
 * Validates and sanitizes URLs
 * @param {string} url - The URL to validate
 * @param {Object} options - Configuration options
 * @param {Array<string>} options.allowedProtocols - Allowed protocols (default: ['http', 'https'])
 * @returns {Object} - Object with isValid boolean and sanitized URL
 */
function sanitizeUrl(url, options = {}) {
  const { allowedProtocols = ['http', 'https'] } = options;

  if (typeof url !== 'string') {
    return { isValid: false, value: '' };
  }

  const sanitized = url.trim();

  try {
    const urlObj = new URL(sanitized);
    const protocol = urlObj.protocol.slice(0, -1); // Remove trailing ':'

    const isValid = allowedProtocols.includes(protocol);
    return {
      isValid,
      value: isValid ? sanitized : ''
    };
  } catch {
    return { isValid: false, value: '' };
  }
}

/**
 * Validates and sanitizes numeric input
 * @param {any} input - The input to validate
 * @param {Object} options - Configuration options
 * @param {number} options.min - Minimum allowed value
 * @param {number} options.max - Maximum allowed value
 * @param {boolean} options.integer - Whether value must be an integer (default: false)
 * @returns {Object} - Object with isValid boolean and value
 */
function sanitizeNumber(input, options = {}) {
  const { min = null, max = null, integer = false } = options;

  const num = Number(input);

  if (isNaN(num)) {
    return { isValid: false, value: null };
  }

  if (integer && !Number.isInteger(num)) {
    return { isValid: false, value: null };
  }

  if (min !== null && num < min) {
    return { isValid: false, value: null };
  }

  if (max !== null && num > max) {
    return { isValid: false, value: null };
  }

  return { isValid: true, value: num };
}

/**
 * Validates and sanitizes boolean input
 * @param {any} input - The input to validate
 * @returns {Object} - Object with isValid boolean and boolean value
 */
function sanitizeBoolean(input) {
  if (typeof input === 'boolean') {
    return { isValid: true, value: input };
  }

  if (typeof input === 'string') {
    const lower = input.toLowerCase().trim();
    if (['true', '1', 'yes', 'on'].includes(lower)) {
      return { isValid: true, value: true };
    }
    if (['false', '0', 'no', 'off'].includes(lower)) {
      return { isValid: true, value: false };
    }
  }

  return { isValid: false, value: null };
}

/**
 * Validates and sanitizes array input
 * @param {any} input - The input to validate
 * @param {Object} options - Configuration options
 * @param {Function} options.itemValidator - Function to validate each item
 * @param {number} options.maxLength - Maximum array length
 * @returns {Object} - Object with isValid boolean and sanitized array
 */
function sanitizeArray(input, options = {}) {
  const { itemValidator = null, maxLength = null } = options;

  if (!Array.isArray(input)) {
    return { isValid: false, value: [] };
  }

  if (maxLength && input.length > maxLength) {
    return { isValid: false, value: [] };
  }

  if (itemValidator && typeof itemValidator === 'function') {
    const sanitized = input.map(item => {
      const result = itemValidator(item);
      return result.isValid ? result.value : null;
    }).filter(item => item !== null);

    return {
      isValid: sanitized.length === input.length,
      value: sanitized
    };
  }

  return { isValid: true, value: input };
}

/**
 * Validates and sanitizes object input
 * @param {any} input - The input to validate
 * @param {Object} schema - Schema defining allowed fields and validators
 * @returns {Object} - Object with isValid boolean and sanitized object
 */
function sanitizeObject(input, schema = {}) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { isValid: false, value: {} };
  }

  const result = {};
  let isValid = true;

  for (const [key, validator] of Object.entries(schema)) {
    if (key in input && typeof validator === 'function') {
      const validation = validator(input[key]);
      if (validation.isValid) {
        result[key] = validation.value;
      } else {
        isValid = false;
      }
    }
  }

  return { isValid, value: result };
}

/**
 * Removes null bytes and other potentially harmful characters
 * @param {string} str - The string to clean
 * @returns {string} - The cleaned string
 */
function removeHarmfulCharacters(str) {
  if (typeof str !== 'string') {
    return '';
  }
  // Remove null bytes and control characters
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Validates input length
 * @param {string} input - The input to validate
 * @param {number} minLength - Minimum required length
 * @param {number} maxLength - Maximum allowed length
 * @returns {Object} - Object with isValid boolean and message
 */
function validateLength(input, minLength = 0, maxLength = Infinity) {
  if (typeof input !== 'string') {
    return { isValid: false, message: 'Input must be a string' };
  }

  const length = input.length;

  if (length < minLength) {
    return { isValid: false, message: `Input must be at least ${minLength} characters long` };
  }

  if (length > maxLength) {
    return { isValid: false, message: `Input must not exceed ${maxLength} characters` };
  }

  return { isValid: true, message: 'Valid length' };
}

/**
 * Validates input matches a specific pattern
 * @param {string} input - The input to validate
 * @param {RegExp} pattern - The regex pattern to match
 * @returns {Object} - Object with isValid boolean
 */
function validatePattern(input, pattern) {
  if (typeof input !== 'string' || !(pattern instanceof RegExp)) {
    return { isValid: false };
  }

  return { isValid: pattern.test(input) };
}

// Export functions for use in Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHtml,
    sanitizeText,
    sanitizeEmail,
    sanitizeUrl,
    sanitizeNumber,
    sanitizeBoolean,
    sanitizeArray,
    sanitizeObject,
    removeHarmfulCharacters,
    validateLength,
    validatePattern
  };
}

// Export for ES6 modules
if (typeof exports !== 'undefined') {
  Object.assign(exports, {
    escapeHtml,
    sanitizeText,
    sanitizeEmail,
    sanitizeUrl,
    sanitizeNumber,
    sanitizeBoolean,
    sanitizeArray,
    sanitizeObject,
    removeHarmfulCharacters,
    validateLength,
    validatePattern
  });
}
