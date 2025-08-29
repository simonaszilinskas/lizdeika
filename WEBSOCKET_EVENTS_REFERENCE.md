# WebSocket Events Reference

## Overview
This document provides a complete reference for WebSocket events used in the Vilnius Assistant system for real-time communication between agents, customers, and the server.

## Client-to-Server Events

### Agent Dashboard Events

#### `join-agent-dashboard`
**Purpose**: Agent joins the dashboard WebSocket room  
**Payload**: `agentId` (string)  
**Response**: Server emits `system-mode-update` and `connected-agents-update`

```javascript
socket.emit('join-agent-dashboard', 'agent-123');
```

#### `agent-typing`
**Purpose**: Agent is typing in a conversation  
**Payload**: `{ conversationId, isTyping }`  
**Effect**: Broadcasts typing status to conversation participants

```javascript
socket.emit('agent-typing', { 
  conversationId: 'conv-456', 
  isTyping: true 
});
```

#### `heartbeat`
**Purpose**: Keep agent connection alive and update activity timestamp  
**Payload**: `{ timestamp }`  
**Response**: Server emits `heartbeat-ack`

```javascript
socket.emit('heartbeat', { timestamp: Date.now() });
```

#### `request-current-state`
**Purpose**: Request current system state  
**Payload**: `stateType` ('connected-agents' | 'system-mode')  
**Response**: Server emits `current-state`

```javascript
socket.emit('request-current-state', 'connected-agents');
```

### Customer Widget Events

#### `join-conversation`
**Purpose**: Customer joins a specific conversation room  
**Payload**: `conversationId` (string)

```javascript
socket.emit('join-conversation', 'conv-789');
```

#### `customer-typing`
**Purpose**: Customer is typing in widget  
**Payload**: `{ conversationId, isTyping }`  
**Effect**: Notifies agents of customer typing status

```javascript
socket.emit('customer-typing', { 
  conversationId: 'conv-789', 
  isTyping: true 
});
```

## Server-to-Client Events

### Agent Dashboard Events

#### `new-conversation`
**Purpose**: New conversation created, agents should refresh conversation list  
**Payload**: `{ conversationId, conversation, timestamp }`  
**Trigger**: When customer starts new conversation

```javascript
socket.on('new-conversation', (data) => {
  console.log('New conversation:', data.conversationId);
  // Reload conversations to show new one
});
```

#### `new-message`
**Purpose**: New message received in any conversation  
**Payload**: `messageData` object  
**Trigger**: When customer or agent sends message

```javascript
socket.on('new-message', (messageData) => {
  // Update conversation UI with new message
});
```

#### `connected-agents-update`
**Purpose**: List of online agents changed  
**Payload**: `{ agents: Array<AgentData> }`  
**Trigger**: Agent connects/disconnects

```javascript
socket.on('connected-agents-update', (data) => {
  console.log('Connected agents:', data.agents);
  // Update agent status display
});
```

#### `system-mode-update`
**Purpose**: System operational mode changed  
**Payload**: `{ mode: string }`  
**Trigger**: System mode toggle

```javascript
socket.on('system-mode-update', (data) => {
  console.log('System mode:', data.mode);
  // Update UI mode indicator
});
```

#### `tickets-reassigned`
**Purpose**: Conversations reassigned between agents  
**Payload**: `{ reassignments: Array, reason: string }`  
**Trigger**: Bulk assignment operations or agent status changes

```javascript
socket.on('tickets-reassigned', (data) => {
  console.log('Tickets reassigned:', data.reassignments);
  // Reload conversation list
});
```

#### `customer-typing-status`
**Purpose**: Customer typing status for agents  
**Payload**: `{ conversationId, isTyping, timestamp }`  
**Trigger**: Customer types in widget

```javascript
socket.on('customer-typing-status', (data) => {
  // Show/hide typing indicator for conversation
});
```

#### `heartbeat-ack`
**Purpose**: Acknowledge agent heartbeat  
**Payload**: `{ timestamp, agentId }`  
**Trigger**: Response to agent heartbeat

