const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.WIDGET_BACKEND_PORT || process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../')); // Serve widget files

// In-memory storage (use PostgreSQL in production)
const conversations = new Map();
const messages = new Map();
const agents = new Map(); // Store agent status and info

// Flowise configuration
const flowise = {
    url: process.env.FLOWISE_URL || 'https://flowise-production-478e.up.railway.app',
    apiKey: process.env.FLOWISE_API_KEY,
    chatflowId: process.env.FLOWISE_CHATFLOW_ID || '941a1dae-117e-4667-bf4f-014221e8435b'
};

// Helper function to get an available agent
function getAvailableAgent() {
    const activeAgents = Array.from(agents.values()).filter(agent => 
        agent.status === 'online' && 
        (new Date() - agent.lastSeen) < 60000 // Active in last minute
    );
    
    if (activeAgents.length === 0) return null;
    
    // Find agent with least active chats
    const agentLoads = activeAgents.map(agent => ({
        ...agent,
        activeChats: Array.from(conversations.values()).filter(c => c.assignedAgent === agent.id).length
    }));
    
    // Sort by least busy agent
    agentLoads.sort((a, b) => a.activeChats - b.activeChats);
    
    return agentLoads[0];
}

/**
 * Build conversation context for AI from message history
 * @param {Array} conversationMessages - Array of messages
 * @param {string} currentMessage - The current message being processed
 * @returns {string} Formatted conversation context
 */
function buildConversationContext(conversationMessages, currentMessage) {
    // Get only customer and agent messages (exclude system messages)
    const relevantMessages = conversationMessages.filter(msg => 
        msg.sender === 'visitor' || msg.sender === 'agent'
    );
    
    // Add current message to context
    const allMessages = [
        ...relevantMessages,
        { sender: 'visitor', content: currentMessage, timestamp: new Date() }
    ];
    
    // Format messages as conversation
    const conversationHistory = allMessages
        .map(msg => {
            const sender = msg.sender === 'visitor' ? 'Customer' : 'Agent';
            return `${sender}: ${msg.content}`;
        })
        .join('\n\n');
    
    // If conversation is getting long, include only recent messages
    if (conversationHistory.length > 2000) {
        const recentMessages = allMessages.slice(-5); // Last 5 messages
        return recentMessages
            .map(msg => {
                const sender = msg.sender === 'visitor' ? 'Customer' : 'Agent';
                return `${sender}: ${msg.content}`;
            })
            .join('\n\n');
    }
    
    return conversationHistory;
}

/**
 * Generate AI suggestion using Flowise with conversation context
 * @param {string} conversationId - Conversation ID for session
 * @param {string} conversationContext - Full conversation context
 * @returns {string} AI suggestion
 */
