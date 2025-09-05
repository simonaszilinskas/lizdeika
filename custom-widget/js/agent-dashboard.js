/**
 * Agent Dashboard Controller
 * Manages agent interface for handling customer support conversations
 */

// Import utility functions and constants
import {
    getAgentDisplayName
} from './agent-dashboard/ui/utils.js';

import {
    TIMING,
    FILTERS,
    DEFAULTS
} from './agent-dashboard/ui/constants.js';

// Import core services
import { AgentAuthManager } from './agent-dashboard/core/AgentAuthManager.js';
import { SocketManager } from './agent-dashboard/core/SocketManager.js';

// Import auth actions
import { logoutAgent, openUserManagement } from './agent-dashboard/auth-actions.js';

// Import bulk operations
import { BulkOperations } from './agent-dashboard/BulkOperations.js';

// Import sound notifications
import { SoundNotificationManager } from './agent-dashboard/SoundNotificationManager.js';

// Import debug manager
import { DebugManager } from './agent-dashboard/DebugManager.js';

// Import event manager
import { EventManager } from './agent-dashboard/EventManager.js';

// Import conversation renderer
import { ConversationRenderer } from './agent-dashboard/ConversationRenderer.js';

// Import API manager
import { APIManager } from './agent-dashboard/APIManager.js';

// Import state manager
import { StateManager } from './agent-dashboard/StateManager.js';

// Import UI helpers
import { UIHelpers } from './agent-dashboard/UIHelpers.js';

// Import chat manager
import { ChatManager } from './agent-dashboard/ChatManager.js';

// Import assignment manager
import { AssignmentManager } from './agent-dashboard/AssignmentManager.js';

// Import utils
import { ErrorHandler } from './agent-dashboard/utils/ErrorHandler.js';
import { Toast } from './agent-dashboard/utils/Toast.js';

// Import core conversation loader
import { ConversationLoader } from './agent-dashboard/core/ConversationLoader.js';

class AgentDashboard {
    constructor(config = {}) {
        // Allow configuration via data attributes or config object
        const apiUrl = config.apiUrl || 
                      document.body.dataset.apiUrl || 
                      window.location.protocol + '//' + window.location.hostname + ':3002';
        
        this.apiUrl = apiUrl;
        
        // Initialize authentication manager
        this.authManager = new AgentAuthManager({ apiUrl: this.apiUrl });
        this.agentId = this.authManager.getAgentId();
        
        // Initialize socket manager
        this.socketManager = new SocketManager({
            apiUrl: this.apiUrl,
            agentId: this.agentId,
            eventHandlers: {
                onConnect: () => this.registerInitialStatus(),
                onDisconnect: () => console.log('Socket disconnected'),
                onNewMessage: (data) => this.handleNewMessage(data),
                onAgentsUpdate: (data) => this.handleAgentsUpdate(data),
                onSystemModeUpdate: (data) => this.updateSystemMode(data.mode),
                onTicketReassignments: (data) => this.handleTicketReassignments(data),
                onCustomerTyping: (data) => this.handleCustomerTyping(data),
                onNewConversation: (data) => this.handleNewConversation(data),
                onAgentSentMessage: (data) => this.handleAgentSentMessage(data),
                onError: (error) => console.error('WebSocket error:', error)
            }
        });
        
        // Initialize state manager
        this.stateManager = new StateManager(this);
        
        // Initialize UI helpers
        this.uiHelpers = new UIHelpers(this);
        
        this.pollInterval = config.pollInterval || TIMING.POLL_INTERVAL;
        this.personalStatus = DEFAULTS.PERSONAL_STATUS; // Personal agent status (online/offline)
        this.systemMode = DEFAULTS.SYSTEM_MODE; // Global system mode (hitl/autopilot/off)
        this.connectedAgents = new Map(); // Track other connected agents
        
        // Agent caching to prevent rapid-fire API calls
        this.agentCache = null;
        this.agentCacheExpiry = 0;
        this.agentCacheDuration = TIMING.AGENT_CACHE_DURATION;
        
        // Initialize modern conversation loader
        this.modernConversationLoader = new ConversationLoader({
            apiUrl: this.apiUrl,
            logger: console
        });
        
        // Initialize utilities
        ErrorHandler.init();
        Toast.init();
        
        // ConversationUpdateManager removed - was unused infrastructure (always fell back to full reloads)
        
        // Initialize bulk operations manager
        this.bulkOperations = new BulkOperations(this);
        
        // Initialize debug manager
        this.debugManager = new DebugManager(this);
        
        // Initialize event manager
        this.eventManager = new EventManager(this);
        
        // Initialize conversation renderer
        this.conversationRenderer = new ConversationRenderer(this);
        
        // Initialize API manager
        this.apiManager = new APIManager(this);
        
        // Initialize chat manager (after API manager)
        this.chatManager = new ChatManager(this);
        
        // Initialize assignment manager
        this.assignmentManager = new AssignmentManager(this);
        
        // Initialize sound notification manager
        this.soundNotificationManager = null;
        this.initializeSoundNotifications();
        
        // Make dashboard globally available immediately
        window.dashboard = this;
        
        console.log(`Agent Dashboard initialized with API URL: ${this.apiUrl}`);
        this.init();
    }


