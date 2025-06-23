# Custom Chat Widget - Direct Flowise Integration

A lightweight, embeddable chat widget that connects directly to Flowise AI without needing Freescout.

## Why Choose This Over Freescout?

### Advantages ✅
- **Faster Setup**: Hours vs days
- **Lower Cost**: No Freescout licensing
- **Better UX**: Real-time chat experience
- **Simpler Architecture**: Direct Flowise connection
- **Full Control**: Customize everything
- **Modern Stack**: WebSocket support ready

### Trade-offs ⚠️
- No built-in email support
- Basic ticketing system
- Limited reporting (initially)
- Single channel (web only)
- Manual agent handoff

## Quick Start

### 1. Set Up Flowise

Create a chatflow in Flowise with:
- Chat Model (OpenAI/Claude/etc)
- System prompt for customer support
- Memory component for conversation history

### 2. Start the Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your Flowise credentials
npm start
```

### 3. Embed the Widget

Add to any website:
```html
<script src="https://your-domain.com/widget.js"></script>
<script>
  VilniusChat.init({
    apiUrl: 'https://your-backend.com',
    theme: {
      primaryColor: '#4F46E5',
      position: 'bottom-right'
    }
  });
</script>
```

### 4. Access Admin Dashboard

Open `admin.html` in your browser to view conversations.

## Features

### For Visitors
- 🎯 Instant AI responses
- 💬 Persistent conversations
- 📱 Mobile responsive
- 🔒 Privacy-focused (local storage)

### For Admins
- 📊 Simple dashboard
- 💾 Conversation history
- 📈 Basic analytics
- 🔍 Message search (coming soon)

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Website   │────▶│   Widget    │────▶│   Backend   │
│   Visitor   │     │     JS      │     │   API       │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Flowise   │
                                        │     AI      │
                                        └─────────────┘
```

## Customization

### Widget Appearance
```javascript
VilniusChat.init({
  theme: {
    primaryColor: '#Your-Brand-Color',
    position: 'bottom-right', // or 'bottom-left'
    fontSize: '14px',
    borderRadius: '16px'
  }
});
```

### AI Behavior
Configure in Flowise:
- Adjust system prompts
- Add knowledge bases
- Set response tone
- Configure fallbacks

## Production Deployment

### Backend Requirements
- Node.js 16+
- PostgreSQL (for persistence)
- Redis (optional, for caching)
- SSL certificate

### Environment Variables
```env
# Required
FLOWISE_URL=https://your-flowise.com
FLOWISE_CHATFLOW_ID=abc123
FLOWISE_API_KEY=your-key

# Production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ALLOWED_ORIGINS=https://your-site.com
```

### Deployment Options
1. **Vercel/Netlify**: For the widget files
2. **Heroku/Railway**: For the backend API
3. **AWS/GCP**: For scalability

## Scaling Considerations

### Phase 1: MVP (Now)
- In-memory storage
- Single server
- Basic features

### Phase 2: Growth
- Add PostgreSQL
- Implement caching
- Add agent handoff

### Phase 3: Scale
- Multiple backends
- Load balancing
- Advanced analytics

## Migration Path

If you outgrow this solution:
1. Export conversations via API
2. Import into Freescout/Zendesk
3. Keep widget for web, use platform for email

## Security

- Sanitize all inputs
- Implement rate limiting
- Use HTTPS in production
- Validate origins
- Rotate API keys

## Monitoring

Track these metrics:
- Response times
- Conversation completion rates
- Error rates
- User satisfaction

## Next Steps

1. **Test with real users**
2. **Gather feedback**
3. **Iterate on UI/UX**
4. **Add requested features**

## Support

- Issues: Create GitHub issue
- Questions: Check FAQ below
- Custom development: Contact team

## FAQ

**Q: Can I use multiple Flowise chatflows?**
A: Yes, modify the backend to route based on page/criteria.

**Q: How do I add human agents?**
A: Implement a queue system and agent dashboard.

**Q: Can this handle high traffic?**
A: Yes, with proper infrastructure (load balancer, multiple instances).

**Q: Is this GDPR compliant?**
A: Implement data retention policies and user consent.