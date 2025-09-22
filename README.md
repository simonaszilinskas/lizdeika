# Vilnius Assistant - AI Customer Support Platform

An AI-powered customer support system that provides intelligent, real-time assistance for municipal services. The platform combines human agents with AI technology to handle citizen inquiries efficiently, featuring document-based knowledge retrieval, automatic ticket assignment, and multilingual support in Lithuanian.

**Key Features:**
- 🤖 **AI Assistant**: Powered by OpenRouter (Gemini) and Flowise with document RAG capabilities
- 👥 **Agent Dashboard**: Real-time conversation management for up to 20 concurrent agents
- 📚 **Knowledge Base**: Upload documents (.txt, .docx) for AI-powered responses using vector search
- 🔄 **Smart Workflow**: Three-action system (send as-is, edit, or rewrite AI suggestions)
- 🌍 **Lithuanian Support**: Native language interface and responses
- 📊 **Production Scale**: Handles 16,000+ conversations annually with 6-month data retention

## 📚 Complete Guide

This README contains all documentation for setup, development, deployment, and troubleshooting.

## ⚡ Quick Start

### 🐳 Docker Setup (Recommended)

**Prerequisites**: Docker and Docker Compose

1. **Clone and start**:
```bash
git clone <repository-url>
cd vilnius-assistant
docker-compose up --build
```

2. **Initialize database** (first run only):
```bash
docker-compose exec backend npx prisma migrate dev --name init
docker-compose exec backend npm run seed
```

### 🔧 Traditional Setup

**Prerequisites**: Node.js 18+, PostgreSQL 12+

1. **Install dependencies**:
```bash
cd custom-widget/backend
npm install
```

2. **Setup database**:
```bash
createdb vilnius_support
cp .env.example .env
# Configure your .env file with database and API keys
npx prisma db push
```

3. **Start the server**:
```bash
npm start
```

### Access the Platform
- **Agent Dashboard**: http://localhost:3002/agent-dashboard.html
- **Customer Widget Demo**: http://localhost:3002/embed-widget.html
- **Settings/Admin**: http://localhost:3002/settings.html
- **Login**: http://localhost:3002/login.html
- **API Documentation**: http://localhost:3002/docs

**Docker Notes**: 
- All services run on port 3002 with Docker
- Database runs internally on port 5434
- For detailed Docker documentation, see [DOCKER.md](./DOCKER.md)

**Traditional Setup Notes**:
- Preferred: run only the backend on port 3002 — it serves the UI pages above
- Alternative: serve static UI from root on port 3000 using `npm run dev` if needed

## 🧪 Testing the System

1. **Test the Customer Widget**:
   - Open http://localhost:3002/embed-widget.html
   - Click the chat bubble and send a message
   - Message should be sent to Flowise for AI suggestion

2. **Test the Agent Dashboard**:
   - Open http://localhost:3002/agent-dashboard.html  
   - See conversations appear in the queue
   - Click a conversation to see AI suggestions
   - Use "Siųsti kaip yra", "Redaguoti", or "Nuo pradžių"

3. **Test System Health**:
   - Open http://localhost:3002/test-dashboard.html
   - Verify all components are working

## ✨ Current Features

### 🤖 **AI & RAG**
- **Dual AI providers**: OpenRouter (Gemini) + Flowise with failover
- **Document RAG**: Upload .txt/.docx files with semantic search
- **Vector database**: Chroma DB Cloud with Mistral embeddings
- **Context-aware responses**: AI uses uploaded documents
- **Smart suggestion polling**: Handles multiple rapid customer messages with intelligent cancellation

### 👥 **User Management**
- **JWT authentication**: Secure login with refresh tokens
- **Role-based access**: Admin, agent, and customer roles
- **Automatic ticket assignment**: Fair distribution across 20 agents
- **Activity logging**: Complete audit trail

### 💬 **Communication**
- **Real-time chat**: WebSocket communication with immediate message display
- **Three-action workflow**: Send/edit/rewrite AI suggestions
- **Conversation archiving**: Bulk operations and search
- **Lithuanian interface**: Native language support

