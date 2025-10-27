/**
 * CORS MIDDLEWARE
 *
 * Provides separate CORS configuration for admin and widget routes.
 *
 * Admin routes (stricter):
 * - /api/auth, /api/users, /api/categories, /api/activities, /api/logs
 * - /api/templates, /api/statistics, /api/widget, /api/knowledge
 * - HTML pages: settings.html, agent-dashboard.html, setup-2fa.html
 * - Only allows origins from ADMIN_ALLOWED_ORIGINS (defaults to same-origin)
 *
 * Widget routes (customer-facing):
 * - /api/conversations, /api/messages
 * - Allows origins from WIDGET_ALLOWED_DOMAINS (can be *)
 *
 * Security Benefits:
 * - Prevents admin endpoints from being accessed by arbitrary origins
 * - Allows flexible widget embedding on customer domains
 * - Clear security boundary between admin and customer features
 */

const cors = require('cors');

// Admin routes that require stricter CORS
// These routes are sensitive and should only be accessed from same origin
const adminRoutePatterns = [
    /^\/api\/auth/,
    /^\/api\/users/,
    /^\/api\/categories/,
    /^\/api\/statistics/,
    /^\/api\/templates/,
    /^\/api\/widget/,
    /^\/api\/knowledge/,
    /^\/settings\.html/,
    /^\/agent-dashboard\.html/,
    /^\/setup-2fa\.html/,
];

/**
 * Parse allowed origins from environment variable
 * @param {string} originsString - Comma-separated list or '*'
 * @returns {string|string[]} - '*' or array of origins
 */
function parseAllowedOrigins(originsString) {
    if (!originsString || originsString.trim() === '*') {
        return '*';
    }
    return originsString.split(',').map(origin => origin.trim());
}

/**
 * Check if request path matches admin route patterns
 * @param {string} path - Request path
 * @returns {boolean} - True if admin route
 */
function isAdminRoute(path) {
    return adminRoutePatterns.some(pattern => pattern.test(path));
}

/**
 * CORS middleware factory
 * Configures CORS based on route type (admin vs widget)
 */
function createCorsMiddleware() {
    const adminAllowedOrigins = parseAllowedOrigins(
        process.env.ADMIN_ALLOWED_ORIGINS || 'same-origin'
    );
    const widgetAllowedDomains = parseAllowedOrigins(
        process.env.WIDGET_ALLOWED_DOMAINS || '*'
    );

    // Admin CORS configuration (stricter)
    const adminCorsOptions = {
        origin: adminAllowedOrigins === 'same-origin'
            ? false  // Same-origin only (no CORS)
            : adminAllowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    };

    // Widget CORS configuration (permissive for embedding)
    // Note: When origin is "*", credentials must be false per CORS spec
    // For specific domain lists, credentials can be true
    const widgetCorsOptions = {
        origin: widgetAllowedDomains === '*' ? true : widgetAllowedDomains,
        credentials: widgetAllowedDomains === '*' ? false : true,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
    };

    const adminCors = cors(adminCorsOptions);
    const widgetCors = cors(widgetCorsOptions);

    return (req, res, next) => {
        if (isAdminRoute(req.path)) {
            return adminCors(req, res, next);
        } else {
            return widgetCors(req, res, next);
        }
    };
}

module.exports = createCorsMiddleware;
