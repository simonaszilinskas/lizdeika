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

# Testing
npm test                        # Run all backend tests
npm run test:unit               # Run unit tests only (with mocks)
npm run test:integration        # Run integration tests (real database)
npm run test:integration:watch  # Integration tests in watch mode
npm run test:coverage           # Run tests with coverage report
npm run db:test:setup           # Setup test database schema
```

### Frontend Testing (from root)
```bash
# Test commands from project root
npm test               # Run all frontend tests
npm run test:unit      # Run unit tests for frontend modules
npm run test:coverage  # Generate coverage report
npm run test:watch     # Watch mode for test development
```

### Docker Development
```bash
# Primary development workflow
docker-compose up --build          # Start all services (runs migrations automatically)
docker-compose exec backend npm run db:seed    # Seed database
docker-compose logs -f backend     # View backend logs
docker-compose exec postgres psql -U postgres -d vilnius_support  # Database CLI

# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

**Important**: Database migrations run automatically in the Docker entrypoint. The `message_statistics` table and all other schema changes are created via Prisma migrations stored in `custom-widget/backend/prisma/migrations/`. This ensures consistent database state across all deployments.

## Architecture Overview

### Core System Components
This is an AI-powered customer support platform with three main layers:

1. **Frontend Layer** (Vanilla JS + ES6 Modules):
   - `custom-widget/js/agent-dashboard/` - Modularized agent dashboard (11 modules)
   - `custom-widget/js/settings/` - Settings management (10 feature modules + 3 core services)
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
- `WidgetConfigModule.js` - Widget configuration and integration code
- `BrandingConfigModule.js` - Widget branding and appearance settings
- `ContextEngineeringModule.js` - RAG and AI prompt configuration
- `KnowledgeManagementModule.js` - Document upload and knowledge base management
- `CategoryManagementModule.js` - Ticket categorization settings
- `TemplateManagementModule.js` - Response templates management
- `SecurityPolicyModule.js` - Security policy configuration
- `StatisticsModule.js` - Analytics and statistics dashboards

**Coordinator**: `SettingsManager.js` - Dependency injection and module coordination

