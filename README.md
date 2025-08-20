# Vilniaus Chatbot'as

A customer support chat system for Vilnius city with AI-powered assistance, evolving toward the full "Lizdeika" platform.

## 📚 Project Documentation

**Complete project documentation is in the [`/project/`](./project/) folder:**

- **[Project Overview](./project/README.md)** - How all components relate to each other
- **[Current System](./project/current-system.md)** - Detailed documentation of what exists now  
- **[Migration Plan](./project/migration-plan.md)** - Phased approach to reach full Lizdeika vision
- **[Lizdeika Specification](./project/moonshot_spec.md)** - Complete vision for the ultimate system

## 🗂️ Docs Index

- **Backend Dev Guide**: `custom-widget/backend/DEVELOPER_GUIDE.md`
- **API Docs**: `custom-widget/API_DOCUMENTATION.md`, `custom-widget/CONVERSATION_API.md` (OpenAPI WIP at `custom-widget/backend/openapi.yaml`, served at `/docs`)
- **Embedding + Widget**: `custom-widget/embed-widget.html`, `custom-widget/widget.js`
- **Architecture**: `custom-widget/backend/ARCHITECTURE.md`, `custom-widget/SYSTEM_ARCHITECTURE.md`
- **Testing**: `custom-widget/backend/tests/*`, how-to in backend dev guide
- **Troubleshooting**: `TROUBLESHOOTING.md`
- **Security**: `SECURITY.md`

## ⚡ Quick Start

1. Install dependencies:
```bash
cd custom-widget/backend && npm install
```

2. Configure environment variables in `custom-widget/backend/.env`:
```bash
PORT=3002
FLOWISE_URL=https://flowise-production-478e.up.railway.app
FLOWISE_CHATFLOW_ID=941a1dae-117e-4667-bf4f-014221e8435b
# FLOWISE_API_KEY= (leave empty if not required)
```

3. Start the backend server:
```bash
cd custom-widget/backend
npm start
```

4. Access the applications:
- **Agent Dashboard**: http://localhost:3002/agent-dashboard.html
- **Customer Widget Demo**: http://localhost:3002/embed-widget.html
- **System Test**: http://localhost:3002/test-dashboard.html

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

## 🚀 Current Features

- **Real-time chat** between customers and agents
- **AI suggestions** from Flowise for agent responses  
- **Lithuanian interface** throughout the system
- **WebSocket communication** for real-time updates
- **Three-action workflow** for agents (send/edit/rewrite)
- **Agent status** management
- **Responsive design** for mobile and desktop

## 🛠️ Next Phase: Migration to Lizdeika

This system is Phase 0 of the migration to full Lizdeika platform. See the [Migration Plan](./project/migration-plan.md) for:

- **Phase 1**: Dual AI Backend (Flowise + OpenRouter)
- **Phase 2**: Document RAG
- **Phase 3**: Add users, persistent database
- **Phase 4**: Package all for deployment

### Remaining tasks for phase 2
- integrate langfuse to track every request cost, feedback and configure the front from there
- in the widget make the status update in real time
- in the widget, check that the colors change successfully

### Tasks for phase 3
- choose a database that would be easy to manage in an on-premise setting
- create all the user logic - automatic ticket assignement, login, user creation, forgot password etc.
- keep a track of all the messages and actions taken but only for 6 months. 

Keep everything as simple as possible. 


## 📖 More Information


For detailed technical information, architecture decisions, and development roadmap, see the complete documentation in the [`/project/`](./project/) folder.
