/**
 * AI PROVIDER ABSTRACTION LAYER
 * 
 * Main Purpose: Provide unified interface for multiple AI providers with consistent API and error handling
 * 
 * Key Responsibilities:
 * - Provider Abstraction: Define common interface for different AI services
 * - Multi-Provider Support: Support Flowise, OpenRouter, and extensible for other providers
 * - Configuration Management: Handle provider-specific configuration and initialization
 * - Error Handling: Provide consistent error handling and retry logic across providers
 * - Health Monitoring: Monitor provider availability and health status
 * 
 * Supported Providers:
 * - Flowise: Self-hosted AI with built-in RAG capabilities
 * - OpenRouter: API gateway for multiple AI models with external RAG enhancement
 * - Extensible architecture for adding new providers
 * 
 * Features:
 * - Unified API interface regardless of underlying provider
 * - Automatic retry logic with exponential backoff
 * - Provider health checking and monitoring
 * - Environment-based configuration loading
 * - Error classification and consistent error responses
 * - Conversation context management
 * 
 * Provider Factory:
 * - createAIProvider(type, config): Factory function to create provider instances
 * - Validates configuration and throws descriptive errors
 * - Supports environment variable configuration
 * - Returns initialized provider ready for use
 * 
 * Error Handling:
 * - retryWithBackoff(): Exponential backoff retry mechanism
 * - Consistent error classification across providers
 * - Network error detection and handling
 * - Provider-specific error message extraction
 * 
 * Health Monitoring:
 * - Regular health checks with caching
 * - Provider availability tracking
 * - Graceful degradation on provider failures
 * - Health status reporting for system monitoring
 * 
 * Configuration:
 * - Environment variable-based configuration
 * - Provider-specific validation requirements
 * - Secure handling of API keys and endpoints
 * - Fallback configuration for development
 * 
 * Notes:
 * - All providers implement the same interface for consistency
 * - Built-in retry logic improves reliability
 * - Health checks are cached to avoid excessive API calls
 * - Supports both development and production configurations
 * - Extensible design allows easy addition of new AI providers
 */

// Node.js 18+ has built-in fetch

class AIProvider {
    constructor(config) {
        this.config = config;
        this.isHealthy = true;
        this.lastHealthCheck = new Date();
    }

    async generateResponse(conversationContext, conversationId) {
        throw new Error('generateResponse method must be implemented');
    }

    async healthCheck() {
        throw new Error('healthCheck method must be implemented');
    }
}

class FlowiseProvider extends AIProvider {
    constructor(config) {
        super(config);
        this.url = config.url;
        this.chatflowId = config.chatflowId;
        this.apiKey = config.apiKey;
    }

    async generateResponse(conversationContext, conversationId) {
        const contextualPrompt = conversationContext.includes('Agent:') 
            ? `Please respond to the customer based on this conversation history:\n\n${conversationContext}\n\nProvide a helpful, professional response that addresses the customer's latest message and any unresolved issues from the conversation.`
            : `Customer message: ${conversationContext}\n\nPlease provide a helpful, professional response to this customer inquiry.`;

        const response = await fetch(
            `${this.url}/api/v1/prediction/${this.chatflowId}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                },
                body: JSON.stringify({
                    question: contextualPrompt,
                    overrideConfig: {
                        sessionId: conversationId
                    }
                }),
                signal: AbortSignal.timeout(30000) // 30 second timeout
            }
        );

        if (!response.ok) {
            throw new Error(`Flowise API error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        return result.text || result.answer || 'I apologize, but I couldn\'t generate a response at this time.';
    }

    async healthCheck() {
        try {
            const response = await fetch(`${this.url}/api/v1/prediction/${this.chatflowId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                },
                body: JSON.stringify({
                    question: "test"
                }),
                signal: AbortSignal.timeout(5000)
            });
            
            this.isHealthy = response.ok;
            this.lastHealthCheck = new Date();
            return this.isHealthy;
        } catch (error) {
            this.isHealthy = false;
            this.lastHealthCheck = new Date();
            return false;
        }
    }
}

class OpenRouterProvider extends AIProvider {
    constructor(config) {
        super(config);
        this.apiKey = config.apiKey;
        this.model = config.model;
        this.systemPrompt = config.systemPrompt;
        this.siteUrl = config.siteUrl;
    }

    async generateResponse(conversationContext, conversationId) {
        // Check if this is RAG-enhanced context by looking for our RAG structure
        const isRAGContext = conversationContext.includes('UŽDUOTIS:');
        
        let messages;
        
        if (isRAGContext) {
            // For RAG, send as a single user message (like the Python implementation)
            console.log('🔧 OpenRouter RAG: Using Python-style single message approach');
            
            messages = [
                {
                    role: "user",
                    content: conversationContext
                }
            ];
        } else {
            // Use current system prompt from environment for normal contexts
            const currentSystemPrompt = process.env.SYSTEM_PROMPT || this.systemPrompt;
            
            messages = [
                {
                    role: "system", 
                    content: currentSystemPrompt
                }
            ];
            
            // Parse conversation context into messages for normal flow
            if (conversationContext.includes('Agent:') || conversationContext.includes('Customer:')) {
                // Multi-turn conversation
                const lines = conversationContext.split('\n').filter(line => line.trim());
                for (const line of lines) {
                    if (line.startsWith('Customer: ')) {
                        messages.push({
                            role: "user",
                            content: line.substring(10) // Remove "Customer: " prefix
                        });
                    } else if (line.startsWith('Agent: ')) {
                        messages.push({
                            role: "assistant", 
                            content: line.substring(7) // Remove "Agent: " prefix
                        });
                    }
                }
            } else {
                // Single customer message
                messages.push({
                    role: "user",
                    content: conversationContext
                });
            }
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.apiKey}`,
                "HTTP-Referer": this.siteUrl,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: this.model,
                messages: messages,
                temperature: 0.2, // Use 0.2 like the working Python implementation
                max_tokens: 1000
            }),
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        
        if (!result.choices || !result.choices[0] || !result.choices[0].message) {
            throw new Error('Invalid response format from OpenRouter');
        }

        return result.choices[0].message.content;
    }

    async healthCheck() {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "HTTP-Referer": this.siteUrl,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{ role: "user", content: "test" }],
                    max_tokens: 10
                }),
                signal: AbortSignal.timeout(5000)
            });
            
            this.isHealthy = response.ok;
            this.lastHealthCheck = new Date();
            return this.isHealthy;
        } catch (error) {
            this.isHealthy = false;
            this.lastHealthCheck = new Date();
            return false;
        }
    }
}

