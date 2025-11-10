/**
 * AGENT DASHBOARD CONTROLLER
 *
 * Main Purpose: Main entry point and coordinator for the agent dashboard interface
 *
 * Key Responsibilities:
 * - Module Initialization: Bootstrap all dashboard modules with dependency injection
 * - State Coordination: Manage global dashboard state across all modules
 * - Event Orchestration: Coordinate inter-module communication via events
 * - UI Lifecycle: Handle dashboard mounting, updating, and cleanup
 * - Authentication: Manage agent login state and session management
 * - WebSocket Coordination: Initialize and manage real-time communication
 *
 * Dependencies:
 * - AgentAuthManager: Authentication and authorization
 * - SocketManager: WebSocket connection and event handling
 * - StateManager: Centralized state management
 * - APIManager: HTTP requests and API communication
 * - ChatManager: Message sending and AI suggestion handling
 * - ConversationRenderer: UI rendering for conversations and messages
 * - AssignmentManager: Conversation assignment operations
 * - BulkOperations: Multi-conversation operations
 * - EventManager: Event coordination and delegation
 * - UIHelpers: DOM manipulation utilities
 * - SoundNotificationManager: Audio notifications
 * - DebugManager: Development tools and logging
 *
 * Architecture Pattern:
 * - Modular ES6 architecture with dependency injection
 * - Single Responsibility Principle for each module
 * - Event-driven communication between modules
 * - Centralized state management via StateManager
 * - Separation of concerns (UI, State, Logic, API)
 *
 * Module Communication:
 * - Modules communicate via StateManager events
 * - Dashboard instance passed to modules for shared context
 * - Public methods exposed for cross-module coordination
 * - Events: conversation-selected, filter-changed, message-sent, etc.
 *
 * Initialization Sequence:
 * 1. Check authentication (redirect if not logged in)
 * 2. Initialize core services (State, API, Socket)
 * 3. Initialize feature modules (Chat, Assignment, Bulk Ops)
 * 4. Initialize UI modules (Renderer, Helpers)
 * 5. Load initial data (conversations, agents)
 * 6. Setup event listeners and UI bindings
 * 7. Connect WebSocket and join agent room
 *
 * Features:
 * - Real-time conversation updates via WebSocket
 * - AI-powered response suggestions with HITL/Autopilot modes
 * - Conversation filtering (mine, unassigned, others, all)
 * - Bulk operations (assign, archive, categorize)
 * - Sound notifications for new messages
 * - Typing indicators for agents and customers
 * - Category assignment with real-time updates
 * - Debug panel for development
 *
 * UI State Management:
 * - Current filter (mine/unassigned/others/all)
 * - Selected conversation ID
 * - Current AI suggestion
 * - Bulk selection set
 * - System mode (HITL/Autopilot/OFF)
 *
 * Notes:
 * - All modules receive dashboard instance for coordination
 * - State changes trigger UI updates via events
 * - WebSocket reconnection is automatic
 * - Authentication token stored in localStorage
 * - Supports multiple concurrent agents
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

import { 
    POLLING_CONFIG, 
    UI_CONFIG, 
    WEBSOCKET_CONFIG 
} from './agent-dashboard/config/constants.js';

import { logger } from './agent-dashboard/utils/logger.js';

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

// Import sidebar manager
import { SidebarManager } from './agent-dashboard/SidebarManager.js';

// Import notification and system mode managers
import { NotificationService } from './agent-dashboard/notifications/NotificationService.js';
import { SystemModeManager } from './agent-dashboard/core/SystemModeManager.js';

class AgentDashboard {
    constructor(config = {}) {
        // Allow configuration via data attributes or config object
        const apiUrl = config.apiUrl ||
                      document.body.dataset.apiUrl ||
                      window.location.origin;
        
        this.apiUrl = apiUrl;

        // Track current polling for AI suggestions (to cancel if new message arrives)
        this.currentPollingId = null;

        // Track if tooltip listeners are initialized (prevent memory leak)
        this.tooltipListenersInitialized = false;

        // Track template dropdown initialization to prevent duplicate listeners
        this.templateDropdownInitialized = false;

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

        // Initialize shared utilities
        this.notificationService = new NotificationService();
        this.systemModeManager = new SystemModeManager();
        
        // Initialize modern conversation loader
        this.modernConversationLoader = new ConversationLoader({
            apiUrl: this.apiUrl,
            logger: console
        });
        
        // Initialize utilities
        ErrorHandler.init();
        Toast.init();
        
        
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
        this.systemModeManager.setChatManager(this.chatManager);
        
        // Initialize assignment manager
        this.assignmentManager = new AssignmentManager(this);
        
        // Initialize sound notification manager
        this.soundNotificationManager = null;
        this.initializeSoundNotifications();

        // Initialize sidebar manager
        this.sidebarManager = new SidebarManager(this);

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

        // Set up auto-refresh for conversations every 5 seconds
        this.startQueueAutoRefresh();
        
        // Check if user is admin and show admin bar
        await this.authManager.checkAdminStatus();
        
        this.eventManager.initializeAllEventListeners();
        await this.socketManager.initialize();
        
        // Restore filter states before loading conversations
        this.stateManager.restoreFilterStates();
        
        await this.loadConversations();

        // Load response templates
        await this.loadTemplates();

        // Restore previously selected conversation after conversations are loaded
        await this.restorePreviousConversation();

        // No need for polling anymore with WebSockets
    }

    /**
     * Restore previously selected conversation from localStorage
     */
    async restorePreviousConversation() {
        try {
            const savedChatId = this.stateManager.restoreCurrentChatId();
            console.log('🔍 Debug: Restored chat ID from localStorage:', savedChatId);
            console.log('🔍 Debug: Available conversations count:', this.stateManager.allConversations.length);
            console.log('🔍 Debug: First few conversation IDs:', 
                this.stateManager.allConversations.slice(0, 3).map(conv => conv.id));
            
            if (savedChatId) {
                console.log(`🔄 Restoring previous conversation: ${savedChatId}`);
                
                // Check if the conversation still exists in the loaded conversations
                const conversationExists = this.stateManager.allConversations.some(conv => conv.id === savedChatId);
                
                if (conversationExists) {
                    // Use the ChatManager to properly select the conversation
                    await this.chatManager.selectChat(savedChatId);
                    console.log(`✅ Successfully restored conversation: ${savedChatId}`);
                } else {
                    console.log(`⚠️ Saved conversation ${savedChatId} no longer exists, clearing from localStorage`);
                    console.log('🔍 Debug: All available conversation IDs:', 
                        this.stateManager.allConversations.map(conv => conv.id));
                    // Clear the invalid conversation from localStorage
                    this.stateManager.setCurrentChatId(null);
                }
            }
        } catch (error) {
            console.error('Error restoring previous conversation:', error);
            // Clear invalid state
            this.stateManager.setCurrentChatId(null);
        }
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
     * Start smart auto-refresh for conversation queue every 5 seconds
     * Only updates UI when there are actual changes to prevent visual flicker
     */
    startQueueAutoRefresh() {
        // Clear any existing interval
        if (this.queueRefreshInterval) {
            clearInterval(this.queueRefreshInterval);
        }

        // Track user interactions to avoid updates while user is active
        this.lastUserInteraction = Date.now();
        this.setupInteractionTracking();

        // Refresh conversations every 15 seconds with smart diff detection
        this.queueRefreshInterval = setInterval(async () => {
            try {
                // Skip refresh if user was recently active (within last 3 seconds)
                const timeSinceLastInteraction = Date.now() - this.lastUserInteraction;
                if (timeSinceLastInteraction < 3000) {
                    console.log('⏸️ Skipping auto-refresh: user recently active');
                    return;
                }

                console.log('🔄 Smart auto-refresh: checking for changes...');
                await this.smartRefreshConversations();
            } catch (error) {
                console.error('Error in smart auto-refresh:', error);
            }
        }, 15000); // 15 seconds (reduced from 5 seconds)

        console.log('✅ Smart auto-refresh started - UI only updates when changes detected');
    }

    /**
     * Smart refresh that only updates UI when conversations actually changed
     */
    async smartRefreshConversations() {
        try {
            // Get fresh data from API directly
            const response = await fetch(`${this.apiUrl}/api/admin/conversations`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('agent_token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            const freshConversations = data.conversations || [];

            // Compare with current state to detect changes
            const hasChanges = this.detectConversationChanges(freshConversations);

            if (hasChanges) {
                console.log('🔄 Changes detected, updating UI...');

                // Prepare filters
                const filters = {
                    archiveFilter: this.stateManager.getArchiveFilter(),
                    assignmentFilter: this.stateManager.getCurrentFilter(),
                    agentId: this.agentId
                };

                // Use the existing load method
                await this.modernConversationLoader.load(filters, (conversations) => {
                    this.conversationRenderer.renderQueue(conversations);
                });
            } else {
                console.log('✅ No changes detected, UI stays stable');
            }
        } catch (error) {
            console.error('Error in smart refresh:', error);
        }
    }

    /**
     * Detect if conversations have actually changed
     * @param {Array} newConversations - Fresh conversation data
     * @returns {boolean} Whether changes were detected
     */
    detectConversationChanges(newConversations) {
        const currentConversations = this.stateManager.allConversations;

        // Quick checks for obvious changes
        if (currentConversations.length !== newConversations.length) {
            console.log('🔄 Change detected: conversation count changed');
            return true;
        }

        // Check each conversation for meaningful changes only
        for (let i = 0; i < newConversations.length; i++) {
            const current = currentConversations[i];
            const fresh = newConversations[i];

            if (!current || current.id !== fresh.id) {
                console.log('🔄 Change detected: conversation order or ID changed');
                return true;
            }

            // Check for meaningful message changes (ignore minor timestamp precision differences)
            const currentMsgId = current.lastMessage?.id;
            const freshMsgId = fresh.lastMessage?.id;

            if (currentMsgId !== freshMsgId) {
                console.log(`🔄 Change detected: new message in conversation ${fresh.id}`);
                return true;
            }

            // Check assignment changes (meaningful for UI)
            if (current.assignedAgent !== fresh.assignedAgent) {
                console.log(`🔄 Change detected: assignment changed for conversation ${fresh.id}`);
                return true;
            }

            // Check status changes (archived, priority, etc)
            if (current.isArchived !== fresh.isArchived) {
                console.log(`🔄 Change detected: archive status changed for conversation ${fresh.id}`);
                return true;
            }

            // Check for unseen count changes (important for UI badges)
            if (current.unseenCount !== fresh.unseenCount) {
                console.log(`🔄 Change detected: unseen count changed for conversation ${fresh.id}`);
                return true;
            }
        }

        return false;
    }

    /**
     * Setup interaction tracking to avoid refreshes while user is active
     */
    setupInteractionTracking() {
        const interactionEvents = ['click', 'scroll', 'keydown', 'mousemove'];
        const trackInteraction = () => {
            this.lastUserInteraction = Date.now();
        };

        // Track interactions on the document
        interactionEvents.forEach(event => {
            document.addEventListener(event, trackInteraction, { passive: true });
        });

        console.log('👂 User interaction tracking setup complete');
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

        // Get element references
        const totalAgentsCompact = document.getElementById('total-agents-compact');
        const tooltipWrapper = document.getElementById('agents-tooltip-wrapper');
        const tooltip = document.getElementById('agents-tooltip');
        const tooltipContent = document.getElementById('agents-tooltip-content');

        // Null safety: verify all required elements exist BEFORE any operations
        const missingElements = [];
        if (!totalAgentsCompact) missingElements.push('total-agents-compact');
        if (!tooltipWrapper) missingElements.push('agents-tooltip-wrapper');
        if (!tooltip) missingElements.push('agents-tooltip');
        if (!tooltipContent) missingElements.push('agents-tooltip-content');

        if (missingElements.length > 0) {
            console.warn(`Agent tooltip elements not found in DOM: ${missingElements.join(', ')}`);
            return;
        }

        // Setup hover and keyboard listeners for custom tooltip (prevent memory leak)
        if (!this.tooltipListenersInitialized) {
            // Store handler references for cleanup
            this.tooltipHandlers = {
                wrapperEnter: () => tooltip.classList.remove('hidden'),
                wrapperLeave: () => tooltip.classList.add('hidden'),
                tooltipEnter: () => tooltip.classList.remove('hidden'),
                tooltipLeave: () => tooltip.classList.add('hidden'),
                compactFocus: () => tooltip.classList.remove('hidden'),
                compactBlur: () => tooltip.classList.add('hidden')
            };

            tooltipWrapper.addEventListener('mouseenter', this.tooltipHandlers.wrapperEnter);
            tooltipWrapper.addEventListener('mouseleave', this.tooltipHandlers.wrapperLeave);
            tooltip.addEventListener('mouseenter', this.tooltipHandlers.tooltipEnter);
            tooltip.addEventListener('mouseleave', this.tooltipHandlers.tooltipLeave);
            totalAgentsCompact.addEventListener('focus', this.tooltipHandlers.compactFocus);
            totalAgentsCompact.addEventListener('blur', this.tooltipHandlers.compactBlur);

            this.tooltipListenersInitialized = true;
        }

        // Performance optimization: Check if update is needed BEFORE expensive operations
        const agentListKey = agents.map(a => a.id + '-' + a.personalStatus).sort().join(',');

        if (this.lastAgentListKey === agentListKey) {
            return;
        }
        this.lastAgentListKey = agentListKey;

        // Update agent count
        totalAgentsCompact.textContent = agents.length;

        // Filter agents by status (only if update is needed)
        const onlineAgents = agents.filter(agent => agent.personalStatus === 'online');
        const offlineAgents = agents.filter(agent => agent.personalStatus === 'offline');

        // Build tooltip using DOM nodes to prevent XSS
        tooltipContent.textContent = '';

        if (onlineAgents.length > 0) {
            const onlineHeader = document.createElement('div');
            onlineHeader.className = 'font-semibold text-green-400 mb-1';
            onlineHeader.textContent = `Online (${onlineAgents.length}):`;

            const onlineList = document.createElement('div');
            onlineList.className = 'mb-2';
            onlineList.textContent = onlineAgents.map(a => getAgentDisplayName(a)).join(', ');

            tooltipContent.appendChild(onlineHeader);
            tooltipContent.appendChild(onlineList);
        }

        if (offlineAgents.length > 0) {
            const offlineHeader = document.createElement('div');
            offlineHeader.className = 'font-semibold text-gray-400 mb-1';
            offlineHeader.textContent = `Offline (${offlineAgents.length}):`;

            const offlineList = document.createElement('div');
            offlineList.textContent = offlineAgents.map(a => getAgentDisplayName(a)).join(', ');

            tooltipContent.appendChild(offlineHeader);
            tooltipContent.appendChild(offlineList);
        }

        if (onlineAgents.length === 0 && offlineAgents.length === 0) {
            tooltipContent.textContent = 'No agents connected';
        }
    }

    /**
     * Cleanup tooltip event listeners
     */
    cleanupTooltipListeners() {
        if (!this.tooltipListenersInitialized || !this.tooltipHandlers) {
            return;
        }

        const tooltipWrapper = document.getElementById('agents-tooltip-wrapper');
        const tooltip = document.getElementById('agents-tooltip');
        const totalAgentsCompact = document.getElementById('total-agents-compact');

        if (tooltipWrapper && tooltip && totalAgentsCompact) {
            tooltipWrapper.removeEventListener('mouseenter', this.tooltipHandlers.wrapperEnter);
            tooltipWrapper.removeEventListener('mouseleave', this.tooltipHandlers.wrapperLeave);
            tooltip.removeEventListener('mouseenter', this.tooltipHandlers.tooltipEnter);
            tooltip.removeEventListener('mouseleave', this.tooltipHandlers.tooltipLeave);
            totalAgentsCompact.removeEventListener('focus', this.tooltipHandlers.compactFocus);
            totalAgentsCompact.removeEventListener('blur', this.tooltipHandlers.compactBlur);
        }

        this.tooltipHandlers = null;
        this.tooltipListenersInitialized = false;
        this.lastAgentListKey = null;
    }


    /**
     * Update system mode display
     * @param {string} mode - System mode (hitl, autopilot, off)
     */
    updateSystemMode(mode) {
        this.systemMode = mode;
        try {
            this.systemModeManager.update(mode);
        } catch (error) {
            console.error('System mode update failed:', error);
            if (typeof ErrorHandler !== 'undefined' && ErrorHandler?.logError) {
                ErrorHandler.logError(error, { context: 'SystemModeManager.update' });
            }
        }
    }

    /**
     * Handle ticket reassignments notification
     * @param {Object} data - Reassignment data
     */
    handleTicketReassignments(data) {
        try {
            this.notificationService.notifyReassignment(data, this.agentId);
        } catch (error) {
            console.error('Ticket reassignment notification failed:', error);
            if (typeof ErrorHandler !== 'undefined' && ErrorHandler?.logError) {
                ErrorHandler.logError(error, { context: 'NotificationService.notifyReassignment' });
            }
        }
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
     * Load response templates
     */
    async loadTemplates() {
        try {
            const token = localStorage.getItem('agent_token');
            if (!token) {
                console.log('⚠️ No auth token for loading templates');
                return;
            }

            const response = await fetch(`${this.apiUrl}/api/templates`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            if (data.success && data.templates) {
                this.populateTemplateSelector(data.templates);
                console.log(`✅ Loaded ${data.templates.length} response templates`);
            }
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    }

    /**
     * Populate template dropdown
     */
    populateTemplateSelector(templates) {
        this.templates = templates; // Store for filtering
        this.renderTemplateDropdown(templates);
        this.initializeTemplateDropdown();
    }

    /**
     * Render template dropdown HTML
     */
    renderTemplateDropdown(templates) {
        const templateList = document.getElementById('template-list');
        if (!templateList) return;

        if (!templates || templates.length === 0) {
            templateList.innerHTML = '<div class="px-4 py-8 text-center text-gray-500 text-sm">No templates available</div>';
            return;
        }

        // Sort templates alphabetically by title
        const sortedTemplates = [...templates].sort((a, b) => a.title.localeCompare(b.title));

        // Build HTML
        let html = '';
        sortedTemplates.forEach(template => {
            const preview = template.content.substring(0, 60) + (template.content.length > 60 ? '...' : '');
            html += `
                <div class="template-item" data-content="${this.escapeHtml(template.content)}">
                    <div class="template-item-title">${this.escapeHtml(template.title)}</div>
                    <div class="template-item-preview">${this.escapeHtml(preview)}</div>
                </div>
            `;
        });

        templateList.innerHTML = html;

        // Add click handlers to template items
        templateList.querySelectorAll('.template-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const content = e.currentTarget.getAttribute('data-content');
                this.insertTemplate(content);
                this.closeTemplateDropdown();
            });
        });
    }

    /**
     * Initialize template dropdown interactions
     */
    initializeTemplateDropdown() {
        if (this.templateDropdownInitialized) return;

        const button = document.getElementById('template-button');
        const dropdown = document.getElementById('template-dropdown');

        if (!button || !dropdown) return;

        // Toggle dropdown on button click
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== button) {
                this.closeTemplateDropdown();
            }
        });

        this.templateDropdownInitialized = true;
    }

    /**
     * Close template dropdown
     */
    closeTemplateDropdown() {
        const dropdown = document.getElementById('template-dropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Insert template into message input
     */
    insertTemplate(content) {
        const input = document.getElementById('message-input');
        if (input) {
            input.value = content;
            input.focus();
            // Manually resize textarea to fit content
            if (this.chatManager && this.chatManager.resizeTextarea) {
                this.chatManager.resizeTextarea();
            }
            this.showToast('Template inserted', 'success');
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
        console.log('🔥 📨 WebSocket: New message received', { conversationId: data.conversationId, sender: data.sender, isCurrentChat: data.conversationId === this.stateManager.getCurrentChatId() });
        console.log('🔥 🐛 DEBUG: Full handleNewMessage data:', JSON.stringify(data, null, 2));

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

        // Create proper message object with consistent structure for both current and non-current chats
        const message = {
            id: (data.message && data.message.id) || data.id,
            content: (data.message && data.message.content) || data.content || '',
            sender: (data.message && data.message.sender) || data.sender || '',
            timestamp: (data.message && data.message.timestamp) || data.timestamp || new Date().toISOString()
        };
        console.log('🔥 DEBUG: Standardized message object:', JSON.stringify(message, null, 2));

        // Update preview for all conversations (this always works)
        this.conversationRenderer.updateConversationPreview(data.conversationId, message);

        // Update conversation timestamp in frontend data to ensure correct sorting
        this.updateConversationTimestamp(data.conversationId, message.timestamp || new Date().toISOString());

        // For current chat: quickly reload messages to show new message and generate suggestions
        if (data.conversationId === this.stateManager.getCurrentChatId()) {
            console.log('⚡ WebSocket: Current chat - reloading messages to show new message');
            setTimeout(async () => {
                try {
                    await this.chatManager.loadChatMessages(data.conversationId);
                    console.log('✅ Chat messages reloaded successfully for current conversation');
                } catch (error) {
                    console.error('❌ Error reloading chat messages:', error);
                }
            }, 50); // Small delay to ensure message is saved in backend
        } else {
            console.log('🐛 DEBUG: Not current chat, preview update only. Current chat:', this.stateManager.getCurrentChatId());
        }

        // Check if conversation exists in queue - if not, clear cache for new conversation
        const queueItem = document.querySelector(`[data-conversation-id="${data.conversationId}"]`);
        if (!queueItem) {
            console.log('🔄 New conversation detected, clearing cache for:', data.conversationId);
            this.modernConversationLoader.refresh();
        }

        // DEFERRED: Handle AI processing and re-sort conversations
        setTimeout(() => {
            console.log('🔄 WebSocket: Performing deferred updates');

            // Trigger conversation re-sort to move conversation with new message to correct position
            console.log('📍 Re-sorting conversations to update position after new message');

            // Add immediate DOM reordering for user messages (matches admin message behavior)
            console.log('📍 Moving conversation to top immediately for user message');
            this.conversationRenderer.reorderConversationList(data.conversationId);

            // Keep existing data-level sorting for consistency
            this.stateManager.applyFilter();

            // If this is the current chat, handle AI suggestions
            if (data.conversationId === this.stateManager.getCurrentChatId()) {

                // Handle AI suggestions with loading state
                const messageSender = (data.message && data.message.sender) || data.sender;
                if (this.systemMode === 'hitl' && (messageSender === 'customer' || messageSender === 'visitor')) {
                    console.log('💬 Customer/visitor message received, processing AI suggestion');
                    console.log('🔥 DEBUG: messageSender:', messageSender, 'data:', data);

                    // Clear any existing suggestion and show loading immediately
                    this.chatManager.hideAISuggestion();
                    this.chatManager.showAISuggestionLoading();

                    // Cancel any existing polling
                    if (this.currentPollingId) {
                        console.log(`🛑 Canceling previous AI suggestion polling: ${this.currentPollingId}`);
                        this.currentPollingId = null;
                    }

                    // Create new polling ID for this message
                    const pollingId = `poll-${Date.now()}-${Math.random()}`;
                    console.log(`🆕 Starting new AI suggestion polling: ${pollingId} for conversationId: ${this.stateManager.getCurrentChatId()}`);
                    this.currentPollingId = pollingId;

                    // Wait for the AI suggestion to be generated (polling approach)
                    // The backend takes 6-13 seconds to generate, so we need to wait
                    console.log('⏳ Waiting for AI suggestion to be generated...');
                    this.pollForNewSuggestion(this.stateManager.getCurrentChatId(), 0, pollingId);

                } else if (this.systemMode === 'hitl') {
                    // For agent messages, just check if there's still a pending suggestion
                    console.log('🔥 DEBUG: Not showing AI loading - messageSender:', messageSender);
                    this.checkForPendingSuggestion(this.stateManager.getCurrentChatId());
                }
            }
        }, 100); // Small delay to allow real-time update to render first
    }

    /**
     * Update conversation timestamp in frontend data for correct sorting
     * @param {string} conversationId - ID of the conversation
     * @param {string} timestamp - New timestamp
     */
    updateConversationTimestamp(conversationId, timestamp) {
        // Update timestamp in modernConversationLoader's cached data
        if (this.modernConversationLoader && this.modernConversationLoader.allConversations) {
            const conversation = this.modernConversationLoader.allConversations.find(c => c.id === conversationId);
            if (conversation) {
                conversation.updatedAt = timestamp;
                console.log(`📅 Updated conversation ${conversationId} timestamp to ${timestamp}`);
            }
        }

        // Update timestamp in stateManager's cached data
        if (this.stateManager && this.stateManager.allConversations) {
            const conversation = this.stateManager.allConversations.find(c => c.id === conversationId);
            if (conversation) {
                conversation.updatedAt = timestamp;
                console.log(`📅 Updated stateManager conversation ${conversationId} timestamp to ${timestamp}`);
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
        console.log('🆕 New conversation received via WebSocket:', data.conversationId);

        // Play sound notification for new conversations
        if (this.soundNotificationManager) {
            this.soundNotificationManager.onNewConversation(data);
        }

        // Check if conversation already exists in queue
        const queueItem = document.querySelector(`[data-conversation-id="${data.conversationId}"]`);
        if (!queueItem) {
            console.log('🔄 Refreshing conversation list to show new conversation:', data.conversationId);
            // Refresh the conversation list to show the new conversation
            this.loadConversations();
        }
    }

    /**
     * Handle agent sent message WebSocket event
     * @param {Object} data - Agent sent message data
     */
    handleAgentSentMessage(data) {
        console.log('🔥 📤 WebSocket: Agent sent message received', { conversationId: data.conversationId, isCurrentChat: data.conversationId === this.stateManager.getCurrentChatId() });

        // Only update if this is the current conversation
        if (data.conversationId === this.stateManager.getCurrentChatId()) {
            // Add the message to the chat immediately without full reload
            // This will automatically update the preview via appendMessageToChat
            this.conversationRenderer.appendMessageToChat(data.message);
        } else {
            // For non-current conversations, update preview directly
            this.conversationRenderer.updateConversationPreview(data.conversationId, data.message);
        }

        // Move conversation to top of list for immediate visual feedback
        this.conversationRenderer.reorderConversationList(data.conversationId);
    }

    
    
    
    




    /**
     * Refresh a single conversation data from server
     * @param {string} conversationId - Conversation ID to refresh
     */
    async refreshConversation(conversationId) {
        await this.assignmentManager.refreshConversation(conversationId);
    }

    /**
     * Poll for new AI suggestion with intelligent cancellation and exponential backoff
     * 
     * This method implements a robust polling system for AI suggestions that:
     * - Uses unique polling IDs to prevent race conditions
     * - Implements exponential backoff to reduce server load
     * - Supports cancellation when newer messages arrive
     * - Automatically times out after maximum attempts
     * 
     * @param {string} conversationId - Conversation ID to poll suggestions for
     * @param {number} attemptCount - Current attempt number (0-based)
     * @param {string} pollingId - Unique ID for this polling session (format: poll-{timestamp}-{random})
     * @returns {Promise<void>} Resolves when suggestion is found, canceled, or timed out
     * 
     * @example
     * // Start polling for a new message
     * const pollingId = `poll-${Date.now()}-${Math.random()}`;
     * this.currentPollingId = pollingId;
     * await this.pollForNewSuggestion('conv-123', 0, pollingId);
     */
    async pollForNewSuggestion(conversationId, attemptCount, pollingId) {
        // Check if this polling session has been canceled
        if (this.currentPollingId !== pollingId) {
            logger.polling('Polling canceled - newer message arrived', pollingId);
            return;
        }
        
        const maxAttempts = POLLING_CONFIG.MAX_ATTEMPTS;
        const baseDelay = POLLING_CONFIG.BASE_DELAY_MS;
        
        if (attemptCount >= maxAttempts) {
            logger.warn('AI suggestion polling timeout', 'POLLING', { pollingId, maxAttempts });
            this.chatManager.hideAISuggestion();
            this.currentPollingId = null;
            return;
        }
        
        try {
            logger.polling(`Attempt ${attemptCount + 1}/${maxAttempts} for conversation ${conversationId}`, pollingId);
            const data = await this.apiManager.getPendingSuggestion(conversationId);
            logger.polling('API response received', pollingId, { hasSuggestion: !!(data && data.suggestion) });
            
            if (data && data.suggestion) {
                // Check again if we're still the active polling session
                if (this.currentPollingId !== pollingId) {
                    logger.polling('Canceled before showing suggestion', pollingId);
                    return;
                }
                
                logger.info('AI suggestion found and displayed', 'POLLING', { conversationId });
                this.chatManager.showAISuggestion(data.suggestion, data.confidence, data.metadata || {});
                this.currentPollingId = null; // Clear the polling ID
            } else {
                // No suggestion yet, wait and try again
                const delay = Math.min(baseDelay * Math.pow(POLLING_CONFIG.BACKOFF_MULTIPLIER, attemptCount), POLLING_CONFIG.MAX_DELAY_MS);
                logger.polling(`No suggestion yet, retrying in ${delay}ms`, pollingId);
                setTimeout(() => {
                    // Check if still active before scheduling next poll
                    if (this.currentPollingId === pollingId) {
                        this.pollForNewSuggestion(conversationId, attemptCount + 1, pollingId);
                    }
                }, delay);
            }
        } catch (error) {
            logger.error('Error polling for AI suggestion', 'POLLING', { pollingId, error: error.message });
            
            // Check if still active before retry
            if (this.currentPollingId === pollingId) {
                // Wait and retry
                setTimeout(() => {
                    this.pollForNewSuggestion(conversationId, attemptCount + 1, pollingId);
                }, POLLING_CONFIG.RETRY_AFTER_ERROR_MS);
            }
        }
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
const dashboard = new AgentDashboard();
console.log('✅ Dashboard initialized');

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (dashboard && dashboard.cleanupTooltipListeners) {
        dashboard.cleanupTooltipListeners();
    }
});
