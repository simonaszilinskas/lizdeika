# Freescout + Flowise Integration Architecture

## Prerequisites

1. **Freescout Setup**
   - Install Freescout (self-hosted)
   - Enable API module: `php artisan freescout:module-install api`
   - Generate API key for authentication
   - Configure webhooks in Freescout settings

2. **Flowise Setup**
   - Install and run Flowise
   - Create a customer support chatflow
   - Configure with your preferred LLM (OpenAI, Claude, etc.)
   - Note the API endpoint and API key

## Middleware Service Structure

```
middleware-service/
├── src/
│   ├── config/
│   │   └── index.js          # Configuration management
│   ├── services/
│   │   ├── freescout.js      # Freescout API client
│   │   └── flowise.js        # Flowise API client
│   ├── webhooks/
│   │   └── freescout.js      # Webhook handlers
│   ├── queue/
│   │   └── processor.js      # Async job processing
│   └── app.js                # Express server
├── package.json
└── .env
```

## API Endpoints Needed

### Middleware Service Endpoints
- `POST /webhooks/freescout` - Receive Freescout events
- `GET /api/suggestions/:ticketId` - Get AI suggestions for a ticket
- `POST /api/suggestions/:ticketId/feedback` - Track suggestion usage

### Freescout API Calls
- `GET /api/conversations/:id` - Fetch ticket details
- `POST /api/conversations/:id/threads` - Add AI suggestion as draft
- `GET /api/customers/:id` - Get customer history

### Flowise API Calls
- `POST /api/v1/prediction/:chatflowId` - Get AI response
- Include conversation history and customer context

## Environment Variables

```env
# Freescout
FREESCOUT_URL=https://your-freescout.com
FREESCOUT_API_KEY=your-api-key
FREESCOUT_WEBHOOK_SECRET=webhook-secret

# Flowise
FLOWISE_URL=http://localhost:3000
FLOWISE_API_KEY=your-flowise-key
FLOWISE_CHATFLOW_ID=your-chatflow-id

# Database
DATABASE_URL=postgresql://...

# Redis (for queue)
REDIS_URL=redis://localhost:6379
```

## Webhook Event Handler Example

```javascript
// webhooks/freescout.js
async function handleNewTicket(data) {
  const { conversation_id, customer_id, subject, preview } = data;
  
  // 1. Fetch full conversation
  const conversation = await freescoutAPI.getConversation(conversation_id);
  
  // 2. Get customer history
  const customer = await freescoutAPI.getCustomer(customer_id);
  
  // 3. Prepare context for AI
  const context = {
    currentIssue: conversation.threads[0].body,
    customerHistory: customer.previous_conversations,
    metadata: {
      subject,
      category: conversation.tags,
      priority: conversation.status
    }
  };
  
  // 4. Get AI suggestion
  const suggestion = await flowiseAPI.getSuggestion(context);
  
  // 5. Store suggestion
  await db.saveSuggestion({
    conversation_id,
    suggestion: suggestion.text,
    confidence: suggestion.confidence
  });
  
  // 6. Notify agent (via Freescout note or custom UI)
  await freescoutAPI.addNote(conversation_id, {
    body: `AI Suggestion: ${suggestion.text}`,
    type: 'ai_suggestion'
  });
}
```

## Flowise Chatflow Configuration

1. **Input Processing**
   - Parse ticket content
   - Extract customer history
   - Identify issue category

2. **LLM Chain Setup**
   - System prompt for support agent persona
   - Context injection (knowledge base, policies)
   - Response formatting rules

3. **Output Processing**
   - Format response for Freescout
   - Add confidence scoring
   - Include suggested actions

## Deployment Considerations

1. **Security**
   - Validate webhook signatures
   - Encrypt API keys
   - Use HTTPS for all communications

2. **Performance**
   - Use Redis queue for async processing
   - Implement rate limiting
   - Cache frequent AI responses

3. **Monitoring**
   - Log all API interactions
   - Track suggestion acceptance rate
   - Monitor response times

## Next Steps

1. Set up Freescout with API module
2. Create Flowise chatflow for support
3. Build middleware service
4. Configure webhooks
5. Test integration flow
6. Add agent feedback UI in Freescout