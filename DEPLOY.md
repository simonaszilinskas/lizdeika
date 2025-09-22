# 🚀 Vilnius Assistant - Deployment Guide

Deploy the Vilnius Assistant AI customer support platform in under 5 minutes with full functionality and transparency.

## ⚡ Quick Start

### 🐳 VM Deployment (Docker)

**Prerequisites**: Docker & Docker Compose installed

```bash
# 1. Clone and configure
git clone <your-repo-url>
cd vilnius-assistant
git checkout deployment

# 2. Setup environment (one-time)
cp .env.template .env
# Edit .env with your API keys (see Required Configuration below)

# 3. Deploy with one command
./scripts/deploy.sh production
```

**Result**: Fully functional system at `http://localhost:3002` in ~3 minutes

### 🚂 Railway Deployment

**Prerequisites**: Railway CLI installed & logged in

```bash
# 1. Clone and setup
git clone <your-repo-url>
cd vilnius-assistant
git checkout deployment

# 2. Deploy with Railway
./scripts/railway-deploy.sh setup     # One-time setup
./scripts/railway-deploy.sh deploy    # Deploy application
```

**Result**: Production-ready system with auto-generated domain in ~5 minutes

## 📋 Required Configuration

### 🔑 Essential API Keys

| Service | Variable | Where to Get | Required |
|---------|----------|--------------|----------|
| **OpenRouter** | `OPENROUTER_API_KEY` | [openrouter.ai](https://openrouter.ai) | ✅ Yes |
| **Mistral** | `MISTRAL_API_KEY` | [mistral.ai](https://mistral.ai) | ✅ Yes |
| **ChromaDB** | `CHROMA_URL`, `CHROMA_TENANT`, `CHROMA_DATABASE`, `CHROMA_AUTH_TOKEN` | [trychroma.com](https://trychroma.com) | ✅ Yes |

### 🔒 Security Settings

| Variable | Purpose | Example |
|----------|---------|---------|
| `JWT_SECRET` | User authentication | Generate 32+ char random string |
| `JWT_REFRESH_SECRET` | Token refresh | Generate 32+ char random string |
| `ADMIN_RECOVERY_KEY` | Admin password reset | Generate 24+ char random string |

### ⚙️ Optional Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `LANGFUSE_PUBLIC_KEY` | - | AI monitoring and analytics |
| `WIDGET_PRIMARY_COLOR` | `#2c5530` | Brand color for chat widget |
| `WIDGET_ALLOWED_DOMAINS` | `*` | Restrict widget embedding |

## 🎯 Deployment Options

### Development Deployment
```bash
./scripts/deploy.sh development
```
- Hot reload enabled
- Debug logging
- Development database
- Accessible at `http://localhost:3002`

### Production Deployment
```bash
./scripts/deploy.sh production
```
- Optimized builds
- SSL/Nginx reverse proxy
- Production database with backups
- Resource limits and monitoring

### Railway (Cloud)
```bash
./scripts/railway-deploy.sh deploy
```
- Auto-scaling
- Managed PostgreSQL
- Custom domains
- Built-in monitoring

## 🩺 Health Verification

After deployment, verify everything works:

1. **Health Dashboard**: `http://your-domain/health-dashboard.html`
   - Real-time status of all services
   - AI provider connectivity
   - Database health
   - Vector database status

2. **Quick Test**:
   ```bash
   curl http://your-domain/health
   # Should return: {"status":"healthy","timestamp":"..."}
   ```

3. **Application Access**:
   - 👨‍💼 **Agent Dashboard**: `/agent-dashboard.html`
   - ⚙️ **Admin Settings**: `/settings.html`
   - 💬 **Widget Demo**: `/embed-widget.html`
   - 🔑 **Login**: `/login.html`

## 🔧 Troubleshooting

### Common Issues

**Port 3002 in use**:
```bash
# Find and kill conflicting process
lsof -i :3002
kill -9 <PID>
```

**Docker build fails**:
```bash
# Clean Docker cache
docker system prune -a
./scripts/deploy.sh production
```

**Environment variables not loading**:
```bash
# Verify .env file exists and has correct values
cat .env | grep API_KEY
```

**Database connection fails**:
```bash
# Check database logs
docker-compose logs postgres
# Reset database
docker-compose down -v && ./scripts/deploy.sh production
```

### Getting Help

**View application logs**:
```bash
# Docker deployment
docker-compose logs -f backend

# Railway deployment
railway logs --tail
```

**Access database**:
```bash
# Docker
docker-compose exec postgres psql -U vilnius_user -d vilnius_support

# Railway
railway shell
```

**Test API endpoints**:
```bash
# Health check
curl http://localhost:3002/health

# Test AI provider
curl -X POST http://localhost:3002/api/admin/ai-test \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json"
```

## 🎉 Default Credentials

**Admin Access**:
- Email: `admin@vilnius.lt`
- Password: `admin123`

⚠️ **Change these immediately in production!**

## 📊 Production Checklist

Before going live:

- [ ] Update admin credentials
- [ ] Configure `WIDGET_ALLOWED_DOMAINS` to specific domains
- [ ] Set up SSL certificates (handled automatically by Railway)
- [ ] Configure backup strategy for database
- [ ] Set up monitoring alerts
- [ ] Test all AI providers and knowledge base
- [ ] Verify file upload functionality
- [ ] Test WebSocket connections

## 🔄 Updates & Maintenance

**Deploy updates**:
```bash
git pull origin deployment
./scripts/deploy.sh production  # VM
# OR
railway up  # Railway
```

**Database migrations**:
```bash
# Handled automatically during deployment
# Manual migration if needed:
docker-compose exec backend npx prisma migrate deploy
```

**Backup database**:
```bash
# Docker
docker-compose exec postgres pg_dump -U vilnius_user vilnius_support > backup.sql

# Railway
railway run pg_dump $DATABASE_URL > backup.sql
```

---

## 🎯 What You Get

✅ **Full AI Customer Support Platform**
- 20 concurrent agents
- Real-time chat with WebSocket
- AI-powered response suggestions
- Document knowledge base with RAG
- Admin dashboard and user management

✅ **Production-Ready Features**
- JWT authentication with refresh tokens
- Role-based access control
- File upload and processing
- Comprehensive logging and monitoring
- Database migrations and seeding

✅ **Transparent Deployment**
- Health dashboard showing all service status
- One-command deployment scripts
- Pre-flight checks and validation
- Detailed error reporting and logs

---

🔗 **Next Steps**: Visit `/health-dashboard.html` after deployment to verify all systems are operational!