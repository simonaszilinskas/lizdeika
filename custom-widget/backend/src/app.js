/**
 * EXPRESS APPLICATION FACTORY
 * 
 * Main Purpose: Create and configure the Express.js application with all middleware, routes, and services
 * 
 * Key Responsibilities:
 * - Application Configuration: Set up Express app with necessary middleware and settings
 * - Route Management: Register all API routes for conversations, agents, knowledge, and system endpoints
 * - WebSocket Integration: Initialize Socket.io server for real-time communication
 * - Middleware Stack: Configure CORS, JSON parsing, static file serving, and error handling
 * - Service Initialization: Set up WebSocket service for real-time messaging
 * 
 * Dependencies:
 * - Express.js for HTTP server framework
 * - Socket.io for WebSocket server functionality
 * - Route modules for API endpoint definitions
 * - Middleware modules for request processing
 * - WebSocket service for real-time communication management
 * 
 * Features:
 * - CORS-enabled API for cross-origin widget embedding
 * - Static file serving for widget assets (HTML, CSS, JS)
 * - Environment-based request logging (development only)
 * - Centralized error handling middleware
 * - Modular route organization with dependency injection
 * 
 * Route Structure:
 * - /api/* - Conversation and agent management endpoints
 * - /api/knowledge/* - Document upload and RAG management
 * - /health, /api/config/* - System health and configuration endpoints
 * - /* - Static widget files served from parent directory
 * 
 * Notes:
 * - Returns app, server, io, and websocketService instances for external use
 * - WebSocket service is initialized and passed to route handlers
 * - Error handling middleware must be registered last in the stack
 * - Static file serving includes the entire widget frontend
 */
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Import middleware
const createCorsMiddleware = require('./middleware/corsMiddleware');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const { correlationMiddleware, socketCorrelationMiddleware } = require('./middleware/correlationMiddleware');
const { createLogger } = require('./utils/logger');

// Import route creators
const createConversationRoutes = require('./routes/conversationRoutes');
const createAgentRoutes = require('./routes/agentRoutes');
const createSystemRoutes = require('./routes/systemRoutes');
const createKnowledgeRoutes = require('./routes/knowledgeRoutes');
const createWidgetRoutes = require('./routes/widgetRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const activityRoutes = require('./routes/activityRoutes');
const logsRoutes = require('./routes/logsRoutes');
const createDocsRoutes = require('./routes/docsRoutes');
const { router: uploadRoutes } = require('./routes/uploadRoutes');
const templateRoutes = require('./routes/templateRoutes');
const statisticsRoutes = require('./routes/statisticsRoutes');

// Import services
const WebSocketService = require('./services/websocketService');
require('dotenv').config();

function createApp() {
    const app = express();
    const server = createServer(app);

    // Socket.IO uses admin CORS settings (agents/admins only)
    const adminAllowedOrigins = process.env.ADMIN_ALLOWED_ORIGINS || 'same-origin';
    const socketOrigin = adminAllowedOrigins === 'same-origin'
        ? false
        : (adminAllowedOrigins.trim() === '*' ? true : adminAllowedOrigins.split(',').map(o => o.trim()));

    const io = new Server(server, {
        cors: {
            origin: socketOrigin,
            methods: ["GET", "POST"]
        }
    });

    // Create logger for app initialization
    const logger = createLogger('app');

    // Trust proxy to get correct client IPs behind load balancers/reverse proxies
    app.set('trust proxy', true);

    // Middleware - IMPORTANT: Order matters!
    // CORS middleware differentiates between admin and widget routes
    app.use(createCorsMiddleware());

    // Correlation ID middleware must be first to track all requests
    app.use(correlationMiddleware);

    app.use(express.json());

    // Static file serving - Railway vs local development paths
    const path = require('path');
    const fs = require('fs');
    const fsPromises = fs.promises;

    const staticPath = process.env.NODE_ENV === 'production'
        ? path.join(__dirname, '../../') // Railway: HTML files in /app/custom-widget/
        : path.join(__dirname, '../../'); // Local: project root, custom-widget/ directory

    const shouldLogStaticDebug = process.env.DEBUG_STATIC_PATH === 'true';

    if (shouldLogStaticDebug) {
        logger.info('Serving static files', { staticPath });
        fsPromises.readdir(staticPath)
            .then((files) => {
                logger.debug('Available files in static directory', { files: files.join(', ') });
                const htmlFiles = files.filter((file) => file.endsWith('.html'));
                logger.debug('HTML files found', { htmlFiles: htmlFiles.join(', ') });
            })
            .catch((error) => {
                logger.error('Cannot read static directory', { staticPath, error: error.message });
            });
    } else if (process.env.NODE_ENV !== 'production') {
        logger.info('Serving static files', { staticPath });
    }

    // Disable caching for JavaScript files in development
    if (process.env.NODE_ENV !== 'production') {
        app.use((req, res, next) => {
            if (req.url.endsWith('.js') || req.url.includes('.js?')) {
                res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
                res.set('Pragma', 'no-cache');
                res.set('Expires', '0');
            }
            next();
        });
    }

    // Request logging in development (must be before static and error handler)
    if (process.env.NODE_ENV !== 'production') {
        app.use((req, res, next) => {
            // Skip logging for static asset files (not API calls that happen to end with these extensions)
            // Only skip if the URL is a direct file request, not an API endpoint
            const isStaticAsset = req.url.startsWith('/') &&
                !req.url.startsWith('/api') &&
                /\.(html|css|js|json|jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|eot)$/.test(req.url);

            if (isStaticAsset) {
                return next();
            }
            requestLogger(req, res, next);
        });
    }

    app.use(express.static(staticPath));

    // Add correlation middleware to Socket.IO
    io.use(socketCorrelationMiddleware);

    // Initialize WebSocket service
    const websocketService = new WebSocketService(io);

    // Routes
    app.use('/api/auth', authRoutes); // Authentication routes
    app.use('/api/users', userRoutes); // User management routes (admin only)
    app.use('/api/categories', categoryRoutes); // Category management routes (agent/admin)
    app.use('/api/activities', activityRoutes); // Activity logging routes
    app.use('/api/logs', logsRoutes); // Centralized logging routes (admin only)
    app.use('/api/templates', templateRoutes); // Response template routes (admin create/edit, agents read)
    app.use('/api/statistics', statisticsRoutes); // Statistics and analytics routes (agent/admin)
    app.use('/api', uploadRoutes); // File upload routes
    app.use('/api', createConversationRoutes(io));
    app.use('/api', createAgentRoutes(io));
    app.use('/api/knowledge', createKnowledgeRoutes()); // Knowledge management routes
    app.use('/api/widget', createWidgetRoutes()); // Widget configuration routes
    app.use('/', createSystemRoutes()); // Health check at root level
    app.use('/api', createSystemRoutes()); // Config routes under /api
    app.use('/docs', createDocsRoutes()); // OpenAPI and docs

    // Error handling middleware (must be last)
    app.use(errorHandler);

    return { app, server, io, websocketService };
}

module.exports = createApp;
