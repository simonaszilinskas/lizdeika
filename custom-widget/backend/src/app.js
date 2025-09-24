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
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Import middleware
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
const activityRoutes = require('./routes/activityRoutes');
const logsRoutes = require('./routes/logsRoutes');
const createDocsRoutes = require('./routes/docsRoutes');

// Import services
const WebSocketService = require('./services/websocketService');
require('dotenv').config();

function createApp() {
    const app = express();
    const server = createServer(app);
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Create logger for app initialization
    const logger = createLogger('app');

    // Middleware - IMPORTANT: Order matters!
    app.use(cors());
    
    // Correlation ID middleware must be first to track all requests
    app.use(correlationMiddleware);
    
    app.use(express.json());

    // Static file serving - Railway vs local development paths
    const path = require('path');
    const fs = require('fs');

    const staticPath = process.env.NODE_ENV === 'production'
        ? path.join(__dirname, '../../') // Railway: HTML files in /app/custom-widget/
        : path.join(__dirname, '../../'); // Local: project root, custom-widget/ directory

    // Debug: List available files in the static directory
    console.log(`🔍 NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`📁 Serving static files from: ${staticPath}`);
    try {
        const files = fs.readdirSync(staticPath);
        console.log(`📋 Available files in static directory: ${files.join(', ')}`);

        // Also check for HTML files specifically
        const htmlFiles = files.filter(f => f.endsWith('.html'));
        console.log(`🌐 HTML files found: ${htmlFiles.join(', ')}`);
    } catch (error) {
        console.error(`❌ Cannot read static directory ${staticPath}:`, error.message);

        // Try alternative paths
        const altPaths = [
            path.join(__dirname, '../../'),
            path.join(__dirname, '../../../'),
            path.join(__dirname, './'),
            '/app'
        ];

        for (const altPath of altPaths) {
            try {
                const files = fs.readdirSync(altPath);
                console.log(`🔍 Alternative path ${altPath}: ${files.slice(0, 10).join(', ')}`);
            } catch (e) {
                console.log(`❌ Alternative path ${altPath}: not accessible`);
            }
        }
    }

    app.use(express.static(staticPath));
    
    // Request logging in development
    if (process.env.NODE_ENV !== 'production') {
        app.use(requestLogger);
    }

    // Add correlation middleware to Socket.IO
    io.use(socketCorrelationMiddleware);

    // Initialize WebSocket service
    const websocketService = new WebSocketService(io);

    // Routes
    app.use('/api/auth', authRoutes); // Authentication routes
    app.use('/api/users', userRoutes); // User management routes (admin only)
    app.use('/api/activities', activityRoutes); // Activity logging routes
    app.use('/api/logs', logsRoutes); // Centralized logging routes (admin only)
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
