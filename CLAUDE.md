# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend Development
```bash
# Navigate to backend
cd custom-widget/backend

# Database operations
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema to database
npm run db:migrate     # Create and run migrations
npm run db:studio      # Open Prisma Studio GUI
npm run db:seed        # Seed database with sample data
npm run db:reset       # Reset database completely

# Server operations
npm start              # Start production server
npm run dev            # Start with nodemon for development
npm test               # Run all backend tests
npm run test:unit      # Run unit tests only
npm run test:coverage  # Run tests with coverage report
```

### Frontend Testing (from root)
```bash
# Test commands from project root
npm test               # Run all frontend tests
npm run test:unit      # Run unit tests for frontend modules
npm run test:coverage  # Generate coverage report
npm run test:watch     # Watch mode for test development
npm run test:visual    # Visual regression tests
npm run test:performance # Performance benchmarks
```

### Docker Development
```bash
# Primary development workflow
docker-compose up --build          # Start all services
docker-compose exec backend npm run db:seed    # Seed database
docker-compose logs -f backend     # View backend logs
docker-compose exec postgres psql -U postgres -d vilnius_support  # Database CLI

# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

## Architecture Overview

### Core System Components
This is an AI-powered customer support platform with three main layers:

1. **Frontend Layer** (Vanilla JS + ES6 Modules):
   - `custom-widget/js/agent-dashboard/` - Modularized agent dashboard (11 modules)
   - `custom-widget/js/settings/` - Settings management (4 feature modules + 3 core services)
   - `*.html` files served by backend at port 3002

2. **Backend Layer** (Node.js + Express):
   - `custom-widget/backend/server.js` - Main entry point
   - `custom-widget/backend/src/` - Core application logic
   - PostgreSQL database with Prisma ORM
   - Real-time WebSocket communication via Socket.IO

3. **AI Integration Layer**:
   - Dual AI providers: OpenRouter (Gemini) + Flowise with automatic failover
   - RAG system: ChromaDB Cloud + Mistral embeddings for document search
   - Document processing: .txt/.docx files with vector storage

### Settings System Architecture
The settings system uses a modernized modular ES6 architecture:

**Core Services** (`custom-widget/js/settings/core/`):
- `APIManager.js` - HTTP requests and authentication
- `StateManager.js` - Application state management with events
- `ConnectionManager.js` - WebSocket connections and real-time updates

**Feature Modules** (`custom-widget/js/settings/modules/`):
- `SystemModeModule.js` - System mode management (HITL/Autopilot/OFF)
- `UserManagementModule.js` - User CRUD operations (admin only)
- `AgentStatusModule.js` - Connected agents display and monitoring
- `WidgetConfigModule.js` - Widget configuration and integration code

**Coordinator**: `SettingsManager.js` - Dependency injection and module coordination

### Agent Dashboard Architecture
The agent dashboard uses a modular architecture with focused modules:

**Key Modules**:
- `APIManager.js` - All HTTP/API operations with consistent error handling
- `StateManager.js` - Centralized state management (conversations, filters, UI state)
- `ConversationRenderer.js` - UI templating and DOM manipulation for conversations
- `ChatManager.js` - Chat operations, messaging, and AI suggestions
- `AssignmentManager.js` - Assignment/unassignment and archiving operations
- `BulkOperations.js` - Multi-conversation operations
- `SocketManager.js` - WebSocket communication (in `core/` directory)

### Database Schema (Prisma)
Key models: `users`, `tickets`, `messages`, `agent_status`, `system_modes`, `knowledge_documents`
- JWT authentication with refresh tokens
- Role-based access (admin/agent/customer)
- Automatic conversation assignment to agents
- 6-month data retention with cleanup jobs

### Authentication Flow
- Login creates JWT + refresh token pair
- Settings page requires admin role for user management features
- Agent dashboard requires agent/admin role
- Default admin credentials: `admin@vilnius.lt` / `admin123` (from seed data)

## Current System Status

### Completed Features (Production Ready)
- ✅ Settings system with modular ES6 architecture
- ✅ Agent dashboard with focused module architecture  
- ✅ Comprehensive testing framework (9 unit test files)
- ✅ Docker development and production setup
- ✅ AI dual-provider system with automatic failover
- ✅ Document RAG with vector search capabilities
- ✅ Real-time WebSocket communication
- ✅ Role-based authentication and user management

### Important Implementation Details

**User Management Loading Fix**: The UserManagementModule requires admin authentication. If users show "Loading..." but don't load, ensure:
1. User is logged in as admin (`admin@vilnius.lt` / `admin123`)
2. Navigate to settings page: `http://localhost:3002/settings.html`
3. Recent fix (latest commit) added missing `await this.userManagementModule.loadUsers()` call

**ES6 Module System**: Both settings and agent dashboard use modern ES6 modules with dependency injection pattern. When adding new features:
- Use constructor dependency injection for core services
- Follow single responsibility principle for modules
- Maintain event-driven communication via StateManager

**Testing**: Comprehensive testing infrastructure with **190 passing tests** across 9 test suites:
- `tests/unit/` - 9 unit test files (3363 total lines) covering all major modules
- `tests/integration/` - Integration tests for module interactions
- `tests/baseline/` - Error handling baseline tests
- `tests/mocks/` - Mock services for isolated testing
- `tests/utilities/` - ES6 module testing utilities
- `tests/performance/` - Performance benchmarks
- `tests/visual/` - Visual regression tests

**Current Status**: 190/190 tests passing, but 3 test files fail due to missing modules. Coverage shows 0% because tests use mocked implementations.

### Port Configuration
- **Development**: All services on `localhost:3002` (backend serves frontend)
- **Docker**: Backend on `localhost:3002`, internal PostgreSQL on port 5434
- **Production**: Nginx reverse proxy with SSL termination

This system supports 20 concurrent agents handling 16,000+ conversations annually with full Lithuanian language support.

# Guidance for development


## Keep Code Minimal

- Always keep code SUPER minimal
- Never introduce features not explicitly mentioned

## Remove Dead Code

- Remove dead code immediately rather than maintaining it
- No backward compatibility or legacy functions

## Prioritize Functionality

- Prioritize functionality over production-ready patterns
- Focus on user experience and feature completeness

## Clean Comments
- When updating code, don't reference what is changing
- Avoid keywords like LEGACY, CHANGED, REMOVED
- Focus on comments that document just the functionality of the code

## Environment Variables
- Store secrets in a .env file (never commit it)
- A .env.example file should be provided for reference and any new secrets should be added to it
- Any secret that is no longer needed should be removed from the .env.example file
- The implementation should use the dotenv (or similar) library to load environment variables from .env files
- Variables should also be loaded from the environment

## Update Documentation

- Update any documentation when it's relevant, including CLAUDE.md

## Branch Naming Convention

- feature/description for new features
- bugfix/description for bug fixes
- hotfix/description for urgent production fixes
- chore/description for maintenance tasks
- Use kebab-case for descriptions

## Conventional Commits

- Format: type(scope): subject
- Types: feat, fix, docs, style, refactor, test, chore
- Subject line max 50 characters
- Use imperative mood ("add" not "added")
- Reference issue numbers when applicable

## Pull Request Rules

- PRs must have descriptive titles
- Include "Closes #123" to auto-close issues
- Require at least 2 approvals for main branch
- All CI checks must pass before merge
- Squash commits when merging

## Docker Best Practices

- Use multi-stage builds for smaller images
- Pin base image versions
- Run as non-root user
- One process per container
- Use .dockerignore file
- Layer caching optimization