# Quick Start Guide - Vilnius Chat Widget

Your Flowise endpoint is already configured! Follow these steps to get the chat widget running:

## 1. Install Backend Dependencies

```bash
cd custom-widget/backend
npm install
```

## 2. Start the Backend Server

```bash
npm start
```

The server will start on http://localhost:3002

## 3. Open the Demo Page

Open `custom-widget/embed-widget.html` in your browser to see the chat widget in action.

## 4. Test the Widget

1. Click the blue chat bubble in the bottom-right corner
2. Type a message like "Hey, how are you?"
3. The AI will respond using your Flowise chatflow

## What's Configured

✅ **Flowise Endpoint**: `https://flowise-production-478e.up.railway.app`  
✅ **Chatflow ID**: `941a1dae-117e-4667-bf4f-014221e8435b`  
✅ **No API Key Required**: Your endpoint is public

## Optional: View Admin Dashboard

Open `custom-widget/admin.html` to see all conversations and messages.

## Troubleshooting

If the widget doesn't respond:
1. Check that the backend is running (`npm start`)
2. Open browser console for any errors
3. Verify your Flowise endpoint is accessible

## Next Steps

1. **Customize the widget appearance** in `embed-widget.html`
2. **Deploy the backend** to Railway/Heroku
3. **Add the widget to your website** with the embed code
4. **Set up a database** for persistent conversations