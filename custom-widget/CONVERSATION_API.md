# Conversation & Agent API Reference

> Quick reference for the most commonly used API endpoints in the Vilnius Assistant system.

## 🔗 Base URL
```
http://localhost:3002/api
```

## 💬 Conversation Endpoints

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
      "assignedAgent": "agent-abc123"
    }
  },
  "conversationId": "session-abc123"
}
```

### Get Conversation Messages
Retrieve all messages in a conversation.

```http
GET /conversations/{conversationId}/messages
```

**Response:**
```json
{
  "conversationId": "session-abc123",
  "messages": [
    {
      "id": "uuid-1",
      "conversationId": "session-abc123",
      "content": "Hello, I need help",
      "sender": "visitor",
      "timestamp": "2025-08-20T10:30:00Z"
    },
    {
      "id": "uuid-2", 
      "conversationId": "session-abc123",
      "content": "Hello! How can I help you?",
      "sender": "agent",
      "timestamp": "2025-08-20T10:31:00Z",
      "agentId": "agent-abc123"
    }
  ]
}
```

### Get AI Suggestion
Get pending AI suggestion for an agent to review.

```http
GET /conversations/{conversationId}/pending-suggestion
```

**Response:**
```json
{
  "suggestion": "Laba diena! Dėl mokyklos registracijos galiu paaiškinti...",
  "confidence": 0.85,
  "messageId": "uuid-message-id", 
  "timestamp": "2025-08-20T10:30:05Z",
  "metadata": {
    "messageCount": 1,
    "customerMessages": ["Hello, I need help with school registration"]
  }
}
```

**404 Response (No suggestion):**
```json
{
  "error": "No pending suggestion found"
}
```

### Get All Conversations (Admin)
Get all conversations with statistics.

```http
GET /admin/conversations
```

**Response:**
```json
{
  "conversations": [
    {
      "id": "session-abc123",
      "visitorId": "visitor-xyz789",
      "startedAt": "2025-08-20T10:30:00Z",
      "status": "active",
      "assignedAgent": "agent-abc123",
      "messageCount": 3,
      "lastMessage": {
        "id": "uuid-last",
        "content": "Thank you for your help!",
        "sender": "visitor",
        "timestamp": "2025-08-20T10:35:00Z"
      }
    }
  ],
  "total": 1
}
```

## 👨‍💼 Agent Endpoints

### Agent Send Response
Agent sends response to customer (can use AI suggestion or write custom).

```http
POST /agent/respond
Content-Type: application/json
```

**Request Body:**
```json
{
  "conversationId": "session-abc123",
  "message": "Hello! I can help you with school registration. Here's what you need...",
  "agentId": "agent-abc123",
  "usedSuggestion": true,
  "suggestionAction": "edited"
}
```

**Suggestion Actions:**
- `"as-is"` - Used AI suggestion without changes
- `"edited"` - Modified AI suggestion  
- `"from-scratch"` - Wrote completely custom response

**Response:**
```json
{
  "success": true,
  "message": {
    "id": "uuid-response-id",
    "conversationId": "session-abc123",
    "content": "Hello! I can help you...",
    "sender": "agent", 
    "timestamp": "2025-08-20T10:32:00Z",
    "agentId": "agent-abc123",
    "metadata": {
      "suggestionAction": "edited",
      "usedSuggestion": true
    }
  }
}
```

### Update Agent Personal Status
Update agent availability (online/afk) with automatic ticket reassignment.

```http
POST /agent/personal-status
Content-Type: application/json
```

**Request Body:**
```json
{
  "agentId": "agent-abc123",
  "personalStatus": "online"
}
```

**Status Options:**
- `"online"` - Available for new conversations
- `"afk"` - Away, reassign tickets to other agents

**Response:**
```json
{
  "success": true,
  "agent": {
    "id": "agent-abc123",
    "name": "Agent One",
    "status": "online",
    "lastSeen": "2025-08-20T10:30:00Z",
    "socketId": "socket-id-123",
    "activeChats": 2,
    "personalStatus": "online",
    "connected": true
  },
  "reassignments": 0
}
```

### Get Connected Agents
Get list of currently connected agents.

```http
GET /agents/connected
```

**Response:**
```json
{
  "agents": [
    {
      "id": "agent-abc123",
      "name": "Agent One", 
      "status": "online",
      "personalStatus": "online",
      "activeChats": 2,
      "lastSeen": "2025-08-20T10:30:00Z",
      "connected": true
    },
    {
      "id": "agent-def456",
      "name": "Agent Two",
      "status": "online", 
      "personalStatus": "afk",
      "activeChats": 0,
      "lastSeen": "2025-08-20T10:28:00Z",
      "connected": true
    }
  ],
  "systemMode": "hitl"
}
```

### Set System Mode
Change global system mode (HITL/Autopilot/Off).

```http
POST /agent/mode
Content-Type: application/json
```

**Request Body:**
```json
{
  "mode": "hitl"
}
```

**Mode Options:**
- `"hitl"` - Human in the Loop (agents review AI suggestions)
- `"autopilot"` - AI responds directly to customers
- `"off"` - System offline, queue messages

**Response:**
```json
{
  "success": true,
  "mode": "hitl"
}
```

### Assign Conversation to Agent
Manually assign a conversation to a specific agent.

```http
POST /conversations/{conversationId}/assign
Content-Type: application/json
```

**Request Body:**
```json
{
  "agentId": "agent-abc123"
}
```

**Response:**
```json
{
  "success": true,
  "conversation": {
    "id": "session-abc123",
    "assignedAgent": "agent-abc123",
    "assignedAt": "2025-08-20T10:30:00Z",
    "status": "active"
  }
}
```

### Close Conversation
Mark conversation as resolved.

```http
POST /conversations/{conversationId}/close
Content-Type: application/json
```

**Request Body:**
```json
{
  "agentId": "agent-abc123"
}
```

**Response:**
```json
{
  "success": true,
  "conversation": {
    "id": "session-abc123",
    "status": "resolved",
    "resolvedAt": "2025-08-20T10:35:00Z",
    "resolvedBy": "agent-abc123"
  }
}
```

## 🔌 WebSocket Events

### Agent Dashboard Events

**Join Agent Dashboard:**
```javascript
socket.emit('join-agent-dashboard', 'agent-abc123');
```

**New Customer Message:**
```javascript
socket.on('new-message', (data) => {
  console.log('New message:', data.message);
  console.log('AI suggestion:', data.aiSuggestion);
});
```

**Agent Status Updates:**
```javascript
socket.on('connected-agents-update', (data) => {
  console.log('Connected agents:', data.agents);
});
```

**System Mode Changes:**
```javascript
socket.on('system-mode-update', (data) => {
  console.log('System mode changed to:', data.mode);
});
```

### Customer Widget Events

**Join Conversation:**
```javascript
socket.emit('join-conversation', 'session-abc123');
```

**Agent Response:**
```javascript
socket.on('agent-message', (data) => {
  console.log('Agent replied:', data.message);
});
```

**Agent Typing:**
```javascript
socket.on('agent-typing-status', (data) => {
  console.log('Agent is typing:', data.isTyping);
});
```

## 🚨 Error Responses

**Standard Error Format:**
```json
{
  "error": "Error message",
  "details": "Additional details if available"
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (missing required fields)
- `401` - Unauthorized (invalid credentials)  
- `403` - Forbidden (not authorized for this action)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error (server problem)

## 📝 Usage Examples

### Customer Chat Flow
```javascript
// 1. Customer sends message
const response = await fetch('/api/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversationId: 'session-new',
    message: 'I need help with school registration',
    visitorId: 'visitor-123'
  })
});

// 2. Get conversation messages
const messages = await fetch('/api/conversations/session-new/messages');
```

### Agent Response Flow
```javascript
// 1. Get pending AI suggestion
const suggestion = await fetch('/api/conversations/session-new/pending-suggestion');

// 2. Send response (using suggestion)
await fetch('/api/agent/respond', {
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversationId: 'session-new',
    message: 'Modified AI suggestion text...',
    agentId: 'agent-123',
    usedSuggestion: true,
    suggestionAction: 'edited'
  })
});
```

### System Management
```javascript
// Set system to autopilot mode
await fetch('/api/agent/mode', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mode: 'autopilot' })
});

// Get all conversations
const conversations = await fetch('/api/admin/conversations');
```

---

**Note:** This API reference covers the core conversation and agent management endpoints. For knowledge base management, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).