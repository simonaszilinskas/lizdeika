/**
 * SYSTEM ROUTES
 * 
 * Main Purpose: Define HTTP endpoints for system administration, health monitoring, and configuration
 * 
 * Key Responsibilities:
 * - Health Monitoring: System health checks and status reporting
 * - Configuration Management: AI provider and system prompt configuration
 * - Admin Functions: System reset and data management operations
 * 
 * Health Routes:
 * - GET /health - Comprehensive system health check
 * 
 * Configuration Routes:
 * - GET /config/system-prompt - Get current system prompt
 * - GET /config/system - Get full system configuration (display-only)
 * - POST /config/settings - Update system prompt (AI provider read-only from env)
 * - GET /config/branding - Get branding settings
 * - PUT /config/branding - Update branding settings (admin only)
 * - GET /config/branding/preview - Get preview of branding changes
 * - POST /config/branding/reset - Reset branding to defaults (admin only)
 * 
 * Admin Routes:
 * - POST /reset - Clear all system data (development/testing)
 * 
 * Notes:
 * - Health endpoint is available at root level (/health)
 * - Configuration endpoints are under /api/config/*
 * - Routes support both development and production configurations
 */
const express = require('express');
const SystemController = require('../controllers/systemController');
const { authenticateToken } = require('../middleware/authMiddleware');
const SettingsService = require('../services/settingsService');

