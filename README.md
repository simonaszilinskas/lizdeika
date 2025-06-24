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

## Testing the Project

### Step 1: Start Both Servers

In two separate terminal windows:

```bash
# Terminal 1 - Main server
npm start
# Should see: Server running on http://localhost:3000

# Terminal 2 - Widget backend
cd custom-widget/backend
npm start
# Should see: Widget backend running on http://localhost:3002
```

### Step 2: Test the Customer Widget

1. Open http://localhost:3000/custom-widget/embed-widget.html
2. Click the chat bubble in the bottom-right corner
3. Type a message like "Hello, I need help"
4. You should see:
   - Your message appears immediately
   - A "waiting for agent" message
   - The message is sent to Flowise for AI suggestion

### Step 3: Test the Agent Dashboard

1. Open http://localhost:3000 in a new tab
2. You should see the conversation appear in the left sidebar
3. Click on the conversation
4. You'll see:
   - Customer's message
   - AI suggestion in purple (from Flowise)
   - Three buttons: "Send as-is", "Edit", "From Scratch"
5. Click "Send as-is" to send the AI suggestion
6. The customer widget should receive the response within 2 seconds

### Step 4: Test the Admin Dashboard

1. Open http://localhost:3000/custom-widget/admin.html
2. View conversation statistics and history
3. Click "View" to see full conversation details

### Testing Tips

- **Multiple Conversations**: Open the widget in multiple browser tabs to simulate different customers
- **Reset Data**: Use `curl -X POST http://localhost:3002/api/reset` to clear all test data
- **Check Logs**: Both servers will log activity to the console
- **Flowise Connection**: If AI suggestions aren't working, verify your Flowise URL and chatflow ID in `.env`

## Troubleshooting

### Common Issues

1. **"Cannot connect to server"**
   - Make sure both servers are running (ports 3000 and 3002)
   - Check if ports are already in use: `lsof -ti:3000` or `lsof -ti:3002`

2. **No AI suggestions appearing**
   - Verify your `.env` file has correct Flowise credentials
   - Test Flowise directly: `curl -X POST https://your-flowise-url/api/v1/prediction/your-chatflow-id -H "Content-Type: application/json" -d '{"question": "test"}'`
   - Check browser console for errors

3. **Messages not updating in real-time**
   - Clear browser cache and reload
   - Check browser console for polling errors
   - Verify both servers are running

4. **Widget not appearing**
   - Check browser console for JavaScript errors
   - Ensure widget.js is loading correctly
   - Try incognito/private browsing mode

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