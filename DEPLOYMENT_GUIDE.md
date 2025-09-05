# 🚀 Complete Deployment Guide - Push to Railway in 5 Minutes

This guide shows you how to set up **automatic deployment** from GitHub to Railway with GitHub Actions.

## 📋 Prerequisites

- [ ] GitHub account
- [ ] Railway account (free tier available)
- [ ] This repository cloned to your GitHub
- [ ] OpenRouter API key (get from [openrouter.ai](https://openrouter.ai))

## ⚡ Quick Setup (5 minutes)

### 1. 🎯 Setup Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Create new project
railway init --name vilnius-assistant
```

### 2. 🔐 Configure Environment Variables

```bash
# Add your environment variables
railway variables set OPENROUTER_API_KEY="your-openrouter-key-here"
railway variables set JWT_SECRET="your-super-secure-jwt-secret"
railway variables set JWT_REFRESH_SECRET="your-refresh-secret"
railway variables set ADMIN_RECOVERY_KEY="admin-recovery-key"
```

**Required Variables:**
```bash
# Core API
OPENROUTER_API_KEY=your-openrouter-api-key

# Authentication
JWT_SECRET=your-super-secure-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
ADMIN_RECOVERY_KEY=admin-recovery-key

# Optional but recommended
DATABASE_URL=railway-will-provide-this
NODE_ENV=production
PORT=3002
```

### 3. 🔗 Connect GitHub Repository

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub"**
4. Choose your repository
5. Railway will automatically detect the configuration

### 4. 🚀 Deploy First Version

```bash
# Deploy manually first time
railway up

# Or let GitHub Actions handle it automatically
```

## 🤖 GitHub Actions Automatic Deployment

### How It Works

1. **Push code** → GitHub
2. **Tests run** → GitHub Actions
3. **Deploy** → Railway (if tests pass)
4. **Live** → Your app is updated automatically

### Setup GitHub Secrets

Go to your GitHub repository → Settings → Secrets → Actions → New repository secret:

```bash
# Required
RAILWAY_TOKEN=your-railway-token

# Optional - for better security
OPENROUTER_API_KEY=your-openrouter-key
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
ADMIN_RECOVERY_KEY=admin-recovery-key
```

**Get your Railway token:**
```bash
railway login
railway tokens
```

### Workflow Overview

The GitHub Actions workflow (`.github/workflows/deploy-railway.yml`) does:

1. **Test Phase**:
   - Installs dependencies
   - Runs tests
   - Runs linting
   - Only continues if all pass

2. **Deploy Phase**:
   - Installs Railway CLI
   - Deploys backend to Railway
   - Deploys frontend files
   - Only runs on main/master branch

## 🎯 Railway Configuration

### Railway.toml Explained

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile.railway"  # Optimized for Railway

[deploy]
startCommand = "node server.js"
healthcheckPath = "/health"            # Health check endpoint
healthcheckTimeout = 300               # 5 minutes timeout
restartPolicyType = "ON_FAILURE"       # Auto-restart on failure
restartPolicyMaxRetries = 3            # Max 3 restart attempts
```

### Dockerfile.railway Features

- **Production-optimized** Node.js 18 Alpine
- **Multi-stage build** for smaller image size
- **Health checks** for reliability
- **Non-root user** for security
- **Prisma client** generation included

## 🔄 Development Workflow

### Local Development
```bash
# Local development with hot reload
docker-compose up

# Access at http://localhost:3002
```

### Push to Production
```bash
# Make your changes
git add .
git commit -m "Your changes"
git push origin main

# GitHub Actions will automatically:
# 1. Run tests
# 2. Deploy to Railway
# 3. Update live site
```

### Monitor Deployment
```bash
# Check Railway logs
railway logs

# Check deployment status
railway status

# View live URL
railway open
```

## 🚨 Common Issues & Solutions

### Railway Token Issues
```bash
# Regenerate token if needed
railway tokens --generate

# List your tokens
railway tokens
```

### Deployment Fails
```bash
# Check Railway logs
railway logs --tail 100

# Check build logs
railway logs --build

# Redeploy manually
railway up
```

### Environment Variables Missing
```bash
# List current variables
railway variables

# Add missing variable
railway variables set VARIABLE_NAME="value"
```

## 🎨 Customization Options

### Change Deployment Branch
Edit `.github/workflows/deploy-railway.yml`:
```yaml
on:
  push:
    branches: [ main, develop, staging ]  # Add your branches
```

### Add More Tests
Add to the test job in GitHub Actions:
```yaml
- name: Run integration tests
  run: |
    cd custom-widget/backend
    npm run test:integration

- name: Run frontend tests
  run: npm run test:frontend
```

### Multiple Environments
Create separate Railway projects:
```bash
# Production
railway init --name vilnius-assistant-prod

# Staging
railway init --name vilnius-assistant-staging
```

## 📊 Monitoring & Alerts

### Railway Dashboard
- **Live logs**: Monitor application in real-time
- **Metrics**: CPU, memory, request tracking
- **Alerts**: Get notified of issues
- **Domains**: Custom domain setup

### Health Checks
The app includes health check endpoint:
```
GET /health
Response: { "status": "ok", "timestamp": "2024-01-01T00:00:00.000Z" }
```

## 🚀 Advanced Features

### Automatic Rollbacks
If deployment fails, Railway automatically rolls back to previous version.

### Zero-Downtime Deployments
Railway uses blue-green deployment strategy for zero downtime.

### Database Management
Railway provides managed PostgreSQL with:
- Automatic backups
- Point-in-time recovery
- Connection pooling
- Scaling options

## 🎯 Next Steps

1. **Customize** your deployment with environment variables
2. **Set up** custom domain (optional)
3. **Configure** monitoring alerts
4. **Scale** as needed (Railway handles auto-scaling)

## 🔗 Useful Links

- [Railway Documentation](https://docs.railway.app/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vilnius Assistant Repository](https://github.com/simonaszilinskas/vilnius-support)

**🎉 Congratulations!** Your Vilnius Assistant now deploys automatically from GitHub to Railway with every push to main branch.
