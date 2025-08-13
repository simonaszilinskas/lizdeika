/**
 * AI Provider Abstraction Layer
 * Supports multiple AI providers with a unified interface
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
        this.siteName = config.siteName;
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
                "X-Title": this.siteName,
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
                    "X-Title": this.siteName,
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
                siteUrl: config.SITE_URL,
                siteName: config.SITE_NAME
            });
        
        default:
            throw new Error(`Unsupported AI provider: ${providerName}`);
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
    retryWithBackoff
};