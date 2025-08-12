/**
 * System Controller
 * Handles system-related endpoints like health checks, configuration, and admin functions
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
     * Update system settings (AI provider, system prompt)
     */
    async updateSettings(req, res) {
        try {
            const { aiProvider: newProvider, systemPrompt } = req.body;
            
            if (!newProvider || !systemPrompt) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Update environment variables for runtime changes
            const oldProvider = process.env.AI_PROVIDER;
            process.env.AI_PROVIDER = newProvider;
            process.env.SYSTEM_PROMPT = systemPrompt;
            
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
}

module.exports = SystemController;