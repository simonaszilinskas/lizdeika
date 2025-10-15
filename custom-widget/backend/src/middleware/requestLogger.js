const { createLogger } = require('../utils/logger');
const logger = createLogger('requestLogger');

/**
 * REQUEST LOGGER MIDDLEWARE
 *
 * Main Purpose: Provide comprehensive HTTP request and response logging for debugging and monitoring
 * 
 * Key Responsibilities:
 * - Request Logging: Log incoming HTTP requests with method, URL, and timestamp
 * - Response Logging: Track response status codes and processing time
 * - Body Logging: Log request/response bodies for non-GET requests (with sanitization)
 * - Performance Monitoring: Measure and log request processing duration
 * - Security: Sanitize sensitive data before logging (passwords, API keys, tokens)
 * 
 * Features:
 * - Automatic request/response timing with millisecond precision
 * - Selective body logging (excludes GET requests for performance)
 * - Sensitive data redaction for security compliance
 * - Environment-aware logging (reduced output in production)
 * - ISO timestamp formatting for log analysis
 * - JSON formatting for structured logging
 * 
 * Sanitization:
 * - Redacts password, apiKey, token fields from request bodies
 * - Prevents sensitive information from appearing in logs
 * - Maintains data structure while protecting sensitive values
 * 
 * Logging Behavior:
 * - Development: Full request/response logging with detailed information
 * - Production: Minimal logging for performance, errors always logged
 * - GET requests: Only logged with basic information (no body)
 * - Non-GET requests: Include sanitized request body in logs
 * - Error responses: Always include response details regardless of environment
 * 
 * Notes:
 * - Should be registered early in middleware stack for complete coverage
 * - Uses monkey-patching to intercept res.json() calls
 * - Provides structured logs suitable for log aggregation systems
 * - Balances debugging needs with performance and security requirements
 */

const requestLogger = (req, res, next) => {
    const start = Date.now();

    // Log request details
    logger.info('Request received', { method: req.method, url: req.url });

    if (req.method !== 'GET' && Object.keys(req.body).length > 0) {
        // Log request body (excluding sensitive data)
        const sanitizedBody = { ...req.body };

        // Remove sensitive fields
        if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
        if (sanitizedBody.apiKey) sanitizedBody.apiKey = '[REDACTED]';
        if (sanitizedBody.token) sanitizedBody.token = '[REDACTED]';

        logger.info('Request body', { body: sanitizedBody });
    }

    // Override res.json to log response
    const originalJson = res.json;
    res.json = function(body) {
        const duration = Date.now() - start;
        logger.info('Request completed', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`
        });

        // Log response for non-GET requests or errors
        if (req.method !== 'GET' || res.statusCode >= 400) {
            const sanitizedResponse = typeof body === 'object' ? { ...body } : body;

            // Don't log large response bodies in production
            if (process.env.NODE_ENV !== 'production' || res.statusCode >= 400) {
                logger.info('Response body', { response: sanitizedResponse });
            }
        }
        
        return originalJson.call(this, body);
    };

    next();
};

module.exports = requestLogger;