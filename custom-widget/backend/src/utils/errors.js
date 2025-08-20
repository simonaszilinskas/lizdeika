/**
 * ERROR UTILITIES
 * Standardized error creation and handling utilities
 */

/**
 * Custom Application Error class
 */
class AppError extends Error {
    constructor(message, statusCode = 500, code = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Common error creators for consistency
 */
const createError = {
    /**
     * Not found error (404)
     */
    notFound: (resource = 'Resource') => {
        return new AppError(`${resource} not found`, 404, 'NOT_FOUND');
    },
    
    /**
     * Bad request error (400) 
     */
    badRequest: (message = 'Bad request') => {
        return new AppError(message, 400, 'BAD_REQUEST');
    },
    
    /**
     * Unauthorized error (401)
     */
    unauthorized: (message = 'Unauthorized') => {
        return new AppError(message, 401, 'UNAUTHORIZED');
    },
    
    /**
     * Forbidden error (403)
     */
    forbidden: (message = 'Forbidden') => {
        return new AppError(message, 403, 'FORBIDDEN');
    },
    
    /**
     * Internal server error (500)
     */
    internal: (message = 'Internal server error') => {
        return new AppError(message, 500, 'INTERNAL_ERROR');
    },
    
    /**
     * Database operation error
     */
    database: (operation = 'Database operation', originalError = null) => {
        const message = `${operation} failed`;
        const error = new AppError(message, 500, 'DATABASE_ERROR');
        if (originalError) {
            error.originalError = originalError;
        }
        return error;
    },
    
    /**
     * Validation error (400)
     */
    validation: (message = 'Validation failed') => {
        return new AppError(message, 400, 'VALIDATION_ERROR');
    },
    
    /**
     * Service unavailable error (503)
     */
    serviceUnavailable: (service = 'Service') => {
        return new AppError(`${service} unavailable`, 503, 'SERVICE_UNAVAILABLE');
    }
};

/**
 * Error handler wrapper for async functions
 * Automatically catches and forwards errors to Express error middleware
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Service error handler - standardized logging and error transformation
 */
const handleServiceError = (error, context = '') => {
    console.error(`Service error${context ? ` in ${context}` : ''}:`, error);
    
    // If it's already an AppError, return as-is
    if (error instanceof AppError) {
        return error;
    }
    
    // Handle Prisma errors
    if (error.name === 'PrismaClientKnownRequestError') {
        switch (error.code) {
            case 'P2002':
                return createError.badRequest('Duplicate entry - record already exists');
            case 'P2025':
                return createError.notFound('Record not found');
            case 'P2003':
                return createError.badRequest('Related record not found');
            default:
                return createError.database('Database operation', error);
        }
    }
    
    // Handle generic database connection issues
    if (error.message?.includes('database') || error.message?.includes('connection')) {
        return createError.database('Database connection', error);
    }
    
    // Default to internal server error
    return createError.internal(error.message || 'Unknown error occurred');
};

module.exports = {
    AppError,
    createError,
    asyncHandler,
    handleServiceError
};