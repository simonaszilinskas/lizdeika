# Middleware Service

⚠️ **This directory contains example integration code that is NOT currently used in the main application.**

## Purpose

This middleware service was created as an example of how to integrate with external systems like FreeScout. It demonstrates:

- Webhook handling for external ticket systems
- API integration with Flowise AI
- Message routing and processing

## Current Status

**NOT IN USE** - The main application currently uses direct Flowise integration in the `custom-widget/backend/server.js` file.

## If You Want to Use This

If you want to integrate with FreeScout or similar ticket systems, you can:

1. Update the configuration in `src/app.js`
2. Set up the required environment variables
3. Configure your external system to send webhooks to this service
4. Update the main application to use this middleware instead of direct Flowise calls

## Files

- `src/app.js` - Main Express server
- `src/services/flowise.js` - Flowise AI integration
- `src/services/freescout.js` - FreeScout integration example
- `package.json` - Dependencies

## To Run (if needed)

```bash
cd middleware-service
npm install
npm start
```

The service will run on port 3001 by default.