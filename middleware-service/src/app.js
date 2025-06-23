require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const FreescoutAPI = require('./services/freescout');
const FlowiseAPI = require('./services/flowise');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
const freescout = new FreescoutAPI({
    url: process.env.FREESCOUT_URL,
    apiKey: process.env.FREESCOUT_API_KEY
});

const flowise = new FlowiseAPI({
    url: process.env.FLOWISE_URL,
    apiKey: process.env.FLOWISE_API_KEY,
    chatflowId: process.env.FLOWISE_CHATFLOW_ID
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook endpoint for Freescout
app.post('/webhooks/freescout', async (req, res) => {
    try {
        // Verify webhook signature
        const signature = req.headers['x-freescout-signature'];
        if (process.env.FREESCOUT_WEBHOOK_SECRET) {
            const isValid = freescout.verifyWebhookSignature(
                req.body,
                signature,
                process.env.FREESCOUT_WEBHOOK_SECRET
            );
            
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid signature' });
            }
        }

        const { event, data } = req.body;
        
        // Handle different event types
        switch (event) {
            case 'conversation.created':
            case 'conversation.customer_replied':
                await handleNewMessage(data);
                break;
            case 'conversation.assigned':
                console.log('Conversation assigned to agent:', data.assignee_id);
                break;
            default:
                console.log('Unhandled event:', event);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API endpoint to get AI suggestion for a specific ticket
app.get('/api/suggestions/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        
        // Fetch conversation details
        const conversation = await freescout.getConversation(conversationId);
        const customer = await freescout.getCustomer(conversation.customer_id);
        
        // Prepare context
        const context = {
            currentIssue: conversation.threads[0].body_plain || conversation.threads[0].body,
            customerHistory: customer.conversations || [],
            metadata: {
                subject: conversation.subject,
                priority: conversation.status,
                category: conversation.tags
            }
        };
        
        // Get AI suggestion
        const suggestion = await flowise.getSuggestion(context);
        
        res.json({
            conversationId,
            suggestion: suggestion.text,
            confidence: suggestion.confidence,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting suggestion:', error);
        res.status(500).json({ error: 'Failed to get AI suggestion' });
    }
});

// API endpoint to provide feedback on suggestions
app.post('/api/suggestions/:conversationId/feedback', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { action, modifiedText } = req.body;
        
        // Log feedback for analytics
        console.log(`Suggestion feedback for ${conversationId}:`, {
            action, // 'accepted', 'modified', 'rejected'
            hasModification: !!modifiedText
        });
        
        // In production, save this to database for analytics
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving feedback:', error);
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});

// Handler for new messages
async function handleNewMessage(data) {
    try {
        const { conversation_id, customer_id } = data;
        
        console.log(`Processing new message for conversation ${conversation_id}`);
        
        // Fetch full conversation details
        const conversation = await freescout.getConversation(conversation_id);
        const customer = await freescout.getCustomer(customer_id);
        
        // Prepare context for AI
        const context = {
            currentIssue: conversation.threads[0].body_plain || conversation.threads[0].body,
            customerHistory: customer.conversations || [],
            metadata: {
                subject: conversation.subject,
                priority: conversation.status,
                category: conversation.tags
            }
        };
        
        // Get AI suggestion
        const suggestion = await flowise.getSuggestion(context);
        
        // Add suggestion as a note or draft
        if (suggestion.confidence > 0.7) {
            // High confidence - create a draft reply
            await freescout.createDraftReply(conversation_id, {
                body: suggestion.text
            });
            console.log(`Created draft reply for conversation ${conversation_id}`);
        } else {
            // Lower confidence - add as a note
            await freescout.addNote(conversation_id, {
                body: `AI Suggestion (Confidence: ${Math.round(suggestion.confidence * 100)}%):\n\n${suggestion.text}`,
                type: 'ai_suggestion'
            });
            console.log(`Added AI note for conversation ${conversation_id}`);
        }
    } catch (error) {
        console.error('Error handling new message:', error);
    }
}

// Start server
app.listen(PORT, () => {
    console.log(`Middleware service running on http://localhost:${PORT}`);
    console.log('Webhook endpoint:', `/webhooks/freescout`);
    console.log('Suggestion API:', `/api/suggestions/:conversationId`);
});