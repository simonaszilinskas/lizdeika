# Vilnius Assistant - Complete API Guide

> Comprehensive API documentation for the Vilnius Assistant customer support platform covering conversations, knowledge management, and agent operations.

## 🔗 Base URL
```
http://localhost:3002/api
```

## 🔐 Authentication

Most endpoints require authentication via JWT tokens:
```http
Authorization: Bearer <jwt_token>
```

The Knowledge API currently does not require authentication, but consider adding API key authentication in production.

---

## 💬 Conversation API

### Send Customer Message
Send a message from customer and get AI response or assign to agent.

```http
POST /messages
Content-Type: application/json
```

**Request Body:**
```json
{
  "conversationId": "session-abc123",
  "message": "Hello, I need help with school registration",
  "visitorId": "visitor-xyz789"
}
```

**Response:**
```json
{
  "userMessage": {
    "id": "uuid-message-id",
    "conversationId": "session-abc123", 
    "content": "Hello, I need help with school registration",
    "sender": "visitor",
    "timestamp": "2025-08-20T10:30:00Z"
  },
  "aiMessage": {
    "id": "uuid-ai-message-id",
    "conversationId": "session-abc123",
    "content": "[Message pending agent response - AI suggestion available]",
    "sender": "system",
    "timestamp": "2025-08-20T10:30:05Z",
    "metadata": {
      "pendingAgent": true,
      "aiSuggestion": "Laba diena! Dėl mokyklos registracijos...",
      "confidence": 0.85,
      "customerMessage": "Hello, I need help with school registration",
      "messageCount": 1,
      "requiresAgent": true
    }
  }
}
```

### Get Conversation Messages
Retrieve messages for a specific conversation.

```http
GET /conversations/{conversationId}/messages
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid-message-1",
      "conversationId": "session-abc123",
      "content": "Hello, I need help",
      "sender": "visitor",
      "timestamp": "2025-08-20T10:30:00Z"
    }
  ]
}
```

### Agent Send Message
Send message from agent to customer.

```http
POST /agents/messages
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "conversationId": "session-abc123",
  "message": "Hello! I can help you with that."
}
```

---

## 👥 Agent Management API

### Get Agent Dashboard Data
Retrieve conversations and agent status for dashboard.

```http
GET /agents/dashboard
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "conversations": [
    {
      "id": "session-abc123",
      "visitorId": "visitor-xyz789",
      "lastMessage": "I need help with registration",
      "timestamp": "2025-08-20T10:30:00Z",
      "status": "active",
      "assignedAgent": null,
      "messageCount": 3,
      "hasUnreadMessages": true
    }
  ],
  "connectedAgents": [
    {
      "id": "agent-1",
      "name": "Agent Smith", 
      "status": "online",
      "activeConversations": 2
    }
  ]
}
```

### Assign Conversation to Agent
Assign a conversation to a specific agent.

```http
POST /agents/assign
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "conversationId": "session-abc123",
  "agentId": "agent-uuid" // optional, assigns to current agent if omitted
}
```

---

## 📚 Knowledge Management API

### Index Single Document
Index a document with metadata for RAG system.

```http
POST /knowledge/documents/index
Content-Type: application/json
```

**Request Body:**
```json
{
  "content": "Document text content to be indexed",
  "metadata": {
    "title": "Document Title",
    "sourceUrl": "https://vilnius.lt/example-page",
    "category": "FAQ",
    "tags": ["vilnius", "registration", "services"],
    "language": "lt",
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

**Required Fields:**
- `content` (string): The text content to be indexed

**Optional Metadata Fields:**
- `title` (string): Document title (default: "API Document")
- `sourceUrl` (string): Source URL for citation purposes
- `category` (string): Document category (default: "general")
- `tags` (array): Array of tags for categorization
- `language` (string): Document language code (default: "lt")
- `lastUpdated` (string): ISO 8601 timestamp of last update

**Response:**
```json
{
  "success": true,
  "documentId": "uuid-document-id",
  "message": "Document indexed successfully",
  "chunksCreated": 3,
  "metadata": {
    "title": "Document Title",
    "category": "FAQ",
    "tags": ["vilnius", "registration", "services"],
    "language": "lt"
  }
}
```

### Batch Index Documents
Index multiple documents at once.

```http
POST /knowledge/documents/batch-index
Content-Type: application/json
```

**Request Body:**
```json
{
  "documents": [
    {
      "content": "First document content...",
      "metadata": {
        "title": "Document 1",
        "category": "FAQ"
      }
    },
    {
      "content": "Second document content...",
      "metadata": {
        "title": "Document 2", 
        "category": "Guide"
      }
    }
  ]
}
```

### Upload Document File
Upload and index a document file (.txt, .docx).

```http
POST /knowledge/upload
Content-Type: multipart/form-data
Authorization: Bearer <jwt_token>
```

**Form Data:**
- `file`: Document file (.txt or .docx)
- `title` (optional): Document title
- `category` (optional): Document category
- `tags` (optional): Comma-separated tags

---

## 🔧 System API

### Health Check
Check system status and component health.

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-20T10:30:00Z",
  "components": {
    "database": "connected",
    "vectorStore": "connected",
    "aiService": "available"
  }
}
```

### System Settings
Get or update system configuration.

```http
GET /admin/settings
Authorization: Bearer <jwt_token>
```

```http
POST /admin/settings
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

---

## 🚀 WebSocket Events

The system supports real-time communication via WebSocket connections.

**Connection:** `ws://localhost:3002`

### Client Events (Sent to Server)

#### Join Agent Dashboard
```json
{
  "event": "join-agent-dashboard",
  "data": {
    "agentId": "agent-uuid",
    "token": "jwt_token"
  }
}
```

#### Agent Typing Indicator
```json
{
  "event": "agent-typing",
  "data": {
    "conversationId": "session-abc123",
    "agentId": "agent-uuid"
  }
}
```

### Server Events (Received from Server)

#### New Message
```json
{
  "event": "new-message",
  "data": {
    "conversationId": "session-abc123",
    "message": {
      "id": "uuid-message-id",
      "content": "Hello, I need help",
      "sender": "visitor",
      "timestamp": "2025-08-20T10:30:00Z"
    }
  }
}
```

#### Agent Status Update
```json
{
  "event": "agent-status-update",
  "data": {
    "agentId": "agent-uuid",
    "status": "online",
    "activeConversations": 2
  }
}
```

---

## 📝 OpenAPI Specification

For complete API specification with request/response schemas, see:
- **OpenAPI YAML**: `backend/openapi.yaml`
- **Interactive Docs**: `http://localhost:3002/docs` (when server is running)

## 🧪 Testing

API endpoints can be tested using:
- **Postman Collection**: Available in the repository
- **Jest Integration Tests**: `backend/tests/integration/`
- **Interactive Docs**: Swagger UI at `/docs`

## 🔍 Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "timestamp": "2025-08-20T10:30:00Z",
  "path": "/api/endpoint"
}
```

Common HTTP status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error (system error)