    /**
     * Initialize sound notifications
     */
    async initializeSoundNotifications() {
        try {
            this.soundNotificationManager = new SoundNotificationManager(this);
            console.log('✅ Sound notification manager initialized');
        } catch (error) {
            console.error('❌ Failed to initialize sound notifications:', error);
            this.soundNotificationManager = null;
        }
    }


    async init() {
        console.log(`Agent Dashboard initialized for agent: ${this.agentId}`);
        
        // Load saved personal status before initializing other components
        await this.loadSavedPersonalStatus();
        
        // Register initial status with the server to ensure agent appears as connected
        await this.registerInitialStatus();
        
        // Set up periodic status refresh to keep agent appearing as connected (every 30 minutes)
        this.startStatusRefresh();
        
        // Check if user is admin and show admin bar
        await this.authManager.checkAdminStatus();
        
        this.eventManager.initializeAllEventListeners();
        await this.socketManager.initialize();
        await this.loadConversations();
        // No need for polling anymore with WebSockets
    }



    /**
     * Manually resize textarea (for programmatic content changes)
     */



    /**
     * Load saved personal status from localStorage
     */
    async loadSavedPersonalStatus() {
        try {
            // Try the new format first (with full email)
            let savedStatus = localStorage.getItem(`agentStatus_${this.agentId}`);
            
            // If not found and agentId contains @, try the old format (username only)
            if (!savedStatus && this.agentId.includes('@')) {
                const usernameOnly = this.agentId.split('@')[0];
                savedStatus = localStorage.getItem(`agentStatus_${usernameOnly}`);
                
                // If found in old format, migrate to new format and remove old
                if (savedStatus) {
                    localStorage.setItem(`agentStatus_${this.agentId}`, savedStatus);
                    localStorage.removeItem(`agentStatus_${usernameOnly}`);
                }
            }
            
            if (savedStatus && ['online', 'offline'].includes(savedStatus)) {
                this.personalStatus = savedStatus;
                
                // Update the dropdown to reflect saved status
                const personalStatusSelect = document.getElementById('personal-status');
                if (personalStatusSelect) {
                    personalStatusSelect.value = savedStatus;
                }
                
                // Update the status dot
                const dot = document.getElementById('agent-status-dot');
                if (dot) {
                    dot.className = `w-3 h-3 rounded-full agent-${savedStatus}`;
                }
                
                console.log(`Loaded saved personal status: ${savedStatus} for agent ${this.agentId}`);
            } else {
                // Default to online if no saved status
                this.personalStatus = 'online';
            }
        } catch (error) {
            console.error('Error loading saved personal status:', error);
            this.personalStatus = 'online';
        }
    }

    /**
     * Update personal agent status (online/offline)
     * @param {string} status - Personal status (online, offline)
     */
    async updatePersonalStatus(status) {
        const dot = document.getElementById('agent-status-dot');
        if (dot) {
            dot.className = `w-3 h-3 rounded-full agent-${status}`;
        }
        
        // Store personal status locally and in localStorage
        this.personalStatus = status;
        localStorage.setItem(`agentStatus_${this.agentId}`, status);
        
        try {
            await this.apiManager.updatePersonalStatus(status);
            console.log(`Updated personal status to: ${status} for agent ${this.agentId}`);
        } catch (error) {
            console.error('Error updating personal status:', error);
        }
    }

