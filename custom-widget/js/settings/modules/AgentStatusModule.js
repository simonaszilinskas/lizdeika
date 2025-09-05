/**
 * Agent Status Module
 * 
 * Handles connected agents display and real-time status updates
 * Extracted from SettingsManager for better modularity and single responsibility
 */

import { ErrorHandler } from '../../agent-dashboard/utils/ErrorHandler.js';

export class AgentStatusModule {
    constructor(apiManager, stateManager, connectionManager) {
        this.apiManager = apiManager;
        this.stateManager = stateManager;
        this.connectionManager = connectionManager;
        
        // DOM elements
        this.elements = {
            agentsList: null,
            totalConnected: null,
            totalAvailable: null,
            totalAfk: null
        };
        
        // Update tracking
        this.lastUpdateTime = null;
        this.updateInterval = null;
        
        console.log('👥 AgentStatusModule: Initialized');
    }

    /**
     * Initialize the agent status module
     */
    async initialize() {
        try {
            // Initialize DOM elements
            this.initializeElements();
            
            // Load current agents
            await this.loadConnectedAgents();
            
            // Setup state change listeners
            this.setupStateListeners();
            
            // Setup real-time updates
            this.setupRealTimeUpdates();
            
            // Start periodic refresh
            this.startPeriodicRefresh();
            
            console.log('✅ AgentStatusModule: Initialization complete');
            
        } catch (error) {
            ErrorHandler.logError(error, 'AgentStatusModule initialization failed');
            throw error;
        }
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.elements = {
            agentsList: document.getElementById('agents-list'),
            totalConnected: document.getElementById('total-connected'),
            totalAvailable: document.getElementById('total-available'),
            totalAfk: document.getElementById('total-afk')
        };
        
        console.log('🎯 AgentStatusModule: DOM elements initialized');
    }

    /**
     * Setup state change listeners
     */
    setupStateListeners() {
        // Listen for connected agents changes
        this.stateManager.on('connectedAgentsChanged', (agents) => {
            console.log('👥 AgentStatusModule: Connected agents changed via state:', agents?.length || 0);
            this.updateAgentDisplay(agents);
        });
        
        console.log('👂 AgentStatusModule: State listeners setup');
    }

    /**
     * Setup real-time updates via WebSocket
     */
    setupRealTimeUpdates() {
        if (!this.connectionManager) {
            console.log('⚠️ AgentStatusModule: No connection manager, skipping real-time updates');
            return;
        }

        // Listen for real-time agent updates
        this.connectionManager.on('agents-updated', (data) => {
            console.log('📡 AgentStatusModule: Real-time agents update received');
            this.stateManager.setConnectedAgents(data.agents);
        });
        
        console.log('🔄 AgentStatusModule: Real-time updates setup');
    }

    /**
     * Start periodic refresh of agent data
     */
    startPeriodicRefresh() {
        // Refresh every 30 seconds
        this.updateInterval = setInterval(() => {
            this.loadConnectedAgents();
        }, 30000);
        
        console.log('⏰ AgentStatusModule: Periodic refresh started (30s interval)');
    }

    // =========================
    // CORE FUNCTIONALITY
    // =========================

    /**
     * Load connected agents
     */
    async loadConnectedAgents() {
        try {
            console.log('📥 AgentStatusModule: Loading connected agents');
            
            // Delegate to APIManager
            const result = await this.apiManager.loadConnectedAgents();
            
            if (result) {
                this.lastUpdateTime = Date.now();
                console.log('✅ AgentStatusModule: Agents loaded successfully');
            }
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load connected agents');
            // Don't show toast for agent loading failures - this happens frequently
        }
    }

    /**
     * Update agent display with new data
     */
    updateAgentDisplay(agents) {
        console.log('🎨 AgentStatusModule: Updating agent display with', agents?.length || 0, 'agents');
        
        if (!this.elements.agentsList) {
            console.log('❌ AgentStatusModule: No agentsList element found');
            return;
        }
        
        // Update agent list display
        this.renderAgentsList(agents || []);
        
        // Update statistics
        this.updateAgentStats(agents || []);
        
        console.log('✅ AgentStatusModule: Agent display updated');
    }

    /**
     * Render agents list HTML
     */
    renderAgentsList(agents) {
        if (agents.length === 0) {
            this.elements.agentsList.innerHTML = '<p class="text-gray-500 text-center py-4">No agents currently connected</p>';
            return;
        }
        
        this.elements.agentsList.innerHTML = agents.map(agent => this.renderAgentCard(agent)).join('');
    }

