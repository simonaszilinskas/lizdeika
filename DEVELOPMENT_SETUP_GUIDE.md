# Development Setup Guide

## Overview
Quick start guide for developers to set up the Vilnius Assistant support system locally.

## 🐳 Docker Setup (Recommended - 2 minutes)

### Prerequisites
- **Docker** and **Docker Compose** ([Download](https://www.docker.com/))
- **Git** ([Download](https://git-scm.com/))

### Quick Start
```bash
git clone <repository-url>
cd vilnius-assistant
docker-compose up --build

# Initialize database (first run only)
docker-compose exec backend npx prisma migrate dev --name init
docker-compose exec backend npm run seed
```

**Access URLs:**
- Agent Dashboard: http://localhost:3002/agent-dashboard.html
- Customer Widget: http://localhost:3002/embed-widget.html
- Login: http://localhost:3002/login.html

## 🔧 Traditional Setup (Alternative)

### Prerequisites
- **Node.js** v18+ ([Download](https://nodejs.org/))
- **PostgreSQL** v13+ ([Download](https://www.postgresql.org/download/))
- **Git** ([Download](https://git-scm.com/))
- **Code Editor** (VS Code recommended)

### Recommended Tools
- **pgAdmin** - Database management GUI
- **Postman/Insomnia** - API testing
- **Chrome DevTools** - Frontend debugging

## Traditional Setup (5 minutes)

### 1. Clone Repository
```bash
git clone https://github.com/simonaszilinskas/vilnius-support.git
cd vilnius-support/custom-widget
```

### 2. Database Setup
```bash
# Create database (adjust for your PostgreSQL setup)
createdb vilnius_support

# Or using psql:
psql -c "CREATE DATABASE vilnius_support;"
```

### 3. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Set database connection
export DATABASE_URL="postgresql://your-username@localhost:5432/vilnius_support"

# Initialize database
npx prisma db push

# Start backend server
npm start
```

Backend will start on `http://localhost:3001`

### 4. Test Setup
```bash
# In a new terminal - test backend
curl http://localhost:3001/api/health
# Should return: {"status":"healthy","timestamp":"..."}

# Create admin user
ADMIN_RECOVERY_KEY="test-recovery-key" node admin-recovery.js create \
  --email admin@vilnius.lt \
  --password "Admin123!" \
  --first-name Admin \
  --last-name User
```

### 5. Frontend Access
Open in browser:
- **Agent Dashboard**: `http://localhost:3001/../agent-dashboard.html`
- **Login**: admin@vilnius.lt / Admin123!

🎉 **You're ready to develop!**

## Detailed Development Workflow

### Environment Configuration

#### Backend Environment Variables
Create `custom-widget/backend/.env`:
```env
# Database
DATABASE_URL="postgresql://your-username@localhost:5432/vilnius_support"

# Development settings
NODE_ENV=development
PORT=3001

# JWT Secret (development only)
JWT_SECRET="dev-jwt-secret-key"

# Admin Recovery
ADMIN_RECOVERY_KEY="test-recovery-key"

# Optional: AI Provider for testing
AI_PROVIDER="openai"
OPENAI_API_KEY="your-openai-key"
```

### Database Management

#### Common Database Commands
```bash
# View database schema
npx prisma studio  # Opens GUI at http://localhost:5555

# Reset database (careful!)
npx prisma db push --force-reset
npx prisma db push

# Check connection
PGUSER=your-username PGDATABASE=vilnius_support psql -c "SELECT version();"

# View users
PGUSER=your-username PGDATABASE=vilnius_support psql -c "SELECT email, role FROM users;"
```

#### Database Seeding (Optional)
```bash
# Run seed script if available
node prisma/seed.js

# Or create test data manually
PGUSER=your-username PGDATABASE=vilnius_support psql -c "
INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active)
VALUES ('test-agent-id', 'agent@vilnius.lt', '$2b$12$...', 'Test', 'Agent', 'agent', true);
"
```

### Frontend Development

#### File Structure
```
custom-widget/
├── agent-dashboard.html      # Main agent interface
├── login.html               # Authentication page
├── settings.html            # System settings
├── widget.js               # Customer widget
├── js/
│   ├── agent-dashboard.js   # Main dashboard logic
│   ├── settings.js         # Settings page logic
│   └── modules/            # Modular components
│       ├── modern-websocket-manager.js
│       ├── modern-conversation-loader.js
│       ├── errorHandler.js
│       └── ...
└── backend/                # Backend API server
```

#### Development Server Options

**Option 1: Static File Server**
```bash
# In custom-widget directory
python3 -m http.server 8000
# Access: http://localhost:8000/agent-dashboard.html
```

**Option 2: Live Server (VS Code Extension)**
- Install "Live Server" extension
- Right-click on `agent-dashboard.html` → "Open with Live Server"

**Option 3: Node.js Express Server**
```bash
npm install -g serve
serve -s . -p 8000
```

### API Testing

#### Authentication
```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vilnius.lt","password":"Admin123!"}'

# Save the returned JWT token for authenticated requests
export JWT_TOKEN="eyJhbGciOiJIUzI1NiIs..."
```

#### Common API Endpoints
```bash
# Get conversations
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3001/api/conversations

# Create conversation (widget)
curl -X POST http://localhost:3001/api/widget/conversation \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello, I need help!"}'

# Send agent message
curl -X POST http://localhost:3001/api/conversations/CONVERSATION_ID/messages \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "How can I help you?"}'

# Get system status
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3001/api/system/status
```

### WebSocket Development

#### Testing WebSocket Events
```javascript
// In browser console (agent dashboard page)
const socket = io('http://localhost:3001');

socket.on('connect', () => {
    console.log('Connected to WebSocket');
    socket.emit('join-agent-dashboard', 'test-agent-id');
});

// Listen for events
socket.on('new-conversation', (data) => {
    console.log('New conversation:', data);
});

socket.on('connected-agents-update', (data) => {
    console.log('Agents update:', data);
});
```

#### WebSocket Debug Logging
```javascript
// Enable verbose WebSocket logging
const wsManager = new ModernWebSocketManager({
    url: 'http://localhost:3001',
    agentId: 'test-agent',
    logger: console
});
```

### Testing

#### Running Tests
```bash
cd custom-widget/backend

# Run all tests
npm test

# Run specific test file
npm test -- tests/unit/conversationService.test.js

# Run with coverage
npm test -- --coverage

# Watch mode for development
npm test -- --watch
```

#### Frontend Testing
```bash
# Install frontend test dependencies (if available)
cd custom-widget/tests/frontend
npm install

# Run frontend tests
npm test
```

### Debugging

#### Backend Debugging

**VS Code Launch Configuration**
Create `.vscode/launch.json`:
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Debug Backend",
            "type": "node",
            "request": "launch",
            "program": "${workspaceFolder}/custom-widget/backend/server.js",
            "env": {
                "NODE_ENV": "development",
                "DATABASE_URL": "postgresql://your-username@localhost:5432/vilnius_support"
            },
            "console": "integratedTerminal",
            "restart": true
        }
    ]
}
```

**Console Debugging**
```bash
# Start with debug output
DEBUG=* npm start

# Or with specific debug namespaces
DEBUG=websocket,database npm start
```

#### Frontend Debugging
- **Chrome DevTools**: F12 → Console, Network, Sources tabs
- **React DevTools**: For any React components (future)
- **Vue DevTools**: For any Vue components (future)

### Common Development Tasks

#### Creating New API Endpoints
1. Add route in `backend/src/routes/`
2. Add controller in `backend/src/controllers/`
3. Add service logic in `backend/src/services/`
4. Add tests in `backend/tests/unit/`

#### Adding New WebSocket Events
1. Add event handler in `backend/src/services/websocketService.js`
2. Add event to `appEvents` array in `js/modules/modern-websocket-manager.js`
3. Add event listener in appropriate frontend file
4. Test with browser console

#### Database Schema Changes
```bash
# Make changes to schema.prisma
# Then apply changes:
npx prisma db push

# Generate updated Prisma client
npx prisma generate
```

### Performance Monitoring

#### Development Monitoring
```bash
# Monitor backend performance
node --inspect server.js
# Open chrome://inspect in Chrome

# Monitor memory usage
node --trace-warnings server.js

# Profile with clinic.js
npm install -g clinic
clinic doctor -- node server.js
```

#### Frontend Performance
```javascript
// Monitor WebSocket performance
performance.mark('websocket-start');
websocketManager.connect().then(() => {
    performance.mark('websocket-end');
    performance.measure('websocket-connection', 'websocket-start', 'websocket-end');
    console.log(performance.getEntriesByName('websocket-connection'));
});
```

## IDE Configuration

### VS Code Extensions
Recommended extensions for this project:
```json
{
    "recommendations": [
        "esbenp.prettier-vscode",
        "ms-vscode.vscode-json",
        "ms-python.python",
        "bradlc.vscode-tailwindcss",
        "Prisma.prisma",
        "ms-vscode.vscode-typescript-next",
        "formulahendry.auto-rename-tag",
        "ms-vscode.live-server"
    ]
}
```

### VS Code Settings
Create `.vscode/settings.json`:
```json
{
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": true
    },
    "javascript.preferences.quoteStyle": "single",
    "files.associations": {
        "*.js": "javascript"
    },
    "emmet.includeLanguages": {
        "javascript": "html"
    }
}
```

## Git Workflow

### Branch Strategy
```bash
# Create feature branch
git checkout -b feature/new-websocket-event

# Make changes and commit
git add .
git commit -m "Add new WebSocket event for typing indicators"

# Push and create PR
git push origin feature/new-websocket-event
```

### Commit Message Format
```
type: short description

Longer description if needed

- Added feature X
- Fixed bug Y
- Updated documentation Z

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Troubleshooting Development Issues

### Port Already in Use
```bash
# Find process using port 3001
lsof -ti:3001
kill -9 <process-id>

# Or use different port
PORT=3002 npm start
```

### Database Connection Issues
```bash
# Check PostgreSQL is running
pg_ctl status

# Check connection
psql -d vilnius_support -c "SELECT 1;"

# Reset connection
pkill -f postgres
brew services restart postgresql  # macOS
sudo systemctl restart postgresql  # Linux
```

### WebSocket Connection Refused
```bash
# Check backend is running
curl http://localhost:3001/api/health

# Check CORS configuration
# Update websocketService.js if needed
```

### Frontend Not Loading
- Check browser console for errors
- Verify API endpoints in settings.js
- Check network tab for failed requests
- Try hard refresh (Ctrl+F5)

## Next Steps

After successful setup:

1. **Explore the codebase**: Start with `agent-dashboard.js` and `websocketService.js`
2. **Make a small change**: Add a console.log statement and verify it works
3. **Run tests**: Ensure all tests pass before making changes
4. **Read the documentation**: Check other .md files in the project
5. **Join development**: Look for issues or features to implement

## Getting Help

### Documentation
- `TROUBLESHOOTING_GUIDE.md` - Common issues and solutions
- `WEBSOCKET_EVENTS_REFERENCE.md` - WebSocket API reference
- `CLAUDE.md` - Project-specific instructions

### Debugging Resources
- Check browser console for frontend issues
- Check terminal output for backend issues
- Use `npm test` to verify functionality
- Consult PostgreSQL logs if database issues

### Code Structure
- Start with `server.js` to understand backend entry point
- Review `agent-dashboard.js` for frontend architecture
- Check `websocketService.js` for real-time features
- Explore `services/` directory for business logic

Happy coding! 🚀