    /**
     * Register initial agent status on page load/connection
     */
    async registerInitialStatus() {
        // Use the already loaded personal status (from loadSavedPersonalStatus)
        const currentStatus = this.personalStatus || 'online';
        
        // Join the agent dashboard room to receive updates
        if (this.socketManager && this.socketManager.isSocketConnected()) {
            this.socketManager.emit('join-agent-dashboard', this.agentId);
            console.log('📡 Joined agent dashboard room:', this.agentId);
        }
        
        // Update the personal status to register the agent with server (but don't save to localStorage again)
        try {
            await this.apiManager.updatePersonalStatus(currentStatus);
            console.log(`Agent ${this.agentId} registered with initial status: ${currentStatus}`);
        } catch (error) {
            console.error('Error registering initial status:', error);
        }
    }

    /**
     * Start periodic status refresh to keep agent appearing as connected
     * This prevents the agent from being filtered out due to stale timestamps
     */
    startStatusRefresh() {
        // Clear any existing interval
        if (this.statusRefreshInterval) {
            clearInterval(this.statusRefreshInterval);
        }
        
        // Refresh status every 30 minutes (well within the 2-hour timeout)
        this.statusRefreshInterval = setInterval(async () => {
            if (this.personalStatus && this.personalStatus !== 'offline') {
                try {
                    await this.apiManager.sendHeartbeat();
                    console.log(`Status refreshed for agent ${this.agentId} at ${new Date().toISOString()}`);
                } catch (error) {
                    console.error('Error refreshing agent status:', error);
                }
            }
        }, 30 * 60 * 1000); // 30 minutes
    }

    /**
     * Handle different behaviors based on system mode
     * @param {string} mode - System mode (hitl, autopilot, off)
     */
    handleSystemMode(mode) {
        switch(mode) {
            case 'hitl':
                // HITL: Human in the Loop - show AI suggestions for validation
                console.log('System Mode: HITL - Human in the Loop mode activated');
                break;
            case 'autopilot':
                // Autopilot: Backend automatically sends AI responses with disclaimer
                console.log('System Mode: Autopilot - Automatic AI responses activated');
                this.chatManager.hideAISuggestion(); // Hide any pending suggestions since backend handles responses
                break;
            case 'off':
                // OFF: Backend sends offline messages for new messages
                console.log('System Mode: OFF - Customer support offline mode activated');
                this.chatManager.hideAISuggestion(); // Hide any pending suggestions
                break;
        }
    }

    /**
     * Update connected agents display
     * @param {Array} agents - Array of connected agents
     */
    updateConnectedAgents(agents) {
        this.connectedAgents.clear();
        agents.forEach(agent => this.connectedAgents.set(agent.id, agent));
        
        // Refresh the agents dropdown if it exists and is visible
        const dropdown = document.getElementById('bulk-assign-agent');
        if (dropdown && dropdown.style.display !== 'none') {
            // Force refresh of dropdown options
            dropdown.innerHTML = '';
            this.bulkOperations.populateAgentsDropdown();
        }
        
        // Update compact format in header
        const compactContainer = document.getElementById('connected-agents-compact');
        const totalAgentsCompact = document.getElementById('total-agents-compact');
        
        if (compactContainer && totalAgentsCompact) {
            totalAgentsCompact.textContent = agents.length;
            
            // Create tooltip content with agent names grouped by status
            const onlineAgents = agents.filter(agent => agent.personalStatus === 'online');
            const offlineAgents = agents.filter(agent => agent.personalStatus === 'offline');
            
            let tooltipContent = '';
            if (onlineAgents.length > 0) {
                tooltipContent += `Online (${onlineAgents.length}): ${onlineAgents.map(a => getAgentDisplayName(a)).join(', ')}`;
            }
            if (offlineAgents.length > 0) {
                if (tooltipContent) tooltipContent += '\n';
                tooltipContent += `Offline (${offlineAgents.length}): ${offlineAgents.map(a => getAgentDisplayName(a)).join(', ')}`;
            }
            if (!tooltipContent) {
                tooltipContent = 'No agents connected';
            }
            
            // Add tooltip to the agent count element
            totalAgentsCompact.title = tooltipContent;
            
            // Show agents as small colored dots with individual tooltips
            compactContainer.innerHTML = agents.map(agent => {
                const statusColor = agent.personalStatus === 'online' ? 'bg-green-400' : 'bg-gray-400';
                const displayName = getAgentDisplayName(agent);
                return `
                    <div class="w-2 h-2 rounded-full ${statusColor}" 
                         title="${displayName} (${agent.personalStatus || 'online'})">
                    </div>
                `;
            }).join('');
        }
        
        // Update old format (for compatibility if it exists elsewhere)
        const container = document.getElementById('connected-agents');
        const totalAgents = document.getElementById('total-agents');
        
        if (container && totalAgents) {
            totalAgents.textContent = agents.length;
            
            container.innerHTML = agents.map(agent => `
                <div class="flex items-center justify-between py-1 px-2 bg-white rounded text-xs">
                    <div class="flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full ${agent.personalStatus === 'online' ? 'bg-green-400' : 'bg-gray-400'}"></div>
                        <span class="text-gray-700">${getAgentDisplayName(agent)}</span>
                    </div>
                    <span class="text-gray-500 capitalize">${agent.personalStatus || 'online'}</span>
                </div>
            `).join('');
        }
    }


