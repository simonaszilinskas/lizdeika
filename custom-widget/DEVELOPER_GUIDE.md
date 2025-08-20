# Vilnius Assistant - Developer Guide

> Comprehensive development guide covering architecture, deployment, troubleshooting, and recent fixes.

## 🚀 Quick Development Setup

### Prerequisites
- Node.js 16+
- PostgreSQL 12+
- Git

### Clone & Install
```bash
git clone <repository-url>
cd vilnius-assistant/custom-widget
cd backend && npm install
```

### Environment Setup
```bash
cp .env.example .env
# Configure required variables (see Configuration section below)
```

### Database Setup
```bash
# Create database
createdb vilnius_support

# Apply schema
npx prisma db push

# Verify setup
npx prisma studio
```

### Start Development
```bash
# Backend with auto-reload
npm run dev

# Or standard start
npm start
```

### Verify Installation
```bash
# Health check
curl http://localhost:3002/health

# Test widget
open http://localhost:3002/embed-widget.html
```

## 🏗️ System Architecture

### Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Chat Widget   │    │  Backend API    │    │ Agent Dashboard │
│   (Frontend)    │◄──►│   (Node.js)     │◄──►│   (Frontend)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └──────┐        ┌──────▼──────┐         ┌──────┘
                └───────►│ PostgreSQL  │◄────────┘
                         └─────────────┘
                                 │
                         ┌──────▼──────┐
                         │ AI Services │
                         │(RAG+OpenAI) │
                         └─────────────┘
```

### Data Flow

1. **Customer Message** → Widget → Backend API → Database
2. **AI Processing** → RAG Query → Vector DB → AI Model → Response
3. **Agent Notification** → WebSocket → Agent Dashboard → UI Update
4. **Agent Response** → Dashboard → Backend → Database → Customer

### Key Technologies

- **Backend**: Node.js, Express, Socket.IO
- **Database**: PostgreSQL + Prisma ORM
- **Vector Store**: Chroma DB Cloud
- **AI**: OpenRouter (Gemini), Mistral Embeddings
- **Frontend**: Vanilla JavaScript, TailwindCSS
- **Real-time**: WebSocket communication

## 📁 Project Structure

```
custom-widget/
├── README.md                     # Main documentation
├── API_DOCUMENTATION.md          # API reference  
├── DEVELOPER_GUIDE.md           # This file
├── SYSTEM_ARCHITECTURE.md        # Architecture diagrams
│
├── widget.js                     # Embeddable customer widget
├── agent-dashboard.html          # Agent interface
├── agent-login.html              # Agent authentication
├── settings.html                 # System configuration
│
└── backend/                      # Node.js API server
    ├── server.js                 # Main application
    ├── .env                      # Environment config
    ├── package.json              # Dependencies
    │
    ├── src/
    │   ├── controllers/          # HTTP request handlers
    │   │   ├── conversationController.js
    │   │   ├── agentController.js
    │   │   └── authController.js
    │   │
    │   ├── services/             # Business logic
    │   │   ├── conversationService.js
    │   │   ├── agentService.js
    │   │   ├── aiService.js
    │   │   └── websocketService.js
    │   │
    │   ├── routes/               # API endpoints
    │   ├── middleware/           # Auth, logging, etc.
    │   └── utils/               # Helper functions
    │
    ├── prisma/
    │   └── schema.prisma         # Database schema
    │
    └── tests/                    # Test suites
        ├── unit/                 # Unit tests
        └── integration/          # API tests
```

## ⚙️ Configuration

### Required Environment Variables

```bash
# Server Configuration
PORT=3002
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database (PostgreSQL)
DATABASE_URL="postgresql://username:password@localhost:5432/vilnius_support"
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vilnius_support
DB_USER=your_username
DB_PASSWORD=your_password

# AI Services
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-xxx
OPENROUTER_MODEL=google/gemini-2.5-flash
SITE_URL=http://localhost:3002
SITE_NAME=Vilniaus chatbot

# RAG Configuration
RAG_K=100
RAG_SHOW_SOURCES=true
MISTRAL_API_KEY=your-mistral-key

# Chroma DB Configuration
CHROMA_URL=https://api.trychroma.com
CHROMA_TENANT=your-tenant-id
CHROMA_DATABASE=your-database-name
CHROMA_AUTH_TOKEN=your-auth-token

# Widget Customization
WIDGET_NAME=Lizdeika
WIDGET_PRIMARY_COLOR=#fc030b
WIDGET_ALLOWED_DOMAINS=*

