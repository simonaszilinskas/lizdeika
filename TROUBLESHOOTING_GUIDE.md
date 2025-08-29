# Troubleshooting Guide

## Overview
This guide helps diagnose and resolve common issues with the Vilnius Assistant support system.

## Quick Diagnostic Commands

### System Health Check
```bash
# Check all services
npm test                                    # Run backend tests
curl http://localhost:3001/api/health      # Backend health
curl http://localhost:3001/api/system/status # System status

# Check processes
pm2 status                                 # PM2 processes
ps aux | grep node                         # Node processes
systemctl status postgresql               # Database
```

### Database Health
```bash
# Database connection
PGUSER=simonaszilinskas PGHOST=localhost PGPORT=5432 PGDATABASE=vilnius_support psql -c "SELECT 1;"

# Check active connections
PGUSER=simonaszilinskas PGHOST=localhost PGPORT=5432 PGDATABASE=vilnius_support psql -c "SELECT COUNT(*) FROM pg_stat_activity;"

# Check agent and admin users
PGUSER=simonaszilinskas PGHOST=localhost PGPORT=5432 PGDATABASE=vilnius_support psql -c "SELECT email, role, is_active FROM users WHERE role IN ('admin', 'agent');"
```

## Common Issues & Solutions

### 1. WebSocket Connection Problems

#### Symptoms
- New conversations don't appear in real-time
- Agent status not updating
- "Connection failed" messages in console

#### Diagnosis
```bash
# Check WebSocket server
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:3001/socket.io/

# Browser console check
# Look for ModernWebSocketManager logs:
# "🔧 ModernWebSocketManager initialized"
# "✅ Connected to WebSocket server"
# "📨 Received new-conversation"
```

#### Solutions
```javascript
// 1. Verify event forwarding in ModernWebSocketManager
const appEvents = [
    'new-message',
    'new-conversation',  // Must be present!
    'connected-agents-update', 
    'system-mode-update',
    'tickets-reassigned',
    'customer-typing-status'
];

// 2. Check agent dashboard event handler
this.websocketManager.on('new-conversation', (data) => {
    console.log('🆕 New conversation created:', data);
    this.loadConversations(); // Should trigger
});
```

### 2. Authentication Issues

#### Symptoms
- "Invalid credentials" with correct password
- JWT token expired frequently
- Login redirects to login page

#### Diagnosis
```bash
# Check user accounts
PGUSER=simonaszilinskas PGHOST=localhost PGPORT=5432 PGDATABASE=vilnius_support psql -c "SELECT email, role, is_active, password_hash FROM users WHERE email = 'admin@vilnius.lt';"

# Test login endpoint
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vilnius.lt","password":"Admin123!"}'
```

#### Solutions
```bash
# 1. Reset admin password
ADMIN_RECOVERY_KEY="test-recovery-key" node admin-recovery.js recover \
  --email admin@vilnius.lt \
  --password "Admin123!"

# 2. Create new admin if needed
ADMIN_RECOVERY_KEY="test-recovery-key" node admin-recovery.js create \
  --email admin@vilnius.lt \
  --password "Admin123!" \
  --first-name Admin \
  --last-name User

# 3. Activate user account
PGUSER=simonaszilinskas PGHOST=localhost PGPORT=5432 PGDATABASE=vilnius_support psql -c "UPDATE users SET is_active = true WHERE email = 'admin@vilnius.lt';"
```

### 3. Database Connection Issues

#### Symptoms
- "Connection refused" errors
- Prisma client errors
- Application crashes with database errors

#### Diagnosis
```bash
# Test direct connection
psql -U simonaszilinskas -h localhost -d vilnius_support -c "SELECT version();"

# Check PostgreSQL status
systemctl status postgresql

# Check connection limits
PGUSER=simonaszilinskas PGHOST=localhost PGPORT=5432 PGDATABASE=vilnius_support psql -c "SELECT setting FROM pg_settings WHERE name = 'max_connections';"
```

#### Solutions
```bash
# 1. Restart PostgreSQL
sudo systemctl restart postgresql

# 2. Check database exists
sudo -u postgres psql -c "SELECT datname FROM pg_database WHERE datname = 'vilnius_support';"

# 3. Fix permissions if needed
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE vilnius_support TO simonaszilinskas;"

# 4. Reset schema if corrupted
cd custom-widget/backend
npx prisma db push --force-reset
npx prisma db push
```

