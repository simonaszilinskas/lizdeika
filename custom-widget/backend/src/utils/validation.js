/**
 * Request Validation Utilities
 * Provides consistent input validation for API endpoints
 */

/**
 * Validation error class for structured error handling
 */
class ValidationError extends Error {
    constructor(message, field = null) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
    }
}

/**
 * Validate required fields in request body
 */
function validateRequired(body, requiredFields) {
    for (const field of requiredFields) {
        if (!body[field]) {
            throw new ValidationError(`Missing required field: ${field}`, field);
        }
    }
}

/**
 * Validate string field
 */
function validateString(value, fieldName, options = {}) {
    if (typeof value !== 'string') {
        throw new ValidationError(`${fieldName} must be a string`, fieldName);
    }
    
    if (options.minLength && value.length < options.minLength) {
        throw new ValidationError(`${fieldName} must be at least ${options.minLength} characters`, fieldName);
    }
    
    if (options.maxLength && value.length > options.maxLength) {
        throw new ValidationError(`${fieldName} must be no more than ${options.maxLength} characters`, fieldName);
    }
    
    if (options.pattern && !options.pattern.test(value)) {
        throw new ValidationError(`${fieldName} has invalid format`, fieldName);
    }
}

/**
 * Validate conversation ID format (UUID or session-xxx)
 */
function validateConversationId(value, fieldName) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const sessionPattern = /^session-[a-z0-9]+$/i;
    
    if (!value) {
        throw new ValidationError(`${fieldName} is required`, fieldName);
    }
    
    if (typeof value !== 'string') {
        throw new ValidationError(`${fieldName} must be a string`, fieldName);
    }
    
    if (!uuidPattern.test(value) && !sessionPattern.test(value)) {
        throw new ValidationError(`${fieldName} must be a valid UUID or session ID`, fieldName);
    }
}

/**
 * Validate UUID format
 */
function validateUUID(value, fieldName) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!value) {
        throw new ValidationError(`${fieldName} is required`, fieldName);
    }
    
    if (typeof value !== 'string') {
        throw new ValidationError(`${fieldName} must be a string`, fieldName);
    }
    
    if (!uuidPattern.test(value)) {
        throw new ValidationError(`${fieldName} must be a valid UUID`, fieldName);
    }
}

/**
 * Validate boolean field
 */
function validateBoolean(value, fieldName) {
    if (typeof value !== 'boolean') {
        throw new ValidationError(`${fieldName} must be a boolean`, fieldName);
    }
}

/**
 * Validate object field
 */
function validateObject(value, fieldName, options = {}) {
    if (value !== null && typeof value !== 'object') {
        throw new ValidationError(`${fieldName} must be an object`, fieldName);
    }
    
    if (options.allowNull === false && value === null) {
        throw new ValidationError(`${fieldName} cannot be null`, fieldName);
    }
}

/**
 * Validate conversation message
 */
function validateMessage(message) {
    validateString(message, 'message', { 
        minLength: 1, 
        maxLength: 5000 
    });
    
    // Trim excessive whitespace
    const trimmed = message.trim();
    if (trimmed.length === 0) {
        throw new ValidationError('Message cannot be empty or only whitespace', 'message');
    }
    
    return trimmed;
}

/**
 * Validation middleware factory
 */
function createValidationMiddleware(validationFn) {
    return (req, res, next) => {
        try {
            validationFn(req);
            next();
        } catch (error) {
            if (error instanceof ValidationError) {
                return res.status(400).json({ 
                    error: error.message, 
                    field: error.field 
                });
            }
            // Re-throw non-validation errors
            throw error;
        }
    };
}

module.exports = {
    ValidationError,
    validateRequired,
    validateString,
    validateUUID,
    validateConversationId,
    validateBoolean,
    validateObject,
    validateMessage,
    createValidationMiddleware
};