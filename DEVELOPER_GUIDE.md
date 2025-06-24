# Developer Guide - Vilnius Support Chat

## How This Project Works

### The Big Picture
This is a customer support chat system with a human in the loop and AI with 3 main parts:
1. **Customer Widget** - The chat bubble customers see on websites
2. **Agent Dashboard** - Where support agents respond to messages
3. **AI Integration** - Flowise generates suggested responses

### Architecture Overview
```
Customer Widget (frontend) 
    ↓ sends messages to
Widget Backend (port 3002)
    ↓ stores messages & gets AI suggestions from
Flowise API (external)
    ↓ suggestions appear in
Agent Dashboard (port 3000)
```

## File Structure Explained

### Main Server (port 3000)
- **`server.js`** - Simple Express server that serves static files
  - Serves the agent dashboard at `/`
  - No authentication (we removed it for simplicity)
  - Just serves files, nothing fancy

### Widget Backend (port 3002) 
- **`custom-widget/backend/server.js`** - The brain of the system
  - Stores conversations in memory (resets when server restarts)
  - Main endpoints:
    - `POST /api/conversations` - Create new chat
    - `POST /api/messages` - Customer sends message
    - `GET /api/admin/conversations` - Agent sees all chats
    - `GET /api/conversations/:id/messages` - Get chat history
    - `POST /api/agent/respond` - Agent sends response
    - `POST /api/reset` - Clear all data (for testing)

### Customer Widget
- **`custom-widget/widget.js`** - The chat bubble code
  - Creates the UI dynamically
  - Polls for new messages every 2 seconds
  - Stores conversation ID in localStorage
  - Key functions:
    - `init()` - Starts everything
    - `sendMessage()` - Sends customer message
    - `loadMessages()` - Fetches new messages
    - `renderMessages()` - Shows messages in UI

- **`custom-widget/embed-widget.html`** - Demo page showing how to embed

### Agent Dashboard
- **`custom-widget/agent-dashboard.html`** - The HTML structure
- **`custom-widget/js/agent-dashboard.js`** - Controls the agent interface
  - Key functions:
    - `loadConversations()` - Fetches all chats
    - `selectChat()` - Agent clicks on a conversation
    - `checkForPendingSuggestion()` - Gets AI suggestion
    - `sendAgentResponse()` - Sends agent's message
  - Polls every 3 seconds for updates

### Admin Dashboard
- **`custom-widget/admin.html`** - Read-only view of all conversations
  - Just for monitoring, no interaction

## Current Bugs 🐛

1. **Data Loss on Restart**
   - Everything is stored in memory
   - Restart server = lose all conversations
   - Fix: Add database (PostgreSQL)

2. **No Real-time Updates**
   - Uses polling (every 2-3 seconds)
   - Wastes bandwidth, not instant
   - Fix: Add WebSockets or Socket.io

3. **Widget Styling Issues**
   - CSS is inline, hard to customize
   - Conflicts with some websites
   - Fix: Use Shadow DOM or iframe

4. **No Message Status**
   - Can't see if agent is typing
   - No read receipts
   - Fix: Add message states

5. **Memory Leaks**
   - Conversations never cleaned up
   - Server will eventually crash
   - Fix: Add conversation expiry

6. **No Error Recovery**
   - If Flowise is down, everything breaks
   - Fix: Add fallback handling

## Features to Add 🚀

### High Priority
1. **Database Storage**
   ```javascript
   // Instead of: conversations.set(id, data)
   // Use: await db.conversations.create({...})
   ```

2. **Agent Authentication**
   - Login system for one agent only - no need for multiple. Credentials stored in .env

3. **Send the past 4 messages to Flowise**
   - So that the chatbot has more context - send both the assistant and user messages

### Medium Priority

6. **Analytics**
   - Integrate with Langfuse to provide feedback on messages

7. **Translate all to Lithuanian**
   - UI translation

## Testing Checklist

Before any change:
- [ ] Customer can send message
- [ ] Agent sees message
- [ ] AI suggestion appears
- [ ] Agent can respond
- [ ] Customer sees response
- [ ] Multiple conversations work
- [ ] Page refresh doesn't break anything

## Code Style Rules

1. **No complex abstractions** - Keep it simple
2. **Comment weird stuff** - If it's not obvious, explain
3. **Log errors** - Always console.error() failures
4. **Check if element exists** - Before using getElementById
5. **Use async/await** - Not .then() chains
6. **Keep it simple** 
7. **New branch for every feature** 


## Deployment Notes

Currently runs locally. For production:
1. Use environment variables for URLs
2. Add HTTPS support
3. Use PM2 or systemd for process management
4. Put behind nginx reverse proxy
5. Add rate limiting
6. Enable CORS properly

## Quick Fixes

**Reset everything:**
```bash
curl -X POST http://localhost:3002/api/reset
```

**Test Flowise:**
```bash
curl -X POST https://your-flowise-url/api/v1/prediction/your-chatflow-id \
  -H "Content-Type: application/json" \
  -d '{"question": "test"}'
```

**Kill stuck processes:**
```bash
lsof -ti:3000 | xargs kill -9
lsof -ti:3002 | xargs kill -9
```
