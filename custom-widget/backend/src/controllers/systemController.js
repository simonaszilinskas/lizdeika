/**
 * System Controller
 * Handles system-related endpoints like health checks, configuration, and admin functions
 */
const conversationService = require('../services/conversationService');
const agentService = require('../services/agentService');
const aiService = require('../services/aiService');
const knowledgeService = require('../services/knowledgeService');

// RAG settings with defaults - will be overridden by env vars
let ragSettings = {
    k: parseInt(process.env.RAG_K) || 20,
    showSources: process.env.RAG_SHOW_SOURCES === 'true' || true
};

class SystemController {
    /**
     * Health check endpoint
     */
    async healthCheck(req, res) {
        try {
            // Check our own health
            const serverHealth = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                connections: {
                    conversations: conversationService.getConversationCount(),
                    messages: conversationService.getTotalMessageCount(),
                    agents: agentService.getAgentCount()
                }
            };
            
            // Check AI provider health
            const aiProviderHealth = await aiService.getProviderHealth();
            serverHealth.aiProvider = aiProviderHealth;
            
            // Determine overall status
            const overallStatus = (aiProviderHealth && aiProviderHealth.healthy) ? 'ok' : 'degraded';
            serverHealth.status = overallStatus;
            
            const httpStatus = overallStatus === 'ok' ? 200 : 503;
            res.status(httpStatus).json(serverHealth);
            
        } catch (error) {
            console.error('Health check error:', error);
            res.status(500).json({
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Get current system prompt configuration
     */
    async getSystemPrompt(req, res) {
        try {
            res.json({
                systemPrompt: process.env.SYSTEM_PROMPT || 'Jūs esate naudingas klientų palaikymo asistentas Vilniaus miestui. Atsakykite lietuvių kalba ir būkite mandagūs bei informatyvūs.'
            });
        } catch (error) {
            console.error('Error getting system prompt:', error);
            res.status(500).json({ error: 'Failed to get system prompt' });
        }
    }

    /**
     * Update system settings (AI provider, system prompt, RAG settings)
     */
    async updateSettings(req, res) {
        try {
            const { aiProvider: newProvider, systemPrompt } = req.body;
            
            if (!newProvider) {
                return res.status(400).json({ error: 'Missing aiProvider field' });
            }
            
            // OpenRouter requires system prompt, Flowise doesn't
            if (newProvider === 'openrouter' && !systemPrompt) {
                return res.status(400).json({ error: 'System prompt required for OpenRouter' });
            }

            // Update environment variables for runtime changes
            const oldProvider = process.env.AI_PROVIDER;
            process.env.AI_PROVIDER = newProvider;
            
            // Only update system prompt if provided (OpenRouter needs it, Flowise doesn't)
            if (systemPrompt) {
                process.env.SYSTEM_PROMPT = systemPrompt;
            }
            
            // Reinitialize AI provider if it changed
            if (oldProvider !== newProvider) {
                console.log(`Switching AI provider from ${oldProvider} to ${newProvider}`);
                
                try {
                    await aiService.switchProvider(newProvider);
                    console.log(`AI Provider successfully switched to: ${newProvider}`);
                } catch (providerError) {
                    console.error(`Failed to initialize new AI provider "${newProvider}":`, providerError.message);
                    
                    // Fallback to previous provider
                    process.env.AI_PROVIDER = oldProvider;
                    
                    return res.status(500).json({ 
                        error: `Failed to switch to ${newProvider}. Reverted to ${oldProvider}.` 
                    });
                }
            } else {
                console.log(`System prompt updated for ${newProvider}`);
            }

            res.json({ 
                success: true, 
                message: 'Settings updated successfully!',
                currentProvider: newProvider
            });
            
        } catch (error) {
            console.error('Error updating settings:', error);
            res.status(500).json({ error: 'Failed to update settings' });
        }
    }


    /**
     * Reset endpoint for testing (clears all data)
     */
    async resetSystem(req, res) {
        try {
            const stats = {
                conversations: conversationService.getConversationCount(),
                messages: conversationService.getTotalMessageCount(),
                agents: agentService.getAgentCount()
            };
            
            // Clear all data
            conversationService.clearAllData();
            agentService.clearAllData();
            
            console.log(`Reset completed: Cleared ${stats.conversations} conversations, ${stats.messages} messages, ${stats.agents} agents`);
            
            res.json({
                success: true,
                message: 'All data cleared successfully',
                cleared: stats
            });
        } catch (error) {
            console.error('Error during reset:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to reset data'
            });
        }
    }

    /**
     * Get knowledge base statistics (RAG testing)
     */
    async getKnowledgeStats(req, res) {
        try {
            const stats = await knowledgeService.getStats();
            res.json(stats);
        } catch (error) {
            console.error('Error getting knowledge stats:', error);
            res.status(500).json({
                error: 'Failed to get knowledge base stats',
                details: error.message
            });
        }
    }

    /**
     * Search knowledge base (RAG testing)
     */
    async searchKnowledge(req, res) {
        try {
            const { query, nResults } = req.body;
            
            if (!query) {
                return res.status(400).json({ error: 'Query parameter required' });
            }

            const results = await knowledgeService.searchContext(query, nResults || 3);
            res.json({
                query,
                results,
                count: results.length
            });
        } catch (error) {
            console.error('Error searching knowledge base:', error);
            res.status(500).json({
                error: 'Failed to search knowledge base',
                details: error.message
            });
        }
    }

    /**
     * Reset knowledge base with sample data (RAG testing)
     */
    async resetKnowledge(req, res) {
        try {
            const success = await knowledgeService.resetSampleData();
            
            if (success) {
                const stats = await knowledgeService.getStats();
                res.json({ 
                    success: true, 
                    message: 'Knowledge base reset successfully',
                    stats
                });
            } else {
                res.status(500).json({
                    error: 'Failed to reset knowledge base'
                });
            }
        } catch (error) {
            console.error('Error resetting knowledge base:', error);
            res.status(500).json({
                error: 'Failed to reset knowledge base',
                details: error.message
            });
        }
    }

    /**
     * Test RAG functionality directly - debug version
     */
    async testRAG(req, res) {
        try {
            const { query } = req.body;
            if (!query) {
                return res.status(400).json({ error: 'Query parameter required' });
            }

            // Test just the knowledge search part first
            const knowledgeService = require('../services/knowledgeService');
            const k = ragSettings.k || 3;
            
            console.log(`🧪 RAG TEST DEBUG: Testing query: "${query}" with k=${k}`);
            
            // Search for relevant contexts
            const relevantContexts = await knowledgeService.searchContext(query, k);
            console.log(`🧪 RAG TEST DEBUG: Found ${relevantContexts?.length || 0} contexts`);
            
            if (relevantContexts && relevantContexts.length > 0) {
                console.log(`🧪 RAG TEST DEBUG: First context preview:`, relevantContexts[0]?.content?.substring(0, 200));
            }

            // Now test the full AI flow
            const aiService = require('../services/aiService');
            const conversationContext = `Customer: ${query}`;
            
            console.log(`🧪 RAG TEST DEBUG: Calling generateAISuggestion with enableRAG=true`);
            const suggestion = await aiService.generateAISuggestion('test-conversation', conversationContext, true);
            
            res.json({
                query,
                suggestion,
                ragEnabled: true,
                provider: process.env.AI_PROVIDER,
                ragSettings: ragSettings,
                debugInfo: {
                    contextsFound: relevantContexts?.length || 0,
                    firstContextPreview: relevantContexts?.[0]?.content?.substring(0, 100),
                    contextSources: relevantContexts?.map(c => c.metadata?.source_document_name).join(', ')
                }
            });
        } catch (error) {
            console.error('Error testing RAG:', error);
            res.status(500).json({
                error: 'Failed to test RAG',
                details: error.message
            });
        }
    }

    /**
     * Debug RAG context generation without calling AI
     */
    async debugRAG(req, res) {
        try {
            const { query } = req.body;
            if (!query) {
                return res.status(400).json({ error: 'Query parameter required' });
            }

            // Import required services
            const knowledgeService = require('../services/knowledgeService');
            
            // Get settings
            const k = ragSettings.k || 3;
            const showSources = ragSettings.showSources || false;
            
            // Search for contexts
            const relevantContexts = await knowledgeService.searchContext(query, k);
            
            // Create conversation context
            const conversationContext = `Customer: ${query}`;
            
            // Manually create enhanced context using the same logic as AI service
            let enhancedContext = conversationContext;
            
            if (relevantContexts && relevantContexts.length > 0) {
                const contextText = relevantContexts
                    .map(ctx => `- ${ctx.content}`)
                    .join('\n');
                
                let sourceInstruction = '';
                if (showSources) {
                    const sources = relevantContexts
                        .map((ctx, index) => `[${index + 1}] ${ctx.metadata?.source_document_name || 'Unknown document'}`)
                        .join(', ');
                    
                    sourceInstruction = `\n\nIMPORTANT: If you use information from the context above, include a sources section at the end of your response like this:
**Sources:** ${sources}`;
                }
                
                enhancedContext = `You are a helpful assistant for Vilnius city. You have access to the following specific information about Vilnius:

RELEVANT INFORMATION:
${contextText}

IMPORTANT: Use ONLY the information provided above to answer questions. If the information above contains relevant details, use them in your response. Do not contradict the provided information.

CONVERSATION:
${conversationContext}

Based on the relevant information provided above, please respond to the user's question.${sourceInstruction}`;
            }
            
            res.json({
                query,
                originalContext: conversationContext,
                enhancedContext,
                contextsFound: relevantContexts?.length || 0,
                ragSettings,
                contextPreview: relevantContexts?.[0]?.content?.substring(0, 200),
                sources: relevantContexts?.map(c => c.metadata?.source_document_name).join(', '),
                enhancedContextLength: enhancedContext.length
            });
            
        } catch (error) {
            console.error('Error debugging RAG:', error);
            res.status(500).json({
                error: 'Failed to debug RAG',
                details: error.message
            });
        }
    }

    /**
     * Simple RAG test that directly tests the AI with enhanced context
     */
    async simpleRAGTest(req, res) {
        try {
            const { query } = req.body;
            if (!query) {
                return res.status(400).json({ error: 'Query parameter required' });
            }

            console.log(`🔧 SIMPLE RAG TEST: Testing query "${query}"`);
            console.log(`🔧 SIMPLE RAG TEST: Current RAG settings:`, ragSettings);

            // Import required services
            const knowledgeService = require('../services/knowledgeService');
            const { createAIProvider } = require('../../ai-providers');
            
            // Get AI provider
            const provider = createAIProvider(process.env.AI_PROVIDER, process.env);
            
            // Search for contexts
            const relevantContexts = await knowledgeService.searchContext(query, ragSettings.k);
            console.log(`🔧 SIMPLE RAG TEST: Found ${relevantContexts?.length || 0} contexts`);
            
            // Create enhanced prompt manually
            let enhancedPrompt = query;
            
            if (relevantContexts && relevantContexts.length > 0) {
                const contextText = relevantContexts
                    .map(ctx => `- ${ctx.content}`)
                    .join('\n');
                
                let sourceInstruction = '';
                if (ragSettings.showSources) {
                    const sources = relevantContexts
                        .map((ctx, index) => `[${index + 1}] ${ctx.metadata?.source_document_name || 'Unknown document'}`)
                        .join(', ');
                    
                    sourceInstruction = `\n\nIMPORTANT: If you use information from the context above, include a sources section at the end of your response like this:
**Sources:** ${sources}`;
                }
                
                enhancedPrompt = `You are a helpful assistant for Vilnius city. You have access to the following specific information about Vilnius:

RELEVANT INFORMATION:
${contextText}

IMPORTANT: Use ONLY the information provided above to answer questions. If the information above contains relevant details, use them in your response. Do not contradict the provided information.

CONVERSATION:
Customer: ${query}

Based on the relevant information provided above, please respond to the user's question.${sourceInstruction}`;
            }
            
            console.log(`🔧 SIMPLE RAG TEST: Enhanced prompt length: ${enhancedPrompt.length}`);
            console.log(`🔧 SIMPLE RAG TEST: Enhanced prompt preview:`, enhancedPrompt.substring(0, 300));
            
            // Call AI directly
            const response = await provider.generateResponse(enhancedPrompt, 'simple-test');
            
            console.log(`🔧 SIMPLE RAG TEST: AI response:`, response?.substring(0, 200));
            
            res.json({
                query,
                response,
                contextsFound: relevantContexts?.length || 0,
                ragSettings,
                enhancedPromptLength: enhancedPrompt.length,
                contextSources: relevantContexts?.map(c => c.metadata?.source_document_name).join(', ')
            });
            
        } catch (error) {
            console.error('🔧 SIMPLE RAG TEST ERROR:', error);
            res.status(500).json({
                error: 'Failed to test simple RAG',
                details: error.message
            });
        }
    }

    /**
     * Context test - just shows what would be sent to AI without calling AI
     */
    async contextTest(req, res) {
        try {
            const { query } = req.body;
            if (!query) {
                return res.status(400).json({ error: 'Query parameter required' });
            }

            const knowledgeService = require('../services/knowledgeService');
            
            // Search for contexts
            const relevantContexts = await knowledgeService.searchContext(query, ragSettings.k);
            
            // Create enhanced prompt manually
            let enhancedPrompt = query;
            
            if (relevantContexts && relevantContexts.length > 0) {
                const contextText = relevantContexts
                    .map(ctx => `- ${ctx.content}`)
                    .join('\n');
                
                let sourceInstruction = '';
                if (ragSettings.showSources) {
                    const sources = relevantContexts
                        .map((ctx, index) => `[${index + 1}] ${ctx.metadata?.source_document_name || 'Unknown document'}`)
                        .join(', ');
                    
                    sourceInstruction = `\n\nIMPORTANT: If you use information from the context above, include a sources section at the end of your response like this:
**Sources:** ${sources}`;
                }
                
                enhancedPrompt = `You are a helpful assistant for Vilnius city. You have access to the following specific information about Vilnius:

RELEVANT INFORMATION:
${contextText}

IMPORTANT: Use ONLY the information provided above to answer questions. If the information above contains relevant details, use them in your response. Do not contradict the provided information.

CONVERSATION:
Customer: ${query}

Based on the relevant information provided above, please respond to the user's question.${sourceInstruction}`;
            }
            
            res.json({
                query,
                enhancedPrompt,
                contextCount: relevantContexts?.length || 0,
                ragSettings,
                firstContextPreview: relevantContexts?.[0]?.content?.substring(0, 200),
                sources: relevantContexts?.map(c => c.metadata?.source_document_name).join(', ')
            });
            
        } catch (error) {
            console.error('Context test error:', error);
            res.status(500).json({
                error: 'Failed to test context',
                details: error.message
            });
        }
    }

    /**
     * Static method to get RAG settings for use in other services
     */
    static getRagConfig() {
        return ragSettings;
    }
}

module.exports = SystemController;