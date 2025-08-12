/**
 * Main Application Setup
 * Configures Express app with middleware and routes
 */
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

// Import route creators
const createConversationRoutes = require('./routes/conversationRoutes');
const createAgentRoutes = require('./routes/agentRoutes');
const createSystemRoutes = require('./routes/systemRoutes');

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

    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.static('../')); // Serve widget files
    
    // Request logging in development
    if (process.env.NODE_ENV !== 'production') {
        app.use(requestLogger);
    }

    // Initialize WebSocket service
    const websocketService = new WebSocketService(io);

    // Routes
    app.use('/api', createConversationRoutes(io));
    app.use('/api', createAgentRoutes(io));
    app.use('/', createSystemRoutes()); // Health check at root level
    app.use('/api', createSystemRoutes()); // Config routes under /api

    // Error handling middleware (must be last)
    app.use(errorHandler);

    return { app, server, io, websocketService };
}

module.exports = createApp;