**Note**: All settings features are consolidated in `settings.html` - there are no separate standalone settings pages.

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
Key models: `users`, `tickets`, `messages`, `agent_status`, `system_modes`, `knowledge_documents`, `message_statistics`
- JWT authentication with refresh tokens
- Role-based access (admin/agent/customer)
- Automatic conversation assignment to agents
- Message-level statistics tracking for analytics
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
- ✅ Comprehensive testing framework (11 backend + 9 frontend unit tests)
- ✅ Docker development and production setup
- ✅ AI dual-provider system with automatic failover
- ✅ Document RAG with vector search capabilities
- ✅ Real-time WebSocket communication
- ✅ Role-based authentication and user management
- ✅ Ticket categorization system (admin-only management, real-time updates)
- ✅ **Statistics backend API (Issue #27)** - Conversation metrics, agent performance, AI suggestion usage
- ✅ **AI Suggestion Security (Issue #63)** - Authentication middleware added to AI suggestion endpoints
- ✅ **Two-Factor Authentication (2FA/TOTP)** - Time-based one-time passwords with QR code setup, manual entry key, and backup codes

### Important Implementation Details

**User Management Loading Fix**: The UserManagementModule requires admin authentication. If users show "Loading..." but don't load, ensure:
1. User is logged in as admin (`admin@vilnius.lt` / `admin123`)
2. Navigate to settings page: `http://localhost:3002/settings.html`
3. Recent fix (latest commit) added missing `await this.userManagementModule.loadUsers()` call

**ES6 Module System**: Both settings and agent dashboard use modern ES6 modules with dependency injection pattern. When adding new features:
- Use constructor dependency injection for core services
- Follow single responsibility principle for modules
- Maintain event-driven communication via StateManager

**Testing**: Comprehensive testing infrastructure with **two test types**:

1. **Unit Tests** (220 tests with mocks):
   - `tests/unit/` - Unit test files covering all major modules
   - `tests/baseline/` - Error handling baseline tests
   - `tests/mocks/` - Mock services for isolated testing
   - `tests/utilities/` - ES6 module testing utilities
   - Run with: `npm run test:unit`

2. **Integration Tests** (57 tests - Real database operations):
   - `tests/integration/` - API integration tests for auth, statistics, and conversation management
   - Tests perform real user actions (no mocks)
   - Use separate test database (vilnius_support_test)
   - Coverage: Authentication, RBAC, Conversations, AI Suggestions, Dashboard, Agent Statistics
   - Run with: `npm run test:integration`

**Test Database Setup**: Integration tests require a separate PostgreSQL test database:
```bash
# Create test database (one-time setup)
createdb vilnius_support_test

# Push schema to test database
npm run db:test:setup

# Run integration tests
npm run test:integration
```

**Current Status**: 220/221 unit tests passing (134 backend + 86 frontend). 57/57 integration tests passing - verifying end-to-end flows with real database operations.

**Known Test Issue**: One auth test occasionally fails in CI due to timing issues with token expiration checks. This is a test environment issue documented in `custom-widget/backend/tests/unit/auth.test.js`. The authentication flow works correctly in production.

**AI Suggestion Endpoints**: Secured with authentication middleware (Issue #63):
- `/api/conversations/:id/pending-suggestion` (GET) - Retrieve cached AI suggestion (agent/admin only)
- `/api/conversations/:id/generate-suggestion` (POST) - Generate new AI suggestion (agent/admin only)
- Note: Full AI integration testing is impractical due to external service dependencies (OpenRouter, ChromaDB, Mistral). See `tests/integration/AI_SUGGESTION_TESTS_DECISION.md` for rationale.

**2FA/TOTP Implementation**: Two-factor authentication with time-based one-time passwords:
- **Frontend**: `custom-widget/setup-2fa.html` - QR code generation and manual entry key display
  - QR code displayed as image from backend
  - Manual entry key shown for users who can't scan QR codes (field: `data.data.manualEntryKey`)
  - Backup codes provided for account recovery
- **Backend**: `custom-widget/backend/src/controllers/userController.js` - 2FA endpoints
  - `POST /api/users/:id/2fa/setup` - Initiate 2FA setup (returns QR code and manual key)
  - `POST /api/users/:id/2fa/confirm` - Confirm TOTP secret with verification code
  - `GET /api/users/:id/2fa/status` - Check if 2FA is enabled
- **Environment**: Requires `TOTP_ENCRYPTION_KEY` env var (minimum 32 characters)
  - Development: Set in `docker-compose.yml`
  - Production: Set in `.env` file (see `.env.example`)
- **Database**: TOTP columns in `users` table:
  - `totp_enabled` (boolean) - Whether 2FA is active
  - `totp_secret` (encrypted) - TOTP secret for generating codes
  - `totp_confirmed_at` (timestamp) - When 2FA was confirmed
  - `backup_codes` (JSON) - Recovery codes for account access
  - `totp_failed_attempts` (integer) - Failed verification attempts (rate limiting)
  - `totp_lock_until` (timestamp) - Account lock time after failed attempts

**Statistics API**: Backend complete with 5 REST endpoints for analytics:
- `/api/statistics/dashboard` - Combined overview of key metrics
- `/api/statistics/conversations` - Detailed conversation statistics
- `/api/statistics/agents` - Agent performance and rankings
- `/api/statistics/ai-suggestions` - AI suggestion usage (HITL-only)
- `/api/statistics/trends` - Time-series data for charts

See `STATISTICS_BACKEND_COMPLETE.md` for API documentation and examples.

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

## Troubleshooting

### Statistics API 400 Error
**Problem**: Statistics dashboard shows HTTP 400 errors, backend logs show "table `public.message_statistics` does not exist"

**Solution**: This was caused by the schema definition existing in `schema.prisma` but the migration not being committed. Fixed with commit `be9505c`. Ensure you:
1. Pull the latest commits (includes the migration)
2. Run `docker-compose down -v` to reset the volume
3. Run `docker-compose up --build` to rebuild with fresh database
4. Migrations will run automatically in the Docker entrypoint

**Prevention**: Always create migrations for schema changes using `prisma migrate dev --name <description>` and commit them to git. Never use `db:push` in development - it bypasses the migration system.

### Database Migration Failures
**Problem**: Docker container restarts in a loop with "migrate found failed migrations"

**Solution**:
1. Stop all containers: `docker-compose down`
2. Remove volumes: `docker volume prune`
3. Rebuild: `docker-compose up --build`

This forces a clean database state and re-applies all migrations in order.