# JWT Authentication
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@vilnius.lt

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
```

### System Modes

The system operates in three modes:

1. **HITL (Human in the Loop)** - Default
   - AI generates suggestions for agents
   - Agents review and can edit responses
   - Real-time notifications

2. **Autopilot**
   - AI responds directly to customers
   - Includes robot disclaimer
   - No agent involvement

3. **Off**
   - Shows offline message
   - Messages queue for later response
   - Manual agent assignment

## 🔧 Development Workflows

### Adding New Features

1. **Create feature branch**
   ```bash
   git checkout -b feature/feature-name
   ```

2. **Implement backend changes**
   - Add routes in `src/routes/`
   - Add controllers in `src/controllers/`
   - Add services in `src/services/`
   - Update database schema if needed

3. **Update frontend**
   - Modify widget.js for customer features
   - Update agent-dashboard.html for agent features

4. **Add tests**
   ```bash
   # Run existing tests
   npm test
   
   # Add new tests in tests/
   ```

5. **Document changes**
   - Update relevant documentation
   - Add API documentation if needed

### Database Changes

```bash
# Modify schema
vim prisma/schema.prisma

# Apply changes
npx prisma db push

# Generate client
npx prisma generate

# View database
npx prisma studio
```

### Testing Strategy

**✅ Phase 1 Complete: Comprehensive Testing Suite (103 tests)**

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific test types  
npm run test:unit        # 87 unit tests
npm run test:integration # 16 integration tests

# Watch mode for development
npm run test:watch

# Run specific test files
npm test tests/unit/agentService.test.js
npm test tests/integration/api.test.js
```

**Test Coverage Summary:**
- **Overall Coverage**: 36.7% (focusing on critical services)
- **Core Services**: 80%+ coverage (agentService, aiService, conversationService)
- **API Endpoints**: 100% integration test coverage
- **Quality**: All tests passing with proper isolation

**Key Test Features:**
- **Unit Tests**: 87 tests covering business logic, edge cases, error handling
- **Integration Tests**: 16 tests covering full API workflows
- **Mock Strategy**: External services properly mocked for reliable testing
- **Test Environment**: Isolated test database and configuration

## 🐛 Recent Bug Fixes

### Fixed Issues (August 2025)

1. **✅ AI Suggestions Not Displaying**
   - **Issue**: Agents couldn't see AI suggestions in HITL mode
   - **Root Cause**: Broken status check in frontend
   - **Fix**: Removed status check, always call `checkForPendingSuggestion()`
   - **Files**: `js/agent-dashboard.js:594-626`

2. **✅ Incorrect Message Count**
   - **Issue**: Showing 4 messages instead of 1
   - **Root Cause**: Counting system messages
   - **Fix**: Filter to only count visitor/agent messages
   - **Files**: `src/services/conversationService.js:151-165`

3. **✅ Agent Display Names**
   - **Issue**: Random IDs instead of friendly names
   - **Root Cause**: No name mapping system
   - **Fix**: Added agent name generation ("Agent One", "Agent Two")
   - **Files**: `src/services/agentService.js:17-53`

4. **✅ PostgreSQL Connection Issues**
   - **Issue**: `User 'postgres' was denied access`
   - **Root Cause**: Wrong username in DATABASE_URL
   - **Fix**: Updated to use system username
   - **Files**: `.env` (DATABASE_URL configuration)

5. **✅ Duplicate User Messages**
   - **Issue**: Customer messages appeared twice
   - **Root Cause**: Backend added message to context twice
   - **Fix**: Fixed `buildConversationContext()` duplication
   - **Files**: `src/controllers/conversationController.js:529`

### Code Quality Improvements

- **Backend**: Fixed conversation context building
- **Frontend**: Added content-based deduplication
- **Database**: Successful PostgreSQL migration
- **AI**: Improved suggestion workflow reliability

## 🚨 Common Issues & Solutions

### Database Issues

**Issue**: Connection failed
```bash
# Check PostgreSQL status
pg_isready

# Restart PostgreSQL
brew services restart postgresql@14  # macOS
sudo systemctl restart postgresql    # Linux

# Create database if missing
createdb vilnius_support
```

**Issue**: Schema out of sync
```bash
# Reset and reapply schema
npx prisma db push --force-reset
```

### AI Service Issues

**Issue**: No AI responses
```bash
# Check API keys
echo $OPENROUTER_API_KEY
echo $MISTRAL_API_KEY

# Test API connectivity
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
     https://openrouter.ai/api/v1/models
```

