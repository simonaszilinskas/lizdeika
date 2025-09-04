# Deployment Guide

## Overview
This guide covers deploying the Vilnius Assistant support system to production, including database setup, environment configuration, and monitoring.

## 🐳 Docker Deployment (Recommended)

### Prerequisites
- **Docker** and **Docker Compose**
- **SSL certificate** for HTTPS
- **Domain name** configured

### Production Deployment Steps

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

## 🔧 Traditional Deployment (Alternative)

### Prerequisites
- **Node.js**: v18+ 
- **PostgreSQL**: v13+
- **NPM**: v8+
- **PM2**: For process management (recommended)

### Domain/Hosting Requirements
- Web server (nginx recommended)
- SSL certificate for HTTPS
- WebSocket support
- Static file serving capability

## Environment Setup

### 1. Database Configuration

#### PostgreSQL Setup
```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE vilnius_support;
CREATE USER vilnius_admin WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE vilnius_support TO vilnius_admin;
\q
```

#### Database Initialization
```bash
# Navigate to backend directory
cd custom-widget/backend

# Set database URL
export DATABASE_URL="postgresql://vilnius_admin:your-secure-password@localhost:5432/vilnius_support"

# Install dependencies
npm install

# Initialize database schema
npx prisma db push

# Optional: Seed initial data
node prisma/seed.js
```

### 2. Backend Configuration

#### Environment Variables
Create `custom-widget/backend/.env`:
```env
# Database
DATABASE_URL="postgresql://vilnius_admin:your-secure-password@localhost:5432/vilnius_support"

# JWT Security
JWT_SECRET="your-super-secure-jwt-secret-key-here"

# Server Configuration
PORT=3001
NODE_ENV=production

# CORS Origins (your frontend domains)
CORS_ORIGIN="https://yourdomain.com,https://www.yourdomain.com"

# Optional: Langfuse Integration
LANGFUSE_SECRET_KEY="your-langfuse-secret"
LANGFUSE_PUBLIC_KEY="your-langfuse-public"
LANGFUSE_BASE_URL="https://cloud.langfuse.com"

# Optional: AI Provider Configuration
AI_PROVIDER="openai"
OPENAI_API_KEY="your-openai-api-key"

# Admin Recovery (for emergency admin account creation)
ADMIN_RECOVERY_KEY="your-recovery-key"
```

#### Production Admin Setup
```bash
# Create initial admin user
ADMIN_RECOVERY_KEY="your-recovery-key" node admin-recovery.js create \
  --email admin@yourdomain.com \
  --password "SecurePassword123!" \
  --first-name Admin \
  --last-name User
```

### 3. Frontend Configuration

#### Update Frontend URLs
Edit `custom-widget/js/settings.js`:
```javascript
// Update API endpoints
const API_BASE = 'https://api.yourdomain.com'; // Your backend URL
const WEBSOCKET_URL = 'wss://api.yourdomain.com'; // WebSocket URL
```

#### Build Frontend Assets
```bash
# Minify CSS and JavaScript for production
# This step depends on your build process
npm run build # If you have a build script
```

### 4. Web Server Configuration

