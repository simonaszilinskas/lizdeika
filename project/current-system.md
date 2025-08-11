# Current System Documentation

This document describes the existing chat system that serves as the starting point for migration to Lizdeika.

## System Overview

**Product Name**: Vilniaus chatbot'as  
**Architecture**: Node.js backend + HTML/JavaScript frontend  
**AI Provider**: Flowise (external service)  
**Storage**: In-memory (no database)  
**Communication**: WebSocket + HTTP API  

## Current Components

### 1. Backend Server (`custom-widget/backend/server.js`)
- **Port**: 3002
- **Framework**: Express.js with Socket.io
- **Storage**: JavaScript Maps (in-memory)
- **AI Integration**: Flowise API calls
- **Features**:
  - Conversation management
  - Message routing
  - AI suggestion generation
  - WebSocket real-time communication
  - Agent assignment logic

### 2. Customer Widget (`custom-widget/widget.js`)
- **Type**: Embeddable chat widget
- **Framework**: Vanilla JavaScript
- **Features**:
  - Real-time messaging
  - Typing indicators
  - Message history
  - Responsive design
  - WebSocket connection

### 3. Agent Dashboard (`custom-widget/agent-dashboard.html`)
- **Type**: Web-based agent interface
- **Language**: Lithuanian
- **Features**:
  - Conversation queue
  - AI suggestion review
  - Three-action workflow: Send as-is / Edit / Write from scratch
  - Agent status management
  - Real-time updates

### 4. Embed Demo (`custom-widget/embed-widget.html`)
- **Purpose**: Demonstrates widget integration
- **Usage**: Shows how to embed widget on websites
- **Configuration**: Simple JavaScript initialization

## Technical Architecture

### Data Flow
```
Customer Widget → Backend Server → Flowise API → Agent Dashboard
       ↑                                              ↓
       ←←←←←←← WebSocket Communication ←←←←←←←←←←←←←←←←←
```

### API Endpoints
- `POST /api/conversations` - Create new conversation
- `POST /api/messages` - Send customer message
- `GET /api/conversations/:id/messages` - Get conversation history
- `GET /api/admin/conversations` - Get all conversations (agent view)
- `POST /api/agent/respond` - Agent sends response
- `GET /api/conversations/:id/pending-suggestion` - Get AI suggestion

### WebSocket Events
- `join-conversation` - Join chat room
- `agent-message` - Broadcast agent response
- `agent-typing-status` - Typing indicators
- `customer-typing-status` - Customer typing
- `agent-status-update` - Agent availability

### Configuration (`.env`)
```
PORT=3002
FLOWISE_URL=https://flowise-production-478e.up.railway.app
FLOWISE_CHATFLOW_ID=941a1dae-117e-4667-bf4f-014221e8435b
# FLOWISE_API_KEY= (currently not used)
```

## Current Features

### ✅ Working Features
1. **Real-time chat** between customers and agents
2. **AI suggestions** from Flowise for agent responses
3. **Three-action workflow** for agents (send/edit/write)
4. **Conversation management** with session tracking
5. **Agent status** management (online/busy/offline)
6. **Typing indicators** for better UX
7. **Lithuanian interface** throughout the system
8. **Responsive design** for mobile and desktop
9. **WebSocket real-time** communication
10. **Message history** within conversations

### ❌ Missing Features (vs Lizdeika spec)
1. **Persistent storage** - everything resets on server restart
2. **Document library** - no knowledge base
3. **RAG system** - no document context in responses
4. **Autopilot mode** - always requires agent intervention
5. **API authentication** - no security layer
6. **External document ingestion** - no API for document upload
7. **Analytics/reporting** - no usage statistics
8. **Data cleanup** - no retention policies
9. **User authentication** - no login system for agents
10. **Advanced embedding** - widget is direct HTML inclusion

## Known Issues

### Technical Issues
1. **Memory leaks** - conversations stored indefinitely in memory
2. **No persistence** - all data lost on server restart
3. **Single point of failure** - if Flowise is down, AI suggestions fail
4. **No rate limiting** - vulnerable to spam/abuse
5. **No error recovery** - WebSocket disconnections not handled gracefully

### UX Issues
1. **No conversation limits** - unlimited message history
2. **No file sharing** - customers can't send documents
3. **No conversation search** - agents can't search past conversations
4. **No agent handoff** - no way to transfer conversations between agents
5. **No offline handling** - no queue for when no agents available

## Performance Characteristics

### Current Limits
- **Concurrent users**: ~100 (memory-limited)
- **Message history**: Unlimited (until server restart)
- **Response time**: 2-5 seconds (Flowise-dependent)
- **File uploads**: Not supported
- **Agent capacity**: No artificial limits

### Resource Usage
- **Memory**: ~50MB base + ~1KB per message
- **CPU**: Low (mostly I/O waiting for Flowise)
- **Network**: Moderate (WebSocket connections)
- **Disk**: Minimal (logs only)

## Security Profile

### Current Security
- **No authentication** - anyone can access agent dashboard
- **No rate limiting** - vulnerable to DoS attacks
- **No input validation** - potential XSS risks
- **No data encryption** - HTTP connections (not HTTPS)
- **No API security** - endpoints are publicly accessible

### Data Privacy
- **In-memory only** - no persistent data storage
- **No PII logging** - customer data not logged to disk
- **Local processing** - only AI calls go external
- **Session-based** - no user tracking between sessions

## Deployment

### Requirements
- **Node.js** 18+
- **npm** package manager
- **Port 3002** available
- **Internet access** for Flowise API calls

### Current Deployment Steps
1. `cd custom-widget/backend`
2. `npm install`
3. Configure `.env` file
4. `npm start`
5. Access at `http://localhost:3002`

### Files Structure
```
custom-widget/
├── backend/
│   ├── server.js          # Main backend server
│   ├── package.json       # Node.js dependencies
│   ├── .env              # Configuration
│   └── node_modules/     # Dependencies
├── js/
│   └── agent-dashboard.js # Agent dashboard logic
├── agent-dashboard.html   # Agent interface
├── embed-widget.html     # Demo embedding page
└── widget.js             # Customer chat widget
```

## Migration Readiness

### Strengths for Migration
1. **Modular architecture** - easy to extend
2. **Clear separation** of concerns (widget/backend/dashboard)
3. **Working WebSocket** infrastructure
4. **Agent workflow** already established
5. **Lithuanian localization** complete

### Migration Preparation Needed
1. **Database integration** points identified
2. **AI provider abstraction** layer needed
3. **Authentication system** design required
4. **Document storage** architecture needed
5. **API security** framework required

This system provides a solid foundation for gradual enhancement toward the full Lizdeika specification while maintaining 100% backward compatibility throughout the migration process.