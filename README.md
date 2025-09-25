# Vilnius Assistant - AI Customer Support Platform

An AI-era, but with a human in the loop open source customer support system. 

**Key Features:**
- AI workflow
   - Document adding via API or the UI
   - Document embedding into Chroma DB via Mistral embeddings API 
   - LLM (open router) for rephrasing user queries 
   - Query embedding and vector search
   - LLM (open router) for query answering based on context
   - Langfuse or manual prompt writing are used to input prompts 
- Three modes 
   - Human in the loop - HITL (the AI provides suggestions, customer support agents approve them)
   - Autopilot (the AI responds directly but shows a warning to the user)
   - OFF (a message saying "We'll get back to you when we are back online")
- User management
   - Login
   - New user creation by admin
   - Password change by admin
- Agent Dashboard 
   - Agents and admins can be online or offline
   - If agents and admins are online, and the mode is HITL, the messages are distributed in round robin
   - Agents and admins can reassign, unassign conversations
   - Agents and admins can archive conversations - if a user writes a message to an archived conversation, the conversation comes back up
   - If no agents or admins are connected, the messages fall into a common pool and are not assigned to nobody

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

## 🏗️ Technology Stack

- **Backend**: Node.js, Express, Prisma ORM
- **Database**: PostgreSQL + Chroma DB Cloud (vectors)  
- **AI**: OpenRouter (Gemini), Flowise, LangChain
- **Auth**: JWT with refresh tokens, bcryptjs hashing
- **Frontend**: Vanilla JavaScript, TailwindCSS
- **Real-time**: Socket.IO WebSocket communication
- **Deployment**: Docker & Docker Compose, Nginx (production)

## 🚀 Deploy in Production

### Option 1: Automated Deployment (Recommended) ✅

Deploy to any Linux VM (Ubuntu, Debian, CentOS) with 4GB+ RAM using our deployment script.

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

The script handles everything: prerequisite checks, Docker builds, database setup, migrations, health verification, and shows you all access URLs.

### Option 2: Manual Docker Compose

For users who prefer manual control over each deployment step:

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

Note: This method requires you to manually check prerequisites, wait for services, and verify deployment.

### Migration Health Checks

Before exposing the service in production, verify that database migrations are healthy:

1. Ensure `DATABASE_URL` (and optional shadow DB URLs) are set in the environment.
2. Run `npx prisma migrate status --schema custom-widget/backend/prisma/schema.prisma --json` to confirm no pending migrations.
3. Apply migrations with `npx prisma migrate deploy --schema custom-widget/backend/prisma/schema.prisma`.
4. Re-run `npx prisma migrate status --schema custom-widget/backend/prisma/schema.prisma --human-readable` and confirm the output reports a healthy state.

If any step fails, the backend will now abort startup and mark the latest migration as rolled back so you can intervene safely.

### 🔑 Required Configuration

Edit `.env` file with real values:
```bash
# Essential API Keys
MISTRAL_API_KEY=your-mistral-key               # From mistral.ai
CHROMA_URL=https://api.trychroma.com           # ChromaDB Cloud
CHROMA_TENANT=your-tenant-id
CHROMA_DATABASE=your-database
CHROMA_AUTH_TOKEN=your-auth-token

# Security (generate these)
JWT_SECRET=$(openssl rand -base64 32)          # Generate secure string
JWT_REFRESH_SECRET=$(openssl rand -base64 32)  # Generate another one
ADMIN_RECOVERY_KEY=$(openssl rand -base64 24)  # For password recovery
```

**Get API Keys from:**
- **OpenRouter**: [openrouter.ai](https://openrouter.ai) - Free tier available
- **Mistral**: [mistral.ai](https://mistral.ai) - Free tier available
- **ChromaDB**: [trychroma.com](https://trychroma.com) - Cloud instance required

### VM Requirements
- **Minimum**: 2 vCPUs, 4GB RAM, 20GB SSD (~$20-40/month)
- **Recommended**: 4 vCPUs, 8GB RAM, 40GB SSD (~$40-80/month)
- **Providers**: DigitalOcean, Linode, AWS EC2, Hetzner, Google Cloud

### Post-Deployment Access
- **Health Dashboard**: `http://your-vm-ip:3002/health-dashboard.html`
- **Agent Dashboard**: `http://your-vm-ip:3002/agent-dashboard.html`
- **Admin Settings**: `http://your-vm-ip:3002/settings.html`
- **Default Login**: admin@vilnius.lt / admin123 (change immediately!)

### Production Checklist
- [ ] Changed admin password from default
- [ ] Configured all API keys (OpenRouter, Mistral, ChromaDB)
- [ ] Set strong JWT secrets (32+ characters)
- [ ] Tested AI responses in chat widget
- [ ] Uploaded knowledge base documents
- [ ] Verified health dashboard shows all green

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

---
