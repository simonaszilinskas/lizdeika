/**
 * AI SERVICE - ENHANCED WITH RAG (RETRIEVAL-AUGMENTED GENERATION)
 * 
 * Main Purpose: Provide AI-powered response generation with document context enhancement
 * 
 * Key Responsibilities:
 * - AI Provider Management: Initialize and manage different AI providers (Flowise, OpenRouter)
 * - RAG Integration: Enhance AI responses with relevant document context from knowledge base
 * - Provider Health Monitoring: Check AI provider availability and health status
 * - Response Generation: Generate contextually aware AI suggestions for agent responses
 * - Provider Switching: Support runtime switching between AI providers with fallback
 * 
 * Dependencies:
 * - AI providers module for multi-provider support
 * - Knowledge service for document retrieval and context enhancement
 * - System controller for RAG configuration settings
 * - Environment variables for provider configuration
 * 
 * Features:
 * - Multi-provider AI support (Flowise with built-in RAG, OpenRouter with external RAG)
 * - Intelligent context enhancement using vector similarity search
 * - Automatic fallback from OpenRouter to Flowise on initialization failure
 * - Retry logic with exponential backoff for improved reliability
 * - Health monitoring and provider status reporting
 * - Source attribution for document references in responses
 * 
 * RAG Process:
 * 1. Search knowledge base for relevant context using customer query
 * 2. Retrieve top-k most relevant document chunks
 * 3. Build enhanced prompt with conversation context and document information
 * 4. Include source attribution instructions for transparency
 * 5. Generate AI response using enhanced context
 * 6. Return response with confidence score and metadata
 * 
 * Provider Configuration:
 * - Flowise: Uses chatflow URL and ID, includes built-in RAG capabilities
 * - OpenRouter: Uses API key and model, requires external RAG context enhancement
 * 
 * Environment Variables:
 * - AI_PROVIDER: Current provider (flowise/openrouter)
 * - FLOWISE_URL, FLOWISE_CHATFLOW_ID: Flowise configuration
 * - OPENROUTER_API_KEY, OPENROUTER_MODEL: OpenRouter configuration
 * - RAG_K: Number of document contexts to retrieve
 * - RAG_SHOW_SOURCES: Whether to include source attribution
 * 
 * Notes:
 * - Provider instances are lazily initialized on first use
 * - Automatic fallback ensures system reliability
 * - RAG enhancement is configurable per request
 * - Health checks include provider-specific status information
 */
const { createAIProvider, retryWithBackoff } = require('../../ai-providers');
const knowledgeService = require('./knowledgeService');
// Note: Removed SystemController import to avoid circular dependency

// Global AI provider instance - initialized lazily
let aiProvider = null;

/**
 * Get or initialize AI provider
 */
function getAIProvider() {
    if (!aiProvider) {
        const AI_PROVIDER = process.env.AI_PROVIDER || 'flowise';
        
        try {
            aiProvider = createAIProvider(AI_PROVIDER, process.env);
            console.log(`AI Provider initialized: ${AI_PROVIDER}`);
        } catch (error) {
            console.error(`Failed to initialize AI provider "${AI_PROVIDER}":`, error.message);
            
            // Fallback to Flowise if OpenRouter fails
            if (AI_PROVIDER !== 'flowise') {
                try {
                    aiProvider = createAIProvider('flowise', process.env);
                    console.log('Fallback to Flowise provider successful');
                } catch (fallbackError) {
                    console.error('Fallback to Flowise also failed:', fallbackError.message);
                    aiProvider = null;
                }
            } else {
                aiProvider = null;
            }
        }
    }
    
    return aiProvider;
}

/**
 * Get fallback AI response when AI provider is unavailable
 */
function getFallbackResponse(conversationContext) {
    const fallbackResponses = [
        "Ačiū už jūsų pranešimą. Šiuo metu išgyvenu techninių sunkumų su AI asistentu, bet užtikrinsiu, kad jums atsakysiu kuo greičiau.",
        "Atsiprašau už nepatogumus. Mano AI sistema laikinai neprieinama, bet gavau jūsų pranešimą ir netrukus jums atsakysiu.",
        "Ačiū, kad kreipėtės! Nors mano AI asistentas laikinai neprieinamas, užsirašiau jūsų užklausą ir netrukus pateiksius atsakymą.",
        "Dėkoju už kantrybę. Mano AI palaikymo sistema šiuo metu neprieiama dėl techninių darbų, bet asmeniškai peržiūrėsiu jūsų pranešimą ir nedelsiant atsakysiu.",
        "Ačiū, kad susisiekėte su mumis. Dėl laikinos techninės problemos negaliu iš karto pateikti AI atsakymo, bet kuo greičiau spręsiu jūsų problemą."
    ];
    
    const contextLength = conversationContext.length;
    const index = contextLength % fallbackResponses.length;
    
    return fallbackResponses[index];
}

