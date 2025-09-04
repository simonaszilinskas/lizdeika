# Docker Deployment Guide

This guide covers running the Vilnius Assistant using Docker containers.

## Quick Start (Development)

1. **Set up environment variables:**
   ```bash
   cp .env.docker .env.docker.local
   # Edit .env.docker.local with your OpenRouter API key
   ```

2. **Start the application:**
   ```bash
   docker-compose up -d
   ```

3. **Access the application:**
   - Main application: http://localhost:3002
   - With nginx: http://localhost (add `--profile with-nginx`)

## Production Deployment

1. **Set up production environment:**
   ```bash
   cp .env.docker .env.docker.prod
   # Configure all production variables in .env.docker.prod
   ```

2. **Deploy to production:**
   ```bash
   docker-compose -f docker-compose.prod.yml --env-file .env.docker.prod up -d
   ```

## Environment Configuration

### Required Variables
- `OPENROUTER_API_KEY`: Your OpenRouter API key

### Production Variables
- `JWT_SECRET`: Secure JWT signing secret
- `JWT_REFRESH_SECRET`: Secure refresh token secret  
- `ADMIN_RECOVERY_KEY`: Admin recovery key
- `DB_PASSWORD`: Secure database password

## Commands

### Development
```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up -d --build
```

### Production
```bash
# Deploy
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop
docker-compose -f docker-compose.prod.yml down

# Update deployment
docker-compose -f docker-compose.prod.yml up -d --build --no-deps backend
```

## Database Management

### Migrations
```bash
# Run migrations
docker-compose exec backend npx prisma migrate deploy

# Generate Prisma client
docker-compose exec backend npx prisma generate

# Reset database (development only)
docker-compose exec backend npx prisma migrate reset
```

### Backup
```bash
# Backup database
docker-compose exec postgres pg_dump -U vilnius_user vilnius_support > backup.sql

# Restore database
docker-compose exec -T postgres psql -U vilnius_user vilnius_support < backup.sql
```

## SSL Configuration (Production)

1. **Add SSL certificates:**
   ```bash
   mkdir -p docker/nginx/ssl
   # Copy your cert.pem and key.pem to docker/nginx/ssl/
   ```

2. **For Let's Encrypt:**
   ```bash
   # Use certbot to generate certificates
   certbot certonly --standalone -d yourdomain.com
   cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem docker/nginx/ssl/cert.pem
   cp /etc/letsencrypt/live/yourdomain.com/privkey.pem docker/nginx/ssl/key.pem
   ```

## Monitoring

### Health Checks
- Backend: http://localhost:3002/health
- Database: Automatic health checks configured

### Logs
```bash
# Application logs
docker-compose logs backend

# Database logs  
docker-compose logs postgres

# Nginx logs
docker-compose logs nginx
```

## Troubleshooting

### Common Issues

1. **Database connection errors:**
   ```bash
   # Check database is running
   docker-compose ps postgres
   
   # Check logs
   docker-compose logs postgres
   ```

2. **Port conflicts:**
   ```bash
   # Change ports in docker-compose.yml
   ports:
     - "3003:3002"  # Use different host port
   ```

3. **Permission issues:**
   ```bash
   # Fix file permissions
   sudo chown -R $USER:$USER ./custom-widget
   ```

## Security Considerations

- Change default JWT secrets in production
- Use strong database passwords
- Configure proper firewall rules
- Enable SSL/TLS in production
- Regularly update Docker images
- Monitor logs for suspicious activity

## Scaling

For high-traffic environments:

```bash
# Scale backend instances
docker-compose up -d --scale backend=3

# Use external load balancer
# Configure nginx upstream for multiple backends
```