    /**
     * Render individual agent card
     */
    renderAgentCard(agent) {
        const statusColor = this.getStatusColor(agent.personalStatus);
        const statusText = this.getStatusText(agent.personalStatus);
        const lastSeenText = this.formatLastSeen(agent.lastSeen);
        const agentId = this.formatAgentId(agent.id);
        
        return `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-3">
                    <div class="w-3 h-3 rounded-full ${statusColor}" title="${statusText}"></div>
                    <div>
                        <div class="font-medium text-gray-900">${agentId}</div>
                        ${agent.name ? `<div class="text-sm text-gray-600">${agent.name}</div>` : ''}
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-sm font-medium text-gray-900 capitalize">
                        ${statusText}
                    </div>
                    <div class="text-xs text-gray-500">
                        ${lastSeenText}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Update agent statistics display
     */
    updateAgentStats(agents) {
        const stats = this.calculateAgentStats(agents);
        
        if (this.elements.totalConnected) {
            this.elements.totalConnected.textContent = stats.total;
        }
        
        if (this.elements.totalAvailable) {
            this.elements.totalAvailable.textContent = stats.available;
        }
        
        if (this.elements.totalAfk) {
            this.elements.totalAfk.textContent = stats.afk;
        }
        
        console.log('📊 AgentStatusModule: Stats updated:', stats);
    }

    /**
     * Calculate agent statistics
     */
    calculateAgentStats(agents) {
        const stats = {
            total: agents.length,
            available: 0,
            afk: 0,
            offline: 0
        };
        
        agents.forEach(agent => {
            switch (agent.personalStatus) {
                case 'online':
                    stats.available++;
                    break;
                case 'afk':
                case 'away':
                    stats.afk++;
                    break;
                default:
                    stats.offline++;
            }
        });
        
        return stats;
    }

    // =========================
    // UTILITY METHODS
    // =========================

    /**
     * Get status color class
     */
    getStatusColor(status) {
        switch (status) {
            case 'online':
                return 'bg-green-400';
            case 'afk':
            case 'away':
                return 'bg-yellow-400';
            case 'busy':
                return 'bg-red-400';
            default:
                return 'bg-gray-400';
        }
    }

    /**
     * Get human-readable status text
     */
    getStatusText(status) {
        switch (status) {
            case 'online':
                return 'Available';
            case 'afk':
                return 'AFK';
            case 'away':
                return 'Away';
            case 'busy':
                return 'Busy';
            default:
                return 'Offline';
        }
    }

    /**
     * Format agent ID for display
     */
    formatAgentId(id) {
        if (!id) return 'Unknown';
        
        // Show first 12 characters with ellipsis
        return id.length > 12 ? `${id.substring(0, 12)}...` : id;
    }

    /**
     * Format last seen timestamp
     */
    formatLastSeen(timestamp) {
        if (!timestamp) return 'Never';
        
        const now = Date.now();
        const diff = now - new Date(timestamp).getTime();
        
        // Less than 1 minute
        if (diff < 60000) {
            return 'Just now';
        }
        
        // Less than 1 hour
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes}m ago`;
        }
        
        // Less than 1 day
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        }
        
        // Format as date
        return new Date(timestamp).toLocaleDateString();
    }

    /**
     * Format time for display
     */
    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString();
    }

    // =========================
    // PUBLIC API
    // =========================

    /**
     * Get current agents data
     */
    getConnectedAgents() {
        return this.stateManager.getConnectedAgents();
    }

    /**
     * Get agent statistics
     */
    getAgentStats() {
        const agents = this.getConnectedAgents();
        return this.calculateAgentStats(agents);
    }

    /**
     * Force refresh of agent data
     */
    async refresh() {
        console.log('🔄 AgentStatusModule: Forcing refresh');
        await this.loadConnectedAgents();
    }

    /**
     * Add event listener for agent changes
     */
    onAgentsChanged(callback) {
        this.stateManager.on('connectedAgentsChanged', callback);
    }

    /**
     * Remove event listener for agent changes
     */
    offAgentsChanged(callback) {
        this.stateManager.off('connectedAgentsChanged', callback);
    }

    /**
     * Check if agent data is stale
     */
    isDataStale() {
        if (!this.lastUpdateTime) return true;
        
        const staleThreshold = 60000; // 1 minute
        return (Date.now() - this.lastUpdateTime) > staleThreshold;
    }

    /**
     * Get last update time
     */
    getLastUpdateTime() {
        return this.lastUpdateTime;
    }

    /**
     * Set update interval (in milliseconds)
     */
    setUpdateInterval(interval) {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            this.loadConnectedAgents();
        }, interval);
        
        console.log(`⏰ AgentStatusModule: Update interval set to ${interval}ms`);
    }

    // =========================
    // DEBUGGING & STATUS
    // =========================

    /**
     * Get module status for debugging
     */
    getStatus() {
        const agents = this.getConnectedAgents();
        const stats = this.calculateAgentStats(agents);
        
        return {
            agentsCount: agents.length,
            stats: stats,
            lastUpdate: this.lastUpdateTime,
            isStale: this.isDataStale(),
            elements: {
                agentsList: !!this.elements.agentsList,
                totalConnected: !!this.elements.totalConnected,
                totalAvailable: !!this.elements.totalAvailable,
                totalAfk: !!this.elements.totalAfk
            },
            hasUpdateInterval: !!this.updateInterval
        };
    }

    /**
     * Get detailed agent information for debugging
     */
    getDetailedAgentInfo() {
        const agents = this.getConnectedAgents();
        
        return agents.map(agent => ({
            id: agent.id,
            status: agent.personalStatus,
            lastSeen: agent.lastSeen,
            name: agent.name,
            formattedId: this.formatAgentId(agent.id),
            formattedLastSeen: this.formatLastSeen(agent.lastSeen),
            statusColor: this.getStatusColor(agent.personalStatus),
            statusText: this.getStatusText(agent.personalStatus)
        }));
    }

    /**
     * Cleanup method for proper shutdown
     */
    destroy() {
        // Clear update interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        console.log('🧹 AgentStatusModule: Cleanup complete');
    }
}