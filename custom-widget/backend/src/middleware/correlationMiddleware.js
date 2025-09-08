/**
 * CORRELATION ID MIDDLEWARE
 * 
 * Main Purpose: Generate and track correlation IDs across all HTTP requests and async operations
 * 
 * Key Responsibilities:
 * - Generate unique correlation IDs for each request
 * - Accept existing correlation IDs from clients (for frontend-backend correlation)
 * - Inject correlation IDs into async context for automatic logging
 * - Add correlation IDs to response headers for client tracking
 * - Support WebSocket correlation ID propagation
 * 
 * Features:
 * - UUID v4 correlation ID generation
 * - Client-provided correlation ID support
 * - Async context propagation using cls-hooked
 * - Response header injection for client tracking
 * - WebSocket handshake correlation support
 * 
 * Headers:
 * - Accepts: X-Correlation-ID (from client)
 * - Returns: X-Correlation-ID (to client)
 * 
 * Notes:
 * - Must be registered early in middleware stack
 * - Works with the logger factory for automatic log correlation
 * - Supports both HTTP requests and WebSocket connections
 */

const { v4: uuidv4 } = require('uuid');
const { getNamespace, setCorrelationId } = require('../utils/logger');

/**
 * Middleware to handle correlation IDs for HTTP requests
 */
const correlationMiddleware = (req, res, next) => {
    const namespace = getNamespace();
    
    // Generate or use existing correlation ID
    const correlationId = req.headers['x-correlation-id'] || 
                         req.headers['X-Correlation-ID'] || 
                         `req_${uuidv4()}`;
    
    // Run the request in the correlation context
    namespace.run(() => {
        setCorrelationId(correlationId);
        
        // Add correlation ID to request object for easy access
        req.correlationId = correlationId;
        
        // Add correlation ID to response headers
        res.setHeader('X-Correlation-ID', correlationId);
        
        // Continue to next middleware
        next();
    });
};

/**
 * Enhanced correlation middleware that also logs request/response
 */
const correlationWithLogging = (logger) => {
    return (req, res, next) => {
        const namespace = getNamespace();
        const startTime = Date.now();
        
        // Generate or use existing correlation ID
        const correlationId = req.headers['x-correlation-id'] || 
                             req.headers['X-Correlation-ID'] || 
                             `req_${uuidv4()}`;
        
        // Run the request in the correlation context
        namespace.run(() => {
            setCorrelationId(correlationId);
            
            // Add correlation ID to request object
            req.correlationId = correlationId;
            
            // Add correlation ID to response headers
            res.setHeader('X-Correlation-ID', correlationId);
            
            // Log request start
            logger.info('HTTP Request Started', {
                method: req.method,
                url: req.url,
                userAgent: req.get('User-Agent'),
                ip: req.ip || req.connection.remoteAddress,
                correlationId
            });
            
            // Override res.end to log response
            const originalEnd = res.end;
            res.end = function(chunk, encoding) {
                const duration = Date.now() - startTime;
                
                // Log response
                logger.info('HTTP Request Completed', {
                    method: req.method,
                    url: req.url,
                    statusCode: res.statusCode,
                    duration: `${duration}ms`,
                    correlationId
                });
                
                // Call original end method
                originalEnd.call(this, chunk, encoding);
            };
            
            next();
        });
    };
};

/**
 * Socket.IO middleware for correlation ID support
 */
const socketCorrelationMiddleware = (socket, next) => {
    const namespace = getNamespace();
    
    // Get correlation ID from handshake headers or generate new one
    const correlationId = socket.handshake.headers['x-correlation-id'] || 
                         `socket_${uuidv4()}`;
    
    // Store correlation ID on socket for future use
    socket.correlationId = correlationId;
    
    // Run socket events in correlation context
    const originalOn = socket.on;
    socket.on = function(event, handler) {
        const wrappedHandler = (...args) => {
            namespace.run(() => {
                setCorrelationId(correlationId);
                return handler(...args);
            });
        };
        return originalOn.call(this, event, wrappedHandler);
    };
    
    next();
};

/**
 * Utility to run any function with correlation context
 * Useful for background tasks, timers, etc.
 */
const withCorrelation = (correlationId, fn) => {
    const namespace = getNamespace();
    return namespace.run(() => {
        setCorrelationId(correlationId);
        return fn();
    });
};

/**
 * Get current correlation ID from any context
 */
const getCurrentCorrelationId = () => {
    const namespace = getNamespace();
    return namespace.get('correlationId');
};

module.exports = {
    correlationMiddleware,
    correlationWithLogging,
    socketCorrelationMiddleware,
    withCorrelation,
    getCurrentCorrelationId
};