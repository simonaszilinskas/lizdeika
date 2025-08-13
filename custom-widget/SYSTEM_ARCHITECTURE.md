# Vilnius Assistant - System Architecture

This document provides visual diagrams explaining how the entire Vilnius Assistant chat widget system works, from user interactions to AI responses.

## 🏗️ Complete System Architecture

```mermaid
graph TB
    subgraph "👥 Users"
        Customer[Customer]
        Agent[Human Agent]
        Admin[System Admin]
    end

    subgraph "🌐 Frontend Interfaces"
        Widget[widget.js<br/>Customer Chat Widget]
        AgentDash[agent-dashboard.html<br/>Agent Interface]
        AdminPanel[admin-settings.html<br/>Admin Configuration]
    end

    subgraph "🚀 Backend Core"
        Server[server.js<br/>Main Server]
        App[app.js<br/>Express App]
        WS[websocketService.js<br/>Real-time Communication]
    end

    subgraph "🎯 Controllers & Routes"
        ConvController[conversationController.js]
        AgentController[agentController.js]
        KnowledgeController[knowledgeController.js]
        SystemController[systemController.js]
        
        ConvRoutes[conversationRoutes.js]
        AgentRoutes[agentRoutes.js]
        KnowledgeRoutes[knowledgeRoutes.js]
        SystemRoutes[systemRoutes.js]
    end

    subgraph "🧠 AI & RAG System"
        AIService[aiService.js<br/>AI Coordination]
        LangChainRAG[langchainRAG.js<br/>Advanced RAG]
        AIProviders[ai-providers.js<br/>Multi-Provider Support]
        
        subgraph "🔍 Knowledge Management"
            KnowledgeService[knowledgeService.js]
            KnowledgeManager[knowledgeManagerService.js]
            DocumentService[documentService.js]
        end
        
        subgraph "🗄️ Vector Database"
            ChromaService[chromaService.js]
            MistralEmbedding[mistralEmbeddingFunction.js]
        end
    end

    subgraph "🌍 External Services"
        ChromaDB[(Chroma DB Cloud<br/>Vector Database)]
        MistralAI[Mistral AI<br/>Embeddings]
        OpenRouter[OpenRouter<br/>Gemini Models]
        Flowise[Flowise<br/>Alternative AI]
    end

    %% User Interactions
    Customer --> Widget
    Agent --> AgentDash
    Admin --> AdminPanel

    %% Frontend to Backend
    Widget --> WS
    AgentDash --> WS
    AdminPanel --> Server

    %% Server Architecture
    Server --> App
    App --> ConvController
    App --> AgentController
    App --> KnowledgeController
    App --> SystemController

    %% Controllers to Routes
    ConvController --> ConvRoutes
    AgentController --> AgentRoutes
    KnowledgeController --> KnowledgeRoutes
    SystemController --> SystemRoutes

    %% AI Processing Flow
    ConvController --> AIService
    AIService --> LangChainRAG
    AIService --> AIProviders
    LangChainRAG --> KnowledgeService
    
    %% Knowledge Processing
    KnowledgeController --> KnowledgeManager
    KnowledgeManager --> DocumentService
    KnowledgeManager --> ChromaService
    KnowledgeService --> ChromaService
    ChromaService --> MistralEmbedding

    %% External Connections
    ChromaService --> ChromaDB
    MistralEmbedding --> MistralAI
    AIProviders --> OpenRouter
    AIProviders --> Flowise
    LangChainRAG --> OpenRouter

    %% Real-time Communication
    WS --> ConvController
    WS --> AgentController

    %% Styling
    classDef frontend fill:#e1f5fe
    classDef backend fill:#f3e5f5
    classDef ai fill:#fff3e0
    classDef external fill:#e8f5e8
    
    class Widget,AgentDash,AdminPanel frontend
    class Server,App,WS backend
    class AIService,LangChainRAG,AIProviders,KnowledgeService,ChromaService ai
    class ChromaDB,MistralAI,OpenRouter,Flowise external
```

## 💬 Customer Conversation Flow

```mermaid
sequenceDiagram
    participant C as Customer
    participant W as Widget
    participant WS as WebSocket
    participant CC as ConvController
    participant AI as AIService
    participant LR as LangChainRAG
    participant KS as KnowledgeService
    participant CS as ChromaService
    participant DB as Chroma DB
    participant OR as OpenRouter

    C->>W: Sends message
    W->>WS: WebSocket message
    WS->>CC: Process message
    
    Note over CC: Check for RAG enhancement
    CC->>AI: Generate AI response
    
    Note over AI: Parse conversation history
    AI->>LR: Get RAG answer with context
    
    Note over LR: Step 1: Query Rephrasing
    LR->>OR: Rephrase query (gemini-2.5-flash-lite)
    OR-->>LR: Better search query
    
    Note over LR: Step 2: Document Retrieval  
    LR->>KS: Search with rephrased query
    KS->>CS: Similarity search
    CS->>DB: Vector search
    DB-->>CS: Relevant documents
    CS-->>KS: Context results
    KS-->>LR: Retrieved context
    
    Note over LR: Step 3: Answer Generation
    LR->>OR: Generate answer (gemini-flash-1.5)
    OR-->>LR: Final response
    LR-->>AI: RAG-enhanced answer
    AI-->>CC: AI response
    
    CC->>WS: Send response
    WS->>W: WebSocket response
    W->>C: Display message
```

## 🤖 Agent Assistance Flow

