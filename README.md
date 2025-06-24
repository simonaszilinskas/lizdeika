# Vilnius Support Chat System

A customer support chat system with AI-powered assistance using Flowise integration.

## Features

- **Customer Chat Widget**: Embeddable widget for websites
- **Agent Dashboard**: Real-time dashboard for support agents
- **AI Suggestions**: Flowise-powered AI suggestions for agent responses
- **Real-time Updates**: Automatic polling for new messages

## Quick Start

1. Install dependencies:
```bash
npm install
cd custom-widget/backend && npm install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Start the servers:
```bash
# Main server (port 3000)
npm start

# Widget backend (port 3002)
cd custom-widget/backend && npm start
```

4. Access the applications:
- Agent Dashboard: http://localhost:3000
- Admin Dashboard: http://localhost:3000/custom-widget/admin.html
- Widget Demo: http://localhost:3000/custom-widget/embed-widget.html

## Environment Variables

- `FLOWISE_URL`: Your Flowise instance URL
- `FLOWISE_CHATFLOW_ID`: Your Flowise chatflow ID
- `FLOWISE_API_KEY`: Your Flowise API key (if required)

## Embedding the Widget

Add this script to any website:
```html
<script src="http://localhost:3000/custom-widget/widget.js"></script>
<script>
    VilniusChat.init({
        apiUrl: 'http://localhost:3002'
    });
</script>
```