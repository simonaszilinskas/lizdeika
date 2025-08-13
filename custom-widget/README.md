# Vilnius Assistant - AI-Powered Chat Widget

> An advanced customer support chat widget with RAG (Retrieval-Augmented Generation) capabilities, real-time agent assistance, and multi-provider AI support.

## 🚀 Quick Start

1. **Setup Environment**:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Configure your API keys in .env
   ```

2. **Start the System**:
   ```bash
   npm start
   ```

3. **Access Interfaces**:
   - **Customer Chat**: `http://localhost:3002/embed-widget.html`
   - **Agent Dashboard**: `http://localhost:3002/agent-dashboard.html`
   - **Admin Settings**: `http://localhost:3002/admin-settings.html`

## 🏗️ System Architecture

![System Overview](https://mermaid.live/img/pako:eNqVVk1v2zAM_SsGexkQt_2Ic0uBYS2GYQOGFu2yS9CLIJOJhciSK1Fp2-C_H5Us27FjN8EQH2KTj-_H90hJuyBFZoWcWGWEHzHnJTYiNw6pQqcFbvIivGOZtKvmIIppS_D4f6eY1RJ_KH4vpJXCX8q0UWw3kX8vbeKODI3yZpQhbWi79IYR_FGZxOqQk2I3k0aJfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FGi3w_kUaLfD-RRot8P5FG)

**📋 For detailed system diagrams and architecture, see: [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)**

## ✨ Key Features

### 🤖 **Advanced AI Capabilities**
- **RAG (Retrieval-Augmented Generation)** - Context-aware responses using uploaded documents
- **Query Rephrasing** - Converts ambiguous questions into searchable queries  
- **Conversation Context** - Maintains multi-turn dialog awareness
- **Multi-Provider Support** - OpenRouter (Gemini) + Flowise compatibility

### 👥 **Multi-Channel Interface**
- **Customer Widget** - Embeddable chat widget for websites
- **Agent Dashboard** - Real-time agent interface with AI suggestions
- **Admin Panel** - System configuration and knowledge management

### 🔍 **Knowledge Management**
- **Document Upload** - Support for .txt and .docx files
- **Vector Database** - Chroma DB Cloud with Mistral embeddings
- **Semantic Search** - Find relevant information automatically
- **Bilingual Support** - Lithuanian and English responses

### ⚡ **Real-Time Features**
- **WebSocket Communication** - Instant message delivery
- **Live Agent Updates** - Real-time conversation monitoring  
- **AI Suggestions** - "Send as-is", "Edit", or "Write from scratch" options

## 📁 Documentation

| Document | Description |
|----------|-------------|
| **[SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)** | 🏗️ Complete system diagrams with Mermaid charts |
| **[FILE_GUIDE.md](./FILE_GUIDE.md)** | 📋 Comprehensive file structure overview |
| **[backend/ARCHITECTURE.md](./backend/ARCHITECTURE.md)** | 🔧 Technical architecture details |
| **[backend/.env.example](./backend/.env.example)** | ⚙️ Environment configuration template |

## 🔧 Configuration

### Required Environment Variables:
```env
# AI Provider Selection
AI_PROVIDER=openrouter  # or 'flowise'

# OpenRouter Configuration  
OPENROUTER_API_KEY=your-api-key
OPENROUTER_MODEL=google/gemini-flash-1.5

# Mistral Embeddings
MISTRAL_API_KEY=your-mistral-key

# Chroma DB Cloud
CHROMA_URL=https://api.trychroma.com
CHROMA_TENANT=your-tenant-id
CHROMA_DATABASE=your-database-name
CHROMA_AUTH_TOKEN=your-auth-token
```

## 🏃‍♂️ Usage Examples

### Customer Conversation:
1. Customer asks: **"labas, sūnus grįžta į šeštą klasę"**
2. AI responds with school registration questions
3. Customer answers: **"nedeklaravau gyvenamosios vietos"** 
4. AI provides contextual guidance about registration process

### Agent Assistance:
1. Customer sends complex question
2. Agent sees AI suggestion in dashboard
3. Agent can "Send as-is", "Edit", or "Write from scratch"
4. Response sent to customer with agent attribution

### Document Upload:
1. Admin uploads Vilnius city documents
2. System extracts text and creates embeddings
3. RAG system uses documents for contextual responses
4. Customers get accurate, document-based answers

## 🛠️ Technology Stack

- **Backend**: Node.js, Express, WebSocket
- **AI**: OpenRouter (Gemini), Flowise, LangChain
- **Vector DB**: Chroma DB Cloud with Mistral embeddings
- **Frontend**: Vanilla JavaScript, TailwindCSS
- **Real-time**: Socket.IO WebSocket communication

## 📊 System Stats

- **25+ documented files** with comprehensive headers
- **Multi-provider AI** support (OpenRouter + Flowise)
- **Advanced RAG** with query rephrasing and context awareness
- **Real-time communication** with WebSocket architecture
- **Bilingual support** (Lithuanian/English)
- **Production-ready** with error handling and logging

---

**🎯 Perfect for**: Customer support, municipal services, documentation-based assistance, multi-language support

**🚀 Ready for**: Production deployment, scaling, and customization