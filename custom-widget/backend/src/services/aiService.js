/**
 * AI Service - Simple wrapper around the original AI provider logic
 */
const { createAIProvider, retryWithBackoff } = require('../../ai-providers');

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
 * Generate AI suggestion using current provider
 */
async function generateAISuggestion(conversationId, conversationContext) {
    const provider = getAIProvider();
    
    // If no AI provider is available, return fallback
    if (!provider) {
        console.log('No AI provider available, using fallback response');
        return getFallbackResponse(conversationContext);
    }
    
    // Check if we need to perform a health check (every 5 minutes)
    const timeSinceLastCheck = new Date() - provider.lastHealthCheck;
    if (timeSinceLastCheck > 5 * 60 * 1000) {
        await provider.healthCheck();
    }
    
    // If provider is known to be unhealthy, return fallback immediately
    if (!provider.isHealthy) {
        console.log(`${process.env.AI_PROVIDER} provider is unhealthy, using fallback response`);
        return getFallbackResponse(conversationContext);
    }
    
    try {
        return await retryWithBackoff(async () => {
            const response = await provider.generateResponse(conversationContext, conversationId);
            console.log(`${process.env.AI_PROVIDER} response received successfully`);
            
            // Mark as healthy on successful response
            provider.isHealthy = true;
            
            return response || 'I apologize, but I couldn\'t generate a response at this time.';
        });
        
    } catch (error) {
        console.error(`Error generating AI suggestion from ${process.env.AI_PROVIDER} after retries:`, error.message);
        
        // Mark provider as unhealthy
        provider.isHealthy = false;
        
        // Return fallback response
        return getFallbackResponse(conversationContext);
    }
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