/**
 * AI Service
 * Handles AI provider management and response generation
 */
const { createAIProvider, retryWithBackoff } = require('../../ai-providers');

class AIService {
    constructor() {
        this.aiProvider = null;
        this.initializeProvider();
    }

    /**
     * Initialize AI provider
     */
    initializeProvider() {
        const AI_PROVIDER = process.env.AI_PROVIDER || 'flowise';
        
        try {
            this.aiProvider = createAIProvider(AI_PROVIDER, process.env);
            console.log(`AI Provider initialized: ${AI_PROVIDER}`);
        } catch (error) {
            console.error(`Failed to initialize AI provider "${AI_PROVIDER}":`, error.message);
            
            // Fallback to Flowise if OpenRouter fails
            if (AI_PROVIDER !== 'flowise') {
                try {
                    this.aiProvider = createAIProvider('flowise', process.env);
                    console.log('Fallback to Flowise provider successful');
                } catch (fallbackError) {
                    console.error('Fallback to Flowise also failed:', fallbackError.message);
                    this.aiProvider = null;
                }
            } else {
                this.aiProvider = null;
            }
        }
    }

    /**
     * Switch to a different AI provider
     */
    async switchProvider(newProviderName) {
        const oldProvider = this.aiProvider;
        
        try {
            this.aiProvider = createAIProvider(newProviderName, process.env);
            console.log(`AI Provider successfully switched to: ${newProviderName}`);
            return this.aiProvider;
        } catch (error) {
            // Restore old provider on failure
            this.aiProvider = oldProvider;
            throw error;
        }
    }

    /**
     * Generate AI suggestion using current provider
     */
    async generateAISuggestion(conversationId, conversationContext) {
        // If no AI provider is available, return fallback
        if (!this.aiProvider) {
            console.log('No AI provider available, using fallback response');
            return this.getFallbackResponse(conversationContext);
        }
        
        // Check if we need to perform a health check (every 5 minutes)
        const timeSinceLastCheck = new Date() - this.aiProvider.lastHealthCheck;
        if (timeSinceLastCheck > 5 * 60 * 1000) {
            await this.aiProvider.healthCheck();
        }
        
        // If provider is known to be unhealthy, return fallback immediately
        if (!this.aiProvider.isHealthy) {
            console.log(`${process.env.AI_PROVIDER} provider is unhealthy, using fallback response`);
            return this.getFallbackResponse(conversationContext);
        }
        
        try {
            return await retryWithBackoff(async () => {
                const response = await this.aiProvider.generateResponse(conversationContext, conversationId);
                console.log(`${process.env.AI_PROVIDER} response received successfully`);
                
                // Mark as healthy on successful response
                this.aiProvider.isHealthy = true;
                
                return response || 'I apologize, but I couldn\'t generate a response at this time.';
            });
            
        } catch (error) {
            console.error(`Error generating AI suggestion from ${process.env.AI_PROVIDER} after retries:`, error.message);
            
            // Mark provider as unhealthy
            this.aiProvider.isHealthy = false;
            
            // Return fallback response
            return this.getFallbackResponse(conversationContext);
        }
    }

    /**
     * Get fallback AI response when AI provider is unavailable
     */
    getFallbackResponse(conversationContext) {
        const fallbackResponses = [
            "Ačiū už jūsų pranešimą. Šiuo metu išgyvenu techninių sunkumų su AI asistentu, bet užtikrinsiu, kad jums atsakysiu kuo greičiau.",
            "Atsiprašau už nepatogumus. Mano AI sistema laikinai neprieinama, bet gavau jūsų pranešimą ir netrukus jums atsakysiu.",
            "Ačiū, kad kreipėtės! Nors mano AI asistentas laikinai neprieinamas, užsirašiau jūsų užklausą ir netrukus pateiksius atsakymą.",
            "Dėkoju už kantrybę. Mano AI palaikymo sistema šiuo metu neprieiama dėl techninių darbų, bet asmeniškai peržiūrėsiu jūsų pranešimą ir nedelsiant atsakysiu.",
            "Ačiū, kad susisiekėte su mumis. Dėl laikinos techninės problemos negaliu iš karto pateikti AI atsakymo, bet kuo greičiau spręsiu jūsų problemą."
        ];
        
        // Simple logic to vary responses based on context
        const contextLength = conversationContext.length;
        const index = contextLength % fallbackResponses.length;
        
        return fallbackResponses[index];
    }

    /**
     * Get AI provider health information
     */
    async getProviderHealth() {
        if (this.aiProvider) {
            const providerHealthy = await this.aiProvider.healthCheck();
            return {
                provider: process.env.AI_PROVIDER,
                configured: true,
                healthy: providerHealthy,
                lastCheck: this.aiProvider.lastHealthCheck
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
     * Get current AI provider instance
     */
    getCurrentProvider() {
        return this.aiProvider;
    }

    /**
     * Check if AI provider is available and healthy
     */
    isProviderHealthy() {
        return this.aiProvider && this.aiProvider.isHealthy;
    }

    /**
     * Force a health check on the current provider
     */
    async checkProviderHealth() {
        if (this.aiProvider) {
            return await this.aiProvider.healthCheck();
        }
        return false;
    }

    /**
     * Get AI provider statistics
     */
    getProviderStats() {
        if (!this.aiProvider) {
            return {
                provider: process.env.AI_PROVIDER || 'none',
                status: 'unavailable',
                initialized: false
            };
        }

        return {
            provider: process.env.AI_PROVIDER,
            status: this.aiProvider.isHealthy ? 'healthy' : 'unhealthy',
            initialized: true,
            lastHealthCheck: this.aiProvider.lastHealthCheck,
            timeSinceLastCheck: new Date() - this.aiProvider.lastHealthCheck
        };
    }
}

module.exports = new AIService();