### 4. Real-time Updates Not Working

#### Symptoms
- New conversations require page refresh
- Agent status changes not visible
- Messages don't appear immediately

#### Diagnosis
```javascript
// In browser console (agent dashboard)
// Check if WebSocket manager is receiving events
console.log('WebSocket Status:', window.agentDashboard?.websocketManager?.getConnectionStatus());

// Monitor events
['new-conversation', 'new-message', 'connected-agents-update'].forEach(event => {
    window.agentDashboard?.websocketManager?.on(event, data => {
        console.log(`📨 ${event}:`, data);
    });
});
```

#### Solutions
```bash
# 1. Test event creation manually
curl -X POST http://localhost:3001/api/widget/conversation \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message for real-time"}'

# 2. Check server logs for event emission
# Should see: "🆕 New conversation created, notifying agents"

# 3. Verify agent is in WebSocket room
# Check server logs: "Agent {agentId} connected with socket {socketId}"
```

### 5. Performance Issues

#### Symptoms
- Slow page loads
- High memory usage
- Database queries taking too long

#### Diagnosis
```bash
# System resources
free -h
df -h
top -p $(pgrep node)

# Database performance
PGUSER=simonaszilinskas PGHOST=localhost PGPORT=5432 PGDATABASE=vilnius_support psql -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Application memory
pm2 monit  # If using PM2
```

#### Solutions
```bash
# 1. Clear old data
PGUSER=simonaszilinskas PGHOST=localhost PGPORT=5432 PGDATABASE=vilnius_support psql -c "DELETE FROM messages WHERE created_at < NOW() - INTERVAL '90 days';"

# 2. Restart application
pm2 restart all

# 3. Optimize database
PGUSER=simonaszilinskas PGHOST=localhost PGPORT=5432 PGDATABASE=vilnius_support psql -c "VACUUM ANALYZE;"

# 4. Check for memory leaks in browser
# Use Chrome DevTools -> Memory tab
```

### 6. Agent Status Issues

#### Symptoms
- Agents show offline when online
- Status not updating
- AFK detection not working

#### Diagnosis
```bash
# Check agent status in database
PGUSER=simonaszilinskas PGHOST=localhost PGPORT=5432 PGDATABASE=vilnius_support psql -c "SELECT u.email, a.status, a.updated_at, (NOW() - a.updated_at) as age FROM users u LEFT JOIN agent_status a ON u.id = a.user_id WHERE u.role IN ('admin', 'agent');"

# Check WebSocket connections
# In browser console: look for "💓 Emitting heartbeat" logs
```

#### Solutions
```bash
# 1. Force agent status update
PGUSER=simonaszilinskas PGHOST=localhost PGPORT=5432 PGDATABASE=vilnius_support psql -c "UPDATE agent_status SET updated_at = NOW() WHERE user_id = 'your-agent-id';"

# 2. Create missing agent status
PGUSER=simonaszilinskas PGHOST=localhost PGPORT=5432 PGDATABASE=vilnius_support psql -c "INSERT INTO agent_status (id, user_id, status, updated_at) VALUES ('status-id', 'agent-id', 'online', NOW()) ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW();"

# 3. Check heartbeat system
# Verify ModernWebSocketManager sends heartbeat every 15 seconds
```

## Error Code Reference

### HTTP Status Codes

#### 401 Unauthorized
- **Cause**: Invalid or expired JWT token
- **Solution**: Re-login or check token expiration
- **Prevention**: Implement token refresh

#### 403 Forbidden
- **Cause**: User lacks permission for operation
- **Solution**: Check user role and permissions
- **Prevention**: Proper role-based access control

#### 404 Not Found
- **Cause**: Resource doesn't exist (conversation, user, etc.)
- **Solution**: Verify resource IDs and existence
- **Prevention**: Better error handling and validation

#### 500 Internal Server Error
- **Cause**: Database connection, code bugs, or system issues
- **Solution**: Check server logs and database connectivity
- **Prevention**: Comprehensive error handling and monitoring

### WebSocket Error Codes

#### Connection Refused
- **Cause**: Server not running or port blocked
- **Solution**: Check server status and firewall
- **Prevention**: Health monitoring and alerting

#### Circuit Breaker Open
- **Cause**: Too many WebSocket errors (3+ failures)
- **Solution**: Fix underlying WebSocket issues and restart
- **Prevention**: Improve error handling and connection stability

