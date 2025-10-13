/**
 * SYSTEM CONTROLLER
 * 
 * Main Purpose: Handle system administration, configuration, and health monitoring endpoints
 * 
 * Key Responsibilities:
 * - System Health Monitoring: Provide comprehensive health checks and status reporting
 * - Configuration Management: Handle AI provider switching and system prompt updates
 * - Admin Functions: System reset, data clearing, and administrative operations
 * - Performance Monitoring: Track memory usage, uptime, and connection statistics
 * 
 * Dependencies:
 * - Conversation service for message and conversation statistics
 * - Agent service for agent counting and status management
 * - AI service for provider health checks and configuration
 * - AI providers module for dynamic provider switching
 * 
 * Features:
 * - Multi-provider AI health monitoring (Flowise, OpenRouter)
 * - Runtime AI provider switching with fallback protection
 * - System prompt configuration with provider-specific validation
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
 * 
 * Environment Variables:
 * - AI_PROVIDER: Current AI provider (flowise/openrouter)
 * - SYSTEM_PROMPT: Custom system prompt for OpenRouter
 * 
 * Error Handling:
 * - Provider switch validation with automatic rollback
 * - Health check degradation detection
 * - Comprehensive error reporting with details
 * - Development-friendly debugging information
 * 
 * Notes:
 * - Provider switching updates environment variables at runtime
 * - Health checks include memory usage and connection statistics
 * - Admin functions are designed for development and testing environments
 */
const conversationService = require('../services/conversationService');
const agentService = require('../services/agentService');
const aiService = require('../services/aiService');

