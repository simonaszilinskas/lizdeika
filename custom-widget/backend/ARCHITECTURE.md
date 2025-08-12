# Backend Architecture

This document describes the architecture of the Vilnius Widget Backend after the code quality improvements implemented in Priority 1 & 2.

## Directory Structure

```
backend/
├── src/
│   ├── controllers/          # Request handlers and business logic coordination
│   │   ├── conversationController.js
│   │   ├── agentController.js
│   │   └── systemController.js
│   ├── services/            # Business logic and data management
│   │   ├── conversationService.js
│   │   ├── agentService.js
│   │   ├── aiService.js
│   │   └── websocketService.js
│   ├── routes/              # API route definitions
│   │   ├── conversationRoutes.js
│   │   ├── agentRoutes.js
│   │   └── systemRoutes.js
│   ├── middleware/          # Express middleware
│   │   ├── errorHandler.js
│   │   └── requestLogger.js
│   └── app.js              # Application setup and configuration
├── tests/
│   ├── unit/               # Unit tests
│   │   └── ai-providers.test.js
│   └── integration/        # Integration tests
│       ├── api.test.js
│       └── websocket.test.js
├── ai-providers.js         # AI provider abstraction layer
├── server.js              # Server entry point
├── server-old.js          # Backup of original monolithic server
└── package.json
```

## Architecture Layers

### 1. Entry Point (`server.js`)
- Application startup and configuration
- Graceful shutdown handling
- Error handling for uncaught exceptions
- Logging startup information

### 2. Application Layer (`src/app.js`)
- Express app configuration
- Middleware setup
- Route registration
- WebSocket initialization

### 3. Routes Layer (`src/routes/`)
- API endpoint definitions
- Request routing to controllers
- Route-specific middleware

### 4. Controllers Layer (`src/controllers/`)
- Request/response handling
- Input validation
- Coordination between services
- HTTP status code management

### 5. Services Layer (`src/services/`)
- Business logic implementation
- Data management and persistence
- External service integration
- Cross-cutting concerns

### 6. Middleware Layer (`src/middleware/`)
- Request logging
- Error handling
- Authentication (future)
- Rate limiting (future)

## Key Components

### AI Service (`aiService.js`)
- Manages AI provider instances
- Handles provider switching
- Implements fallback responses
- Health monitoring

### Conversation Service (`conversationService.js`)
- Conversation lifecycle management
- Message storage and retrieval
- Agent assignment logic
- Conversation statistics

### Agent Service (`agentService.js`)
- Agent status management
- Performance tracking
- Load balancing for assignment
- Agent statistics

### WebSocket Service (`websocketService.js`)
- Real-time communication
- Room management
- Event broadcasting
- Connection handling

## Data Flow

1. **Incoming Request** → Routes → Controllers → Services → Response
2. **WebSocket Events** → WebSocket Service → Services → Event Broadcast
3. **AI Processing** → AI Service → Provider → Fallback (if needed)

## Testing Strategy

### Unit Tests
- AI provider functionality
- Service layer business logic
- Utility functions
- Isolated component testing

### Integration Tests
- API endpoint behavior
- WebSocket communication
- Cross-service interactions
- Error scenarios

## Configuration

### Environment Variables
- `AI_PROVIDER`: Current AI provider (flowise/openrouter)
- `SYSTEM_PROMPT`: AI system prompt
- `NODE_ENV`: Environment (development/production)
- Provider-specific configuration

### Runtime Configuration
- AI provider switching without restart
- System prompt updates
- Feature toggles (future)

## Scalability Considerations

### Current Architecture
- In-memory data storage (development)
- Single server instance
- WebSocket for real-time features

### Production Recommendations
- PostgreSQL for data persistence
- Redis for session management
- Load balancer for multiple instances
- Message queue for async processing

## Error Handling

### Centralized Error Handling
- Global error middleware
- Structured error responses
- Logging and monitoring
- Graceful degradation

### AI Provider Resilience
- Automatic fallback responses
- Health check monitoring
- Retry logic with backoff
- Provider switching capability

## Monitoring and Observability

### Logging
- Request/response logging
- Error tracking
- Performance metrics
- Business metrics

### Health Checks
- Server health endpoint
- AI provider health
- Database connectivity (future)
- External service status

## Security

### Current Measures
- CORS configuration
- Input sanitization
- Error message sanitization
- Environment variable protection

### Future Enhancements
- Authentication middleware
- Rate limiting
- API key management
- Request validation

## Development Workflow

### Code Organization
- Separation of concerns
- Dependency injection
- Modular architecture
- Clear interfaces

### Testing
- Comprehensive test coverage
- Automated testing pipeline
- Mock external dependencies
- Integration test scenarios

### Documentation
- Code documentation
- API documentation
- Architecture decisions
- Deployment guides