#### **AI Suggestion System**
Smart polling system ensures agents always see the most recent AI suggestions:
- **Immediate message display**: Customer messages appear instantly (<100ms)
- **Background AI processing**: Suggestions generated in 6-13 seconds
- **Intelligent cancellation**: Prevents outdated suggestions when customers send multiple messages rapidly
- **Multi-agent safe**: Each agent polls independently with no conflicts
- **Exponential backoff**: Efficient polling (2s → 5s) reduces server load

### 📊 **System Capabilities**
- **20 concurrent agents** with automatic assignment
- **16,000+ conversations/year** capacity
- **6-month data retention** with automated cleanup
- **Production-ready** with comprehensive error handling

## 🚀 Development Priorities

### 🧪 **Testing Implementation** (Medium Priority)
- [ ] **Fix failing tests** - 3 tests failing due to missing modules
- [ ] **Fix coverage reporting** - Jest shows 0% due to ES6-to-CommonJS transformation, but tests exercise real code
- [ ] **Backend tests** - Add tests for API endpoints and database operations

### 📊 **Monitoring & Observability** (High Priority)
- [ ] **Structured logging** - Correlation IDs and centralized logs
- [ ] **Performance metrics** - Response times, AI provider latency tracking
- [ ] **Error monitoring** - Rate tracking and alerting system
- [ ] **Database monitoring** - Query performance and connection health
- [ ] **WebSocket health** - Connection monitoring and diagnostics

### 🔒 **Security Hardening** (Medium Priority)
- [ ] **Input validation** - Comprehensive sanitization audit
- [ ] **Advanced rate limiting** - Per user/endpoint (beyond global)
- [ ] **Security headers** - HTTPS, CSP, HSTS implementation
- [ ] **Audit logging** - Sensitive operations tracking
- [ ] **JWT strategy** - Token rotation and refresh policies

### ⚡ **Performance Optimization** (Medium Priority)
- [ ] **Database optimization** - Query performance, indexing
- [ ] **Redis caching** - Frequently accessed data caching
- [ ] **Connection pooling** - PostgreSQL optimization
- [ ] **Asset optimization** - CDN integration, compression
- [ ] **Vector DB tuning** - ChromaDB query optimization

### 🎯 **Operational Excellence** (Medium Priority)
- [ ] **Enhanced health checks** - Database, AI providers, vector DB
- [ ] **Disaster recovery** - Backup procedures and restoration
- [ ] **Log management** - Rotation, retention, analysis
- [ ] **Config validation** - Environment setup verification
- [ ] **Graceful shutdown** - Process management improvements

### 🔧 **Developer Experience** (Low Priority)
- [ ] **CI/CD pipeline** - Automated testing and deployment
- [ ] **Code quality** - ESLint, Prettier, quality gates
- [ ] **API documentation** - OpenAPI/Swagger integration
- [ ] **Dev environment** - Container optimization

### 🌐 **User Experience** (Low Priority)
- [ ] **iframe embedding** - Easy widget integration like YouTube
- [ ] **Mobile optimization** - Improved responsive design for widget and dashboard
- [ ] **Accessibility** - WCAG 2.1 compliance
- [ ] **Dark mode** - Theme support across platform
- [ ] **Keyboard navigation** - Full accessibility support
- [ ] **Multi-language** - Expansion beyond Lithuanian


## 🏗️ Technology Stack

- **Backend**: Node.js, Express, Prisma ORM
- **Database**: PostgreSQL + Chroma DB Cloud (vectors)  
- **AI**: OpenRouter (Gemini), Flowise, LangChain
- **Auth**: JWT with refresh tokens, bcryptjs hashing
- **Frontend**: Vanilla JavaScript, TailwindCSS
- **Real-time**: Socket.IO WebSocket communication
- **Deployment**: Docker & Docker Compose, Nginx (production)

---

**🎯 Perfect for**: Municipal customer support, enterprise ticketing, documentation-based assistance

**🚀 Ready for**: Production deployment with 20 agents and 16,000+ annual conversations

---

## 🚀 Deploy in Production

### Option 1: VM Deployment (Docker) - Tested & Verified ✅

Deploy to any Linux VM (Ubuntu, Debian, CentOS) with 4GB+ RAM.

#### Prerequisites (one-time setup)
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again for docker group to take effect
```

#### Deploy with One Command
```bash
# 1. Clone repository
git clone https://github.com/simonaszilinskas/vilnius-assistant.git
cd vilnius-assistant
git checkout deployment

# 2. Configure environment (REQUIRED)
cp .env.template .env
nano .env  # Edit with your API keys - see Required Configuration below

