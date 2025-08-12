/**
 * Request Logger Middleware
 * Logs incoming requests for debugging and monitoring
 */

const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    // Log request details
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    if (req.method !== 'GET' && Object.keys(req.body).length > 0) {
        // Log request body (excluding sensitive data)
        const sanitizedBody = { ...req.body };
        
        // Remove sensitive fields
        if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
        if (sanitizedBody.apiKey) sanitizedBody.apiKey = '[REDACTED]';
        if (sanitizedBody.token) sanitizedBody.token = '[REDACTED]';
        
        console.log(`Request body:`, JSON.stringify(sanitizedBody, null, 2));
    }

    // Override res.json to log response
    const originalJson = res.json;
    res.json = function(body) {
        const duration = Date.now() - start;
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
        
        // Log response for non-GET requests or errors
        if (req.method !== 'GET' || res.statusCode >= 400) {
            const sanitizedResponse = typeof body === 'object' ? { ...body } : body;
            
            // Don't log large response bodies in production
            if (process.env.NODE_ENV !== 'production' || res.statusCode >= 400) {
                console.log(`Response:`, JSON.stringify(sanitizedResponse, null, 2));
            }
        }
        
        return originalJson.call(this, body);
    };

    next();
};

module.exports = requestLogger;