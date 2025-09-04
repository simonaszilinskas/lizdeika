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

## ✨ Current Features (Phase 3 Complete)

### 🤖 **AI & RAG**
- **Dual AI providers**: OpenRouter (Gemini) + Flowise with failover
- **Document RAG**: Upload .txt/.docx files with semantic search
- **Vector database**: Chroma DB Cloud with Mistral embeddings
- **Context-aware responses**: AI uses uploaded documents

### 👥 **User Management**
- **JWT authentication**: Secure login with refresh tokens
- **Role-based access**: Admin, agent, and customer roles
- **Automatic ticket assignment**: Fair distribution across 20 agents
- **Activity logging**: Complete audit trail

### 💬 **Communication**
- **Real-time chat**: WebSocket communication
- **Three-action workflow**: Send/edit/rewrite AI suggestions
- **Conversation archiving**: Bulk operations and search
- **Lithuanian interface**: Native language support

### 📊 **System Capabilities**
- **20 concurrent agents** with automatic assignment
- **16,000+ conversations/year** capacity
- **6-month data retention** with automated cleanup
- **Production-ready** with comprehensive error handling

## 🚀 Next Steps: Completing Lizdeika Vision

- [ ] **iframe embedding** - Easy widget integration like YouTube
- [ ] **Mobile optimization** - Improved responsive design for the widget and the dashboard


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

## 🚀 Production Deployment

### Docker Production Setup

1. **Clone and configure**:
```bash
git clone <repository-url>
cd vilnius-assistant
cp .env.docker .env.docker.local
# Edit .env.docker.local with your production values
```

2. **Deploy with production compose**:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

3. **Initialize database**:
```bash
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run seed
```

### SSL Configuration
The production setup includes Nginx with SSL. Update `docker/nginx/prod.conf` with your SSL certificates.

### Monitoring
- Container logs: `docker-compose logs -f`
- Health check: `https://yourdomain.com/health`

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