```javascript
socket.on('heartbeat-ack', (data) => {
  console.log('Heartbeat acknowledged:', data.timestamp);
});
```

### Customer Widget Events

#### `agent-message`
**Purpose**: Agent sent message in conversation  
**Payload**: `messageData` object  
**Trigger**: Agent replies to customer

```javascript
socket.on('agent-message', (messageData) => {
  // Display agent message in widget
});
```

#### `agent-typing-status`
**Purpose**: Agent typing status for customer  
**Payload**: `{ isTyping, timestamp }`  
**Trigger**: Agent types response

```javascript
socket.on('agent-typing-status', (data) => {
  // Show/hide "Agent is typing..." indicator
});
```

## Connection Management

### Connection Events

#### `connect`
**Purpose**: WebSocket connection established  
**Automatic**: Emitted by Socket.IO on successful connection

```javascript
socket.on('connect', () => {
  console.log('Connected to server');
  // Initialize connection (join rooms, send heartbeat)
});
```

#### `disconnect`
**Purpose**: WebSocket connection lost  
**Automatic**: Emitted by Socket.IO on disconnection

```javascript
socket.on('disconnect', () => {
  console.log('Disconnected from server');
  // Handle disconnection (show offline status)
});
```

#### `connect_error`
**Purpose**: Connection failed  
**Automatic**: Emitted by Socket.IO on connection errors

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  // Handle connection failure
});
```

#### `reconnect`
**Purpose**: Reconnected after disconnection  
**Automatic**: Emitted by Socket.IO on successful reconnection

```javascript
socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
  // Re-initialize connection state
});
```

## Event Flow Examples

### New Conversation Flow
1. Customer starts conversation via widget API
2. Server creates conversation in database
3. Server emits `new-conversation` to `agents` room
4. ModernWebSocketManager forwards event to agent dashboard
5. Agent dashboard receives event and reloads conversation list

### Agent Status Change Flow
1. Agent connects/disconnects from dashboard
2. Server updates agent status in database  
3. Server gets current connected agents list
4. Server emits `connected-agents-update` to all agents
5. Agent dashboards update online status display

### Message Flow
1. Customer/Agent sends message via API
2. Server saves message to database
3. Server emits `new-message` to agents room
4. Server emits `agent-message` to conversation room (if from agent)
5. UIs update to display new message

## Implementation Notes

### ModernWebSocketManager
The client-side `ModernWebSocketManager` forwards these events to the application:
- `new-message`
- `new-conversation` 
- `connected-agents-update`
- `system-mode-update`
- `tickets-reassigned`
- `customer-typing-status`

### Room Management
- `agents` - All connected agent dashboards
- `<conversationId>` - Participants in specific conversation

### Error Handling
All WebSocket events should include error handling:
```javascript
socket.on('error-event', (error) => {
  console.error('WebSocket error:', error);
  // Handle gracefully, potentially fall back to API polling
});
```

### Heartbeat System
- Agents send heartbeat every 15 seconds
- Server responds with `heartbeat-ack`
- Updates agent activity timestamp
- Prevents connection timeout

## Debugging WebSocket Events

### Client-side Debugging
```javascript
// Enable detailed logging in ModernWebSocketManager
const wsManager = new ModernWebSocketManager({
  logger: console, // Enable logging
  agentId: 'your-agent-id'
});

// Monitor all events
['new-conversation', 'new-message', 'connected-agents-update'].forEach(event => {
  wsManager.on(event, data => console.log(`📨 ${event}:`, data));
});
```

### Server-side Debugging
```javascript
// In websocketService.js
console.log(`🆕 Emitting new-conversation to agents room`);
this.io.to('agents').emit('new-conversation', data);
```

### Browser Console Monitoring
1. Open browser dev tools
2. Look for `🔧 ModernWebSocketManager` logs
3. Check for `📨 Received` event logs
4. Verify events trigger appropriate UI updates