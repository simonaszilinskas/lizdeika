# Vilnius Assistant - File Structure Guide

This document provides a comprehensive overview of all files in the Vilnius Assistant chat widget system and their purposes.

## 📁 Frontend Files

### HTML Interface Files
- **`embed-widget.html`** - Demonstration page showing chat widget integration
- **`agent-dashboard.html`** - Real-time agent interface for managing customer conversations and tickets
- **`login.html`** - User authentication interface for agents and admins
- **`settings.html`** - System configuration, user management, and knowledge base interface
- **`user-management.html`** - Dedicated user management interface for admins

### JavaScript Files
- **`widget.js`** - Embeddable customer chat widget with WebSocket communication
- **`js/agent-dashboard.js`** - Agent dashboard controller for real-time conversation management
- **`js/settings.js`** - Settings and user management interface controller

## 🚀 Backend Files

### Entry Points
- **`backend/server.js`** - Main server entry point with configuration management and graceful shutdown
- **`backend/src/app.js`** - Express application factory with middleware and route configuration
- **`backend/ai-providers.js`** - AI provider abstraction layer supporting multiple AI services

### Controllers
- **`backend/src/controllers/agentController.js`** - Agent management and agent-customer communication endpoints
- **`backend/src/controllers/authController.js`** - User authentication, login, logout, and JWT token management
- **`backend/src/controllers/conversationController.js`** - Customer conversations and AI integration with RAG technology
- **`backend/src/controllers/knowledgeController.js`** - Document upload, processing, and RAG knowledge base management
- **`backend/src/controllers/systemController.js`** - System administration, health monitoring, and RAG testing
- **`backend/src/controllers/userController.js`** - User management, creation, editing, and role administration
- **`backend/src/controllers/widgetController.js`** - Widget configuration and integration code generation

### Routes
- **`backend/src/routes/agentRoutes.js`** - HTTP route definitions for agent management
- **`backend/src/routes/authRoutes.js`** - Route definitions for authentication and authorization
- **`backend/src/routes/conversationRoutes.js`** - Route definitions for conversations and messaging
- **`backend/src/routes/knowledgeRoutes.js`** - Route definitions for document and knowledge base operations
- **`backend/src/routes/systemRoutes.js`** - Route definitions for system administration and configuration
- **`backend/src/routes/userRoutes.js`** - Route definitions for user management operations
- **`backend/src/routes/widgetRoutes.js`** - Route definitions for widget configuration and integration

### Core Services
- **`backend/src/services/aiService.js`** - AI provider management with RAG integration and multi-provider support
- **`backend/src/services/agentService.js`** - Agent status management and availability tracking
- **`backend/src/services/authService.js`** - Authentication, password management, and JWT token handling
- **`backend/src/services/conversationService.js`** - Conversation data persistence and message management
- **`backend/src/services/langchainRAG.js`** - Advanced RAG implementation using LangChain with query rephrasing
- **`backend/src/services/knowledgeService.js`** - Document management and semantic search interface
- **`backend/src/services/chromaService.js`** - Vector database operations with Chroma DB Cloud
- **`backend/src/services/documentService.js`** - File processing and text extraction (.txt, .docx)
- **`backend/src/services/knowledgeManagerService.js`** - High-level knowledge base management
- **`backend/src/services/mistralEmbeddingFunction.js`** - Custom Mistral AI embedding provider
- **`backend/src/services/websocketService.js`** - Real-time WebSocket communication management

### Middleware & Utilities
- **`backend/src/middleware/authMiddleware.js`** - JWT authentication and authorization middleware
- **`backend/src/middleware/errorHandler.js`** - Centralized error handling and response formatting
- **`backend/src/middleware/requestLogger.js`** - HTTP request/response logging with sanitization
- **`backend/src/utils/database.js`** - Database connection and Prisma client management
- **`backend/src/utils/passwordUtils.js`** - Password hashing and validation utilities
- **`backend/src/utils/tokenUtils.js`** - JWT token generation and validation
- **`backend/src/utils/validators.js`** - Input validation and sanitization

## 🔧 Configuration Files

- **`backend/.env.example`** - Environment variables template with all required configuration
- **`backend/package.json`** - Node.js dependencies and project metadata
- **`backend/package-lock.json`** - Locked dependency versions for reproducible builds
- **`backend/prisma/schema.prisma`** - Database schema definition with Prisma ORM
- **`backend/prisma/seed.js`** - Database seeding script for initial data

## 📚 Documentation Files

- **`ARCHITECTURE.md`** - Complete system architecture and design documentation
- **`API_GUIDE.md`** - Comprehensive API documentation for all endpoints
- **`DEVELOPER_GUIDE.md`** - Development setup, configuration, and workflow guide
- **`USER_MANAGEMENT_SYSTEM.md`** - Authentication and user management documentation
- **`FILE_GUIDE.md`** - This file - comprehensive file structure guide
- **`backend/ADMIN_RECOVERY_GUIDE.md`** - Emergency admin account recovery procedures
- **`backend/DATABASE_SETUP.md`** - Database configuration and troubleshooting
- **`backend/MIGRATION_GUIDE.md`** - Database migration and upgrade instructions
- **`backend/SHUTDOWN.md`** - Graceful server shutdown procedures
- **`backend/TESTING_GUIDE.md`** - Testing strategy, setup, and execution guide

## 🧪 Test Files

- **`backend/tests/unit/`** - Unit tests for individual components
- **`backend/tests/integration/`** - Integration tests for API endpoints

## 📦 Data Storage

- **`backend/uploads/`** - Uploaded documents and extracted text files
- **`backend/server.log`** - Application runtime logs

## 🏗️ System Architecture Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   External      │
│   Interfaces    │    │   Services      │    │   Services      │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • widget.js     │◄──►│ • server.js     │◄──►│ • Chroma DB     │
│ • agent-dash.js │    │ • aiService.js  │    │ • Mistral AI    │
│ • admin-sett.js │    │ • langchainRAG  │    │ • OpenRouter    │
│ • HTML pages    │    │ • knowledgeServ │    │ • Flowise       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔑 Key Features by File

### RAG (Retrieval-Augmented Generation) System
- **`langchainRAG.js`** - Core RAG implementation with query rephrasing
- **`chromaService.js`** - Vector database operations
- **`knowledgeService.js`** - Document search and retrieval
- **`mistralEmbeddingFunction.js`** - Text-to-vector conversion

### Multi-Provider AI Support
- **`ai-providers.js`** - Provider abstraction (OpenRouter, Flowise)
- **`aiService.js`** - Provider switching and management
- **`systemController.js`** - Configuration and health monitoring

### Real-Time Communication
- **`websocketService.js`** - WebSocket server management
- **`agent-dashboard.js`** - Real-time agent interface
- **`widget.js`** - Customer chat interface

### Document Management
- **`knowledgeController.js`** - Upload and processing endpoints
- **`documentService.js`** - File extraction and parsing
- **`knowledgeManagerService.js`** - Knowledge base operations

This structure provides a complete, scalable chat widget system with advanced AI capabilities, real-time communication, and comprehensive administrative tools.