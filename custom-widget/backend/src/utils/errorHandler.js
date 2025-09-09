/**
 * Standardized Error Handling Utilities
 * Provides consistent error responses and logging across all controllers
 */

const { ValidationError } = require('./validation');

/**
 * Standard error response structure
 */
function createErrorResponse(error, defaultMessage = 'Internal server error') {
    if (error instanceof ValidationError) {
        return {
            status: 400,
            body: { error: error.message, field: error.field }
        };
    }
    
    // Handle specific error types
    if (error.name === 'UnauthorizedError') {
        return {
            status: 401,
            body: { error: 'Unauthorized access' }
        };
    }
    
    if (error.name === 'ForbiddenError') {
        return {
            status: 403,
            body: { error: 'Forbidden' }
        };
    }
    
    if (error.name === 'NotFoundError') {
        return {
            status: 404,
            body: { error: 'Resource not found' }
        };
    }
    
    // Default to 500 for unhandled errors
    return {
        status: 500,
        body: { error: defaultMessage }
    };
}

/**
 * Express error handler middleware
 */
function handleControllerError(error, defaultMessage, req, res) {
    const errorResponse = createErrorResponse(error, defaultMessage);
    
    // Log server errors (5xx) only
    if (errorResponse.status >= 500) {
        console.error(`${defaultMessage}:`, error);
    }
    
    return res.status(errorResponse.status).json(errorResponse.body);
}

/**
 * Async route wrapper to handle errors automatically
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Create a standardized controller method wrapper
 */
function wrapController(controllerMethod, errorMessage) {
    return async (req, res) => {
        try {
            await controllerMethod(req, res);
        } catch (error) {
            handleControllerError(error, errorMessage, req, res);
        }
    };
}

module.exports = {
    createErrorResponse,
    handleControllerError,
    asyncHandler,
    wrapController
};