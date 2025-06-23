# Custom Chat Widget Architecture

## Overview
Build a lightweight chat widget that connects directly to Flowise for AI-powered support without Freescout.

## Tech Stack
- **Frontend**: Vanilla JS widget (embeddable)
- **Backend**: Node.js/Express API
- **AI**: Flowise for responses
- **Database**: PostgreSQL for conversations
- **WebSocket**: Socket.io for real-time chat

## Architecture

```
Customer → Chat Widget → WebSocket → Backend API → Flowise AI
                                         ↓
                                    PostgreSQL
```

## Key Components

### 1. Embeddable Widget (`widget.js`)
```javascript
// Minimal embed code for websites
<script>
  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'widget.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://your-domain.com/widget.js';f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','WIDGET_ID');
</script>
```

### 2. Backend API Endpoints
- `POST /api/conversations` - Start new conversation
- `POST /api/messages` - Send message
- `GET /api/messages/:conversationId` - Get history
- `WS /socket` - Real-time messaging

### 3. Database Schema
```sql
-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  visitor_id VARCHAR(255),
  status VARCHAR(50),
  created_at TIMESTAMP,
  metadata JSONB
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  sender_type VARCHAR(50), -- 'visitor', 'ai', 'agent'
  content TEXT,
  created_at TIMESTAMP
);
```

### 4. Flowise Integration
```javascript
async function getAIResponse(conversationHistory, currentMessage) {
  const context = {
    history: conversationHistory,
    question: currentMessage,
    metadata: {
      timestamp: new Date(),
      source: 'chat_widget'
    }
  };
  
  return await flowiseAPI.predict(context);
}
```

## Features

1. **Instant AI Responses**
   - No human agent needed initially
   - Seamless handoff when required

2. **Persistent Conversations**
   - Cookie-based visitor tracking
   - Conversation history retained

3. **Real-time Updates**
   - WebSocket for instant messaging
   - Typing indicators

4. **Simple Admin Panel**
   - View all conversations
   - Take over from AI when needed
   - Export conversation data

## Implementation Timeline

**Week 1**: Widget development
- Create embeddable widget
- Style customization options
- Mobile responsive design

**Week 2**: Backend API
- Set up Express server
- PostgreSQL integration
- Flowise connection

**Week 3**: Real-time features
- Socket.io integration
- Typing indicators
- Online/offline status

**Week 4**: Admin panel
- Simple dashboard
- Conversation management
- Basic analytics

## Advantages Over Freescout Integration

1. **Faster Setup**: Days vs weeks
2. **Lower Cost**: No licensing fees
3. **Better UX**: Real-time chat vs email-style
4. **Simpler**: Direct Flowise connection
5. **Customizable**: Full control over features

## Migration Path

Start with custom widget, then if needed:
1. Export conversations to Freescout later
2. Use Freescout for email channel only
3. Keep widget for website visitors