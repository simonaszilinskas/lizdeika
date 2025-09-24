/**
 * VILNIUS ASSISTANT BACKEND SERVER - MAIN ENTRY POINT
 * 
 * Main Purpose: HTTP and WebSocket server for the Vilnius chat widget system
 * 
 * Key Responsibilities:
 * - Server Initialization: Start Express HTTP server and Socket.io WebSocket server
 * - Configuration Management: Load and validate environment variables and AI provider settings
 * - Knowledge Base Setup: Initialize RAG (Retrieval-Augmented Generation) system with sample data
 * - Health Monitoring: Provide system health checks and configuration reporting
 * - Graceful Shutdown: Handle SIGTERM/SIGINT signals for clean server termination
 * 
 * Dependencies:
 * - Express.js application factory (./src/app.js)
 * - Knowledge service for RAG initialization
 * - Environment variables for configuration
 * - Socket.io for real-time WebSocket communication
 * 
 * Features:
 * - Multi-provider AI support (Flowise, OpenRouter)
 * - RAG knowledge base with ChromaDB and Mistral embeddings
 * - Real-time messaging via WebSockets with fallback polling
 * - Comprehensive error handling and process management
 * - Development and production environment support
 * 
 * Environment Variables:
 * - WIDGET_BACKEND_PORT/PORT: Server port (default: 3002)
 * - AI_PROVIDER: AI service provider (flowise/openrouter)
 * - NODE_ENV: Environment mode (development/production)
 * - OPENROUTER_API_KEY, OPENROUTER_MODEL: OpenRouter configuration
 * - FLOWISE_URL, FLOWISE_CHATFLOW_ID: Flowise configuration
 * 
 * Notes:
 * - Initializes knowledge base after server startup
 * - Provides detailed configuration logging for debugging
 * - Handles unhandled promise rejections and uncaught exceptions
 * - Supports graceful shutdown with proper resource cleanup
 */
const createApp = require('./src/app');
const knowledgeService = require('./src/services/knowledgeService');
const databaseClient = require('./src/utils/database');
const SettingsService = require('./src/services/settingsService');

const PORT = process.env.WIDGET_BACKEND_PORT || process.env.PORT || 3002;

// Create and configure the application
const { app, server, io, websocketService } = createApp();

// Initialize database connection with Railway support
async function initializeDatabase() {
    try {
        console.log('🔌 Connecting to PostgreSQL database...');

        // Log database URL info for debugging (without exposing credentials)
        if (process.env.DATABASE_URL) {
            const dbUrl = new URL(process.env.DATABASE_URL);
            console.log(`📍 Database host: ${dbUrl.hostname}:${dbUrl.port}`);
            console.log(`📊 Database name: ${dbUrl.pathname.substring(1)}`);
        } else {
            console.log('⚠️  DATABASE_URL not found, using individual DB settings');
        }

        await databaseClient.connect();
        console.log('✅ Database connection established');

        // Run database migrations in production (Railway)
        if (process.env.NODE_ENV === 'production') {
            console.log('🔄 Running database migrations...');
            const { execSync } = require('child_process');
            try {
                execSync('npx prisma db push --accept-data-loss', {
                    stdio: 'pipe',
                    cwd: __dirname
                });
                console.log('✅ Database migrations completed');
            } catch (migrationError) {
                console.warn('⚠️  Migration warning:', migrationError.message);
                // Don't fail if migrations have warnings, but continue
            }
        }

    } catch (error) {
        console.error('❌ Database connection failed:', error.message);

        if (process.env.NODE_ENV === 'production') {
            console.error('💥 Production database failure - cannot continue');
            console.error('🔍 Check Railway PostgreSQL service and DATABASE_URL');
            throw error; // Will be caught by startServer() and exit
        } else {
            console.log('💡 Development mode: Make sure PostgreSQL is running');
            console.log('   docker-compose up postgres -d');
            throw error; // Let development know about the issue
        }
    }
}

// Initialize knowledge base connection (no automatic sample data loading)
async function initializeKnowledgeBase() {
    try {
        console.log('Initializing RAG knowledge base connection...');
        const initialized = await knowledgeService.initializeSampleData();
        if (initialized) {
            const stats = await knowledgeService.getStats();
            console.log('✅ Knowledge base connection ready:', stats);
        } else {
            console.log('⚠️  Knowledge base connection failed - RAG disabled');
        }
    } catch (error) {
        console.log('⚠️  Knowledge base error - RAG disabled:', error.message);
    }
}

// Display configuration after SettingsService initialization
async function displayConfiguration() {
    try {
        const settingsService = new SettingsService();
        // Wait for settings service to initialize
        await new Promise((resolve) => {
            settingsService.once('initialized', resolve);
            setTimeout(resolve, 1000); // fallback timeout
        });

        const aiConfig = await settingsService.getAIProviderConfig();
        console.log('Configuration:');
        console.log(`- AI Provider: ${aiConfig.AI_PROVIDER || 'flowise'}`);
        console.log(`- Environment: ${process.env.NODE_ENV || 'development'}`);

        if (aiConfig.AI_PROVIDER === 'openrouter') {
            console.log(`- OpenRouter Model: ${aiConfig.OPENROUTER_MODEL || 'not set'}`);
            console.log(`- API Key: ${aiConfig.OPENROUTER_API_KEY ? 'SET' : 'NOT SET'}`);
        } else if (aiConfig.AI_PROVIDER === 'flowise') {
            console.log(`- Flowise URL: ${aiConfig.FLOWISE_URL || 'not set'}`);
            console.log(`- Chatflow ID: ${aiConfig.FLOWISE_CHATFLOW_ID || 'not set'}`);
        }
    } catch (error) {
        console.log('Configuration (fallback to env vars):');
        console.log(`- AI Provider: ${process.env.AI_PROVIDER || 'flowise'}`);
        console.log(`- Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log('- Warning: Could not load configuration from database:', error.message);
    }
}

// Initialize all services before starting server
async function startServer() {
    try {
        console.log('🚀 Starting Vilnius Assistant Backend...');
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🚪 Port: ${PORT}`);
        console.log(`🌐 Host: ${process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'}`);

        // Initialize database connection first
        await initializeDatabase();

        // Initialize knowledge base
        await initializeKnowledgeBase();

        // Display configuration
        await displayConfiguration();

        // Start server only after all dependencies are ready
        // Bind to 0.0.0.0 for Railway/Docker, localhost for development
        const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
        server.listen(PORT, host, () => {
            console.log(`✅ Widget backend running on http://${host}:${PORT}`);
            console.log('WebSocket server initialized');

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

            console.log('\\n🎉 Server ready to accept requests');
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Start the server with proper initialization sequence
startServer();

// Graceful shutdown
function gracefulShutdown(signal) {
    console.log(`${signal} received, shutting down gracefully`);
    
    // Close the HTTP server
    server.close(() => {
        console.log('HTTP server closed');
        
        // Close database connection
        databaseClient.disconnect().then(() => {
            console.log('Database connection closed');
            
            // Close all WebSocket connections
            io.close(() => {
                console.log('WebSocket server closed');
                process.exit(0);
            });
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