class SystemController {
    /**
     * Health check endpoint
     */
    async healthCheck(req, res) {
        try {
            // Basic health check that works even without database
            const serverHealth = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                environment: process.env.NODE_ENV || 'development',
                port: process.env.PORT || 3002
            };

            let aiProviderHealthy = true;

            // Try to get service stats, but don't fail if they're not available
            try {
                serverHealth.connections = {
                    conversations: conversationService.getConversationCount(),
                    messages: conversationService.getTotalMessageCount(),
                    agents: agentService.getAgentCount()
                };
            } catch (serviceError) {
                logger.warn('Service stats not available:', serviceError.message);
                serverHealth.connections = { error: 'Services not initialized' };
            }

            // Try to check AI provider health, but don't fail
            try {
                const aiProviderHealth = await aiService.getProviderHealth();
                serverHealth.aiProvider = aiProviderHealth;
                aiProviderHealthy = aiProviderHealth && aiProviderHealth.healthy;
            } catch (aiError) {
                logger.warn('AI provider health check failed:', aiError.message);
                serverHealth.aiProvider = { error: 'AI service not available' };
                aiProviderHealthy = false;
            }

            // Determine overall status - for Railway, prioritize basic server health
            // AI provider being down shouldn't fail healthcheck in production
            const isProd = process.env.NODE_ENV === 'production';
            let overallStatus = 'ok';
            let httpStatus = 200;

            if (!isProd && !aiProviderHealthy) {
                // In development, show degraded status if AI is down
                overallStatus = 'degraded';
                httpStatus = 200; // Still return 200 for Railway healthcheck
            }

            serverHealth.status = overallStatus;
            res.status(httpStatus).json(serverHealth);

        } catch (error) {
            logger.error('Health check error:', error);
            res.status(503).json({
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
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
            logger.error('Error getting system prompt:', error);
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
                logger.info(`System prompt updated for ${currentProvider}`);
                
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
            logger.error('Error updating settings:', error);
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
                providerReadOnly: true,
                note: 'AI provider is configured via AI_PROVIDER environment variable'
            };
            
            res.json(config);
        } catch (error) {
            logger.error('Error getting system config:', error);
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
            
            logger.info(`Reset completed: Cleared ${stats.conversations} conversations, ${stats.messages} messages, ${stats.agents} agents`);
            
            res.json({
                success: true,
                message: 'All data cleared successfully',
                cleared: stats
            });
        } catch (error) {
            logger.error('Error during reset:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to reset data'
            });
        }
    }


    /**
     * Initialize all prompts in Langfuse for management
     * POST /prompts/initialize
     */
    async initializePrompts(req, res) {
        try {
            const { initializePromptsInLangfuse } = require('../services/chains/VilniusPrompts');
            
            logger.info('🚀 Initializing Langfuse prompts...');
            const results = await initializePromptsInLangfuse();
            
            res.json({
                success: true,
                message: 'Prompts initialized in Langfuse',
                results: results,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            logger.error('Failed to initialize prompts:', error);
            res.status(500).json({
                error: 'Failed to initialize prompts',
                details: error.message,
                available: process.env.LANGFUSE_PUBLIC_KEY ? 'Langfuse configured' : 'Langfuse not configured'
            });
        }
    }

    /**
     * Get prompt management system health
     * GET /prompts/health
     */
    async getPromptHealth(req, res) {
        try {
            const { checkPromptSystemHealth } = require('../services/chains/VilniusPrompts');
            
            const health = await checkPromptSystemHealth();
            
            res.json({
                success: true,
                health: health,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            logger.error('Failed to check prompt health:', error);
            res.status(500).json({
                error: 'Failed to check prompt system health',
                details: error.message
            });
        }
    }

    /**
     * List all available Langfuse prompts
     * GET /prompts/list
     */
    async listPrompts(req, res) {
        try {
            const promptManager = require('../services/promptManager');
            
            // Check if Langfuse is available
            if (!promptManager.enabled) {
                return res.json({
                    success: true,
                    prompts: [],
                    langfuseEnabled: false,
                    message: 'Langfuse not configured - no prompts available'
                });
            }

            // For now, return the predefined prompts since Langfuse doesn't have a direct "list all prompts" API
            // In a real implementation, you'd maintain a registry or fetch from Langfuse API
            const predefinedPrompts = [
                {
                    name: 'vilnius-rag-system',
                    description: 'Main system prompt for Vilnius RAG assistant',
                    category: 'system',
                    language: 'lithuanian'
                },
                {
                    name: 'vilnius-query-rephrase', 
                    description: 'Query rephrasing for better document retrieval',
                    category: 'processing',
                    language: 'multilingual'
                },
                {
                    name: 'vilnius-context-format',
                    description: 'Context formatting template for RAG responses', 
                    category: 'formatting',
                    language: 'lithuanian'
                }
            ];
            
            res.json({
                success: true,
                prompts: predefinedPrompts,
                langfuseEnabled: true,
                count: predefinedPrompts.length
            });
            
        } catch (error) {
            logger.error('Failed to list prompts:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to list prompts',
                message: error.message
            });
        }
    }

    /**
     * Get specific prompt content with versions
     * GET /prompts/:name
     */
    async getPrompt(req, res) {
        try {
            const { name } = req.params;
            const promptManager = require('../services/promptManager');
            
            if (!promptManager.enabled) {
                return res.status(404).json({
                    success: false,
                    error: 'Langfuse not configured'
                });
            }

            // Get the prompt with fallback
            const prompt = await promptManager.getPrompt(name, 'Fallback content not available');
            
            res.json({
                success: true,
                prompt: {
                    name: prompt.name,
                    content: prompt.content,
                    version: prompt.version,
                    fromLangfuse: prompt.fromLangfuse,
                    source: prompt.source,
                    config: prompt.config
                }
            });
            
        } catch (error) {
            logger.error(`Failed to get prompt ${req.params.name}:`, error);
            res.status(500).json({
                success: false,
                error: 'Failed to get prompt',
                message: error.message
            });
        }
    }

    /**
     * Update or create a prompt in Langfuse
     * POST /prompts/:name
     */
    async updatePrompt(req, res) {
        try {
            const { name } = req.params;
            const { content, config = {}, labels = ['production'] } = req.body;
            
            if (!content) {
                return res.status(400).json({
                    success: false,
                    error: 'Prompt content is required'
                });
            }

            const promptManager = require('../services/promptManager');
            
            if (!promptManager.enabled) {
                return res.status(404).json({
                    success: false,
                    error: 'Langfuse not configured'
                });
            }

            const result = await promptManager.createPrompt(name, content, config, labels);
            
            if (result) {
                res.json({
                    success: true,
                    prompt: result,
                    message: `Prompt '${name}' updated successfully`
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to update prompt'
                });
            }
            
        } catch (error) {
            logger.error(`Failed to update prompt ${req.params.name}:`, error);
            res.status(500).json({
                success: false,
                error: 'Failed to update prompt',
                message: error.message
            });
        }
    }

    /**
     * Test prompt compilation with sample data
     * POST /prompts/:name/test
     */
    async testPrompt(req, res) {
        try {
            const { name } = req.params;
            const { variables = {} } = req.body;
            
            const promptManager = require('../services/promptManager');
            
            // Sample default variables for testing
            const testVariables = {
                context: 'Sample context: Vilnius city services information...',
                question: 'What are the opening hours for city services?',
                formatted_history: 'User: Previous question\nAssistant: Previous response',
                ...variables
            };

            const prompt = await promptManager.getPrompt(name, 'Default test prompt');
            const compiledContent = prompt.compile(testVariables);
            
            res.json({
                success: true,
                test: {
                    name: prompt.name,
                    originalContent: prompt.content,
                    compiledContent: compiledContent,
                    variables: testVariables,
                    fromLangfuse: prompt.fromLangfuse,
                    source: prompt.source
                }
            });
            
        } catch (error) {
            logger.error(`Failed to test prompt ${req.params.name}:`, error);
            res.status(500).json({
                success: false,
                error: 'Failed to test prompt',
                message: error.message
            });
        }
    }


    /**
     * Create a new prompt in Langfuse
     * POST /prompts/create
     */
    async createPrompt(req, res) {
        try {
            const { name, content, config = {}, labels = ['production'], type = 'system' } = req.body;
            
            if (!name || !content) {
                return res.status(400).json({
                    success: false,
                    error: 'Prompt name and content are required'
                });
            }

            const promptManager = require('../services/promptManager');
            
            if (!promptManager.enabled) {
                return res.status(400).json({
                    success: false,
                    error: 'Langfuse not configured - cannot create prompts'
                });
            }

            // Add type to config
            config.promptType = type;
            config.createdBy = req.user?.email || 'system';
            config.createdAt = new Date().toISOString();

            const result = await promptManager.createPrompt(name, content, config, labels);
            
            if (result) {
                res.json({
                    success: true,
                    prompt: {
                        name: result.name,
                        version: result.version,
                        content: result.prompt,
                        config: result.config,
                        labels: result.labels
                    },
                    message: `Prompt '${name}' created successfully in Langfuse`
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to create prompt in Langfuse'
                });
            }
            
        } catch (error) {
            logger.error('Failed to create prompt:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create prompt',
                message: error.message
            });
        }
    }

    /**
     * Delete a prompt from Langfuse (archive it)
     * DELETE /prompts/:name
     */
    async deletePrompt(req, res) {
        try {
            const { name } = req.params;
            
            const promptManager = require('../services/promptManager');
            
            if (!promptManager.enabled) {
                return res.status(400).json({
                    success: false,
                    error: 'Langfuse not configured'
                });
            }

            // In Langfuse, we can't actually delete prompts, but we can archive them
            // by creating a new version with archived status
            const archivedPrompt = await promptManager.createPrompt(
                name, 
                '[ARCHIVED] This prompt has been archived',
                { archived: true, archivedAt: new Date().toISOString() },
                ['archived']
            );
            
            if (archivedPrompt) {
                res.json({
                    success: true,
                    message: `Prompt '${name}' has been archived`
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: 'Failed to archive prompt'
                });
            }
            
        } catch (error) {
            logger.error(`Failed to delete prompt ${req.params.name}:`, error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete prompt',
                message: error.message
            });
        }
    }

    /**
     * Get detailed prompt statistics and usage
     * GET /prompts/stats
     */
    async getPromptStats(req, res) {
        try {
            const SettingsService = require('../services/settingsService');
            const settingsService = new SettingsService();
            const promptManager = require('../services/promptManager');
const { createLogger } = require('../utils/logger');
const logger = createLogger('systemController');
            
            // Get all prompt settings
            const promptSettings = await settingsService.getSettingsByCategory('prompts', true);
            
            // Count active prompts by type
            const promptTypes = ['system', 'processing', 'formatting'];
            const stats = {
                langfuseEnabled: promptManager.enabled,
                totalPromptSettings: Object.keys(promptSettings).length,
                promptTypes: {}
            };

            // Analyze each type
            for (const type of promptTypes) {
                const activePrompt = promptSettings[`active_${type}_prompt`]?.value;
                const useCustom = promptSettings[`use_custom_${type}_prompt`]?.value === 'true';
                const customContent = promptSettings[`custom_${type}_prompt_content`]?.value;
                
                stats.promptTypes[type] = {
                    hasActivePrompt: !!activePrompt,
                    activePrompt: activePrompt,
                    useCustom: useCustom,
                    hasCustomContent: !!customContent,
                    customContentLength: customContent?.length || 0
                };
            }

            // Get cache stats if available
            if (promptManager.enabled) {
                const cacheStats = promptManager.getCacheStats();
                stats.cache = cacheStats;
            }

            res.json({
                success: true,
                stats: stats
            });

        } catch (error) {
            logger.error('Failed to get prompt stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get prompt statistics',
                message: error.message
            });
        }
    }

}

module.exports = SystemController;