/**
 * ERROR HANDLER MIDDLEWARE
 * 
 * Main Purpose: Centralized error handling and response formatting for the entire application
 * 
 * Key Responsibilities:
 * - Global Error Catching: Capture and handle all unhandled errors in the Express application
 * - Error Classification: Identify different types of errors and provide appropriate responses
 * - Response Formatting: Standardize error response format across all endpoints
 * - Security: Prevent sensitive error details from leaking to clients
 * - Development Support: Provide detailed error information in development environment
 * 
 * Error Types Handled:
 * - MongoDB/Mongoose errors (CastError, ValidationError, duplicate keys)
 * - JWT authentication errors (invalid token, expired token)
 * - Generic application errors with custom status codes
 * - Unhandled exceptions and promise rejections
 * 
 * Features:
 * - Environment-aware error details (stack traces only in development)
 * - Automatic HTTP status code mapping
 * - Sanitized error messages for security
 * - Comprehensive error logging for debugging
 * - Standardized JSON error response format
 * 
 * Response Format:
 * {
 *   "success": false,
 *   "error": "Human-readable error message",
 *   "stack": "Stack trace (development only)"
 * }
 * 
 * Notes:
 * - Must be registered as the last middleware in the Express app
 * - Logs full error details to console for debugging
 * - Prevents application crashes from unhandled errors
 * - Provides consistent error experience across all endpoints
 */

const errorHandler = (err, req, res, next) => {
    console.error('Error occurred:', err);

    // Default error
    let error = { ...err };
    error.message = err.message;

    // Log error for debugging
    console.error(err.stack);

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        error = { message, statusCode: 404 };
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const message = 'Duplicate field value entered';
        error = { message, statusCode: 400 };
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = { message, statusCode: 400 };
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid token';
        error = { message, statusCode: 401 };
    }

    if (err.name === 'TokenExpiredError') {
        const message = 'Token expired';
        error = { message, statusCode: 401 };
    }

    res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = errorHandler;