function createSystemRoutes() {
    const router = express.Router();
    const systemController = new SystemController();
    const settingsService = new SettingsService();

    // Health check
    router.get('/health', (req, res) => {
        systemController.healthCheck(req, res);
    });

    // Get current system prompt configuration
    router.get('/config/system-prompt', (req, res) => {
        systemController.getSystemPrompt(req, res);
    });

    // Get full system configuration (display-only)
    router.get('/config/system', (req, res) => {
        systemController.getSystemConfig(req, res);
    });

    // Update system settings (system prompt only - AI provider is read-only)
    router.post('/config/settings', (req, res) => {
        systemController.updateSettings(req, res);
    });

    // ===========================
    // AI CONFIGURATION ROUTES
    // ===========================

    // Get current AI settings (admin only for security)
    router.get('/config/ai', authenticateToken, async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }

            const aiSettings = await settingsService.getSettingsByCategory('ai', true); // Include private settings
            const langfuseStatus = settingsService.getLangfuseStatus();
            
            res.json({
                success: true,
                settings: aiSettings,
                langfuse: langfuseStatus
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to fetch AI settings',
                message: error.message
            });
        }
    });

    // Update AI settings (admin only)
    router.put('/config/ai', authenticateToken, async (req, res) => {
        try {
            // Check admin permissions
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }

            const settings = req.body;
            if (!settings || typeof settings !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'Settings object is required'
                });
            }

            // Update settings
            const updatedSettings = await settingsService.updateSettings(
                settings, 
                req.user.id, 
                'ai'
            );

            res.json({
                success: true,
                data: updatedSettings,
                message: 'AI settings updated successfully'
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                error: 'Failed to update AI settings',
                message: error.message
            });
        }
    });

    // ===========================
    // AI PROVIDER SETTINGS ROUTES (for Knowledge Base UI)
    // ===========================

    // Get AI provider settings (admin only)
    router.get('/api/settings/ai_providers', authenticateToken, async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }

            const aiProviderSettings = await settingsService.getSettingsByCategory('ai_providers', true);

            res.json({
                success: true,
                data: aiProviderSettings
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to fetch AI provider settings',
                message: error.message
            });
        }
    });

    // Update AI provider settings (admin only)
    router.post('/api/settings/ai_providers', authenticateToken, async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }

            const settings = req.body;
            if (!settings || typeof settings !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'Settings object is required'
                });
            }

            // Update AI provider settings
            const updatedSettings = await settingsService.updateSettings(
                settings,
                req.user.id,
                'ai_providers'
            );

            res.json({
                success: true,
                data: updatedSettings,
                message: 'AI provider settings updated successfully'
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                error: 'Failed to update AI provider settings',
                message: error.message
            });
        }
    });

    // Test AI provider connection (admin only)
    router.post('/api/system/test-ai-provider', authenticateToken, async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }

            const { provider, config } = req.body;
            if (!provider || !config) {
                return res.status(400).json({
                    success: false,
                    error: 'Provider and config are required'
                });
            }

            // Test the provider configuration
            const { createAIProvider } = require('../../ai-providers');

            try {
                const testProvider = createAIProvider(provider, {
                    AI_PROVIDER: provider,
                    FLOWISE_URL: config.flowise_url,
                    FLOWISE_CHATFLOW_ID: config.flowise_chatflow_id,
                    FLOWISE_API_KEY: config.flowise_api_key,
                    OPENROUTER_API_KEY: config.openrouter_api_key,
                    OPENROUTER_MODEL: config.openrouter_model,
                    REPHRASING_MODEL: config.rephrasing_model || 'google/gemini-2.5-flash-lite',
                    SITE_URL: config.site_url,
                    SITE_NAME: config.site_name
                });

                // First check basic health
                const isHealthy = await testProvider.healthCheck();
                if (!isHealthy) {
                    return res.json({
                        success: false,
                        provider: provider,
                        healthy: false,
                        message: `${provider} provider health check failed`
                    });
                }

                // Now test actual AI response generation
                logger.info(`🧪 Testing ${provider} with actual message generation...`);

                // Temporarily set environment variables for the test
                const originalEnvVars = {};
                const envVarsToSet = {
                    AI_PROVIDER: provider,
                    OPENROUTER_API_KEY: config.openrouter_api_key,
                    OPENROUTER_MODEL: config.openrouter_model,
                    REPHRASING_MODEL: config.rephrasing_model || 'google/gemini-2.5-flash-lite',
                    SITE_URL: config.site_url,
                    SITE_NAME: config.site_name
                };

                // Backup original values and set new ones
                for (const [key, value] of Object.entries(envVarsToSet)) {
                    originalEnvVars[key] = process.env[key];
                    if (value) process.env[key] = value;
                }

                try {
                    // Test with the AI service directly
                    const { generateAISuggestion } = require('../services/aiService');
                    const testMessage = 'Hello, this is a connection test';
                    const testConversationId = 'test-' + Date.now();

                    const result = await generateAISuggestion(testConversationId, testMessage, true);

                    const success = result && !result.startsWith('Atsiprašau');

                    res.json({
                        success: success,
                        provider: provider,
                        healthy: true,
                        message: success ?
                            `${provider} provider test successful - AI response generated` :
                            `${provider} provider test failed - AI returned error message`,
                        testResponse: result ? result.substring(0, 100) + '...' : null
                    });

                } finally {
                    // Restore original environment variables
                    for (const [key, originalValue] of Object.entries(originalEnvVars)) {
                        if (originalValue !== undefined) {
                            process.env[key] = originalValue;
                        } else {
                            delete process.env[key];
                        }
                    }
                }

            } catch (providerError) {
                res.json({
                    success: false,
                    provider: provider,
                    healthy: false,
                    message: `Provider initialization failed: ${providerError.message}`
                });
            }

        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to test AI provider',
                message: error.message
            });
        }
    });

    // ===========================
    // BRANDING CONFIGURATION ROUTES
    // ===========================

    // Get current branding settings (public endpoint for frontend)
    router.get('/config/branding', async (req, res) => {
        try {
            const brandingSettings = await settingsService.getSettingsByCategory('branding', false); // Only public settings
            
            res.json({
                success: true,
                data: brandingSettings
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to fetch branding settings',
                message: error.message
            });
        }
    });

    // Update branding settings (admin only)
    router.put('/config/branding', authenticateToken, async (req, res) => {
        try {
            // Check admin permissions
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }

            const { settings } = req.body;
            if (!settings || typeof settings !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'Settings object is required'
                });
            }

            // Update settings
            const updatedSettings = await settingsService.updateSettings(
                settings, 
                req.user.id, 
                'branding'
            );

            res.json({
                success: true,
                data: updatedSettings,
                message: 'Branding settings updated successfully'
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                error: 'Failed to update branding settings',
                message: error.message
            });
        }
    });

    // Get branding preview (admin only) - returns what the settings would look like
    router.get('/config/branding/preview', authenticateToken, async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }

            const allBrandingSettings = await settingsService.getSettingsByCategory('branding', true); // Include private settings
            
            res.json({
                success: true,
                data: {
                    settings: allBrandingSettings,
                    preview: {
                        widgetName: allBrandingSettings.widget_name?.value || 'Vilnius Assistant',
                        primaryColor: allBrandingSettings.widget_primary_color?.value || '#2c5530',
                        allowedDomains: allBrandingSettings.widget_allowed_domains?.value || '*'
                    }
                }
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to get branding preview',
                message: error.message
            });
        }
    });

    // Reset branding settings to defaults (admin only)
    router.post('/config/branding/reset', authenticateToken, async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }

            const resetResult = await settingsService.resetSettings('branding', req.user.id);
            
            res.json({
                success: true,
                data: resetResult,
                message: 'Branding settings reset to defaults'
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to reset branding settings',
                message: error.message
            });
        }
    });

    // ===========================
    // PROMPTS CONFIGURATION ROUTES
    // ===========================

    // Get current prompt settings (admin only)
    router.get('/config/prompts', authenticateToken, async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }

            const promptSettings = await settingsService.getSettingsByCategory('prompts', true); // Include private settings
            
            res.json({
                success: true,
                data: promptSettings
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to fetch prompt settings',
                message: error.message
            });
        }
    });

    // Update prompt settings (admin only)
    router.put('/config/prompts', authenticateToken, async (req, res) => {
        try {
            // Check admin permissions
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }

            const settings = req.body;
            if (!settings || typeof settings !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'Settings object is required'
                });
            }

            // Update settings
            const updatedSettings = await settingsService.updateSettings(
                settings, 
                req.user.id, 
                'prompts'
            );

            res.json({
                success: true,
                data: updatedSettings,
                message: 'Prompt settings updated successfully'
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                error: 'Failed to update prompt settings',
                message: error.message
            });
        }
    });


    // Reset endpoint for testing (clears all data)
    router.post('/reset', (req, res) => {
        systemController.resetSystem(req, res);
    });


    // Langfuse Prompt Management routes
    router.post('/prompts/initialize', (req, res) => {
        systemController.initializePrompts(req, res);
    });

    router.get('/prompts/health', (req, res) => {
        systemController.getPromptHealth(req, res);
    });

    // New Langfuse prompt management endpoints
    router.get('/prompts/list', (req, res) => {
        systemController.listPrompts(req, res);
    });

    router.get('/prompts/:name', (req, res) => {
        systemController.getPrompt(req, res);
    });

    router.post('/prompts/:name', authenticateToken, (req, res) => {
        systemController.updatePrompt(req, res);
    });

    router.post('/prompts/:name/test', (req, res) => {
        systemController.testPrompt(req, res);
    });

    // Langfuse prompt management endpoints (for direct prompt creation)
    router.post('/prompts/create', authenticateToken, (req, res) => {
        systemController.createPrompt(req, res);
    });

    router.delete('/prompts/:name', authenticateToken, (req, res) => {
        systemController.deletePrompt(req, res);
    });

    router.get('/prompts/stats', (req, res) => {
        systemController.getPromptStats(req, res);
    });

    // ===========================
    // AI PROVIDER VERIFICATION ENDPOINTS
    // ===========================

    // Get current AI provider status and configuration (admin only)
    router.get('/ai-provider-status', authenticateToken, async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }

            const { getAIProviderConfig } = require('../../ai-providers');
            const config = await getAIProviderConfig();

            // Determine if configuration came from database or environment
            const aiProviderSettings = await settingsService.getSettingsByCategory('ai_providers', true);
            const hasDbConfig = Object.keys(aiProviderSettings).length > 0;

            res.json({
                success: true,
                currentProvider: config.AI_PROVIDER,
                configSource: hasDbConfig ? 'database' : 'environment',
                configuration: {
                    provider: config.AI_PROVIDER,
                    model: config.OPENROUTER_MODEL || null,
                    flowiseUrl: config.FLOWISE_URL || null,
                    flowiseChatflowId: config.FLOWISE_CHATFLOW_ID || null,
                    siteUrl: config.SITE_URL || null,
                    siteName: config.SITE_NAME || null
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to get AI provider status',
                message: error.message
            });
        }
    });

    // ===========================
    // GENERIC SETTINGS ROUTES
    // ===========================

    // Get a single setting by category and key
    router.get('/api/settings/:category/:key', authenticateToken, async (req, res) => {
        try {
            const { category, key } = req.params;

            const value = await settingsService.getSetting(key, category);

            res.json({
                success: true,
                data: {
                    key,
                    value,
                    category
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to fetch setting',
                message: error.message
            });
        }
    });

    // Update a single setting by category and key (admin only)
    router.put('/api/settings/:category/:key', authenticateToken, async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }

            const { category, key } = req.params;
            const { value } = req.body;

            if (value === undefined) {
                return res.status(400).json({
                    success: false,
                    error: 'Value is required'
                });
            }

            const updatedSetting = await settingsService.updateSetting(
                key,
                value,
                req.user.id,
                category
            );

            res.json({
                success: true,
                data: updatedSetting,
                message: `Setting ${key} updated successfully`
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                error: 'Failed to update setting',
                message: error.message
            });
        }
    });

    // Test AI chat suggestion with metadata (for verification tests)
    router.post('/chat/suggestion', authenticateToken, async (req, res) => {
        try {
            if (req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }

            const { conversationId, context, enableRAG = false } = req.body;

            if (!conversationId || !context) {
                return res.status(400).json({
                    success: false,
                    error: 'conversationId and context are required'
                });
            }

            // Get AI provider configuration
            const { getAIProviderConfig } = require('../../ai-providers');
            const config = await getAIProviderConfig();

            // Generate AI suggestion with metadata
            const aiService = require('../services/aiService');
const { createLogger } = require('../utils/logger');
const logger = createLogger('systemRoutes');
            const suggestion = await aiService.generateAISuggestion(
                conversationId,
                context,
                enableRAG
            );

            // Determine config source
            const aiProviderSettings = await settingsService.getSettingsByCategory('ai_providers', true);
            const hasDbConfig = Object.keys(aiProviderSettings).length > 0;

            res.json({
                success: true,
                suggestion,
                metadata: {
                    modelUsed: config.OPENROUTER_MODEL || config.FLOWISE_CHATFLOW_ID || 'unknown',
                    providerUsed: config.AI_PROVIDER,
                    configSource: hasDbConfig ? 'database' : 'environment',
                    timestamp: new Date().toISOString(),
                    conversationId,
                    enableRAG
                }
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to generate AI suggestion',
                message: error.message
            });
        }
    });

    return router;
}

module.exports = createSystemRoutes;