/**
 * Generate AI suggestion using current provider with RAG enhancement
 * Also captures debug information for developer transparency
 */
async function generateAISuggestion(conversationId, conversationContext, enableRAG = true) {
    // Initialize debug information collection
    const debugInfo = {
        timestamp: new Date().toISOString(),
        conversationId: conversationId,
        step1_originalRequest: {
            conversationContext: conversationContext,
            enableRAG: enableRAG,
            provider: process.env.AI_PROVIDER || 'flowise'
        }
    };
    const provider = getAIProvider();
    
    // If no AI provider is available, return fallback
    if (!provider) {
        console.log('No AI provider available, using fallback response');
        debugInfo.step2_providerCheck = { status: 'unavailable', fallbackUsed: true };
        const fallbackResponse = getFallbackResponse(conversationContext);
        debugInfo.finalResponse = fallbackResponse;
        await storeDebugInfo(conversationId, debugInfo);
        return fallbackResponse;
    }
    
    // Check if we need to perform a health check (every 5 minutes)
    const timeSinceLastCheck = new Date() - provider.lastHealthCheck;
    if (timeSinceLastCheck > 5 * 60 * 1000) {
        await provider.healthCheck();
    }
    
    // If provider is known to be unhealthy, return fallback immediately
    if (!provider.isHealthy) {
        console.log(`${process.env.AI_PROVIDER} provider is unhealthy, using fallback response`);
        debugInfo.step2_providerCheck = { status: 'unhealthy', fallbackUsed: true };
        const fallbackResponse = getFallbackResponse(conversationContext);
        debugInfo.finalResponse = fallbackResponse;
        await storeDebugInfo(conversationId, debugInfo);
        return fallbackResponse;
    }

    debugInfo.step2_providerCheck = { status: 'healthy', provider: process.env.AI_PROVIDER };
    
    // RAG Enhancement: Use LangChain for OpenRouter, Flowise has built-in RAG
    let enhancedContext = conversationContext;
    const currentProvider = process.env.AI_PROVIDER || 'flowise';
    const shouldUseRAG = enableRAG && currentProvider === 'openrouter';
    
    debugInfo.step3_ragProcessing = {
        enabled: enableRAG,
        provider: currentProvider,
        shouldUseRAG: shouldUseRAG
    };
    
    if (shouldUseRAG) {
        try {
            // Use LangChain RAG implementation
            const LangChainRAG = require('./langchainRAG');
            const ragService = new LangChainRAG();
            
            // Extract the most recent user message for context retrieval
            const recentMessage = extractRecentUserMessage(conversationContext);
            debugInfo.step3_ragProcessing.extractedMessage = recentMessage;
            
            // Parse conversation history for context
            const chatHistory = parseConversationHistory(conversationContext);
            debugInfo.step3_ragProcessing.chatHistoryLength = chatHistory.length;
            
            if (recentMessage) {
                // Get RAG response using LangChain with full conversation context and debug info
                const ragResult = await ragService.getAnswer(recentMessage, chatHistory, true);
                
                // Merge LangChain debug info into main debug structure
                if (ragResult.debugInfo) {
                    debugInfo.step4_langchainRAG = ragResult.debugInfo;
                }
                
                debugInfo.step5_ragResults = {
                    answer: ragResult.answer,
                    contextsUsed: ragResult.contextsUsed,
                    sources: ragResult.sources,
                    sourceUrls: ragResult.sourceUrls
                };
                debugInfo.finalResponse = ragResult.answer;
                
                // Store comprehensive debug info including LangChain internals
                await storeDebugInfo(conversationId, debugInfo);
                
                // Return the LangChain response directly
                return ragResult.answer;
            }
        } catch (error) {
            console.error('LangChain RAG Error:', error.message);
            debugInfo.step3_ragProcessing.error = error.message;
        }
    } else if (currentProvider === 'flowise') {
        console.log('Flowise provider: Using built-in RAG capabilities');
        debugInfo.step3_ragProcessing.note = 'Flowise uses built-in RAG capabilities';
    }
    
    try {
        debugInfo.step4_modelRequest = {
            enhancedContext: enhancedContext,
            contextLength: enhancedContext.length,
            provider: currentProvider
        };
        
        const response = await retryWithBackoff(async () => {
            const aiResponse = await provider.generateResponse(enhancedContext, conversationId);
            
            // Mark as healthy on successful response
            provider.isHealthy = true;
            
            return aiResponse || 'I apologize, but I couldn\'t generate a response at this time.';
        });
        
        debugInfo.step5_modelResponse = {
            response: response,
            responseLength: response.length,
            successful: true
        };
        debugInfo.finalResponse = response;
        
        // Store debug info
        await storeDebugInfo(conversationId, debugInfo);
        
        return response;
        
    } catch (error) {
        console.error(`Error generating AI suggestion from ${process.env.AI_PROVIDER} after retries:`, error.message);
        
        // Mark provider as unhealthy
        provider.isHealthy = false;
        
        debugInfo.step5_modelResponse = {
            error: error.message,
            successful: false,
            fallbackUsed: true
        };
        
        // Return fallback response
        const fallbackResponse = getFallbackResponse(conversationContext);
        debugInfo.finalResponse = fallbackResponse;
        
        // Store debug info
        await storeDebugInfo(conversationId, debugInfo);
        
        return fallbackResponse;
    }
}

