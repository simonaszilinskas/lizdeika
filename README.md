# Vilnius Assistant - AI Customer Support Platform

> **Phase 3 Complete**: A production-ready customer support platform with AI-powered assistance, user management, and RAG capabilities for Vilnius city.

**Current Status**: ✅ PostgreSQL database, JWT authentication, dual AI providers (OpenRouter + Flowise), document RAG with Chroma DB, automatic ticket assignment for 20 agents supporting 16,000+ conversations annually.

## 📚 Documentation

| Document | Purpose |
|----------|----------|
| **[Developer Guide](./custom-widget/DEVELOPER_GUIDE.md)** | Complete setup and development guide |
| **[API Documentation](./custom-widget/API_GUIDE.md)** | REST API reference (also at `/docs`) |
| **[System Architecture](./custom-widget/ARCHITECTURE.md)** | Technical architecture and diagrams |
| **[File Structure](./custom-widget/FILE_GUIDE.md)** | Complete file overview |
| **[User Management](./custom-widget/USER_MANAGEMENT_SYSTEM.md)** | Authentication and user system |

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 12+

### Setup
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

Notes on hosting:
- Preferred: run only the backend on port 3002 — it serves the UI pages above.
- Alternative: serve static UI from root on port 3000 using `npm run dev` if you need it. Backend still runs on 3002.

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

### **Phase 4: Enhanced UI & Autopilot** (Next - 2 weeks)
- [ ] **Autopilot mode** - Immediate AI responses without human review
- [ ] **Enhanced document management** - Search, filtering, metadata
- [ ] **Analytics dashboard** - Conversation metrics and reporting
- [ ] **iframe embedding** - Easy widget integration like YouTube
- [ ] **Mobile optimization** - Improved responsive design

### **Phase 5: API Integration & Analytics** (Future - 3 weeks)
- [ ] **Document ingestion API** - External systems can upload documents
- [ ] **Webhook support** - Status notifications to external systems
- [ ] **Advanced analytics** - Langfuse integration for cost tracking
- [ ] **Multi-format documents** - PDF, RTF support
- [ ] **API key management** - Secure external system access

### **Production Deployment Checklist**
- [ ] HTTPS configuration and SSL certificates
- [ ] Database backup and recovery procedures
- [ ] Environment variable security review
- [ ] Load testing for 20 concurrent agents
- [ ] Monitoring and alerting setup
- [ ] User training documentation 


## 🏗️ Technology Stack

- **Backend**: Node.js, Express, Prisma ORM
- **Database**: PostgreSQL + Chroma DB Cloud (vectors)
- **AI**: OpenRouter (Gemini), Flowise, LangChain
- **Auth**: JWT with refresh tokens, bcrypt hashing
- **Frontend**: Vanilla JavaScript, TailwindCSS
- **Real-time**: Socket.IO WebSocket communication

---

**🎯 Perfect for**: Municipal customer support, enterprise ticketing, documentation-based assistance

**🚀 Ready for**: Production deployment with 20 agents and 16,000+ annual conversations
