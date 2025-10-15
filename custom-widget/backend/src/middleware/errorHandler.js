const { createLogger } = require('../utils/logger');
const logger = createLogger('errorHandler');

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
 * - Prisma/PostgreSQL errors (connection, constraint violations, validation)
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
    logger.error('Error occurred', {
        message: err.message,
        name: err.name,
        code: err.code,
        stack: err.stack
    });

    // Default error
    let error = { ...err };
    error.message = err.message;

    // Prisma Client Errors
    if (err.name === 'PrismaClientKnownRequestError') {
        switch (err.code) {
            case 'P2002':
                const message = 'Duplicate field value entered';
                error = { message, statusCode: 400 };
                break;
            case 'P2025':
                const notFoundMessage = 'Resource not found';
                error = { message: notFoundMessage, statusCode: 404 };
                break;
            case 'P2003':
                const foreignKeyMessage = 'Foreign key constraint failed';
                error = { message: foreignKeyMessage, statusCode: 400 };
                break;
            default:
                const genericMessage = 'Database operation failed';
                error = { message: genericMessage, statusCode: 400 };
        }
    }

    // Prisma Client Connection Errors
    if (err.name === 'PrismaClientUnknownRequestError') {
        const message = 'Database connection error';
        error = { message, statusCode: 500 };
    }

    // Prisma Client Validation Errors
    if (err.name === 'PrismaClientValidationError') {
        const message = 'Invalid data provided';
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