#### Nginx Configuration
Create `/etc/nginx/sites-available/vilnius-assistant`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # Frontend files
    root /path/to/vilnius-assistant/custom-widget;
    index agent-dashboard.html;
    
    # API Backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket Support
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files
    location / {
        try_files $uri $uri/ =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/vilnius-assistant /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Process Management

### Using PM2 (Recommended)

#### Install PM2
```bash
npm install -g pm2
```

#### PM2 Ecosystem Configuration
Create `custom-widget/backend/ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'vilnius-assistant-backend',
    script: 'server.js',
    cwd: '/path/to/vilnius-assistant/custom-widget/backend',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    restart_delay: 5000
  }]
};
```

#### Start Application
```bash
# Start with PM2
cd custom-widget/backend
pm2 start ecosystem.config.js

# Enable startup on boot
pm2 startup
pm2 save
```

### Using Systemd (Alternative)

Create `/etc/systemd/system/vilnius-assistant.service`:
```ini
[Unit]
Description=Vilnius Assistant Backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/vilnius-assistant/custom-widget/backend
Environment=NODE_ENV=production
Environment=PORT=3001
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable vilnius-assistant
sudo systemctl start vilnius-assistant
sudo systemctl status vilnius-assistant
```

## Monitoring & Logging

### Log Files Locations
- **PM2 Logs**: `custom-widget/backend/logs/`
- **Nginx Logs**: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- **PostgreSQL Logs**: `/var/log/postgresql/`

### Health Check Endpoints
```bash
# Backend health check
curl https://api.yourdomain.com/api/health

# Database connection check
curl https://api.yourdomain.com/api/system/status
```

### Performance Monitoring
```bash
# PM2 monitoring
pm2 monit

# System resources
htop
iotop
free -h
df -h

# PostgreSQL monitoring
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

## Backup Strategy

### Database Backups
```bash
#!/bin/bash
# Daily backup script
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/vilnius-assistant"
mkdir -p $BACKUP_DIR

pg_dump -U vilnius_admin -h localhost vilnius_support > \
  "$BACKUP_DIR/vilnius_support_$DATE.sql"

# Keep last 7 days of backups
find $BACKUP_DIR -name "vilnius_support_*.sql" -mtime +7 -delete
```

Add to crontab:
```bash
crontab -e
# Add: 0 2 * * * /path/to/backup-script.sh
```

### File Backups
- Application code (via Git)
- Configuration files
- Uploaded documents (if any)
- SSL certificates

## SSL Certificate Management

### Let's Encrypt (Recommended)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal (already configured by certbot)
sudo systemctl status certbot.timer
```

## Security Considerations

### Firewall Configuration
```bash
# UFW Configuration
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 5432 # PostgreSQL (only from localhost)
sudo ufw enable
```

### Database Security
```sql
-- Revoke unnecessary permissions
REVOKE ALL ON DATABASE vilnius_support FROM public;

-- Limit connections
ALTER DATABASE vilnius_support CONNECTION LIMIT 50;

-- Enable SSL
-- ssl = on in postgresql.conf
```

### Application Security
- Regular security updates
- Strong JWT secret rotation
- Rate limiting (consider nginx rate limiting)
- SQL injection protection (Prisma provides this)
- XSS protection headers (configured in nginx)

## Troubleshooting

### Common Issues

#### WebSocket Connection Failures
```bash
# Check port binding
netstat -tlnp | grep 3001

# Check nginx WebSocket config
sudo nginx -t
```

#### Database Connection Issues
```bash
# Test database connection
psql -U vilnius_admin -h localhost -d vilnius_support

# Check PostgreSQL service
sudo systemctl status postgresql
```

#### Performance Issues
```bash
# Check application logs
pm2 logs vilnius-assistant-backend

# Monitor resources
pm2 monit
```

### Rollback Procedures

#### Application Rollback
```bash
# With PM2
pm2 stop vilnius-assistant-backend
# Deploy previous version
pm2 start ecosystem.config.js

# Database rollback (if needed)
psql -U vilnius_admin -d vilnius_support < backup_file.sql
```

## Maintenance

### Regular Maintenance Tasks
- [ ] Weekly: Review application logs
- [ ] Weekly: Check disk space and cleanup old logs
- [ ] Monthly: Update system packages
- [ ] Monthly: Review database performance
- [ ] Quarterly: Security audit
- [ ] Quarterly: Backup restoration test

### Update Procedures
1. Test updates in staging environment
2. Create database backup
3. Deploy code updates
4. Run database migrations if needed
5. Restart application
6. Verify functionality
7. Monitor for issues

## Production Checklist

### Pre-deployment
- [ ] Environment variables configured
- [ ] Database initialized and seeded
- [ ] SSL certificates installed
- [ ] Nginx configuration tested
- [ ] Firewall configured
- [ ] Backup system configured
- [ ] Monitoring system active

### Post-deployment
- [ ] Health checks passing
- [ ] WebSocket connections working
- [ ] Admin login functional
- [ ] Agent dashboard accessible
- [ ] Customer widget responsive
- [ ] Real-time features working
- [ ] Logs being written correctly

### Performance Validation
- [ ] Page load times < 2 seconds
- [ ] WebSocket connection established < 1 second
- [ ] Database queries performant
- [ ] Memory usage stable
- [ ] No memory leaks detected