# 3. Deploy everything automatically
./scripts/deploy.sh production
```

**Result**: Full system running at `http://your-vm-ip:3002` in 3-5 minutes!

#### Required Configuration
Edit `.env` file with real values:
```bash
# Essential API Keys (get from providers)
OPENROUTER_API_KEY=sk-or-v1-your-real-key      # From openrouter.ai
MISTRAL_API_KEY=your-real-mistral-key          # From mistral.ai
CHROMA_URL=https://api.trychroma.com           # ChromaDB Cloud
CHROMA_TENANT=your-tenant-id
CHROMA_DATABASE=your-database
CHROMA_AUTH_TOKEN=your-auth-token

# Security (generate these)
JWT_SECRET=$(openssl rand -base64 32)          # Generate 32+ char string
JWT_REFRESH_SECRET=$(openssl rand -base64 32)  # Generate another one
ADMIN_RECOVERY_KEY=$(openssl rand -base64 24)  # Generate 24+ char string
```

#### VM Requirements
- **Minimum**: 2 vCPUs, 4GB RAM, 20GB SSD (~$20-40/month)
- **Recommended**: 4 vCPUs, 8GB RAM, 40GB SSD (~$40-80/month)
- **Providers**: DigitalOcean, Linode, AWS EC2, Hetzner, Google Cloud

#### Post-Deployment Access
- **Health Dashboard**: `http://your-vm-ip:3002/health-dashboard.html` - System status
- **Agent Dashboard**: `http://your-vm-ip:3002/agent-dashboard.html` - Main app
- **Admin Settings**: `http://your-vm-ip:3002/settings.html` - Configuration
- **Default Login**: admin@vilnius.lt / admin123 (change immediately!)

### Option 2: Railway Deployment (GitHub Integration) 🚂

Deploy directly from GitHub with automatic scaling and managed database.

#### One-Click Deploy
1. Push deployment branch to GitHub:
   ```bash
   git push origin deployment
   ```