## Logging & Debugging

### Enable Debug Logging

#### Backend Debugging
```javascript
// In websocketService.js - already enabled
console.log('🆕 New conversation created, notifying agents:', conversationId);
console.log('🐛 Socket ${socket.id} registered listener for: ${event}');
```

#### Frontend Debugging
```javascript
// In browser console
localStorage.setItem('debug', 'websocket,dashboard');

// Enable ModernWebSocketManager verbose logging
const wsManager = new ModernWebSocketManager({
    logger: console, // Full logging
    agentId: 'your-agent-id'
});
```

### Log File Locations
```bash
# Application logs (if using PM2)
tail -f ~/.pm2/logs/vilnius-assistant-backend-out.log
tail -f ~/.pm2/logs/vilnius-assistant-backend-error.log

# Database logs
tail -f /var/log/postgresql/postgresql-13-main.log

# System logs
journalctl -u vilnius-assistant -f
```

## Data Recovery

### Database Recovery
```bash
# Restore from backup
pg_dump vilnius_support > backup_before_recovery.sql
psql vilnius_support < your_backup_file.sql

# Partial data recovery
PGUSER=simonaszilinskas PGHOST=localhost PGPORT=5432 PGDATABASE=vilnius_support psql -c "SELECT COUNT(*) FROM tickets;"
```

### Clean Database Reset (DANGEROUS)
```bash
# Complete reset - USE CAREFULLY
PGUSER=simonaszilinskas PGHOST=localhost PGPORT=5432 PGDATABASE=vilnius_support psql -c "
BEGIN;
DELETE FROM messages;
DELETE FROM ticket_actions;
DELETE FROM tickets;
-- Keep users table intact
COMMIT;
"
```

## Emergency Procedures

### Complete System Reset
```bash
# 1. Stop services
pm2 stop all

# 2. Backup current state
pg_dump vilnius_support > emergency_backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Reset database
cd custom-widget/backend
npx prisma db push --force-reset
npx prisma db push

# 4. Create admin user
ADMIN_RECOVERY_KEY="test-recovery-key" node admin-recovery.js create \
  --email admin@vilnius.lt \
  --password "Admin123!" \
  --first-name Admin \
  --last-name User

# 5. Start services
pm2 start all
```

### Network Connectivity Issues
```bash
# Check ports
netstat -tlnp | grep :3001
netstat -tlnp | grep :5432

# Test internal connectivity
curl http://localhost:3001/api/health
telnet localhost 5432
```

## Contact Support

### Information to Collect
When reporting issues, collect:

```bash
# System info
uname -a
node --version
npm --version
pm2 --version

# Service status
pm2 status
systemctl status postgresql

# Recent logs
pm2 logs --lines 50

# Database status
PGUSER=simonaszilinskas PGHOST=localhost PGPORT=5432 PGDATABASE=vilnius_support psql -c "SELECT COUNT(*) FROM users WHERE role IN ('admin', 'agent');"
```

### Error Reporting Template
```
**Issue Description:**
[Brief description of the problem]

**Steps to Reproduce:**
1. [First step]
2. [Second step]
3. [Error occurs]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**System Information:**
- Node.js version: [version]
- Database: [PostgreSQL version]
- Browser: [if frontend issue]

**Logs:**
[Relevant log excerpts]

**Screenshots:**
[If applicable]
```

## Prevention Best Practices

### Regular Maintenance
```bash
# Weekly health check script
#!/bin/bash
echo "=== Weekly Health Check ===" >> /var/log/vilnius-health.log
date >> /var/log/vilnius-health.log

# Check services
pm2 status >> /var/log/vilnius-health.log 2>&1
systemctl status postgresql >> /var/log/vilnius-health.log 2>&1

# Check database
PGUSER=simonaszilinskas PGHOST=localhost PGPORT=5432 PGDATABASE=vilnius_support psql -c "SELECT 'DB OK';" >> /var/log/vilnius-health.log 2>&1

# Check disk space
df -h >> /var/log/vilnius-health.log 2>&1

echo "=== End Health Check ===" >> /var/log/vilnius-health.log
```

### Monitoring Alerts
Set up monitoring for:
- Application uptime
- Database connectivity
- WebSocket connection count
- Memory usage
- Disk space
- Error rates

This troubleshooting guide should help resolve most common issues. For complex problems, collect diagnostic information and seek additional support.