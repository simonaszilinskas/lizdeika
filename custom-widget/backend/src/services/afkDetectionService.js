/**
 * AFK Detection Service
 * Automatically detects agent inactivity and sets them to AFK status
 */

const agentService = require('./agentService');

class AFKDetectionService {
    constructor() {
        // AFK timeout: 15 minutes (configurable via environment variable)
        this.afkTimeoutMinutes = parseInt(process.env.AFK_TIMEOUT_MINUTES) || 15;
        this.checkIntervalMinutes = 2; // Check every 2 minutes
        
        // Track agent last activity
        this.agentActivity = new Map();
        
        // Start the AFK detection process
        this.startAFKDetection();
        
        console.log(`🟡 AFK Detection started: ${this.afkTimeoutMinutes}min timeout, checking every ${this.checkIntervalMinutes}min`);
    }

    /**
     * Record activity for an agent
     * @param {string} agentId - Agent ID
     */
    async recordActivity(agentId) {
        if (!agentId) return;
        
        this.agentActivity.set(agentId, Date.now());
        
        // If agent was automatically set to AFK, reset them to online
        const isAutoAFK = this.agentActivity.get(agentId + '_autoAFK');
        if (isAutoAFK) {
            const connectedAgents = await agentService.getConnectedAgents();
            const agent = connectedAgents.find(a => a.id === agentId);
            if (agent && agent.personalStatus === 'afk') {
                agentService.updateAgentPersonalStatus(agentId, 'online');
                this.agentActivity.delete(agentId + '_autoAFK'); // Clear the auto-AFK flag
                console.log(`🟢 Auto-restored ${agentId} from AFK due to activity`);
            }
        }
    }

    /**
     * Start the automatic AFK detection interval
     */
    startAFKDetection() {
        const intervalMs = this.checkIntervalMinutes * 60 * 1000;
        
        setInterval(() => {
            this.checkForInactiveAgents();
        }, intervalMs);
    }

    /**
     * Check for inactive agents and set them to AFK
     */
    async checkForInactiveAgents() {
        const connectedAgents = await agentService.getConnectedAgents();
        const now = Date.now();
        const timeoutMs = this.afkTimeoutMinutes * 60 * 1000;

        for (const agent of connectedAgents) {
            // Skip if agent is manually set to AFK or offline
            if (agent.personalStatus === 'afk' || agent.personalStatus === 'offline') {
                continue;
            }

            const lastActivity = this.agentActivity.get(agent.id) || agent.lastSeen || 0;
            const timeSinceActivity = now - lastActivity;

            // If agent has been inactive for the timeout period
            if (timeSinceActivity > timeoutMs) {
                try {
                    // Set agent to AFK with auto flag
                    await agentService.updateAgentPersonalStatus(agent.id, 'afk');
                    
                    // Track that this was automatically set for potential auto-restoration
                    // Note: We store this in our local activity map as a flag
                    this.agentActivity.set(agent.id + '_autoAFK', true);

                    console.log(`🟡 Auto-AFK: Set ${agent.id} to AFK after ${Math.round(timeSinceActivity / 60000)}min inactivity`);
                } catch (error) {
                    console.error(`Error setting agent ${agent.id} to AFK:`, error.message);
                }
            }
        }
    }

    /**
     * Get AFK configuration
     */
    getConfig() {
        return {
            afkTimeoutMinutes: this.afkTimeoutMinutes,
            checkIntervalMinutes: this.checkIntervalMinutes,
            enabled: true
        };
    }

    /**
     * Update AFK timeout (for runtime configuration)
     * @param {number} minutes - New timeout in minutes
     */
    setAFKTimeout(minutes) {
        if (minutes < 1 || minutes > 120) {
            throw new Error('AFK timeout must be between 1 and 120 minutes');
        }
        
        this.afkTimeoutMinutes = minutes;
        console.log(`🔄 AFK timeout updated to ${minutes} minutes`);
    }
}

module.exports = new AFKDetectionService();