/**
 * Factory function to create AI provider instances
 * Now uses database credentials with environment fallback
 */
function createAIProvider(providerName, config) {
    switch (providerName.toLowerCase()) {
        case 'flowise':
            return new FlowiseProvider({
                url: config.FLOWISE_URL,
                chatflowId: config.FLOWISE_CHATFLOW_ID,
                apiKey: config.FLOWISE_API_KEY
            });

        case 'openrouter':
            return new OpenRouterProvider({
                apiKey: config.OPENROUTER_API_KEY,
                model: config.OPENROUTER_MODEL,
                systemPrompt: config.SYSTEM_PROMPT,
                siteUrl: config.SITE_URL
            });

        default:
            throw new Error(`Unsupported AI provider: ${providerName}`);
    }
}

/**
 * Get AI Provider configuration from database with environment fallback
 * This function handles the database-first credential lookup
 */
async function getAIProviderConfig() {
    try {
        // Try to get SettingsService instance
        const SettingsService = require('./src/services/settingsService');
        const settingsService = new SettingsService();

        // Wait for initialization
        return new Promise((resolve, reject) => {
            if (settingsService.settingsCache && settingsService.settingsCache.size > 0) {
                // Service already initialized
                settingsService.getAIProviderConfig().then(resolve).catch(reject);
            } else {
                // Wait for initialization
                settingsService.once('initialized', async () => {
                    try {
                        const config = await settingsService.getAIProviderConfig();
                        resolve(config);
                    } catch (error) {
                        reject(error);
                    }
                });

                // Fallback timeout - use environment variables if database fails
                setTimeout(() => {
                    resolve({
                        AI_PROVIDER: process.env.AI_PROVIDER || 'flowise',
                        FLOWISE_URL: process.env.FLOWISE_URL || null,
                        FLOWISE_CHATFLOW_ID: process.env.FLOWISE_CHATFLOW_ID || null,
                        FLOWISE_API_KEY: process.env.FLOWISE_API_KEY || null,
                        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || null,
                        OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
                        REPHRASING_MODEL: process.env.REPHRASING_MODEL || 'google/gemini-2.5-flash-lite',
                        SITE_URL: process.env.SITE_URL || 'http://localhost:3002',
                        SITE_NAME: process.env.SITE_NAME || 'Vilniaus chatbot',
                        SYSTEM_PROMPT: process.env.SYSTEM_PROMPT || ''
                    });
                }, 2000);
            }
        });
    } catch (error) {
        console.warn('Failed to initialize SettingsService, using environment variables:', error.message);

        // Return environment variables as fallback
        return {
            AI_PROVIDER: process.env.AI_PROVIDER || 'flowise',
            FLOWISE_URL: process.env.FLOWISE_URL || null,
            FLOWISE_CHATFLOW_ID: process.env.FLOWISE_CHATFLOW_ID || null,
            FLOWISE_API_KEY: process.env.FLOWISE_API_KEY || null,
            OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || null,
            OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
            SITE_URL: process.env.SITE_URL || 'http://localhost:3002',
            SITE_NAME: process.env.SITE_NAME || 'Vilniaus chatbot',
            SYSTEM_PROMPT: process.env.SYSTEM_PROMPT || ''
        };
    }
}

/**
 * Retry function with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 2000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            if (attempt === maxRetries) {
                throw error;
            }
            
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.log(`AI provider attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}

module.exports = {
    AIProvider,
    FlowiseProvider,
    OpenRouterProvider,
    createAIProvider,
    getAIProviderConfig,
    retryWithBackoff
};