async function generateAISuggestion(conversationId, conversationContext) {
    try {
        // Create a more contextual prompt for the AI
        const contextualPrompt = conversationContext.includes('Agent:') 
            ? `Please respond to the customer based on this conversation history:\n\n${conversationContext}\n\nProvide a helpful, professional response that addresses the customer's latest message and any unresolved issues from the conversation.`
            : `Customer message: ${conversationContext}\n\nPlease provide a helpful, professional response to this customer inquiry.`;
        
        // Use the exact same format as your working query function
        const response = await fetch(
            `${flowise.url}/api/v1/prediction/${flowise.chatflowId}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    question: contextualPrompt,
                    overrideConfig: {
                        sessionId: conversationId
                    }
                })
            }
        );
        
        if (!response.ok) {
            throw new Error(`Flowise API error: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Flowise response:', result);
        
        return result.text || result.answer || 'I apologize, but I couldn\'t generate a response at this time.';
    } catch (error) {
        console.error('Error generating AI suggestion:', error.message);
        return 'I apologize, but I\'m having trouble generating a suggestion right now. Please respond based on your best judgment.';
    }
}

// Create new conversation
app.post('/api/conversations', (req, res) => {
    const conversationId = uuidv4();
    const conversation = {
        id: conversationId,
        visitorId: req.body.visitorId || uuidv4(),
        startedAt: new Date(),
        status: 'active',
        metadata: req.body.metadata || {}
    };
    
    conversations.set(conversationId, conversation);
    messages.set(conversationId, []);
    
    res.json({ conversationId, conversation });
});

// Send message and get AI response
app.post('/api/messages', async (req, res) => {
    const { conversationId, message, visitorId, requestHuman } = req.body;
    
    try {
        // Create conversation if doesn't exist
        if (!conversations.has(conversationId)) {
            const conversation = {
                id: conversationId,
                visitorId: visitorId || uuidv4(),
                startedAt: new Date(),
                status: 'active'
            };
            conversations.set(conversationId, conversation);
            messages.set(conversationId, []);
        }
        
        // Store user message
        const userMessage = {
            id: uuidv4(),
            conversationId,
            content: message,
            sender: 'visitor',
            timestamp: new Date()
        };
        
        const conversationMessages = messages.get(conversationId) || [];
        
        // Get conversation context for AI (include current message without storing it yet)
        const conversationContext = buildConversationContext(conversationMessages, message);
        
        // Generate AI suggestion with full conversation context
        const aiSuggestion = await generateAISuggestion(conversationId, conversationContext);
        
        // Remove any existing pending messages first
        const filteredMessages = conversationMessages.filter(msg => 
            !(msg.sender === 'system' && msg.metadata && msg.metadata.pendingAgent)
        );
        
        // Count customer messages for context (including current message)
        const customerMessageCount = filteredMessages.filter(msg => msg.sender === 'visitor').length + 1;
        
        // Create new pending message with AI suggestion
        const aiMessage = {
            id: uuidv4(),
            conversationId,
            content: '[Message pending agent response - AI suggestion available]',
            sender: 'system',
            timestamp: new Date(),
            metadata: { 
                pendingAgent: true,
                aiSuggestion: aiSuggestion,
                confidence: 0.85,
                customerMessage: message,
                messageCount: customerMessageCount,
                conversationContext: conversationContext.substring(0, 200) + '...' // Store summary for debugging
            }
        };
        
        // Add current user message and AI suggestion to filtered messages
        filteredMessages.push(userMessage);
        filteredMessages.push(aiMessage);
        
        console.log(`Generated AI suggestion for conversation ${conversationId} with ${customerMessageCount} customer messages`);
        
        // Auto-assign to available agent if not assigned
        const conversation = conversations.get(conversationId);
        if (!conversation.assignedAgent) {
            const availableAgent = getAvailableAgent();
            if (availableAgent) {
                conversation.assignedAgent = availableAgent.id;
                conversation.assignedAt = new Date();
                conversations.set(conversationId, conversation);
                
                // Add system message about assignment
                const assignmentMessage = {
                    id: uuidv4(),
                    conversationId,
                    content: `Conversation assigned to agent ${availableAgent.id}`,
                    sender: 'system',
                    timestamp: new Date()
                };
                filteredMessages.push(assignmentMessage);
            }
        }
        
        // Store the cleaned up messages
        messages.set(conversationId, filteredMessages);
        
        // Emit new message to agents via WebSocket
        io.to('agents').emit('new-message', {
            conversationId,
            message: userMessage,
            aiSuggestion: aiMessage,
            timestamp: new Date()
        });
        
        res.json({
            userMessage,
            aiMessage,
            conversationId
        });
        
    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).json({
            error: 'Failed to process message',
            details: error.message
        });
    }
});

// Get conversation history
app.get('/api/conversations/:conversationId/messages', (req, res) => {
    const { conversationId } = req.params;
    const conversationMessages = messages.get(conversationId) || [];
    
    res.json({
        conversationId,
        messages: conversationMessages
    });
});

// Admin endpoint to view all conversations
app.get('/api/admin/conversations', (req, res) => {
    const allConversations = Array.from(conversations.values()).map(conv => ({
        ...conv,
        messageCount: (messages.get(conv.id) || []).length,
        lastMessage: (messages.get(conv.id) || []).slice(-1)[0]
    }));
    
    res.json({
        conversations: allConversations,
        total: allConversations.length
    });
});

// Agent endpoints

// Update agent status
app.post('/api/agent/status', (req, res) => {
    const { agentId, status } = req.body;
    
    agents.set(agentId, {
        id: agentId,
        status: status, // online, busy, offline
        lastSeen: new Date(),
        activeChats: Array.from(conversations.values()).filter(c => c.assignedAgent === agentId).length
    });
    
    res.json({ success: true });
});

