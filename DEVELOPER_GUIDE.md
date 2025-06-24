# Developer Guide - Vilnius Support Chat

## How This Project Works

### The Big Picture
This is a customer support chat system with 3 main parts:
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
   - Fix: Add database (PostgreSQL or SQLite)

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
   - Login system for agents
   - Track which agent sent what

3. **File Uploads**
   - Customers send screenshots
   - Agents send documents

4. **Conversation Search**
   - Find old chats by keyword
   - Filter by date, status

### Medium Priority
5. **Canned Responses**
   - Pre-written answers for common questions
   - Quick insert buttons

6. **Customer Info**
   - Name, email, phone collection
   - Show in agent dashboard

7. **Analytics**
   - Response time tracking
   - Customer satisfaction

8. **Multiple Languages**
   - UI translation
   - Auto-detect customer language

### Nice to Have
9. **Voice Messages**
10. **Screen Sharing**
11. **Co-browsing**
12. **Chatbot Handoff**

## How to Add a New Feature

### Example: Adding Email Collection

1. **Update Widget UI** (`widget.js`):
```javascript
// Add email input to chat window
const emailInput = '<input type="email" placeholder="Your email" id="customer-email">';
```

2. **Update Message Sending** (`widget.js`):
```javascript
// In sendMessage function
const email = document.getElementById('customer-email').value;
body: JSON.stringify({
    conversationId: this.conversationId,
    message: message,
    customerEmail: email // NEW
})
```

3. **Update Backend** (`backend/server.js`):
```javascript
// In POST /api/messages
const { conversationId, message, customerEmail } = req.body;
// Store email with conversation
```

4. **Show in Dashboard** (`agent-dashboard.js`):
```javascript
// Display email in conversation header
document.getElementById('customer-email').textContent = conv.customerEmail;
```

## Common Issues & Solutions

### "Can't see messages"
1. Check both servers are running (ports 3000 & 3002)
2. Check browser console for errors
3. Check network tab for failed requests

### "AI suggestions not working"
1. Verify `.env` has correct Flowise URL
2. Test Flowise directly with curl
3. Check widget backend logs

### "Widget not appearing"
1. Check if `widget.js` loaded (network tab)
2. Look for JavaScript errors
3. Try incognito mode (no extensions)

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

## Contact for Questions

If you're stuck:
1. Check browser console first
2. Check server logs
3. Search for the error message
4. Try the quick fixes above

Remember: This is a simple system. Don't overcomplicate it. Most bugs are probably port issues or missing API calls.