# Server Control Guide

## 🚀 **Starting the Server**

```bash
# Start server (keeps terminal open)
npm start

# Start in background
npm start &

# Development mode with auto-reload
npm run dev
```

## ⏹️ **Stopping the Server**

### **Method 1: Force Kill (Recommended)**
```bash
# Kill all Node server processes
pkill -f "node server.js"

# Or find specific process and kill
ps aux | grep "node server.js"
kill -9 [PID]
```

### **Method 2: Graceful Shutdown (if server responds)**
```bash
# If running in foreground
Ctrl + C

# Send termination signal
kill [PID]
```

### **Method 3: Kill by Port**
```bash
# Find what's using port 3002
lsof -i :3002

# Kill process using port 3002
lsof -ti:3002 | xargs kill -9
```

## 🔧 **Quick Commands**

```bash
# Start server
npm start

# Stop server (force)
pkill -f "node server.js"

# Restart server
pkill -f "node server.js" && npm start

# Check if running
curl http://localhost:3002/health
```

## 🐛 **If Server Won't Stop**

The graceful shutdown may hang due to WebSocket connections. Use:

```bash
# Force kill (works immediately)
pkill -9 -f "node server.js"

# Or kill by port
sudo lsof -ti:3002 | xargs kill -9
```

## 📊 **Server Status**

```bash
# Check if server is running
ps aux | grep "node server.js"

# Check port usage
netstat -tulpn | grep :3002

# Test server response
curl http://localhost:3002/health
```

## ⚡ **One-Line Commands**

```bash
# Start
npm start

# Stop  
pkill -f "node server.js"

# Restart
pkill -f "node server.js" && npm start

# Status
curl -s http://localhost:3002/health | jq '.status'
```

The `pkill -f "node server.js"` command is the most reliable way to stop the server.