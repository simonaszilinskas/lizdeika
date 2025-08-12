/**
 * Server Entry Point
 * Starts the Vilnius Widget Backend Server
 */
const createApp = require('./src/app');

const PORT = process.env.WIDGET_BACKEND_PORT || process.env.PORT || 3002;

// Create and configure the application
const { app, server, io, websocketService } = createApp();

// Start server
server.listen(PORT, () => {
    console.log(`Widget backend running on http://localhost:${PORT}`);
    console.log('WebSocket server initialized');
    console.log('Configuration:');
    console.log(`- AI Provider: ${process.env.AI_PROVIDER || 'flowise'}`);
    console.log(`- Environment: ${process.env.NODE_ENV || 'development'}`);
    
    if (process.env.AI_PROVIDER === 'openrouter') {
        console.log(`- OpenRouter Model: ${process.env.OPENROUTER_MODEL || 'not set'}`);
        console.log(`- API Key: ${process.env.OPENROUTER_API_KEY ? 'SET' : 'NOT SET'}`);
    } else if (process.env.AI_PROVIDER === 'flowise') {
        console.log(`- Flowise URL: ${process.env.FLOWISE_URL || 'not set'}`);
        console.log(`- Chatflow ID: ${process.env.FLOWISE_CHATFLOW_ID || 'not set'}`);
    }
    
    console.log('\\nEndpoints:');
    console.log('- POST /api/conversations');
    console.log('- POST /api/messages');
    console.log('- GET /api/conversations/:id/messages');
    console.log('- GET /api/admin/conversations');
    console.log('- POST /api/reset (for testing)');
    console.log('- GET /health');
    
    console.log('\\nWebSocket Events:');
    console.log('- join-conversation');
    console.log('- join-agent-dashboard');
    console.log('- agent-typing');
    console.log('- customer-typing');
});

// Graceful shutdown
function gracefulShutdown(signal) {
    console.log(`${signal} received, shutting down gracefully`);
    
    // Close the HTTP server
    server.close(() => {
        console.log('HTTP server closed');
        
        // Close all WebSocket connections
        io.close(() => {
            console.log('WebSocket server closed');
            process.exit(0);
        });
        
        // Force exit if WebSocket doesn't close in time
        setTimeout(() => {
            console.log('Forcing shutdown...');
            process.exit(0);
        }, 5000);
    });
    
    // If server doesn't close in time, force exit
    setTimeout(() => {
        console.log('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
    server.close(() => {
        process.exit(1);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

module.exports = { app, server, io };