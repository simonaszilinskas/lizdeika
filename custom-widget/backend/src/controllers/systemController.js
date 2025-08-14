/**
 * SYSTEM CONTROLLER
 * 
 * Main Purpose: Handle system administration, configuration, health monitoring, and RAG testing endpoints
 * 
 * Key Responsibilities:
 * - System Health Monitoring: Provide comprehensive health checks and status reporting
 * - Configuration Management: Handle AI provider switching and system prompt updates
 * - RAG System Testing: Provide debugging and testing tools for knowledge base functionality
 * - Admin Functions: System reset, data clearing, and administrative operations
 * - Performance Monitoring: Track memory usage, uptime, and connection statistics
 * 
 * Dependencies:
 * - Conversation service for message and conversation statistics
 * - Agent service for agent counting and status management
 * - AI service for provider health checks and configuration
 * - Knowledge service for RAG functionality and document management
 * - AI providers module for dynamic provider switching
 * 
 * Features:
 * - Multi-provider AI health monitoring (Flowise, OpenRouter)
 * - Runtime AI provider switching with fallback protection
 * - Comprehensive RAG testing and debugging tools
 * - System prompt configuration with provider-specific validation
 * - Knowledge base search and statistics
 * - Development and production environment support
 * 
 * Health Check Endpoints:
 * - GET /health - Comprehensive system health with AI provider status
 * 
 * Configuration Endpoints:
 * - GET /config/system-prompt - Retrieve current system prompt
 * - POST /config/settings - Update AI provider and system prompt
 * 
 * Admin Endpoints:
 * - POST /reset - Clear all conversations, messages, and agent data
 * - GET /knowledge/stats - Knowledge base statistics and metrics
 * - POST /knowledge/search - Search knowledge base for testing
 * - POST /knowledge/reset - Reset knowledge base with sample data
 * 
 * RAG Testing Endpoints:
 * - POST /test-rag - Full RAG functionality test with AI response
 * - POST /debug-rag - RAG context generation without AI call
 * - POST /simple-rag-test - Direct AI test with enhanced context
 * - POST /context-test - Show what would be sent to AI without calling
 * 
 * Environment Variables:
 * - AI_PROVIDER: Current AI provider (flowise/openrouter)
 * - SYSTEM_PROMPT: Custom system prompt for OpenRouter
 * - RAG_K: Number of context documents to retrieve (default: 20)
 * - RAG_SHOW_SOURCES: Whether to show document sources (default: true)
 * 
 * RAG Configuration:
 * - Configurable context retrieval count (k parameter)
 * - Source attribution control for transparency
 * - Enhanced prompt generation with document context
 * - Dynamic source instruction injection
 * 
 * Error Handling:
 * - Provider switch validation with automatic rollback
 * - Health check degradation detection
 * - Comprehensive error reporting with details
 * - Development-friendly debugging information
 * 
 * Notes:
 * - Provider switching updates environment variables at runtime
 * - RAG settings are managed via environment variables for consistency
 * - Health checks include memory usage and connection statistics
 * - Testing endpoints provide detailed debugging information
 * - Admin functions are designed for development and testing environments
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
                systemPrompt: process.env.SYSTEM_PROMPT || 'UŽDUOTIS:\n\nTu esi naudingas Vilniaus miesto savivaldybės gyventojų aptarnavimo pokalbių robotas. Pasitelkdams tau pateiktą informaciją, kurią turi kontekste, atsakyk piliečiui į jo klausimą jo klausimo kalba. Jei klausimas neaiškus, užduok follow-up klausimą prieš atsakant. Niekada neišgalvok atsakymų, pasitelk tik informaciją, kurią turi. Niekada neminėk dokumentų ID. Gali cituoti tik nuorodas (URL) kurias turi kontekste.'
            });
        } catch (error) {
            console.error('Error getting system prompt:', error);
            res.status(500).json({ error: 'Failed to get system prompt' });
        }
    }

    /**
     * Update system settings (system prompt only - AI provider is read-only from env)
     */
    async updateSettings(req, res) {
        try {
            const { systemPrompt } = req.body;
            const currentProvider = process.env.AI_PROVIDER;
            
            // AI provider is now read-only from environment variable
            // Only allow system prompt updates for OpenRouter
            if (currentProvider === 'openrouter' && systemPrompt) {
                process.env.SYSTEM_PROMPT = systemPrompt;
                console.log(`System prompt updated for ${currentProvider}`);
                
                res.json({ 
                    success: true, 
                    message: 'System prompt updated successfully!',
                    currentProvider: currentProvider,
                    note: 'AI provider is configured via environment variable and cannot be changed at runtime'
                });
            } else if (currentProvider === 'flowise') {
                res.json({ 
                    success: true, 
                    message: 'No settings to update - Flowise uses built-in prompts',
                    currentProvider: currentProvider,
                    note: 'AI provider is configured via environment variable'
                });
            } else {
                res.status(400).json({ 
                    error: 'No system prompt provided or invalid configuration',
                    currentProvider: currentProvider
                });
            }
            
        } catch (error) {
            console.error('Error updating settings:', error);
            res.status(500).json({ error: 'Failed to update settings' });
        }
    }

    /**
     * Get current system configuration (display-only)
     */
    async getSystemConfig(req, res) {
        try {
            const config = {
                aiProvider: process.env.AI_PROVIDER || 'flowise',
                systemPrompt: process.env.SYSTEM_PROMPT || 'Default prompt not set',
                ragSettings: ragSettings,
                providerReadOnly: true,
                note: 'AI provider is configured via AI_PROVIDER environment variable'
            };
            
            res.json(config);
        } catch (error) {
            console.error('Error getting system config:', error);
            res.status(500).json({ error: 'Failed to get system configuration' });
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