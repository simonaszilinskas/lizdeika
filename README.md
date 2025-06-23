# Vilnius Assistant - AI-Powered Customer Support System

This project integrates Freescout (help desk software) with Flowise (AI workflow builder) to create an intelligent customer support system.

## Architecture

```
Customer Email → Freescout → Webhook → Middleware Service → Flowise AI → Suggestion → Support Agent
```

## Components

### 1. Simple Demo Interface
- `login.html` - Basic login page
- `chat.html` - Demo chat interface with AI suggestions
- `server.js` - Simple Express server with authentication

### 2. Production Integration
- `middleware-service/` - Connects Freescout with Flowise
- `integration-architecture.md` - Detailed integration guide

## Quick Start (Demo Interface)

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. Start the demo server:
```bash
npm start
```

4. Access at `http://localhost:3000`

## Production Setup with Freescout + Flowise

### Prerequisites

1. **Freescout Installation**
   - Install Freescout (self-hosted)
   - Enable API module
   - Generate API key

2. **Flowise Setup**
   - Install Flowise
   - Create customer support chatflow
   - Configure LLM (OpenAI, Claude, etc.)

### Middleware Service Setup

1. Navigate to middleware service:
```bash
cd middleware-service
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit with your Freescout and Flowise credentials
```

3. Start the middleware:
```bash
npm start
```

### Freescout Configuration

1. Go to Freescout Admin → Settings → Webhooks
2. Add webhook URL: `http://your-middleware:3001/webhooks/freescout`
3. Select events:
   - Conversation Created
   - Customer Replied

### Flowise Chatflow Setup

1. Create new chatflow in Flowise
2. Add components:
   - Chat Model (OpenAI/Claude)
   - System Prompt (customer support persona)
   - Memory (conversation history)
   - Output Parser

3. System prompt example:
```
You are a helpful customer support agent. Provide professional, 
empathetic responses to customer inquiries. Keep responses 
concise and actionable.
```

## How It Works

1. **Customer sends email** → Received by Freescout
2. **Webhook triggered** → Middleware receives event
3. **Context gathered** → Customer history, ticket details
4. **AI suggestion generated** → Flowise processes with LLM
5. **Suggestion delivered** → As draft or note in Freescout
6. **Agent reviews** → Can send, edit, or write new response

## API Endpoints

### Middleware Service
- `POST /webhooks/freescout` - Webhook receiver
- `GET /api/suggestions/:conversationId` - Get AI suggestion
- `POST /api/suggestions/:conversationId/feedback` - Track usage

## Features

- ✅ Real-time AI suggestions for support tickets
- ✅ Customer history context
- ✅ Confidence scoring
- ✅ Draft/note creation based on confidence
- ✅ Feedback tracking
- ✅ Webhook signature verification

## Security Considerations

- Use HTTPS in production
- Secure API keys in environment variables
- Implement rate limiting
- Validate webhook signatures
- Use database for session storage

## Monitoring

- Check middleware logs for webhook events
- Monitor Flowise API response times
- Track suggestion acceptance rates
- Set up alerts for failures

## Troubleshooting

1. **Webhook not receiving events**
   - Check Freescout webhook configuration
   - Verify middleware is accessible from Freescout
   - Check webhook signature if enabled

2. **AI suggestions not generating**
   - Verify Flowise is running
   - Check Flowise API key and chatflow ID
   - Review Flowise chatflow configuration

3. **Suggestions not appearing in Freescout**
   - Check Freescout API permissions
   - Verify conversation/draft creation endpoints
   - Review middleware logs for errors

## Next Steps

1. Add database for suggestion history
2. Implement Redis queue for scalability
3. Create custom Freescout module for better UI
4. Add more sophisticated confidence scoring
5. Implement A/B testing for prompts
6. Add analytics dashboard# vilnius-support