2. Go to [railway.app/new](https://railway.app/new)
3. Choose "Deploy from GitHub repo"
4. Select your repository → `deployment` branch
5. Add PostgreSQL database service
6. Configure environment variables (same as VM deployment)
7. Railway handles everything else!

**Result**: Production deployment with SSL at `https://your-app.railway.app` in 3 minutes!

#### Railway Benefits
- Auto-scaling and load balancing
- Managed PostgreSQL with backups
- Free SSL certificates
- Built-in monitoring
- $5 free credits monthly
- ~$20-50/month for production

### Option 3: Traditional Docker Compose

For manual Docker deployment without scripts:

```bash
# Clone and configure
git clone https://github.com/simonaszilinskas/vilnius-assistant.git
cd vilnius-assistant
git checkout deployment
cp .env.template .env
# Edit .env with your configuration

# Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Initialize database
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
docker-compose -f docker-compose.prod.yml exec backend npm run db:seed
```

### 🔑 Getting Required API Keys

1. **OpenRouter** (AI Provider):
   - Go to [openrouter.ai](https://openrouter.ai)
   - Create account → Get API key
   - Free tier available

2. **Mistral** (Embeddings):
   - Go to [mistral.ai](https://mistral.ai)
   - Create account → Get API key
   - Free tier available

3. **ChromaDB** (Vector Database):
   - Go to [trychroma.com](https://trychroma.com)
   - Create cloud instance
   - Get tenant, database, and auth token

### ✅ Deployment Verification

After deployment, verify everything works:

1. **Check Health Dashboard**: `http://your-domain:3002/health-dashboard.html`
   - All services should show green
   - AI providers connected
   - Database operational

2. **Run Quick Test**:
   ```bash
   curl http://your-domain:3002/health
   # Should return: {"status":"healthy"}
   ```

3. **Test Login**:
   - Go to `/login.html`
   - Login with admin@vilnius.lt / admin123
   - Change password immediately!

### 🔧 Production Maintenance

**View logs**:
```bash
# VM deployment
docker-compose logs -f backend

# Railway deployment
railway logs --tail
```

**Backup database**:
```bash
docker-compose exec postgres pg_dump -U vilnius_user vilnius_support > backup.sql
```

**Deploy updates**:
```bash
git pull origin deployment
./scripts/deploy.sh production  # VM
# OR
railway up  # Railway
```

### 📊 Production Checklist

Before going live:
- [ ] Changed admin password from default
- [ ] Configured all API keys (OpenRouter, Mistral, ChromaDB)
- [ ] Set strong JWT secrets (32+ characters)
- [ ] Tested AI responses in chat widget
- [ ] Uploaded knowledge base documents
- [ ] Created agent user accounts
- [ ] Configured `WIDGET_ALLOWED_DOMAINS` for security
- [ ] Set up database backups
- [ ] Verified health dashboard shows all green

### 🚨 Common Issues & Solutions

**Port 3002 in use**:
```bash
sudo lsof -i :3002
sudo kill -9 <PID>
```

**Docker permission denied**:
```bash
sudo usermod -aG docker $USER
# Logout and login again
```

**API keys not working**:
- Verify keys are correct in `.env`
- Check provider dashboards for usage/errors
- Test with `curl` to API endpoints

**Database connection fails**:
```bash
docker-compose logs postgres
docker-compose down -v
./scripts/deploy.sh production  # Rebuild everything
```

---

## 🛠️ Development Guide

### Docker Development
```bash
# Start development containers
docker-compose up --build

# Watch logs
docker-compose logs -f

# Access database
docker-compose exec postgres psql -U postgres -d vilnius_support

# Run commands in backend container
docker-compose exec backend npm run seed
docker-compose exec backend npx prisma studio
```

### Development Workflow
1. Make code changes locally
2. Containers auto-restart with volume mounts
3. Database persists between restarts
4. Access services on localhost:3002

---

## 🔧 Troubleshooting

### Docker Issues
```bash
# Check container status
docker-compose ps

# Restart services
docker-compose restart

# View container logs
docker-compose logs backend
docker-compose logs postgres

# Clean restart
docker-compose down
docker-compose up --build
```

### Common Issues

**Database connection fails:**
```bash
# Check database is running
docker-compose logs postgres
# Reinitialize if needed
docker-compose exec backend npx prisma migrate dev
```

**Port conflicts:**
```bash
# Check what's using port 3002
lsof -i :3002
# Kill conflicting processes
pkill -f "node.*3002"
```

**Build failures:**
```bash
# Clean Docker system
docker system prune -a
# Rebuild without cache
docker-compose build --no-cache
```

---

## 📊 System Architecture

### Components
- **Backend**: Node.js/Express API server
- **Database**: PostgreSQL with Prisma ORM
- **AI**: OpenRouter (Gemini) + Flowise with failover
- **Vector DB**: Chroma DB Cloud for document RAG
- **Auth**: JWT with refresh tokens
- **Real-time**: Socket.IO WebSocket communication
- **Frontend**: Vanilla JavaScript + TailwindCSS

### Docker Services
- **backend**: Main application (port 3002)
- **postgres**: Database (internal port 5432, external 5434)
- **nginx**: Reverse proxy with SSL (production only)

### File Structure
```
vilnius-assistant/
├── custom-widget/
│   ├── backend/           # Node.js API server
│   ├── js/               # Frontend JavaScript
│   ├── *.html            # UI pages
│   └── *.css             # Styles
├── docker/               # Docker configurations
├── scripts/              # Utility scripts
├── Dockerfile            # Backend container
├── docker-compose.yml    # Development setup
└── docker-compose.prod.yml # Production setup
```

---

## 🔐 Environment Variables

### Required Variables
```bash
# Database
DATABASE_URL="postgresql://postgres:password@postgres:5432/vilnius_support"

# AI Services
OPENROUTER_API_KEY="your-openrouter-key"
FLOWISE_API_URL="your-flowise-url"
FLOWISE_API_KEY="your-flowise-key"

# Authentication
JWT_SECRET="your-jwt-secret"
JWT_REFRESH_SECRET="your-refresh-secret"

# Vector Database
CHROMA_URL="your-chroma-url"
CHROMA_API_KEY="your-chroma-key"

# Observability (Optional)
LANGFUSE_SECRET_KEY="your-langfuse-key"
LANGFUSE_PUBLIC_KEY="your-langfuse-public"
LANGFUSE_HOST="your-langfuse-host"
```

### Docker Environment Files
- `.env.docker`: Template for Docker environment
- `.env.docker.local`: Local overrides (not committed)

---
