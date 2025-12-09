/**
 * Error Handler Utility
 * Provides consistent error handling with user-friendly messages and logging
 */

/**
 * Custom error class for application-specific errors
 */
class ApplicationError extends Error {
  constructor(message, statusCode = 500, userMessage = null, context = {}) {
    super(message);
    this.name = 'ApplicationError';
    this.statusCode = statusCode;
    this.userMessage = userMessage || message;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Validation error class
 */
class ValidationError extends ApplicationError {
  constructor(message, context = {}) {
    super(message, 400, 'Please check your input and try again.', context);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error class
 */
class AuthenticationError extends ApplicationError {
  constructor(message, context = {}) {
    super(message, 401, 'Authentication failed. Please log in again.', context);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error class
 */
class AuthorizationError extends ApplicationError {
  constructor(message, context = {}) {
    super(message, 403, 'You do not have permission to access this resource.', context);
    this.name = 'AuthorizationError';
  }
}

/**
 * Not found error class
 */
class NotFoundError extends ApplicationError {
  constructor(message, context = {}) {
    super(message, 404, 'The requested resource was not found.', context);
    this.name = 'NotFoundError';
  }
}

/**
 * Server error class
 */
class ServerError extends ApplicationError {
  constructor(message, context = {}) {
    super(message, 500, 'An unexpected error occurred. Please try again later.', context);
    this.name = 'ServerError';
  }
}

/**
 * Logger configuration and utilities
 */
const Logger = {
  levels: {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
  },

  /**
   * Format log message with timestamp and level
   */
  format: (level, message, data = {}) => {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      level,
      message,
      ...(Object.keys(data).length > 0 && { data }),
    };
  },

  /**
   * Log debug message
   */
  debug: (message, data = {}) => {
    const log = Logger.format(Logger.levels.DEBUG, message, data);
    if (typeof console !== 'undefined') {
      console.debug('[DEBUG]', log.timestamp, message, Object.keys(data).length > 0 ? data : '');
    }
    return log;
  },

  /**
   * Log info message
   */
  info: (message, data = {}) => {
    const log = Logger.format(Logger.levels.INFO, message, data);
    if (typeof console !== 'undefined') {
      console.info('[INFO]', log.timestamp, message, Object.keys(data).length > 0 ? data : '');
    }
    return log;
  },

  /**
   * Log warning message
   */
  warn: (message, data = {}) => {
    const log = Logger.format(Logger.levels.WARN, message, data);
    if (typeof console !== 'undefined') {
      console.warn('[WARN]', log.timestamp, message, Object.keys(data).length > 0 ? data : '');
    }
    return log;
  },

  /**
   * Log error message
   */
  error: (message, error = null, data = {}) => {
    const errorData = {
      ...data,
      ...(error && {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
      }),
    };
    const log = Logger.format(Logger.levels.ERROR, message, errorData);
    if (typeof console !== 'undefined') {
      console.error('[ERROR]', log.timestamp, message, errorData);
    }
    return log;
  },
};

/**
 * Error handler function
 * Normalizes errors and provides appropriate responses
 */
const handleError = (error, context = {}) => {
  let normalizedError;

  // Handle ApplicationError instances
  if (error instanceof ApplicationError) {
    normalizedError = {
      success: false,
      statusCode: error.statusCode,
      message: error.userMessage,
      errorType: error.name,
      timestamp: error.timestamp,
      ...(process.env.NODE_ENV === 'development' && {
        details: {
          message: error.message,
          context: error.context,
          stack: error.stack,
        },
      }),
    };
  }
  // Handle standard Error instances
  else if (error instanceof Error) {
    const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';
    normalizedError = {
      success: false,
      statusCode: 500,
      message: isDev ? error.message : 'An unexpected error occurred. Please try again later.',
      errorType: error.name || 'Error',
      timestamp: new Date().toISOString(),
      ...(isDev && {
        details: {
          message: error.message,
          stack: error.stack,
          context,
        },
      }),
    };
  }
  // Handle non-Error objects
  else {
    normalizedError = {
      success: false,
      statusCode: 500,
      message: 'An unexpected error occurred. Please try again later.',
      errorType: 'UnknownError',
      timestamp: new Date().toISOString(),
      ...(typeof process !== 'undefined' &&
        process.env?.NODE_ENV === 'development' && {
          details: { context, error },
        }),
    };
  }

  // Log the error
  Logger.error(`Error: ${normalizedError.errorType}`, error, { context, ...normalizedError });

  return normalizedError;
};

/**
 * Async error wrapper for Express/Node.js route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    const errorResponse = handleError(error, {
      method: req?.method,
      path: req?.path,
      url: req?.originalUrl,
    });
    const statusCode = errorResponse.statusCode || 500;
    if (res && typeof res.status === 'function') {
      res.status(statusCode).json(errorResponse);
    } else {
      next(errorResponse);
    }
  });
};

/**
 * Express error middleware
 */
const errorMiddleware = (err, req, res, next) => {
  const errorResponse = handleError(err, {
    method: req?.method,
    path: req?.path,
    url: req?.originalUrl,
    ip: req?.ip,
  });
  const statusCode = errorResponse.statusCode || 500;
  res.status(statusCode).json(errorResponse);
};

/**
 * Validation helper
 */
const validate = (data, rules) => {
  const errors = [];

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];

    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }

    if (value === undefined || value === null || value === '') {
      continue;
    }

    if (rule.type) {
      if (typeof value !== rule.type) {
        errors.push(`${field} must be of type ${rule.type}`);
      }
    }

    if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
      errors.push(`${field} must be at least ${rule.minLength} characters long`);
    }

    if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
      errors.push(`${field} must be no more than ${rule.maxLength} characters long`);
    }

    if (rule.pattern && !rule.pattern.test(value)) {
      errors.push(`${field} format is invalid`);
    }

    if (rule.custom) {
      const customError = rule.custom(value);
      if (customError) {
        errors.push(customError);
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Validation failed', { errors });
  }
};

/**
 * Safe JSON parse wrapper
 */
const safeJsonParse = (jsonString, defaultValue = null) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    Logger.warn('JSON parse error', { error: error.message, jsonString });
    return defaultValue;
  }
};

// Export all error classes and utilities
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Error classes
    ApplicationError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ServerError,
    // Logger
    Logger,
    // Error handling
    handleError,
    asyncHandler,
    errorMiddleware,
    // Utilities
    validate,
    safeJsonParse,
  };
}

// Export for ES modules
if (typeof export !== 'undefined') {
  export {
    ApplicationError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ServerError,
    Logger,
    handleError,
    asyncHandler,
    errorMiddleware,
    validate,
    safeJsonParse,
  };
}