/**
 * Extract the most recent user message from conversation context
 */
function extractRecentUserMessage(conversationContext) {
    // Simple extraction - get last line that looks like a user message
    const lines = conversationContext.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line && !line.startsWith('Assistant:') && !line.startsWith('AI:') && !line.startsWith('You:') && !line.startsWith('Agent:')) {
            return line.replace(/^(Customer:|User:)\s*/, '');
        }
    }
    return conversationContext;
}

/**
 * Parse conversation context into structured history for LangChain
 */
function parseConversationHistory(conversationContext) {
    const lines = conversationContext.split('\n').filter(line => line.trim());
    const history = [];
    
    let currentUserMessage = null;
    
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        
        // Check for user/customer message
        if (trimmed.startsWith('Customer: ') || trimmed.startsWith('User: ')) {
            // If we have a previous user message without response, add it with empty assistant response
            if (currentUserMessage) {
                history.push([currentUserMessage, '']);
            }
            currentUserMessage = trimmed.replace(/^(Customer:|User:)\s*/, '');
        }
        // Check for assistant/agent response
        else if (trimmed.startsWith('Assistant: ') || trimmed.startsWith('You: ') || trimmed.startsWith('Agent: ')) {
            const assistantMessage = trimmed.replace(/^(Assistant:|You:|Agent:)\s*/, '');
            
            if (currentUserMessage) {
                history.push([currentUserMessage, assistantMessage]);
                currentUserMessage = null;
            }
        }
    }
    
    // Add any remaining user message without response
    if (currentUserMessage) {
        history.push([currentUserMessage, '']);
    }
    
    return history;
}


/**
 * Get AI provider health information
 */
async function getProviderHealth() {
    const provider = getAIProvider();
    
    if (provider) {
        const providerHealthy = await provider.healthCheck();
        return {
            provider: process.env.AI_PROVIDER,
            configured: true,
            healthy: providerHealthy,
            lastCheck: provider.lastHealthCheck
        };
    } else {
        return {
            provider: process.env.AI_PROVIDER,
            configured: false,
            healthy: false,
            error: 'AI provider failed to initialize'
        };
    }
}

/**
 * Store debug information in the conversation for developer transparency
 */
async function storeDebugInfo(conversationId, debugInfo) {
    try {
        const conversationService = require('./conversationService');
        const { v4: uuidv4 } = require('uuid');
        
        // Create a hidden system message with debug metadata (no visible content)
        const debugMessage = {
            id: uuidv4(),
            conversationId,
            content: '',  // Empty content - no visible message
            sender: 'system',
            timestamp: new Date(),
            metadata: { 
                debugInfo: debugInfo,
                systemMessage: true,
                debugOnly: true  // Flag to indicate this is debug-only data
            }
        };
        
        conversationService.addMessage(conversationId, debugMessage);
    } catch (error) {
        console.error('Failed to store debug info:', error);
    }
}

/**
 * Switch to a different AI provider
 */
async function switchProvider(newProviderName) {
    try {
        const newProvider = createAIProvider(newProviderName, process.env);
        aiProvider = newProvider;
        console.log(`AI Provider successfully switched to: ${newProviderName}`);
        return aiProvider;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    generateAISuggestion,
    getProviderHealth,
    switchProvider,
    getAIProvider
};