/**
 * SYSTEM ROUTES
 * 
 * Main Purpose: Define HTTP endpoints for system administration, health monitoring, and configuration
 * 
 * Key Responsibilities:
 * - Health Monitoring: System health checks and status reporting
 * - Configuration Management: AI provider and system prompt configuration
 * - Admin Functions: System reset and data management operations
 * - RAG Testing: Knowledge base testing and debugging endpoints
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
 * - GET /knowledge/stats - Knowledge base statistics
 * - POST /knowledge/search - Search knowledge base
 * - POST /knowledge/reset - Reset knowledge base with sample data
 * 
 * RAG Testing Routes:
 * - POST /test-rag - Full RAG functionality test
 * - POST /debug-rag - RAG context generation debugging
 * - POST /simple-rag-test - Direct AI test with enhanced context
 * - POST /context-test - Preview context without AI call
 * 
 * Notes:
 * - Health endpoint is available at root level (/health)
 * - Configuration endpoints are under /api/config/*
 * - Testing endpoints are designed for development environments
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


    // Reset endpoint for testing (clears all data)
    router.post('/reset', (req, res) => {
        systemController.resetSystem(req, res);
    });

    // RAG/Knowledge base testing endpoints
    router.get('/knowledge/stats', (req, res) => {
        systemController.getKnowledgeStats(req, res);
    });

    router.post('/knowledge/search', (req, res) => {
        systemController.searchKnowledge(req, res);
    });

    router.post('/knowledge/reset', (req, res) => {
        systemController.resetKnowledge(req, res);
    });

    // Test RAG functionality directly
    router.post('/test-rag', (req, res) => {
        systemController.testRAG(req, res);
    });

    // Debug RAG context generation only
    router.post('/debug-rag', (req, res) => {
        systemController.debugRAG(req, res);
    });

    // Simple RAG test that directly calls AI with enhanced context
    router.post('/simple-rag-test', (req, res) => {
        systemController.simpleRAGTest(req, res);
    });

    // Context-only test - just check what context would be sent to AI
    router.post('/context-test', (req, res) => {
        systemController.contextTest(req, res);
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

    return router;
}

module.exports = createSystemRoutes;