// Assign conversation to agent
app.post('/api/conversations/:conversationId/assign', (req, res) => {
    const { conversationId } = req.params;
    const { agentId } = req.body;
    
    const conversation = conversations.get(conversationId);
    if (conversation) {
        conversation.assignedAgent = agentId;
        conversation.assignedAt = new Date();
        conversations.set(conversationId, conversation);
        
        // Add system message about assignment
        const conversationMessages = messages.get(conversationId) || [];
        conversationMessages.push({
            id: uuidv4(),
            conversationId,
            content: `Agent has joined the conversation`,
            sender: 'system',
            timestamp: new Date()
        });
        messages.set(conversationId, conversationMessages);
        
        res.json({ success: true, conversation });
    } else {
        res.status(404).json({ error: 'Conversation not found' });
    }
});

// Agent send message
app.post('/api/agent/message', (req, res) => {
    const { conversationId, message, agentId } = req.body;
    
    try {
        const conversation = conversations.get(conversationId);
        if (!conversation || conversation.assignedAgent !== agentId) {
            return res.status(403).json({ error: 'Not authorized for this conversation' });
        }
        
        // Store agent message
        const agentMessage = {
            id: uuidv4(),
            conversationId,
            content: message,
            sender: 'agent',
            timestamp: new Date(),
            agentId
        };
        
        const conversationMessages = messages.get(conversationId) || [];
        conversationMessages.push(agentMessage);
        messages.set(conversationId, conversationMessages);
        
        res.json({ success: true, message: agentMessage });
        
    } catch (error) {
        console.error('Error sending agent message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// End conversation
app.post('/api/conversations/:conversationId/end', (req, res) => {
    const { conversationId } = req.params;
    const { agentId } = req.body;
    
    const conversation = conversations.get(conversationId);
    if (conversation && conversation.assignedAgent === agentId) {
        conversation.status = 'resolved';
        conversation.endedAt = new Date();
        conversations.set(conversationId, conversation);
        
        // Add system message
        const conversationMessages = messages.get(conversationId) || [];
        conversationMessages.push({
            id: uuidv4(),
            conversationId,
            content: `Conversation ended by agent`,
            sender: 'system',
            timestamp: new Date()
        });
        messages.set(conversationId, conversationMessages);
        
        res.json({ success: true });
    } else {
        res.status(403).json({ error: 'Not authorized' });
    }
});

// Get active agents
app.get('/api/agents', (req, res) => {
    const activeAgents = Array.from(agents.values()).filter(agent => 
        agent.status !== 'offline' && 
        (new Date() - agent.lastSeen) < 60000 // Active in last minute
    );
    
    res.json({ agents: activeAgents });
});

// Get AI suggestion for a pending message
app.get('/api/conversations/:conversationId/pending-suggestion', (req, res) => {
    const { conversationId } = req.params;
    
    const conversationMessages = messages.get(conversationId) || [];
    
    // Find the most recent message with AI suggestion (by lastUpdated timestamp)
    const pendingMessages = conversationMessages
        .filter(msg => msg.metadata && msg.metadata.pendingAgent && msg.metadata.aiSuggestion);
    
    const pendingMessage = pendingMessages.length > 0 
        ? pendingMessages.reduce((latest, current) => {
            const latestTime = latest.metadata.lastUpdated || latest.timestamp;
            const currentTime = current.metadata.lastUpdated || current.timestamp;
            return new Date(currentTime) > new Date(latestTime) ? current : latest;
        })
        : null;
    
    if (pendingMessage) {
        res.json({
            suggestion: pendingMessage.metadata.aiSuggestion,
            confidence: pendingMessage.metadata.confidence || 0.8,
            messageId: pendingMessage.id,
            timestamp: pendingMessage.timestamp,
            metadata: {
                messageCount: pendingMessage.metadata.messageCount || 1,
                customerMessages: pendingMessage.metadata.customerMessages
            }
        });
    } else {
        res.status(404).json({ error: 'No pending suggestion found' });
    }
});

// Agent sends response (using AI suggestion, edited, or from scratch)
app.post('/api/agent/respond', (req, res) => {
    const { conversationId, message, agentId, usedSuggestion, suggestionAction } = req.body;
    // suggestionAction: 'as-is', 'edited', 'from-scratch'
    
    try {
        const conversation = conversations.get(conversationId);
        if (!conversation || conversation.assignedAgent !== agentId) {
            return res.status(403).json({ error: 'Not authorized for this conversation' });
        }
        
        // Store agent message
        const agentMessage = {
            id: uuidv4(),
            conversationId,
            content: message,
            sender: 'agent',
            timestamp: new Date(),
            agentId,
            metadata: {
                suggestionAction: suggestionAction,
                usedSuggestion: usedSuggestion
            }
        };
        
        const conversationMessages = messages.get(conversationId) || [];
        
        // Remove any pending system messages for this conversation
        const filteredMessages = conversationMessages.filter(msg => 
            !(msg.sender === 'system' && msg.metadata && msg.metadata.pendingAgent)
        );
        
        filteredMessages.push(agentMessage);
        messages.set(conversationId, filteredMessages);
        
        // Emit agent message to customer via WebSocket
        io.to(conversationId).emit('agent-message', {
            message: agentMessage,
            timestamp: new Date()
        });
        
        console.log(`Agent ${agentId} sent message to conversation ${conversationId}: ${message.substring(0, 50)}...`);
        
        res.json({ success: true, message: agentMessage });
        
    } catch (error) {
        console.error('Error sending agent response:', error);
        res.status(500).json({ error: 'Failed to send response' });
    }
});

// Reset endpoint for testing (clears all data)
app.post('/api/reset', (req, res) => {
    try {
        const conversationCount = conversations.size;
        const messageCount = Array.from(messages.values()).reduce((total, msgs) => total + msgs.length, 0);
        const agentCount = agents.size;
        
        // Clear all data
        conversations.clear();
        messages.clear();
        agents.clear();
        
        console.log(`Reset completed: Cleared ${conversationCount} conversations, ${messageCount} messages, ${agentCount} agents`);
        
        res.json({
            success: true,
            message: 'All data cleared successfully',
            cleared: {
                conversations: conversationCount,
                messages: messageCount,
                agents: agentCount
            }
        });
    } catch (error) {
        console.error('Error during reset:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset data'
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        flowise: {
            url: flowise.url,
            configured: !!flowise.chatflowId
        }
    });
});

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Join conversation room
    socket.on('join-conversation', (conversationId) => {
        socket.join(conversationId);
        console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
    });
    
    // Join agent dashboard
    socket.on('join-agent-dashboard', (agentId) => {
        socket.join('agents');
        socket.agentId = agentId;
        
        // Update agent status to online
        agents.set(agentId, {
            id: agentId,
            status: 'online',
            lastSeen: new Date(),
            socketId: socket.id,
            activeChats: Array.from(conversations.values()).filter(c => c.assignedAgent === agentId).length
        });
        
        console.log(`Agent ${agentId} connected with socket ${socket.id}`);
        
        // Broadcast agent status to all agents
        io.to('agents').emit('agent-status-update', {
            agentId,
            status: 'online',
            timestamp: new Date()
        });
    });
    
    // Handle agent typing
    socket.on('agent-typing', (data) => {
        const { conversationId, isTyping } = data;
        socket.to(conversationId).emit('agent-typing-status', {
            isTyping,
            timestamp: new Date()
        });
    });
    
    // Handle customer typing
    socket.on('customer-typing', (data) => {
        const { conversationId, isTyping } = data;
        io.to('agents').emit('customer-typing-status', {
            conversationId,
            isTyping,
            timestamp: new Date()
        });
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        
        // Update agent status if this was an agent
        if (socket.agentId) {
            const agent = agents.get(socket.agentId);
            if (agent) {
                agent.status = 'offline';
                agent.lastSeen = new Date();
                agents.set(socket.agentId, agent);
                
                // Broadcast agent status to all agents
                io.to('agents').emit('agent-status-update', {
                    agentId: socket.agentId,
                    status: 'offline',
                    timestamp: new Date()
                });
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Widget backend running on http://localhost:${PORT}`);
    console.log('WebSocket server initialized');
    console.log('Configuration:');
    console.log(`- Flowise URL: ${flowise.url}`);
    console.log(`- Chatflow ID: ${flowise.chatflowId || 'NOT SET'}`);
    console.log(`- API Key: ${flowise.apiKey ? 'SET' : 'NOT SET'}`);
    console.log('\nEndpoints:');
    console.log('- POST /api/conversations');
    console.log('- POST /api/messages');
    console.log('- GET /api/conversations/:id/messages');
    console.log('- GET /api/admin/conversations');
    console.log('- POST /api/reset (for testing)');
});