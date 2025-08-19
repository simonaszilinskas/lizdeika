# 🚀 Super Simple Development Setup

## One-Time Setup (2 minutes)

```bash
# 1. Clone and install
cd /Users/simonaszilinskas/vilnius-assistant/custom-widget
cd backend && npm install

# 2. Start server
npm run dev
```

**That's it! No database, no Docker, no complexity:**
- ✅ Server starts on http://localhost:3002
- ✅ Agent login ready: `admin@vilnius.lt / admin123`
- ✅ All AI chat functionality preserved
- ✅ Simple user management system active

## 🧪 How to Use

### **Agent/Admin Login**
**Main Interface**: http://localhost:3002/agent-login.html

### **Demo Credentials**
- **Admin**: `admin@vilnius.lt / admin123` (can create users)
- **Agent**: `agent1@vilnius.lt / agent123` (standard access)

### **Create New Users**
1. Login as admin
2. Click "Manage Users" red button
3. Fill details, generate password
4. Copy credentials to share with user

## 🎮 System Features

### **Original AI System (Preserved)**
- ✅ Real-time customer chat with AI
- ✅ RAG knowledge base integration
- ✅ WebSocket communication
- ✅ Agent dashboard with conversation monitoring
- ✅ AI-powered response suggestions

### **New Admin System**
- ✅ Simple login for agents/admins
- ✅ User creation and management
- ✅ Role-based access control
- ✅ Secure password generation
- ✅ Clean logout functionality

## 🔄 Daily Development

```bash
# Start everything (one command)
npm run dev
```

**Your complete system is running!**
- Customer chat: http://localhost:3002/
- Agent login: http://localhost:3002/agent-login.html
- Live monitoring: http://localhost:3002/admin.html

## 🔧 What's Different from Complex Systems

### **Removed Complexity**
- ❌ No PostgreSQL setup needed
- ❌ No Docker containers
- ❌ No database migrations
- ❌ No complex authentication flows
- ❌ No invitation system with emails

### **Simple & Effective**
- ✅ In-memory user storage (easily upgradeable)
- ✅ Direct credential sharing
- ✅ Iframe-based integration
- ✅ Immediate functionality
- ✅ Maintainable codebase

**Perfect for your needs: simple, secure, and working! 🎉**