    /**
     * Update system mode display
     * @param {string} mode - System mode (hitl, autopilot, off)
     */
    updateSystemMode(mode) {
        // Update local state
        this.systemMode = mode;
        
        // Update old system mode display (for compatibility)
        const systemModeElement = document.getElementById('system-mode');
        const systemStatusDot = document.getElementById('system-status-dot');
        
        if (systemModeElement) {
            systemModeElement.textContent = mode.toUpperCase();
        }
        
        if (systemStatusDot) {
            systemStatusDot.className = `w-2 h-2 rounded-full system-${mode}`;
        }
        
        this.handleSystemMode(mode);
    }

    /**
     * Handle ticket reassignments notification
     * @param {Object} data - Reassignment data
     */
    handleTicketReassignments(data) {
        const { reassignments, reason } = data;
        
        let message = '';
        const myReassignments = reassignments.filter(r => r.toAgent === this.agentId);
        const myLosses = reassignments.filter(r => r.fromAgent === this.agentId);
        
        // AFK reason removed - no longer applicable
        if (reason === 'agent_online') {
            if (myReassignments.length > 0) {
                message = `You received ${myReassignments.length} tickets (agent back online + redistribution)`;
            }
        } else if (reason === 'agent_joined') {
            if (myReassignments.length > 0) {
                message = `You received ${myReassignments.length} tickets from the queue`;
            }
        }
        
        if (message) {
            this.showNotification(message, 'info');
        }
    }