**Issue**: RAG not working
```bash
# Check Chroma DB connection
curl -H "Authorization: Bearer $CHROMA_AUTH_TOKEN" \
     "$CHROMA_URL/api/v1/collections"
```

### Frontend Issues

**Issue**: Widget not loading
- Check CORS settings
- Verify `WIDGET_ALLOWED_DOMAINS`
- Check browser console errors
- Ensure backend is running

**Issue**: Agent dashboard not updating
- Check WebSocket connection
- Verify agent authentication
- Check browser network tab
- Restart server if needed

### Performance Issues

**Issue**: Slow responses
```bash
# Check database performance
EXPLAIN ANALYZE SELECT * FROM tickets WHERE status = 'open';

# Monitor server resources
top -p $(pgrep node)

# Check logs for bottlenecks
tail -f server.log
```

## 📊 Monitoring & Logging

### Health Endpoints

```bash
# System health
curl http://localhost:3002/health

# Database status
curl http://localhost:3002/api/admin/health

# AI service status
curl http://localhost:3002/api/ai/health
```

### Log Locations

- **Server logs**: Console output / server.log
- **Database logs**: PostgreSQL logs
- **Application logs**: Built-in console logging

### Key Metrics

```bash
# Active conversations
curl http://localhost:3002/api/admin/conversations

# Agent status
curl http://localhost:3002/api/agents/connected

# System statistics
curl http://localhost:3002/api/admin/stats
```

## 🚀 Deployment

### Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] CORS domains configured
- [ ] API keys secured
- [ ] Health checks working
- [ ] Monitoring setup
- [ ] Backup strategy implemented

### Docker Deployment

```bash
# Build and run
docker-compose up -d

# Check logs
docker-compose logs -f backend

# Update
docker-compose pull && docker-compose up -d
```

### Environment-Specific Settings

**Development**
```bash
NODE_ENV=development
DEBUG=true
```

**Production**
```bash
NODE_ENV=production
DEBUG=false
FRONTEND_URL=https://your-domain.com
```

## 🧪 Testing Guide

### Unit Tests

```javascript
// Example test structure
describe('ConversationService', () => {
  it('should create conversation', async () => {
    const conversation = await conversationService.createConversation('test-id', {
      visitorId: 'visitor-123'
    });
    expect(conversation.id).toBe('test-id');
  });
});
```

### Integration Tests

```javascript
// Example API test
describe('POST /api/messages', () => {
  it('should process customer message', async () => {
    const response = await request(app)
      .post('/api/messages')
      .send({
        conversationId: 'test-conv',
        message: 'Hello',
        visitorId: 'visitor-123'
      });
    expect(response.status).toBe(200);
  });
});
```

### Manual Testing Workflows

1. **Customer Journey**
   - Load widget on test page
   - Send message
   - Verify AI response or agent assignment
   - Test conversation flow

2. **Agent Journey**
   - Login to agent dashboard
   - View pending conversations
   - Send response using AI suggestion
   - Mark conversation as resolved

3. **System Administration**
   - Upload documents to knowledge base
   - Configure system settings
   - Monitor agent activity
   - Review conversation history

## 🔐 Security Considerations

### Authentication
- JWT tokens with refresh mechanism
- Secure password hashing
- Role-based access control

### API Security
- Input validation on all endpoints
- Rate limiting (to be implemented)
- CORS configuration
- SQL injection prevention (Prisma ORM)

### Data Protection
- Sensitive data in environment variables
- Database connection encryption
- Regular security updates

## 📈 Performance Optimization

### Database
- Indexed queries for conversations and messages
- Proper relationship management
- Regular maintenance tasks

### API
- Efficient query patterns
- Minimal data transfer
- Caching strategies (to be implemented)

### Frontend
- Optimized WebSocket usage
- Efficient DOM updates
- Minimal asset loading

## 🤝 Contributing

### Code Style
- Use ESLint configuration
- Follow existing patterns
- Add comments for complex logic
- Write descriptive commit messages

### Pull Request Process
1. Create feature branch
2. Implement changes with tests
3. Update documentation
4. Submit PR with description
5. Address review feedback

### Code Review Checklist
- [ ] Code follows style guidelines
- [ ] Tests pass and cover new functionality
- [ ] Documentation updated
- [ ] No security vulnerabilities
- [ ] Performance impact considered

---

**Last Updated**: August 2025  
**Maintainers**: Development Team  
**Support**: GitHub Issues