```mermaid
sequenceDiagram
    participant A as Agent
    participant AD as Agent Dashboard
    participant WS as WebSocket
    participant AC as AgentController
    participant CC as ConvController
    participant AI as AIService

    Note over A,AI: Customer sends message first
    
    CC->>AI: Generate AI suggestion
    AI-->>CC: AI suggestion ready
    CC->>WS: Broadcast AI suggestion
    WS->>AD: Display suggestion panel
    AD->>A: Shows "Siųsti kaip yra" button
    
    alt Agent uses suggestion as-is
        A->>AD: Clicks "Siųsti kaip yra"
        AD->>WS: Send as-is request  
        WS->>AC: Process agent response
        AC->>CC: Send to customer
        CC->>WS: Deliver to customer
    else Agent edits suggestion
        A->>AD: Clicks "Redaguoti"
        AD->>A: Shows editable text
        A->>AD: Modifies response
        AD->>WS: Send modified response
        WS->>AC: Process agent response
        AC->>CC: Send to customer
    else Agent writes from scratch
        A->>AD: Clicks "Nuo pradžių"
        AD->>A: Shows empty text field
        A->>AD: Writes custom response
        AD->>WS: Send custom response
        WS->>AC: Process agent response
        AC->>CC: Send to customer
    end
```

## 📁 Document Upload & RAG Integration

```mermaid
flowchart TD
    A[Admin uploads document] --> B[knowledgeController.js]
    B --> C[documentService.js<br/>Extract text from .docx/.txt]
    C --> D[knowledgeManagerService.js<br/>Process and chunk text]
    D --> E[mistralEmbeddingFunction.js<br/>Generate 1024-dim vectors]
    E --> F[chromaService.js<br/>Store in vector DB]
    F --> G[(Chroma DB Cloud<br/>vilnius-knowledge-base-mistral-1024)]
    
    H[Customer asks question] --> I[langchainRAG.js<br/>Rephrase query]
    I --> J[knowledgeService.js<br/>Search similar documents]
    J --> K[chromaService.js<br/>Vector similarity search]
    K --> G
    G --> L[Retrieved relevant context]
    L --> M[langchainRAG.js<br/>Generate contextual answer]
    M --> N[Customer receives informed response]

    style G fill:#e8f5e8
    style M fill:#fff3e0
    style N fill:#e1f5fe
```

## 🔄 Multi-Provider AI Architecture

```mermaid
graph LR
    subgraph "🎯 AI Coordination Layer"
        AS[aiService.js<br/>Main Coordinator]
    end
    
    subgraph "🔀 Provider Abstraction"
        AP[ai-providers.js<br/>Multi-Provider Support]
        FP[FlowiseProvider]
        OP[OpenRouterProvider]
    end
    
    subgraph "🧠 RAG Enhancement"
        LR[langchainRAG.js<br/>Advanced RAG]
    end
    
    subgraph "🌍 External AI Services"
        F[Flowise<br/>Built-in RAG]
        OR[OpenRouter<br/>+ External RAG]
    end

    AS --> AP
    AS --> LR
    AP --> FP
    AP --> OP
    FP --> F
    OP --> OR
    LR --> OR
    
    Note1[Provider switch via<br/>environment variable<br/>AI_PROVIDER=flowise|openrouter]
    
    style AS fill:#fff3e0
    style LR fill:#fff3e0
    style F fill:#e8f5e8
    style OR fill:#e8f5e8
```

## 🛠️ System Configuration Flow

```mermaid
graph TD
    A[Admin opens admin-settings.html] --> B[Load current configuration]
    B --> C[systemController.js<br/>Get system status]
    C --> D{Choose Configuration}
    
    D --> E[AI Provider Settings]
    D --> F[Knowledge Base Management] 
    D --> G[RAG Configuration]
    
    E --> H[Switch between<br/>Flowise/OpenRouter]
    E --> I[Update system prompts]
    E --> J[Test provider health]
    
    F --> K[Upload documents]
    F --> L[View knowledge base stats]
    F --> M[Clear/reindex documents]
    
    G --> N[Set k parameter<br/>for similarity search]
    G --> O[Configure source display]
    G --> P[Test RAG functionality]
    
    H --> Q[systemController.js<br/>Save configuration]
    I --> Q
    J --> Q
    K --> R[knowledgeController.js<br/>Process uploads]
    L --> S[knowledgeService.js<br/>Get statistics]
    M --> T[chromaService.js<br/>Database operations]
    N --> Q
    O --> Q
    P --> U[Test RAG pipeline]
    
    Q --> V[Configuration updated<br/>System ready]
    R --> V
    S --> V  
    T --> V
    U --> V

    style A fill:#e1f5fe
    style V fill:#e8f5e8
```

## 🔍 Key System Features

### **Multi-Channel Communication**
- **Customer Widget**: Direct customer interaction
- **Agent Dashboard**: Real-time agent assistance with AI suggestions
- **Admin Panel**: System configuration and knowledge management

### **Advanced RAG (Retrieval-Augmented Generation)**
- **Query Rephrasing**: Converts ambiguous questions into searchable queries
- **Conversation Context**: Maintains multi-turn conversation awareness
- **Semantic Search**: Uses Mistral embeddings for relevant document retrieval
- **Bilingual Support**: Responds in Lithuanian or English based on input

### **Multi-Provider AI Support**
- **OpenRouter**: Gemini models with external RAG enhancement
- **Flowise**: Alternative AI provider with built-in RAG capabilities
- **Switchable**: Runtime provider switching via configuration

### **Real-Time Architecture**  
- **WebSocket Communication**: Instant message delivery
- **Live Agent Updates**: Real-time conversation monitoring
- **AI Suggestion System**: Immediate AI assistance for agents

This architecture provides a complete, scalable chat widget system with enterprise-level features for customer support, AI assistance, and knowledge management.