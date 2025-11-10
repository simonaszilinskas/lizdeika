# Production Deployment Guide

Quick reference for deploying Lizdeika to production.

## Prerequisites

- Docker & Docker Compose installed
- Domain name (optional, can use IP)
- API keys: OpenRouter, Mistral, ChromaDB

## Quick Deploy

```bash
# 1. Clone and navigate
git clone https://github.com/simonaszilinskas/lizdeika.git
cd lizdeika

# 2. Configure environment
cp .env.template .env
nano .env  # Add your API keys (see below)

# 3. Deploy
docker compose -f docker-compose.prod.yml up -d

# 4. Verify
curl http://localhost/health
```

## Required Environment Variables

Edit `.env` and set these:

```bash
# **CRITICAL**: SITE_URL is REQUIRED in production (app will not start without it)
# Must match your deployed URL (used for AI API HTTP-Referer headers)
SITE_URL=https://yourdomain.com  # or http://your-vps-ip for staging

# Frontend URL (usually same as SITE_URL)
FRONTEND_URL=https://yourdomain.com

# Database (auto-generated password recommended)
DB_PASSWORD=your_secure_random_password_here

# AI Services
OPENROUTER_API_KEY=sk-or-v1-your-key
MISTRAL_API_KEY=your-mistral-key

# Vector Database
CHROMA_URL=https://api.trychroma.com
CHROMA_TENANT=your-tenant-id
CHROMA_DATABASE=your-db-name
CHROMA_API_KEY=your-chroma-key

# Security (auto-generate these)
JWT_SECRET=$(openssl rand -base64 48)
JWT_REFRESH_SECRET=$(openssl rand -base64 48)
TOTP_ENCRYPTION_KEY=$(openssl rand -base64 48)
ADMIN_RECOVERY_KEY=$(openssl rand -base64 32)
```

## SSL/HTTPS Setup (Recommended)

### Option 1: Let's Encrypt (Automatic)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Certificates auto-renew
```

### Option 2: Custom Certificates

Place certificates in `docker/nginx/ssl/`:
- `cert.pem` - Certificate
- `key.pem` - Private key

Then use `docker-compose.prod.yml` (already configured for SSL).

## Access URLs

After deployment:

- **Homepage**: `http://your-domain/`
- **Login**: `http://your-domain/login.html`
- **Agent Dashboard**: `http://your-domain/agent-dashboard.html`
- **Settings**: `http://your-domain/settings.html`
- **API Docs**: `http://your-domain/docs`
- **Health Check**: `http://your-domain/health`

## Post-Deployment

```bash
# Create first admin user (optional - can register via UI)
docker compose -f docker-compose.prod.yml exec backend npm run db:seed

# Default credentials (CHANGE IMMEDIATELY)
# Email: admin@vilnius.lt
# Password: admin123
```

## Management

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart
docker compose -f docker-compose.prod.yml restart

# Stop
docker compose -f docker-compose.prod.yml down

# Update to latest
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Migrating from Previous Versions

### ⚠️ SITE_URL Now Required (v1.1+)

If updating from an older version, you **must** add `SITE_URL` to your `.env` file:

```bash
# 1. Stop containers
docker compose -f docker-compose.prod.yml down

# 2. Add SITE_URL to .env
echo "SITE_URL=https://yourdomain.com" >> .env
# or for staging: SITE_URL=http://your-vps-ip

# 3. Restart
docker compose -f docker-compose.prod.yml up -d
```

**Why is this required?**
- Used for HTTP-Referer headers in AI API calls
- Required by production environment validation
- Ensures URL consistency across the application

**Startup will fail with this error if not set:**
```
Error: Missing critical environment variables: SITE_URL
```

## Backup

```bash
# Database backup
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U vilnius_user vilnius_support > backup-$(date +%Y%m%d).sql

# Restore
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U vilnius_user vilnius_support
```

## Troubleshooting

**Port 80/443 in use?**
```bash
sudo lsof -i :80
sudo systemctl stop apache2  # or nginx, if installed separately
```

**Check logs for errors:**
```bash
docker compose -f docker-compose.prod.yml logs backend --tail=100
```

**Reset everything:**
```bash
docker compose -f docker-compose.prod.yml down -v  # WARNING: Deletes data!
docker compose -f docker-compose.prod.yml up -d --build
```

## Security Checklist

- [ ] **Set `SITE_URL` to your production domain (REQUIRED)**
- [ ] Change default admin password
- [ ] Set strong `DB_PASSWORD`
- [ ] Generate unique JWT secrets
- [ ] Enable SSL/HTTPS
- [ ] Set `WIDGET_ALLOWED_DOMAINS` to specific domains (not `*`)
- [ ] Configure firewall (allow only 80, 443, 22)
- [ ] Regular backups scheduled
- [ ] Keep Docker images updated

## Environment-Specific URLs

All URLs now use `window.location.origin` - automatically adapts to:
- Development: `http://localhost:3002`
- Staging: `http://your-staging-ip`
- Production: `https://yourdomain.com`

No hardcoded URLs - deploy anywhere without code changes.

## Performance Tuning

Adjust in `docker-compose.prod.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 1G  # Increase for high traffic
```

## Support

- Issues: https://github.com/simonaszilinskas/lizdeika/issues
- Docs: See `README.md` and `CLAUDE.md`