    /**
     * Show notification to user
     * @param {string} message - Notification message
     * @param {string} type - Notification type (info, warning, success, error)
     */
    showNotification(message, type = 'info') {
        // Create notification element if it doesn't exist
        let notification = document.getElementById('agent-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'agent-notification';
            notification.className = 'fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm';
            document.body.appendChild(notification);
        }
        
        // Set content and styling
        const iconMap = {
            info: 'fa-info-circle text-blue-600',
            warning: 'fa-exclamation-triangle text-yellow-600',
            success: 'fa-check-circle text-green-600',
            error: 'fa-times-circle text-red-600'
        };
        
        const bgMap = {
            info: 'bg-blue-50 border-blue-200 text-blue-800',
            warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
            success: 'bg-green-50 border-green-200 text-green-800',
            error: 'bg-red-50 border-red-200 text-red-800'
        };
        
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm border ${bgMap[type]}`;
        notification.innerHTML = `
            <div class="flex items-start gap-3">
                <i class="fas ${iconMap[type]} mt-0.5"></i>
                <div class="flex-1">
                    <p class="text-sm font-medium">${message}</p>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times text-sm"></i>
                </button>
            </div>
        `;
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (notification && notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }


    /**
     * Load and display conversations using modern loader
     */
    async loadConversations() {
        try {
            console.log('📞 Loading conversations with modern loader...');
            
            const filters = {
                archiveFilter: this.stateManager.getArchiveFilter(),
                assignmentFilter: this.stateManager.getCurrentFilter(),
                agentId: this.agentId
            };
            
            // Use modern conversation loader
            await this.modernConversationLoader.load(filters, (conversations) => {
                this.conversationRenderer.renderQueue(conversations);
            });
            
            // Store conversations for backward compatibility
            const conversationData = this.modernConversationLoader.getConversations();
            this.stateManager.setAllConversations(conversationData.all);
            
            // Update filter button styles
            this.stateManager.updateFilterButtons();
            console.log('✅ Modern conversation loading completed successfully');
            
        } catch (error) {
            console.error('❌ Error in modern conversation loading:', error);
            // Fallback to show error state is handled by the modern loader
        }
    }

















    /**
     * Toggle assignment dropdown visibility
     */
    async toggleAssignDropdown(conversationId, event) {
        await this.assignmentManager.toggleAssignDropdown(conversationId, event);
    }

    /**
     * Assign conversation to specific agent
     */
    async assignToAgent(conversationId, agentId, event) {
        await this.assignmentManager.assignToAgent(conversationId, agentId, event);
    }

    /**
     * Unassign conversation (assign to nobody)
     */
    async unassignConversation(conversationId, event) {
        await this.assignmentManager.unassignFromDropdown(conversationId, event);
    }

    /**
     * Assign conversation to current agent
     * @param {string} conversationId - ID of conversation to assign
     * @param {Event} event - Click event to prevent propagation
     */
    async assignConversation(conversationId, event) {
        await this.assignmentManager.assignConversation(conversationId, event);
    }

    /**
     * Unassign conversation from current agent (direct action, not dropdown)
     * @param {string} conversationId - ID of conversation to unassign
     * @param {Event} event - Click event to prevent propagation
     */
    async unassignFromCurrentAgent(conversationId, event) {
        await this.assignmentManager.unassignConversation(conversationId, event);
    }

    /**
     * Archive conversation
     * @param {string} conversationId - ID of conversation to archive
     * @param {Event} event - Click event to prevent propagation
     */
    async archiveConversation(conversationId, event) {
        await this.assignmentManager.archiveConversation(conversationId, event);
    }

    /**
     * Unarchive conversation
     * @param {string} conversationId - ID of conversation to unarchive
     * @param {Event} event - Click event to prevent propagation
     */
    async unarchiveConversation(conversationId, event) {
        await this.assignmentManager.unarchiveConversation(conversationId, event);
    }

    /**
     * Set conversation filter
     * @param {string} filter - Filter type: 'mine', 'unassigned', 'others', 'all'
     */
    setFilter(filter) {
        this.stateManager.setFilter(filter);
    }



    /**
     * Filter conversations based on assignment status
     * @param {Array} conversations - Array of conversation objects
     * @param {string} filter - Filter type
     * @returns {Array} Filtered conversations
     */
    filterConversations(conversations, filter) {
        // First apply archive filter
        let filtered = conversations;
        if (this.stateManager.getArchiveFilter() === 'active') {
            filtered = conversations.filter(conv => !conv.archived);
        } else if (this.stateManager.getArchiveFilter() === 'archived') {
            filtered = conversations.filter(conv => conv.archived);
            // Archived conversations don't use assignment filters
            return filtered;
        }
        
        // Then apply assignment filter (only for active conversations)
        switch (filter) {
            case 'mine':
                return filtered.filter(conv => conv.assignedAgent === this.agentId);
            case 'unassigned':
                return filtered.filter(conv => !conv.assignedAgent);
            case 'others':
                return filtered.filter(conv => conv.assignedAgent && conv.assignedAgent !== this.agentId);
            case 'all':
            default:
                return filtered;
        }
    }

    /**
     * Select and load a chat conversation
     * @param {string} conversationId - ID of conversation to select
     */
    async selectChat(conversationId) {
        await this.chatManager.selectChat(conversationId);
    }







    /**
     * Send message from input field
     */
    async sendMessage() {
        await this.chatManager.sendMessage();
    }

    /**
     * Get AI assistance for current conversation
     */
    async getAIAssistance() {
        await this.chatManager.getAIAssistance();
    }

    /**
     * Check for pending AI suggestions (HITL mode only) - delegate to ChatManager
     * @param {string} conversationId - ID of conversation
     */
    async checkForPendingSuggestion(conversationId) {
        await this.chatManager.checkForPendingSuggestion(conversationId);
    }

    /**
     * Send AI suggestion as-is
     */
    async sendAsIs() {
        await this.chatManager.sendAsIs();
    }

    /**
     * Edit AI suggestion in input field
     */
    editSuggestion() {
        this.chatManager.editSuggestion();
    }

    /**
     * Clear input and write from scratch
     */
    writeFromScratch() {
        this.chatManager.writeFromScratch();
    }

    /**
     * Load messages for a conversation
     * @param {string} conversationId - ID of conversation
     */
    async loadChatMessages(conversationId) {
        await this.chatManager.loadChatMessages(conversationId);
    }

    /**
     * Auto-resize textarea based on content
     */
    resizeTextarea() {
        this.chatManager.resizeTextarea();
    }


    /**
     * Show toast notification to user
     * @param {string} message - Message to display
     * @param {string} type - Type of toast: 'success', 'warning', 'error', 'info'
     */
    showToast(message, type = 'info') {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'fixed top-4 right-4 z-50 space-y-2';
            document.body.appendChild(toastContainer);
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `max-w-sm p-4 rounded-md shadow-lg transform transition-all duration-300 ease-in-out`;
        
        // Set colors based on type
        const typeStyles = {
            success: 'bg-green-500 text-white',
            warning: 'bg-yellow-500 text-white',
            error: 'bg-red-500 text-white',
            info: 'bg-blue-500 text-white'
        };
        
        toast.className += ` ${typeStyles[type] || typeStyles.info}`;
        
        // Set content
        toast.innerHTML = `
            <div class="flex items-center">
                <span class="flex-1">${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" 
                        class="ml-3 text-white hover:text-gray-200 focus:outline-none">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
        `;
        
        // Add to container
        toastContainer.appendChild(toast);
        
        // Auto-remove after 5 seconds (except for errors - keep them longer)
        const duration = type === 'error' ? 8000 : 5000;
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300);
            }
        }, duration);
    }


    /**
     * Handle bulk operation errors with user-friendly messages
     * @param {Error} error - The error that occurred
     * @param {string} operation - The operation that failed ('archive', 'unarchive', 'assign')
     */
    handleBulkOperationError(error, operation = 'process') {
        console.error(`Error ${operation}ing conversations:`, error);
        
        // Show user-friendly error message
        let errorMessage = `Failed to ${operation} conversations. Please try again.`;
        
        if (error.message.includes('403')) {
            errorMessage = `You are not authorized to ${operation} these conversations.`;
        } else if (error.message.includes('404')) {
            errorMessage = 'Some conversations no longer exist.';
        } else if (error.message.includes('500')) {
            errorMessage = 'Server error. Please try again in a moment.';
        } else if (error.name === 'TypeError') {
            errorMessage = 'Network error. Please check your connection and try again.';
        }
        
        this.showToast(errorMessage, 'error');
    }

    // Debug methods moved to ./agent-dashboard/DebugManager.js


    /**
     * Show an element by ID
     * @param {string} elementId - Element ID to show
     */
    showElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove('hidden');
        }
    }

    /**
     * Hide an element by ID
     * @param {string} elementId - Element ID to hide
     */
    hideElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('hidden');
        }
    }

    /**
     * Reset chat view to no selection
     */
    resetChatView() {
        this.stateManager.resetChatView();
    }

    /**
     * Handle new message from socket manager
     * @param {Object} data - Message data
     */
    handleNewMessage(data) {
        console.log('📨 WebSocket: New message received', { conversationId: data.conversationId, sender: data.sender, isCurrentChat: data.conversationId === this.stateManager.getCurrentChatId() });
        
        // Play sound notification for new messages
        if (this.soundNotificationManager && data.sender !== 'agent') {
            this.soundNotificationManager.onNewMessage({
                conversationId: data.conversationId,
                sender: data.sender,
                content: data.content || data.message,
                senderType: data.sender,
                conversation: data.conversation || { assigned_agent_id: data.assignedAgentId }
            });
        }
        
        // Always do full conversation reload for reliability
        this.loadConversations();
        
        // If this is the current chat, update messages and check for suggestion
        if (data.conversationId === this.stateManager.getCurrentChatId()) {
            console.log('🔄 WebSocket: Refreshing current chat messages');
            // Refresh conversation status (handles reopening cases)
            this.refreshConversation(this.stateManager.getCurrentChatId());
            this.loadChatMessages(this.currentChatId);
            
            // If this is a customer message in HITL mode, refresh suggestions
            if (this.systemMode === 'hitl' && data.sender === 'customer') {
                console.log('💬 Customer message received, clearing old suggestion and checking for new one');
                // Clear any existing suggestion first (it's now outdated)
                this.chatManager.hideAISuggestion();
                // Check for new suggestion based on updated conversation
                this.checkForPendingSuggestion(this.stateManager.getCurrentChatId());
            } else if (this.systemMode === 'hitl') {
                // For agent messages, just check if there's still a pending suggestion
                this.checkForPendingSuggestion(this.stateManager.getCurrentChatId());
            }
        }
    }

    /**
     * Handle agents update from socket manager
     * @param {Object} data - Agents data
     */
    handleAgentsUpdate(data) {
        // Invalidate agent cache when status changes
        this.agentCacheExpiry = 0;
        console.log('🔄 Agent cache invalidated due to status change');
        this.updateConnectedAgents(data.agents);
    }

    /**
     * Handle customer typing from socket manager
     * @param {Object} data - Typing data
     */
    handleCustomerTyping(data) {
        if (data.conversationId === this.stateManager.getCurrentChatId()) {
            UIHelpers.showCustomerTyping(data.isTyping);
        }
    }

    /**
     * Handle new conversation from socket manager
     * @param {Object} data - Conversation data
     */
    handleNewConversation(data) {
        // Play sound notification for new conversations
        if (this.soundNotificationManager) {
            this.soundNotificationManager.onNewConversation(data);
        }
        
        // Reload conversations to show the new conversation
        this.loadConversations();
    }

    /**
     * Handle agent sent message WebSocket event
     * @param {Object} data - Agent sent message data
     */
    handleAgentSentMessage(data) {
        // Only update if this is the current conversation
        if (data.conversationId === this.stateManager.getCurrentChatId()) {
            // Add the message to the chat immediately without full reload
            this.conversationRenderer.appendMessageToChat(data.message);
            
            // Reload conversations to update queue status
            this.loadConversations();
        }
    }

    
    
    
    




    /**
     * Refresh a single conversation data from server
     * @param {string} conversationId - Conversation ID to refresh
     */
    async refreshConversation(conversationId) {
        await this.assignmentManager.refreshConversation(conversationId);
    }








    /**
     * Toggle conversation selection for bulk operations
     */
    toggleConversationSelection(conversationId) {
        this.stateManager.toggleConversationSelection(conversationId);
        this.bulkOperations.updateBulkActionsPanel();
    }

    /**
     * Toggle select/deselect all filtered conversations
     */
    toggleSelectAll(selectAll) {
        this.stateManager.toggleSelectAll(selectAll);
        this.bulkOperations.updateBulkActionsPanel();
    }

    /**
     * Update selection UI (checkboxes) - delegate to bulk operations
     */
    updateSelectionUI() {
        this.bulkOperations.updateSelectionUI();
    }

    /**
     * Toggle between active and archived conversations
     */
    toggleArchiveFilter() {
        this.stateManager.toggleArchiveFilter();
        this.bulkOperations.updateBulkActionButtons();
    }

    // Bulk operations methods moved to ./agent-dashboard/BulkOperations.js
}

// Functions moved to ./agent-dashboard/auth-actions.js

// Expose functions globally for HTML onclick handlers
window.logoutAgent = logoutAgent;
window.openUserManagement = openUserManagement;

// Initialize dashboard immediately when script loads (DOM is already ready at this point)
console.log('🚀 Initializing Agent Dashboard...');
new AgentDashboard();
console.log('✅ Dashboard initialized');