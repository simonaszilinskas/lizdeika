/**
 * Agent Dashboard Controller
 * Manages agent interface for handling customer support conversations
 */
class AgentDashboard {
    constructor(config = {}) {
        // Allow configuration via data attributes or config object
        const apiUrl = config.apiUrl || 
                      document.body.dataset.apiUrl || 
                      window.location.protocol + '//' + window.location.hostname + ':3002';
        
        this.apiUrl = apiUrl;
        this.currentChatId = null;
        this.agentId = this.getAuthenticatedAgentId();
        this.conversations = new Map();
        this.currentSuggestion = null;
        this.pollInterval = config.pollInterval || 15000; // Reduced from 3s to 15s
        this.socket = null;
        this.personalStatus = 'online'; // Personal agent status (online/offline)
        this.systemMode = 'hitl'; // Global system mode (hitl/autopilot/off)
        this.connectedAgents = new Map(); // Track other connected agents
        this.currentFilter = 'unassigned'; // Current conversation filter (mine, unassigned, others, all)
        this.allConversations = []; // Store all conversations for filtering
        this.selectedConversations = new Set(); // Track selected conversations for bulk operations
        this.archiveFilter = 'active'; // Archive filter (active, archived)
        
        // Agent caching to prevent rapid-fire API calls
        this.agentCache = null;
        this.agentCacheExpiry = 0;
        this.agentCacheDuration = 30000; // 30 seconds cache
        
        // Initialize modern conversation loader
        this.modernConversationLoader = new ModernConversationLoader({
            apiUrl: this.apiUrl,
            logger: console
        });
        
        // ConversationUpdateManager removed - was unused infrastructure (always fell back to full reloads)
        
        // Initialize sound notification manager
        this.soundNotificationManager = null;
        this.initializeSoundNotifications();
        
        // Make dashboard globally available immediately
        window.dashboard = this;
        
        console.log(`Agent Dashboard initialized with API URL: ${this.apiUrl}`);
        this.init();
    }

    /**
     * Get agent ID from authenticated user
     */
    getAuthenticatedAgentId() {
        try {
            // First try the new user_data format
            const userData = localStorage.getItem('user_data');
            if (userData) {
                const user = JSON.parse(userData);
                if (user.email) {
                    console.log(`Using agent ID from user_data: ${user.email}`);
                    return user.email; // Use full email as agent ID
                }
            }
            
            // Try to get authenticated user from localStorage (old format)
            const agentUser = localStorage.getItem('agentUser');
            if (agentUser) {
                const user = JSON.parse(agentUser);
                // Use full email as agent ID
                if (user.email) {
                    console.log(`Using agent ID from agentUser: ${user.email}`);
                    return user.email;
                }
            }
        } catch (error) {
            console.warn('Could not get authenticated agent ID:', error);
        }
        
        // Fallback: check if running in iframe and try to communicate with parent
        try {
            if (window.parent && window.parent !== window) {
                // We're in an iframe, try to get user from parent
                const parentAgentUser = window.parent.localStorage?.getItem('agentUser');
                if (parentAgentUser) {
                    const user = JSON.parse(parentAgentUser);
                    if (user.email) {
                        console.log(`Using agent ID from parent: ${user.email.split('@')[0]}`);
                        return user.email.split('@')[0];
                    }
                }
            }
        } catch (error) {
            console.warn('Could not access parent window for agent ID:', error);
        }
        
        // Final fallback: generate random ID (for development/standalone use)
        console.warn('No authenticated user found, generating random agent ID');
        return 'agent-' + Math.random().toString(36).substring(2, 11);
    }

    /**
     * Initialize browser notifications
     */
    async initializeSoundNotifications() {
        try {
            // Only initialize if SoundNotificationManager is available
            if (typeof SoundNotificationManager !== 'undefined') {
                this.soundNotificationManager = new SoundNotificationManager({
                    agentId: this.agentId,
                    logger: console
                });
                
                console.log('✅ Sound notification manager initialized');
            } else {
                console.warn('⚠️ SoundNotificationManager not available, notifications disabled');
            }
        } catch (error) {
            console.error('❌ Failed to initialize sound notifications:', error);
        }
    }

    /**
     * Check if current user is admin and show admin bar
     */
    async checkAdminStatus() {
        try {
            const token = localStorage.getItem('agent_token');
            if (!token) {
                return;
            }

            console.log('🔍 Checking admin status...');
            const response = await fetch(`${this.apiUrl}/api/auth/profile`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                const user = data.data;
                console.log('👤 User profile:', user);
                
                if (user && user.role === 'admin') {
                    console.log('✅ User is admin, showing admin bar');
                    const adminBar = document.getElementById('adminBar');
                    if (adminBar) {
                        adminBar.classList.remove('hidden');
                    }
                } else {
                    console.log('❌ User is not admin, role:', user?.role);
                }
            } else {
                console.log('❌ Failed to get user profile:', response.status);
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
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
        await this.checkAdminStatus();
        
        this.initializeEventListeners();
        this.initializeWebSocket();
        await this.loadConversations();
        // No need for polling anymore with WebSockets
    }

    /**
     * Setup all event listeners
     */
    initializeEventListeners() {
        // Personal status change
        const personalStatusSelect = document.getElementById('personal-status');
        if (personalStatusSelect) {
            personalStatusSelect.addEventListener('change', (e) => {
                this.updatePersonalStatus(e.target.value);
            });
        }

        // Filter buttons
        const filterButtons = document.querySelectorAll('[data-filter]');
        console.log(`🔘 Found ${filterButtons.length} filter buttons`);
        filterButtons.forEach((button, index) => {
            const filter = button.getAttribute('data-filter');
            console.log(`🔘 Adding event listener to button ${index} with filter: ${filter}`);
            button.addEventListener('click', (e) => {
                const clickedFilter = e.target.getAttribute('data-filter');
                console.log(`🔘 Filter button clicked: ${clickedFilter}`);
                this.setFilter(clickedFilter);
            });
        });

        // Message form submission
        const messageForm = document.getElementById('message-form');
        if (messageForm) {
            messageForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }

        // AI assistance button
        const aiAssistBtn = document.getElementById('ai-assist-btn');
        if (aiAssistBtn) {
            aiAssistBtn.addEventListener('click', () => {
                this.getAIAssistance();
            });
        }

        // AI suggestion action buttons
        this.setupAISuggestionListeners();

        // Auto-resize textarea
        this.setupTextareaAutoResize();

        // Close assignment dropdowns when clicking elsewhere
        document.addEventListener('click', (e) => {
            if (!e.target.closest('[id^="assign-dropdown-"]') && !e.target.closest('button[onclick*="toggleAssignDropdown"]')) {
                document.querySelectorAll('[id^="assign-dropdown-"]').forEach(dropdown => {
                    dropdown.classList.add('hidden');
                });
            }
        });

        // Archive toggle icon
        const archiveToggle = document.getElementById('archive-toggle');
        if (archiveToggle) {
            archiveToggle.addEventListener('click', () => this.toggleArchiveFilter());
        }

        // Bulk action buttons
        const selectAllCheckbox = document.getElementById('select-all');
        const clearSelectionBtn = document.getElementById('clear-selection');
        const bulkArchiveBtn = document.getElementById('bulk-archive');
        const bulkUnarchiveBtn = document.getElementById('bulk-unarchive');
        const bulkAssignMeBtn = document.getElementById('bulk-assign-me');

        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));
        }

        if (clearSelectionBtn) {
            clearSelectionBtn.addEventListener('click', () => this.clearAllSelections());
        }
        
        if (bulkArchiveBtn) {
            bulkArchiveBtn.addEventListener('click', () => this.bulkArchiveConversations());
        }
        
        if (bulkUnarchiveBtn) {
            bulkUnarchiveBtn.addEventListener('click', () => this.bulkUnarchiveConversations());
        }
        
        if (bulkAssignMeBtn) {
            bulkAssignMeBtn.addEventListener('click', () => this.bulkAssignToMe());
        }
        
        const bulkAssignAgentDropdown = document.getElementById('bulk-assign-agent');
        if (bulkAssignAgentDropdown) {
            bulkAssignAgentDropdown.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.bulkAssignToAgent(e.target.value);
                    e.target.value = ''; // Reset dropdown
                }
            });
        }

    }

    /**
     * Setup AI suggestion panel event listeners
     */
    setupAISuggestionListeners() {
        const sendAsIsBtn = document.getElementById('send-as-is-btn');
        const editSuggestionBtn = document.getElementById('edit-suggestion-btn');
        const writeFromScratchBtn = document.getElementById('write-from-scratch-btn');
        const debugToggleBtn = document.getElementById('debug-toggle-btn');
        const debugCloseBtn = document.getElementById('debug-modal-close');

        if (sendAsIsBtn) {
            sendAsIsBtn.addEventListener('click', () => this.sendAsIs());
        }

        if (editSuggestionBtn) {
            editSuggestionBtn.addEventListener('click', () => this.editSuggestion());
        }

        if (writeFromScratchBtn) {
            writeFromScratchBtn.addEventListener('click', () => this.writeFromScratch());
        }

        if (debugToggleBtn) {
            debugToggleBtn.addEventListener('click', () => this.toggleDebugPanel());
        }

        if (debugCloseBtn) {
            debugCloseBtn.addEventListener('click', () => this.hideDebugModal());
        }
        
        // Close debug modal on escape key or click outside
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideDebugModal();
            }
        });
        
        const debugModal = document.getElementById('debug-modal');
        if (debugModal) {
            debugModal.addEventListener('click', (e) => {
                if (e.target === debugModal) {
                    this.hideDebugModal();
                }
            });
        }
    }

    /**
     * Manually resize textarea (for programmatic content changes)
     */
    resizeTextarea() {
        const textarea = document.getElementById('message-input');
        if (textarea) {
            // Reset height to recalculate
            textarea.style.height = 'auto';
            
            // Calculate new height with much larger range
            const minHeight = 80;   // ~2 lines
            const maxHeight = 300;  // ~8-10 lines  
            const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
            
            textarea.style.height = newHeight + 'px';
            
            // console.log(`Manual textarea resize: scrollHeight=${textarea.scrollHeight}, newHeight=${newHeight}`); // Debug
        }
    }

    /**
     * Setup auto-resize functionality for textarea
     */
    setupTextareaAutoResize() {
        const textarea = document.getElementById('message-input');
        if (textarea) {
            let typingTimer;
            
            // Auto-resize textarea that expands upward
            textarea.addEventListener('input', () => {
                this.resizeTextarea();
            });
            
            // Send typing status
            textarea.addEventListener('input', () => {
                this.sendTypingStatus(true);
                
                // Clear existing timer
                clearTimeout(typingTimer);
                
                // Set timer to stop typing after 1 second of inactivity
                typingTimer = setTimeout(() => {
                    this.sendTypingStatus(false);
                }, 1000);
            });
            
            textarea.addEventListener('blur', () => {
                this.sendTypingStatus(false);
                clearTimeout(typingTimer);
            });
            
            // Initialize with proper height
            textarea.style.height = '80px'; // Start with minimum height
        }
    }


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
            await fetch(`${this.apiUrl}/api/agent/personal-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: this.agentId, personalStatus: status })
            });
            
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
        
        // Update the personal status to register the agent with server (but don't save to localStorage again)
        try {
            await fetch(`${this.apiUrl}/api/agent/personal-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: this.agentId, personalStatus: currentStatus })
            });
            
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
                    await fetch(`${this.apiUrl}/api/agent/personal-status`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            agentId: this.agentId, 
                            personalStatus: this.personalStatus 
                        })
                    });
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
                this.hideAISuggestion(); // Hide any pending suggestions since backend handles responses
                break;
            case 'off':
                // OFF: Backend sends offline messages for new messages
                console.log('System Mode: OFF - Customer support offline mode activated');
                this.hideAISuggestion(); // Hide any pending suggestions
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
            this.populateAgentsDropdown();
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
                tooltipContent += `Online (${onlineAgents.length}): ${onlineAgents.map(a => this.getAgentDisplayName(a)).join(', ')}`;
            }
            if (offlineAgents.length > 0) {
                if (tooltipContent) tooltipContent += '\n';
                tooltipContent += `Offline (${offlineAgents.length}): ${offlineAgents.map(a => this.getAgentDisplayName(a)).join(', ')}`;
            }
            if (!tooltipContent) {
                tooltipContent = 'No agents connected';
            }
            
            // Add tooltip to the agent count element
            totalAgentsCompact.title = tooltipContent;
            
            // Show agents as small colored dots with individual tooltips
            compactContainer.innerHTML = agents.map(agent => {
                const statusColor = agent.personalStatus === 'online' ? 'bg-green-400' : 'bg-gray-400';
                const displayName = this.getAgentDisplayName(agent);
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
                        <span class="text-gray-700">${this.getAgentDisplayName(agent)}</span>
                    </div>
                    <span class="text-gray-500 capitalize">${agent.personalStatus || 'online'}</span>
                </div>
            `).join('');
        }
    }

    /**
     * Get agent display name
     * @param {Object} agent - Agent object
     * @returns {string} Display name
     */
    getAgentDisplayName(agent) {
        // If agent has a name property, use it
        if (agent.name) {
            return agent.name;
        }
        
        // Extract a readable part from agent ID
        const idParts = agent.id.split('-');
        if (idParts.length > 1) {
            const suffix = idParts[1];
            // Create a more readable name from the suffix
            return `Agent ${suffix.substring(0, 4).toUpperCase()}`;
        }
        
        // Fallback to truncated ID
        return `Agent ${agent.id.substring(6, 12)}`;
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
                archiveFilter: this.archiveFilter,
                assignmentFilter: this.currentFilter,
                agentId: this.agentId
            };
            
            // Use modern conversation loader
            await this.modernConversationLoader.load(filters, (conversations) => {
                this.renderQueue(conversations);
            });
            
            // Store conversations for backward compatibility
            const conversationData = this.modernConversationLoader.getConversations();
            this.allConversations = conversationData.all;
            
            // Update filter button styles
            this.updateFilterButtons();
            console.log('✅ Modern conversation loading completed successfully');
            
        } catch (error) {
            console.error('❌ Error in modern conversation loading:', error);
            // Fallback to show error state is handled by the modern loader
        }
    }


    /**
     * Utility method to safely update element text content
     * @param {string} elementId - ID of element to update
     * @param {any} value - Value to set
     */
    updateElementText(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * Render conversation queue
     * @param {Array} conversations - Array of conversation objects
     */
    renderQueue(conversations) {
        console.log(`🎨 renderQueue called with ${conversations.length} conversations`);
        const queueContainer = document.getElementById('chat-queue');
        if (!queueContainer) {
            console.error('❌ chat-queue element not found!');
            return;
        }
        
        // Sort conversations by priority
        const sorted = this.sortConversationsByPriority(conversations);
        console.log(`📝 Sorted conversations, rendering ${sorted.length} items`);

        queueContainer.innerHTML = sorted.map(conv => this.renderQueueItem(conv)).join('');
        console.log('✅ Queue rendered successfully');
    }

    /**
     * Sort conversations by priority - Closed at bottom, MY tickets first, then by recent activity
     * @param {Array} conversations - Array of conversation objects
     * @returns {Array} Sorted conversations
     */
    sortConversationsByPriority(conversations) {
        return conversations.sort((a, b) => {
            const aNeedsResponse = this.conversationNeedsResponse(a);
            const bNeedsResponse = this.conversationNeedsResponse(b);
            const aIsMine = a.assignedAgent === this.agentId;
            const bIsMine = b.assignedAgent === this.agentId;
            
            // Priority 1: My tickets with responses needed
            if (aIsMine && aNeedsResponse && (!bIsMine || !bNeedsResponse)) return -1;
            if (bIsMine && bNeedsResponse && (!aIsMine || !aNeedsResponse)) return 1;
            
            // Priority 2: My tickets (even without response needed)
            if (aIsMine && !bIsMine) return -1;
            if (bIsMine && !aIsMine) return 1;
            
            // Priority 3: Other tickets needing response
            if (aNeedsResponse && !bNeedsResponse) return -1;
            if (bNeedsResponse && !aNeedsResponse) return 1;
            
            // Priority 4: Sort by most recent activity (updatedAt or startedAt)
            const aTime = new Date(a.updatedAt || a.startedAt);
            const bTime = new Date(b.updatedAt || b.startedAt);
            return bTime - aTime;
        });
    }

    /**
     * Check if conversation needs agent response
     * @param {Object} conv - Conversation object
     * @returns {boolean} True if needs response
     */
    conversationNeedsResponse(conv) {
        return conv.lastMessage && 
               conv.lastMessage.metadata && 
               conv.lastMessage.metadata.pendingAgent;
    }

    /**
     * Check if conversation is unseen by current agent
     * @param {Object} conv - Conversation object
     * @returns {boolean} True if unseen
     */
    conversationIsUnseen(conv) {
        if (!conv.lastMessage || !conv.lastMessage.metadata) return false;
        
        // Check if explicitly marked as unseen when no agents were online
        if (conv.lastMessage.metadata.unseenByAgents) return true;
        
        // Check if last message is from customer and needs response
        if (conv.lastMessage.sender === 'user' && 
            conv.lastMessage.metadata.pendingAgent &&
            !conv.lastMessage.metadata.seenByAgent) {
            return true;
        }
        
        return false;
    }

    /**
     * Render individual queue item
     * @param {Object} conv - Conversation object
     * @returns {string} HTML string for queue item
     */
    renderQueueItem(conv) {
        const isAssignedToMe = conv.assignedAgent === this.agentId;
        const isUnassigned = !conv.assignedAgent;
        const isActive = conv.id === this.currentChatId;
        const needsResponse = this.conversationNeedsResponse(conv);
        const isUnseen = this.conversationIsUnseen(conv);
        
        const cssClass = this.getQueueItemCssClass(isActive, needsResponse, isAssignedToMe, isUnassigned, isUnseen);
        const statusLabel = this.getQueueItemStatusLabel(needsResponse, isAssignedToMe, isUnassigned, isUnseen, conv);
        const statusCss = this.getQueueItemStatusCss(needsResponse, isAssignedToMe, isUnassigned, isUnseen);
        
        const isSelected = this.selectedConversations.has(conv.id);
        const archivedClass = conv.archived ? 'opacity-75 bg-gray-50' : '';
        
        // Calculate unread indicator
        const unreadCount = this.getUnreadMessageCount(conv, isAssignedToMe);
        const urgencyIcon = this.getUrgencyIcon(isUnseen, needsResponse, isAssignedToMe);
        const priorityClass = this.getPriorityAnimationClass(isUnseen, needsResponse, isAssignedToMe);

        return `
            <div class="chat-queue-item p-3 rounded-lg cursor-pointer border ${cssClass} ${archivedClass} ${priorityClass}" 
                 onclick="dashboard.selectChat('${conv.id}')">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2">
                        <input type="checkbox" 
                               class="conversation-checkbox" 
                               data-conversation-id="${conv.id}"
                               ${isSelected ? 'checked' : ''}
                               onclick="event.stopPropagation(); dashboard.toggleConversationSelection('${conv.id}')"
                               title="Select for bulk actions">
                        ${urgencyIcon}
                        <div class="flex-1">
                            <div class="font-medium text-sm flex items-center gap-2">
                                <span>User #${conv.userNumber || 'Unknown'}</span>
                                ${unreadCount > 0 ? `<span class="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full animate-pulse">${unreadCount}</span>` : ''}
                                ${conv.archived ? '<i class="fas fa-archive text-gray-400" title="Archived"></i>' : ''}
                            </div>
                            <div class="text-xs text-gray-500">
                                ${this.formatConversationDate(conv.startedAt)}
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                        <span class="text-xs px-2 py-1 rounded ${statusCss}">
                            ${statusLabel}
                        </span>
                        ${this.getTimeUrgencyIndicator(conv)}
                    </div>
                </div>
                <div class="text-sm truncate text-gray-600">
                    ${conv.lastMessage ? this.escapeHtml(conv.lastMessage.content) : 'No messages yet'}
                </div>
                <div class="flex justify-between items-center mt-2 text-xs">
                    <div class="flex items-center gap-2">
                        <span class="text-gray-500 flex items-center gap-1">
                            <i class="fas fa-comments text-gray-400"></i>
                            ${conv.messageCount} messages
                        </span>
                        ${this.renderAssignmentButtons(isAssignedToMe, isUnassigned, conv.id, conv.archived)}
                    </div>
                    <span class="text-gray-500">${this.formatConversationDate(conv.updatedAt || conv.startedAt)}</span>
                </div>
            </div>
        `;
    }

    /**
     * Get CSS classes for queue item based on status
     */
    getQueueItemCssClass(isActive, needsResponse, isAssignedToMe, isUnassigned, isUnseen) {
        if (isActive) return 'active-chat border-indigo-300 bg-indigo-50';
        
        // UNSEEN + MINE: Clearest/most prominent (bright red with thick border)
        if (isUnseen && isAssignedToMe) {
            return 'bg-red-100 border-red-400 hover:bg-red-200 border-l-4 border-l-red-600 shadow-lg ring-2 ring-red-200';
        }
        
        // MINE: Blue
        if (isAssignedToMe) {
            return 'bg-blue-50 border-blue-200 hover:bg-blue-100';
        }
        
        // UNSEEN + NOBODY'S: Red accent on white
        if (isUnseen && isUnassigned) {
            return 'bg-white border-red-300 hover:bg-red-50 border-l-4 border-l-red-500 shadow-md';
        }
        
        // NOBODY'S: Classic white
        if (isUnassigned) {
            return 'bg-white border-gray-200 hover:bg-gray-50';
        }
        
        // UNSEEN + SOMEBODY'S: Red accent on light grey
        if (isUnseen) {
            return 'bg-gray-100 border-red-300 hover:bg-gray-200 border-l-2 border-l-red-400';
        }
        
        // SOMEBODY'S: Light grey
        return 'bg-gray-100 border-gray-300 hover:bg-gray-200';
    }

    /**
     * Get status label for queue item
     */
    getQueueItemStatusLabel(needsResponse, isAssignedToMe, isUnassigned, isUnseen, conv) {
        if (needsResponse && isAssignedToMe) return 'NEEDS REPLY';
        if (isUnseen && isUnassigned) return 'UNSEEN';
        if (needsResponse) return 'NEW MESSAGE';
        if (isAssignedToMe) return 'MINE';
        if (isUnassigned) return 'UNASSIGNED';
        
        if (conv && conv.assignedAgent) {
            const agent = this.connectedAgents.get(conv.assignedAgent);
            if (agent) {
                return this.getAgentDisplayName(agent).replace('Agent ', '');
            }
            return conv.assignedAgent.substring(0, 6);
        }
        return 'OTHER';
    }

    /**
     * Get status CSS classes for queue item
     */
    getQueueItemStatusCss(needsResponse, isAssignedToMe, isUnassigned, isUnseen) {
        // UNSEEN states get red badges with bold text
        if (isUnseen && isAssignedToMe) return 'bg-red-600 text-white font-bold animate-pulse';
        if (isUnseen && isUnassigned) return 'bg-red-600 text-white font-bold';
        if (isUnseen) return 'bg-red-500 text-white font-medium';
        
        // Regular states
        if (needsResponse && isAssignedToMe) return 'bg-blue-600 text-white font-medium';
        if (isAssignedToMe) return 'bg-blue-100 text-blue-700';
        if (isUnassigned) return 'bg-gray-600 text-white text-xs';
        
        // SOMEBODY'S (other agents)
        return 'bg-gray-400 text-white text-xs';
    }

    /**
     * Get unread message count for visual indicator
     */
    getUnreadMessageCount(conv, isAssignedToMe) {
        // For conversations assigned to me, show count based on unseen messages
        if (isAssignedToMe && conv.lastMessage && conv.lastMessage.metadata) {
            // If conversation is unseen, show at least 1
            if (this.conversationIsUnseen(conv)) {
                return 1;
            }
        }
        
        // For unassigned conversations, show count if unseen
        if (!conv.assignedAgent && this.conversationIsUnseen(conv)) {
            return 1;
        }
        
        return 0;
    }

    /**
     * Get urgency icon for conversation (simplified - no user icons)
     */
    getUrgencyIcon(isUnseen, needsResponse, isAssignedToMe) {
        // Only show urgent indicators, no regular assignment icons
        if (isUnseen && isAssignedToMe) {
            return '<i class="fas fa-exclamation-triangle text-red-600 animate-pulse" title="Urgent: Unseen message assigned to you!"></i>';
        }
        if (isUnseen) {
            return '<i class="fas fa-exclamation-circle text-red-500" title="New unseen message"></i>';
        }
        
        // No icons for regular states - rely on colors instead
        return '';
    }

    /**
     * Get priority animation class
     */
    getPriorityAnimationClass(isUnseen, needsResponse, isAssignedToMe) {
        if (isUnseen && isAssignedToMe) {
            return 'animate-pulse'; // Most urgent
        }
        return '';
    }

    /**
     * Get time-based urgency indicator
     */
    getTimeUrgencyIndicator(conv) {
        if (!conv.lastMessage || !conv.lastMessage.timestamp) {
            return '';
        }

        const now = new Date();
        const lastMessageTime = new Date(conv.lastMessage.timestamp);
        const timeDiff = now - lastMessageTime;
        const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
        
        if (this.conversationIsUnseen(conv)) {
            if (hoursAgo >= 2) {
                return '<i class="fas fa-clock text-red-500 animate-pulse" title="Unseen for over 2 hours!"></i>';
            } else if (hoursAgo >= 1) {
                return '<i class="fas fa-clock text-orange-500" title="Unseen for over 1 hour"></i>';
            }
        }
        
        return '';
    }

    /**
     * Render assignment buttons for conversation card
     */
    renderAssignmentButtons(isAssignedToMe, isUnassigned, conversationId, isArchived = false) {
        // Archived conversations show unarchive button only
        if (isArchived) {
            return `
                <button onclick="dashboard.unarchiveConversation('${conversationId}', event)" 
                        class="px-2 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-xs rounded">
                    Unarchive
                </button>`;
        }
        
        if (isAssignedToMe) {
            return `
                <div class="flex gap-1">
                    <button onclick="dashboard.unassignConversation('${conversationId}', event)" 
                            class="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded">
                        Unassign
                    </button>
                    <div class="relative">
                        <button onclick="dashboard.toggleAssignDropdown('${conversationId}', event)" 
                                class="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 text-xs rounded">
                            Reassign
                        </button>
                        <div id="assign-dropdown-${conversationId}" 
                             class="hidden absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 min-w-32">
                            ${this.renderAgentOptions(conversationId)}
                        </div>
                    </div>
                </div>`;
        } else {
            return `
                <div class="flex gap-1">
                    <button onclick="dashboard.assignConversation('${conversationId}', event)" 
                            class="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded">
                        Assign to me
                    </button>
                    <div class="relative">
                        <button onclick="dashboard.toggleAssignDropdown('${conversationId}', event)" 
                                class="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 text-xs rounded">
                            Assign to...
                        </button>
                        <div id="assign-dropdown-${conversationId}" 
                             class="hidden absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 min-w-32">
                            ${this.renderAgentOptions(conversationId)}
                        </div>
                    </div>
                </div>`;
        }
    }

    /**
     * Render dropdown options for online agents only
     * Uses caching to prevent rapid-fire API calls
     */
    async renderAgentOptions(conversationId) {
        try {
            let allAgents;
            
            // Check cache first
            if (this.agentCache && Date.now() < this.agentCacheExpiry) {
                allAgents = this.agentCache.filter(agent => agent.id !== this.agentId);
                console.log('📋 Using cached agent data');
            } else {
                // Fetch all agents from server
                console.log('🔄 Fetching fresh agent data');
                const response = await fetch(`${this.apiUrl}/api/agents/all`);
                if (!response.ok) {
                    console.error('Failed to fetch agents:', response.status);
                    return `<div class="px-3 py-2 text-xs text-gray-500">Error loading agents</div>`;
                }
                
                const data = await response.json();
                
                // Update cache
                this.agentCache = data.agents;
                this.agentCacheExpiry = Date.now() + this.agentCacheDuration;
                
                allAgents = data.agents.filter(agent => agent.id !== this.agentId);
            }
            
            // Sort: online agents first, then offline
            allAgents.sort((a, b) => {
                const aOnline = a.connected === true;
                const bOnline = b.connected === true;
                if (aOnline && !bOnline) return -1;
                if (!aOnline && bOnline) return 1;
                return (a.name || a.id).localeCompare(b.name || b.id);
            });
            
            // Create dropdown options - start with "Assign to nobody" option
            let dropdownHtml = `
                <button onclick="dashboard.unassignConversation('${conversationId}', event)" 
                        class="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 flex items-center text-red-600">
                    <span class="w-2 h-2 bg-gray-400 rounded-full inline-block mr-2"></span>Nobody (unassign)
                </button>
            `;
            
            // Add separator if there are agents
            if (allAgents.length > 0) {
                dropdownHtml += `<div class="border-t border-gray-200 my-1"></div>`;
            }
            
            // Add agent options - only show online agents
            const onlineAgents = allAgents.filter(agent => agent.connected === true);
            
            if (onlineAgents.length === 0) {
                dropdownHtml += `
                    <div class="px-3 py-2 text-xs text-gray-500 text-center">
                        No other agents online
                    </div>
                `;
            } else {
                dropdownHtml += onlineAgents.map(agent => {
                    const displayName = agent.name || this.getAgentDisplayName(agent);
                    
                    return `
                        <button onclick="dashboard.assignToAgent('${conversationId}', '${agent.id}', event)" 
                                class="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 flex items-center text-gray-900">
                            <span class="w-2 h-2 bg-green-500 rounded-full inline-block mr-2"></span>${displayName}
                        </button>
                    `;
                }).join('');
            }
            
            return dropdownHtml;
        } catch (error) {
            console.error('Error fetching agents for dropdown:', error);
            return `<div class="px-3 py-2 text-xs text-gray-500">Error loading agents</div>`;
        }
    }

    /**
     * Toggle assignment dropdown visibility
     */
    async toggleAssignDropdown(conversationId, event) {
        if (event) {
            event.stopPropagation();
        }
        
        // Close all other dropdowns first
        document.querySelectorAll('[id^="assign-dropdown-"]').forEach(dropdown => {
            if (dropdown.id !== `assign-dropdown-${conversationId}`) {
                dropdown.classList.add('hidden');
            }
        });
        
        const dropdown = document.getElementById(`assign-dropdown-${conversationId}`);
        if (dropdown) {
            const wasHidden = dropdown.classList.contains('hidden');
            dropdown.classList.toggle('hidden');
            
            // Only fetch and update content when opening dropdown
            if (wasHidden && !dropdown.classList.contains('hidden')) {
                dropdown.innerHTML = '<div class="px-3 py-2 text-xs text-gray-500">Loading...</div>';
                const agentOptions = await this.renderAgentOptions(conversationId);
                dropdown.innerHTML = agentOptions;
            }
        }
    }

    /**
     * Assign conversation to specific agent
     */
    async assignToAgent(conversationId, agentId, event) {
        if (event) {
            event.stopPropagation();
        }
        
        // Close dropdown
        const dropdown = document.getElementById(`assign-dropdown-${conversationId}`);
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
        
        try {
            console.log('🔄 Assigning conversation:', conversationId, 'to agent:', agentId);
            const response = await fetch(`${this.apiUrl}/api/conversations/${conversationId}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: agentId })
            });
            
            if (response.ok) {
                console.log('✅ Assignment to agent successful, refreshing conversation list...');
                // Clear modern loader cache to force fresh data
                this.modernConversationLoader.refresh();
                await this.loadConversations();
                console.log('✅ Conversation list refreshed after assignment to agent');
            } else {
                const errorText = await response.text();
                console.error('Failed to assign conversation:', response.status, errorText);
                this.showToast(`Failed to assign conversation: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            this.handleAssignmentError(error, 'assign');
        }
    }

    /**
     * Unassign conversation (assign to nobody)
     */
    async unassignConversation(conversationId, event) {
        if (event) {
            event.stopPropagation();
        }
        
        // Close dropdown
        const dropdown = document.getElementById(`assign-dropdown-${conversationId}`);
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
        
        try {
            const response = await fetch(`${this.apiUrl}/api/conversations/${conversationId}/unassign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: this.agentId })
            });
            
            if (response.ok) {
                console.log(`Unassigned conversation ${conversationId}`);
                await this.loadConversations();
            } else {
                const errorText = await response.text();
                console.error('Failed to unassign conversation:', response.status, errorText);
                this.showToast(`Failed to unassign conversation: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            this.handleAssignmentError(error, 'unassign');
        }
    }

    /**
     * Assign conversation to current agent
     * @param {string} conversationId - ID of conversation to assign
     * @param {Event} event - Click event to prevent propagation
     */
    async assignConversation(conversationId, event) {
        if (event) {
            event.stopPropagation(); // Prevent selecting the chat
        }
        
        try {
            console.log('🔄 Assigning conversation:', conversationId, 'to agent:', this.agentId);
            const response = await fetch(`${this.apiUrl}/api/conversations/${conversationId}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: this.agentId })
            });
            
            if (response.ok) {
                console.log('✅ Assignment successful, refreshing conversation list...');
                // Clear modern loader cache to force fresh data
                this.modernConversationLoader.refresh();
                await this.loadConversations();
                console.log('✅ Conversation list refreshed after assignment');
            } else {
                const errorText = await response.text();
                console.error('Failed to assign conversation:', response.status, errorText);
                this.showToast(`Failed to assign conversation: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            this.handleAssignmentError(error, 'assign');
        }
    }

    /**
     * Unassign conversation from current agent
     * @param {string} conversationId - ID of conversation to unassign
     * @param {Event} event - Click event to prevent propagation
     */
    async unassignConversation(conversationId, event) {
        if (event) {
            event.stopPropagation(); // Prevent selecting the chat
        }
        
        try {
            console.log('🔄 Unassigning conversation:', conversationId, 'from agent:', this.agentId);
            const response = await fetch(`${this.apiUrl}/api/conversations/${conversationId}/unassign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: this.agentId })
            });
            
            if (response.ok) {
                console.log('✅ Unassignment successful, refreshing conversation list...');
                // If we're unassigning the current chat, reset the view
                if (conversationId === this.currentChatId) {
                    this.resetChatView();
                }
                // Clear modern loader cache to force fresh data
                this.modernConversationLoader.refresh();
                await this.loadConversations();
                console.log('✅ Conversation list refreshed after unassignment');
            } else {
                const errorText = await response.text();
                console.error('Failed to unassign conversation:', response.status, errorText);
                this.showToast(`Failed to unassign conversation: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            this.handleAssignmentError(error, 'unassign');
        }
    }

    /**
     * Unarchive conversation
     * @param {string} conversationId - ID of conversation to unarchive
     * @param {Event} event - Click event to prevent propagation
     */
    async unarchiveConversation(conversationId, event) {
        if (event) {
            event.stopPropagation(); // Prevent selecting the chat
        }
        
        try {
            console.log('📂 Unarchiving conversation:', conversationId);
            const response = await fetch(`${this.apiUrl}/api/admin/conversations/bulk-unarchive`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('agent_token')}`
                },
                body: JSON.stringify({ conversationIds: [conversationId] })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Unarchived conversation successfully`);
                console.log('✅ Unarchive operation successful, refreshing conversation list...');
                this.modernConversationLoader.refresh();
                await this.loadConversations();
                console.log('✅ Conversation list refreshed after unarchive operation');
            } else {
                const errorText = await response.text();
                console.error('Failed to unarchive conversation:', response.status, errorText);
                this.showToast(`Failed to unarchive conversation: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            this.handleBulkOperationError(error, 'unarchive');
        }
    }

    /**
     * Set conversation filter
     * @param {string} filter - Filter type: 'mine', 'unassigned', 'others', 'all'
     */
    setFilter(filter) {
        console.log(`🔽 setFilter called with filter: ${filter}`);
        this.currentFilter = filter;
        this.updateFilterButtons();
        this.applyFilter();
    }

    /**
     * Update filter button styles
     */
    updateFilterButtons() {
        const buttons = ['filter-mine', 'filter-unassigned', 'filter-others', 'filter-all'];
        const filterMap = {
            'mine': 'filter-mine',
            'unassigned': 'filter-unassigned',
            'others': 'filter-others',
            'all': 'filter-all'
        };

        buttons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                if (buttonId === filterMap[this.currentFilter]) {
                    // Active button styling
                    button.className = 'flex-1 text-xs px-2 py-1.5 rounded bg-blue-100 text-blue-800 font-medium transition hover:bg-blue-200';
                } else {
                    // Inactive button styling
                    button.className = 'flex-1 text-xs px-2 py-1.5 rounded bg-gray-100 text-gray-700 transition hover:bg-gray-200';
                }
            }
        });
    }

    /**
     * Apply current filter to conversations
     */
    applyFilter() {
        console.log(`🔍 applyFilter called - current filter: ${this.currentFilter}, total conversations: ${this.allConversations.length}`);
        
        const filters = {
            archiveFilter: this.archiveFilter,
            assignmentFilter: this.currentFilter,
            agentId: this.agentId
        };
        
        // Use modern conversation loader for filtering
        this.modernConversationLoader.reapplyFilters(filters, (conversations) => {
            this.renderQueue(conversations);
        });
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
        if (this.archiveFilter === 'active') {
            filtered = conversations.filter(conv => !conv.archived);
        } else if (this.archiveFilter === 'archived') {
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
        this.currentChatId = conversationId;
        
        try {
            // Load messages first (this also updates conversation data)
            await this.loadChatMessages(conversationId);
            
            // Always check for pending suggestions in HITL mode 
            // The API will return 404 if no suggestion exists, which is fine
            if (this.systemMode === 'hitl') {
                await this.checkForPendingSuggestion(conversationId);
            }
            
            // Show chat interface
            this.showChatInterface(conversationId);
            
            // Refresh queue to show assignment
            this.loadConversations();
        } catch (error) {
            console.error('Error selecting chat:', error);
        }
    }

    /**
     * Show chat interface elements
     * @param {string} conversationId - ID of current conversation
     */
    showChatInterface(conversationId) {
        this.hideElement('no-chat-selected');
        this.showElement('chat-header');
        this.showElement('chat-messages');
        this.showElement('message-input-area');
        
        // Update header with conversation info
        const conv = this.conversations.get(conversationId);
        if (conv && conv.visitorId) {
            this.updateElementText('customer-name', conv.visitorId.substring(0, 16) + '...');
            this.updateElementText('customer-info', `Started ${new Date(conv.startedAt).toLocaleString()}`);
            
        } else {
            this.updateElementText('customer-name', '');
            this.updateElementText('customer-info', '');
        }
    }

    /**
     * Load messages for a conversation
     * @param {string} conversationId - ID of conversation
     */
    async loadChatMessages(conversationId) {
        try {
            const response = await fetch(`${this.apiUrl}/api/conversations/${conversationId}/messages`);
            const data = await response.json();
            
            this.conversations.set(conversationId, data);
            this.renderMessages(data.messages);
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    /**
     * Render messages in the chat area
     * @param {Array} messages - Array of message objects
     */
    renderMessages(messages) {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        
        const filteredMessages = this.filterSystemMessages(messages);
        
        container.innerHTML = filteredMessages.map(msg => this.renderMessage(msg)).join('');
        container.scrollTop = container.scrollHeight;
    }

    /**
     * Filter out unnecessary system messages
     * @param {Array} messages - Array of message objects
     * @returns {Array} Filtered messages
     */
    filterSystemMessages(messages) {
        return messages.filter(msg => {
            if (msg.sender === 'system') {
                return !msg.content.includes('[Message pending agent response') &&
                       !msg.content.includes('Agent has joined the conversation') &&
                       !msg.content.includes('Conversation assigned to agent') &&
                       !msg.content.includes('[Debug information stored]') &&
                       !(msg.metadata && msg.metadata.debugOnly) &&  // Hide debug-only messages
                       msg.content.trim() !== '';  // Hide empty system messages
            }
            return true;
        });
    }

    /**
     * Render individual message
     * @param {Object} msg - Message object
     * @returns {string} HTML string for message
     */
    renderMessage(msg) {
        const isCustomer = msg.sender === 'visitor';
        const isAI = msg.sender === 'ai';
        const isAgent = msg.sender === 'agent';
        const isSystem = msg.sender === 'system';
        
        const formattedContent = (isAI || isAgent) ? 
            this.markdownToHtml(msg.content) : 
            this.escapeHtml(msg.content);
        
        return `
            <div class="flex ${isCustomer ? '' : 'justify-end'} mb-4">
                <div class="max-w-[70%]">
                    <div class="${this.getMessageBubbleCss(isCustomer, isAI, isSystem, msg)}" style="line-height: 1.6;">
                        ${formattedContent}
                    </div>
                    <div class="text-xs text-gray-500 mt-1 ${isCustomer ? '' : 'text-right'}">
                        ${this.getMessageSenderLabel(isAI, isAgent, isSystem, msg)} • 
                        ${new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                </div>
            </div>
        `;
    }


    /**
     * Get CSS classes for message bubble
     */
    getMessageBubbleCss(isCustomer, isAI, isSystem, msg = null) {
        const baseClass = 'px-4 py-3 rounded-2xl shadow-sm max-w-full break-words';
        
        if (isCustomer) return `${baseClass} bg-white border border-gray-200 text-gray-800`;
        if (isAI) return `${baseClass} bg-purple-50 border border-purple-200 text-purple-900`;
        if (isSystem) return `${baseClass} bg-yellow-50 border border-yellow-200 text-yellow-900`;
        
        // Standard styling for all agent messages - no special color coding needed
        return `${baseClass} bg-indigo-600 text-white`;
    }

    /**
     * Get sender label for message
     */
    getMessageSenderLabel(isAI, isAgent, isSystem, msg = null) {
        if (isAI) return 'AI Assistant';
        if (isSystem) return 'System';
        if (isAgent && msg && msg.metadata && msg.metadata.responseAttribution) {
            const attr = msg.metadata.responseAttribution;
            let label = attr.respondedBy || 'Agent';
            
            // Add response type annotation
            if (attr.responseType === 'autopilot') {
                return label; // Just "Autopilot" without redundant (autopilot)
            } else if (attr.responseType === 'as-is') {
                return `${label} (as-is)`;
            } else if (attr.responseType === 'edited') {
                return `${label} (edited)`;
            } else if (attr.responseType === 'from-scratch' || attr.responseType === 'custom') {
                return `${label} (custom)`;
            }
            
            return label;
        }
        if (isAgent) return 'You';
        return 'Customer';
    }

    /**
     * Send message from input field
     */
    async sendMessage() {
        const input = document.getElementById('message-input');
        if (!input) return;
        
        const message = input.value.trim();
        
        // Validate message and provide feedback
        if (!message) {
            this.showToast('Please enter a message before sending', 'warning');
            input.focus();
            return;
        }
        
        if (!this.currentChatId) {
            this.showToast('Please select a conversation first', 'warning');
            return;
        }
        
        // Determine suggestion action
        const suggestionAction = this.currentSuggestion ? 
            (message === this.currentSuggestion ? 'as-is' : 'edited') : 
            'from-scratch';
        
        await this.sendAgentResponse(message, suggestionAction);
    }

    /**
     * Get AI assistance for current conversation
     */
    async getAIAssistance() {
        if (!this.currentChatId) return;
        
        try {
            const response = await fetch(`${this.apiUrl}/api/suggestions/${this.currentChatId}`);
            const data = await response.json();
            
            this.showAISuggestion(data.suggestion, data.confidence);
        } catch (error) {
            console.error('Error getting AI assistance:', error);
        }
    }

    /**
     * Check for pending AI suggestions (HITL mode only)
     * @param {string} conversationId - ID of conversation
     */
    async checkForPendingSuggestion(conversationId) {
        try {
            const response = await fetch(`${this.apiUrl}/api/conversations/${conversationId}/pending-suggestion`);
            if (response.ok) {
                const data = await response.json();
                
                // HITL mode: Show suggestion for human validation
                if (!this.currentSuggestion || this.currentSuggestion !== data.suggestion) {
                    this.showAISuggestion(data.suggestion, data.confidence, data.metadata || {});
                }
            } else if (response.status === 404) {
                // No pending suggestion - this is normal
                this.hideAISuggestion();
            } else {
                console.error('Unexpected error checking suggestion:', response.status);
                this.hideAISuggestion();
            }
        } catch (error) {
            console.error('Error checking for pending suggestion:', error);
            this.hideAISuggestion();
        }
    }

    /**
     * Show AI suggestion panel
     * @param {string} suggestion - AI suggestion text
     * @param {number} _confidence - Confidence score (unused)
     * @param {Object} metadata - Additional metadata
     */
    showAISuggestion(suggestion, _confidence, metadata = {}) {
        const suggestionText = document.getElementById('ai-suggestion-text');
        const panel = document.getElementById('ai-suggestion-panel');
        
        if (suggestionText) {
            suggestionText.innerHTML = this.markdownToHtml(suggestion);
        }
        
        // Update header based on metadata
        const headerText = metadata.messageCount > 1 
            ? `AI Suggestion (responding to ${metadata.messageCount} messages)`
            : 'AI Suggestion';
            
        const headerElement = document.querySelector('#ai-suggestion-panel .font-semibold');
        if (headerElement) {
            headerElement.textContent = headerText;
        }
        
        if (panel) {
            panel.classList.remove('hidden');
        }
        
        this.currentSuggestion = suggestion;
    }

    /**
     * Hide AI suggestion panel
     */
    hideAISuggestion() {
        const panel = document.getElementById('ai-suggestion-panel');
        const suggestionText = document.getElementById('ai-suggestion-text');
        
        if (panel) {
            panel.classList.add('hidden');
        }
        
        if (suggestionText) {
            suggestionText.textContent = '';
        }
        
        this.currentSuggestion = null;
    }

    /**
     * Send AI suggestion as-is
     */
    async sendAsIs() {
        if (!this.currentSuggestion) return;
        await this.sendAgentResponse(this.currentSuggestion, 'as-is');
    }

    /**
     * Edit AI suggestion in input field
     */
    editSuggestion() {
        if (!this.currentSuggestion) return;
        
        const input = document.getElementById('message-input');
        if (input) {
            input.value = this.currentSuggestion;
            input.focus();
            // Manually resize after setting content
            setTimeout(() => this.resizeTextarea(), 10); // Small delay to ensure content is set
        }
        
        this.hideAISuggestion();
    }

    /**
     * Clear input and write from scratch
     */
    writeFromScratch() {
        const input = document.getElementById('message-input');
        if (input) {
            input.value = '';
            input.focus();
            // Resize to minimum height after clearing
            setTimeout(() => this.resizeTextarea(), 10);
        }
        
        this.hideAISuggestion();
    }

    /**
     * Send agent response to backend
     * @param {string} message - Message content
     * @param {string} suggestionAction - How suggestion was used
     */
    async sendAgentResponse(message, suggestionAction) {
        if (!this.currentChatId) return;
        
        try {
            const response = await fetch(`${this.apiUrl}/api/agent/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId: this.currentChatId,
                    message: message,
                    agentId: this.agentId,
                    usedSuggestion: this.currentSuggestion,
                    suggestionAction: suggestionAction,
                    autoAssign: true  // Auto-assign to this agent when responding
                })
            });
            
            if (response.ok) {
                this.hideAISuggestion();
                this.clearMessageInput();
                
                // Reload messages and queue with slight delay
                setTimeout(async () => {
                    await this.loadChatMessages(this.currentChatId);
                    this.loadConversations();
                }, 100);
            } else {
                const errorText = await response.text();
                console.error('Failed to send message:', errorText);
                this.showToast(`Failed to send message: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            console.error('Error sending agent response:', error);
            
            // Show user-friendly error message
            let errorMessage = 'Failed to send message. Please try again.';
            
            if (error.message.includes('403')) {
                errorMessage = 'You are not authorized to respond to this conversation.';
            } else if (error.message.includes('404')) {
                errorMessage = 'This conversation no longer exists.';
            } else if (error.message.includes('500')) {
                errorMessage = 'Server error. Please try again in a moment.';
            } else if (error.name === 'TypeError') {
                errorMessage = 'Network error. Please check your connection and try again.';
            }
            
            // Show error to user with toast notification
            this.showToast(errorMessage, 'error');
            
            // Attempt to refresh data in case it helps
            setTimeout(() => {
                this.loadConversations();
                if (this.currentChatId) {
                    this.loadChatMessages(this.currentChatId);
                }
            }, 1000);
        }
    }

    /**
     * Clear message input field
     */
    clearMessageInput() {
        const input = document.getElementById('message-input');
        if (input) {
            input.value = '';
            input.style.height = 'auto';
        }
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
     * Handle assignment operation errors with user-friendly messages
     * @param {Error} error - The error that occurred
     * @param {string} operation - The operation that failed ('assign' or 'unassign')
     */
    handleAssignmentError(error, operation = 'assign') {
        console.error(`Error ${operation}ing conversation:`, error);
        
        // Show user-friendly error message
        let errorMessage = `Failed to ${operation} conversation. Please try again.`;
        
        if (error.message.includes('403')) {
            errorMessage = `You are not authorized to ${operation} this conversation.`;
        } else if (error.message.includes('404')) {
            errorMessage = 'This conversation no longer exists.';
        } else if (error.message.includes('500')) {
            errorMessage = 'Server error. Please try again in a moment.';
        } else if (error.name === 'TypeError') {
            errorMessage = 'Network error. Please check your connection and try again.';
        }
        
        this.showToast(errorMessage, 'error');
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

    /**
     * Toggle debug modal visibility
     */
    async toggleDebugPanel() {
        const modal = document.getElementById('debug-modal');
        if (!modal) return;
        
        if (modal.classList.contains('hidden')) {
            await this.showDebugModal();
        } else {
            this.hideDebugModal();
        }
    }

    /**
     * Show debug modal and load debug information
     */
    async showDebugModal() {
        if (!this.currentChatId) return;
        
        const modal = document.getElementById('debug-modal');
        if (!modal) return;
        
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        await this.loadDebugInfo();
    }

    /**
     * Hide debug modal
     */
    hideDebugModal() {
        const modal = document.getElementById('debug-modal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = ''; // Restore scrolling
        }
    }

    /**
     * Load debug information from backend
     */
    async loadDebugInfo() {
        if (!this.currentChatId) return;
        
        try {
            const response = await fetch(`${this.apiUrl}/api/conversations/${this.currentChatId}/debug-info`);
            
            if (response.ok) {
                const debugInfo = await response.json();
                this.renderDebugInfo(debugInfo);
            } else if (response.status === 404) {
                this.renderDebugError('No debug information available for this conversation.');
            } else {
                this.renderDebugError('Failed to load debug information.');
            }
        } catch (error) {
            console.error('Error loading debug info:', error);
            this.renderDebugError('Error loading debug information.');
        }
    }

    /**
     * Render debug information in the panel
     */
    renderDebugInfo(debugInfo) {
        const content = document.getElementById('debug-content');
        if (!content) return;
        
        let sections = [];
        
        // Check if we have LangChain RAG debug info (new comprehensive format)
        if (debugInfo.step4_langchainRAG) {
            const langchainDebug = debugInfo.step4_langchainRAG;
            sections = [
                {
                    id: 'original-request',
                    title: '1. Original Request & Context',
                    data: {
                        ...debugInfo.step1_originalRequest,
                        langchainInput: langchainDebug.step1_input
                    }
                },
                {
                    id: 'query-rephrasing',
                    title: '2. Query Rephrasing (LLM Call #1)',
                    data: langchainDebug.step2_queryRephrasing
                },
                {
                    id: 'document-retrieval',
                    title: '3. Document Retrieval',
                    data: langchainDebug.step3_documentRetrieval
                },
                {
                    id: 'context-formatting',
                    title: '4. Context Formatting',
                    data: langchainDebug.step4_contextFormatting
                },
                {
                    id: 'response-generation',
                    title: '5. AI Model Response (LLM Call #2)',
                    data: langchainDebug.step5_responseGeneration
                },
                {
                    id: 'source-attribution',
                    title: '6. Source Attribution',
                    data: langchainDebug.step6_sourceAttribution
                },
                {
                    id: 'final-result',
                    title: '7. Final Result',
                    data: {
                        ...langchainDebug.step7_finalResult,
                        totalProcessingTime: langchainDebug.totalProcessingTime,
                        chainType: langchainDebug.chainType,
                        aiServiceFinalResponse: debugInfo.finalResponse
                    }
                }
            ];
        } else {
            // Fallback to old format for backwards compatibility
            sections = [
                {
                    id: 'original-request',
                    title: '1. Original Request',
                    data: debugInfo.step1_originalRequest
                },
                {
                    id: 'provider-check',
                    title: '2. Provider Status',
                    data: debugInfo.step2_providerCheck
                },
                {
                    id: 'rag-processing',
                    title: '3. RAG Processing',
                    data: debugInfo.step3_ragProcessing
                },
                {
                    id: 'rag-results',
                    title: '4. Retrieved Documents',
                    data: debugInfo.step4_ragResults || debugInfo.step4_modelRequest
                },
                {
                    id: 'model-response',
                    title: '5. AI Model Response',
                    data: debugInfo.step5_modelResponse
                },
                {
                    id: 'final-response',
                    title: '6. Final Response',
                    data: { response: debugInfo.finalResponse }
                }
            ];
        }
        
        content.innerHTML = sections.map(section => this.renderDebugSection(section)).join('');
        
        // Add event listeners for toggles
        this.setupDebugToggleListeners();
    }

    /**
     * Render individual debug section
     */
    renderDebugSection(section) {
        const hasData = section.data && Object.keys(section.data).length > 0;
        const previewData = hasData ? this.formatDebugPreview(section.data) : 'No data available';
        const fullData = hasData ? JSON.stringify(section.data, null, 2) : 'No data available';
        
        return `
            <div class="debug-section mb-4 border border-yellow-200 rounded-lg">
                <div class="debug-section-header bg-yellow-50 p-3 cursor-pointer flex justify-between items-center" 
                     onclick="this.parentElement.querySelector('.debug-section-content').classList.toggle('hidden')">
                    <h4 class="font-medium text-yellow-800">${section.title}</h4>
                    <i class="fas fa-chevron-down text-yellow-600 transform transition-transform"></i>
                </div>
                <div class="debug-section-content hidden p-3 bg-white">
                    <div class="debug-preview mb-3 p-2 bg-gray-50 rounded text-sm text-gray-700">
                        ${previewData}
                    </div>
                    <div class="debug-toggle-container">
                        <button class="debug-toggle-btn text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-2 py-1 rounded" 
                                onclick="this.nextElementSibling.classList.toggle('hidden')">
                            <i class="fas fa-code mr-1"></i> Show Full Data
                        </button>
                        <pre class="debug-full-data hidden mt-2 p-2 bg-gray-900 text-green-400 text-xs rounded overflow-auto max-h-64">${this.escapeHtml(fullData)}</pre>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Format debug data for preview
     */
    formatDebugPreview(data) {
        if (!data) return 'No data';
        
        if (typeof data === 'string') {
            return data.length > 100 ? data.substring(0, 100) + '...' : data;
        }
        
        if (typeof data === 'object') {
            const keys = Object.keys(data);
            const keyCount = keys.length;
            
            if (keyCount === 0) return 'Empty object';
            
            // Show key highlights based on the data structure
            const highlights = [];
            
            // General fields
            if (data.provider) highlights.push(`Provider: ${data.provider}`);
            if (data.status) highlights.push(`Status: ${data.status}`);
            if (data.enabled !== undefined) highlights.push(`Enabled: ${data.enabled}`);
            if (data.successful !== undefined) highlights.push(`Success: ${data.successful}`);
            if (data.error) highlights.push(`Error: ${data.error}`);
            
            // LLM-specific fields
            if (data.model) highlights.push(`Model: ${data.model}`);
            if (data.temperature !== undefined) highlights.push(`Temp: ${data.temperature}`);
            if (data.formattedPrompt) highlights.push(`Prompt: ${data.formattedPrompt.substring(0, 50)}...`);
            if (data.finalPrompt) highlights.push(`Final Prompt: ${data.finalPrompt.substring(0, 50)}...`);
            if (data.rephrasedQuery) highlights.push(`Rephrased: "${data.rephrasedQuery}"`);
            if (data.extractedContent) highlights.push(`Response: ${data.extractedContent.substring(0, 50)}...`);
            
            // Prompt management fields (Langfuse integration)
            if (data.promptSource) highlights.push(`Prompt Source: ${data.promptSource}`);
            if (data.promptVersion) highlights.push(`Version: v${data.promptVersion}`);
            if (data.originalQuery) highlights.push(`Original: "${data.originalQuery}"`);
            if (data.improvement !== undefined) highlights.push(`Improved: ${data.improvement ? 'Yes' : 'No'}`);
            if (data.action) highlights.push(`Action: ${data.action}`);
            if (data.hasHistory !== undefined) highlights.push(`Has History: ${data.hasHistory}`);
            if (data.promptType) highlights.push(`Type: ${data.promptType}`);
            
            // RAG-specific fields
            if (data.contextsUsed) highlights.push(`Contexts: ${data.contextsUsed}`);
            if (data.sources && Array.isArray(data.sources)) highlights.push(`Sources: ${data.sources.length}`);
            if (data.retrievedDocuments !== undefined) highlights.push(`Documents: ${data.retrievedDocuments}`);
            if (data.requestedDocuments !== undefined) highlights.push(`Requested: ${data.requestedDocuments}`);
            if (data.searchQuery) highlights.push(`Search: "${data.searchQuery}"`);
            if (data.documentsMetadata && Array.isArray(data.documentsMetadata)) {
                highlights.push(`Metadata: ${data.documentsMetadata.length} entries`);
            }
            if (data.documentsUsed) highlights.push(`Used: ${data.documentsUsed}`);
            
            // Content length fields
            if (data.contextLength) highlights.push(`Context: ${data.contextLength} chars`);
            if (data.responseLength) highlights.push(`Response: ${data.responseLength} chars`);
            if (data.totalPromptLength) highlights.push(`Total Prompt: ${data.totalPromptLength} chars`);
            
            // Config fields
            if (data.k) highlights.push(`K: ${data.k}`);
            if (data.used !== undefined) highlights.push(`Used: ${data.used}`);
            if (data.skipped) highlights.push('Skipped');
            if (data.historyExchanges !== undefined) highlights.push(`History: ${data.historyExchanges} exchanges`);
            if (data.validExchanges !== undefined) highlights.push(`Valid: ${data.validExchanges}`);
            
            // Fallback response preview
            if (data.response && !data.extractedContent) highlights.push(`Response: ${data.response.substring(0, 50)}...`);
            if (data.answer) highlights.push(`Answer: ${data.answer.substring(0, 50)}...`);
            
            return highlights.length > 0 ? highlights.join(' • ') : `${keyCount} properties`;
        }
        
        return String(data);
    }

    /**
     * Setup event listeners for debug toggles
     */
    setupDebugToggleListeners() {
        const headers = document.querySelectorAll('.debug-section-header');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const icon = header.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-chevron-down');
                    icon.classList.toggle('fa-chevron-up');
                }
            });
        });
    }

    /**
     * Render debug error message
     */
    renderDebugError(message) {
        const content = document.getElementById('debug-content');
        if (!content) return;
        
        content.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <i class="fas fa-exclamation-triangle text-red-500 mb-2"></i>
                <p class="text-red-700">${message}</p>
            </div>
        `;
    }


    /**
     * Reset chat view to no selection
     */
    resetChatView() {
        this.currentChatId = null;
        this.showElement('no-chat-selected');
        this.hideElement('chat-header');
        this.hideElement('chat-messages');
        this.hideElement('message-input-area');
        this.hideAISuggestion();
    }

    /**
     * Initialize WebSocket connection using direct Socket.io
     */
    async initializeWebSocket() {
        try {
            const wsUrl = this.apiUrl.replace('http', 'ws');
            
            // Direct Socket.io connection (like settings.js)
            this.socket = io(wsUrl);
            
            // Set up event handlers for dashboard functionality
            this.setupWebSocketEventHandlers();
            
            // Start heartbeat to keep connection alive
            this.startHeartbeat();
            
            console.log('✅ Direct Socket.io WebSocket initialized successfully');
            
        } catch (error) {
            console.error('💥 Failed to initialize WebSocket connection:', error);
            // Fallback to polling if WebSocket fails completely
            this.fallbackToPolling();
        }
    }
    
    /**
     * Setup WebSocket event handlers for dashboard functionality
     */
    setupWebSocketEventHandlers() {
        // Connection events using direct Socket.io
        this.socket.on('connect', () => {
            console.log('✅ Connected to WebSocket server via direct Socket.io');
            // Register initial agent status on connection
            this.registerInitialStatus();
        });
        
        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from WebSocket server');
        });
        
        // Note: Socket.io handles reconnection automatically - no custom 'reconnect' event needed
        
        // Application events
        this.socket.on('new-message', (data) => {
            console.log('📨 New message received:', data);
            
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
            if (data.conversationId === this.currentChatId) {
                // Refresh conversation status (handles reopening cases)
                this.refreshConversation(this.currentChatId);
                this.loadChatMessages(this.currentChatId);
                
                // Only check for pending suggestions in HITL mode
                if (this.systemMode === 'hitl') {
                    this.checkForPendingSuggestion(this.currentChatId);
                }
            }
        });
        
        this.socket.on('connected-agents-update', (data) => {
            console.log('👥 Connected agents update:', data);
            // Invalidate agent cache when status changes
            this.agentCacheExpiry = 0;
            console.log('🔄 Agent cache invalidated due to status change');
            this.updateConnectedAgents(data.agents);
        });
        
        this.socket.on('system-mode-update', (data) => {
            console.log('⚙️ System mode update:', data);
            this.updateSystemMode(data.mode);
        });
        
        this.socket.on('tickets-reassigned', (data) => {
            console.log('🔄 Tickets reassigned:', data);
            this.handleTicketReassignments(data);
            
            // Play sound notification for assignments to current agent
            if (this.soundNotificationManager && data.reassignments) {
                const assignedToMe = data.reassignments.filter(r => 
                    r.newAgent === this.agentId && r.conversationId
                );
                
                if (assignedToMe.length > 0) {
                    // Play new conversation sound for assignments
                    this.soundNotificationManager.playSound('newConversation');
                }
            }
            
            // Refresh conversations to show updated assignments
            setTimeout(() => this.loadConversations(), 500);
        });
        
        this.socket.on('customer-typing-status', (data) => {
            if (data.conversationId === this.currentChatId) {
                this.showCustomerTyping(data.isTyping);
            }
        });

        this.socket.on('new-conversation', (data) => {
            console.log('🆕 New conversation created:', data);
            
            // Play sound notification for new conversations
            if (this.soundNotificationManager) {
                this.soundNotificationManager.onNewConversation(data);
            }
            
            // Reload conversations to show the new conversation
            this.loadConversations();
        });
        
        // Socket.io error handling (simplified - no circuit breaker needed)
        this.socket.on('error', (error) => {
            console.error('💥 WebSocket error:', error);
        });
        
        // Socket.io handles connection status automatically - no custom monitoring needed
    }
    
    /**
     * Start heartbeat to keep WebSocket connection alive
     */
    startHeartbeat() {
        // Send heartbeat every 15 seconds to keep connection active
        this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.socket.connected) {
                this.socket.emit('heartbeat', { 
                    timestamp: Date.now(),
                    agentId: this.agentId 
                });
                console.log('💓 Agent dashboard heartbeat sent');
            }
        }, 15000); // 15 seconds
    }
    
    /**
     * Stop heartbeat interval
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('💔 Agent dashboard heartbeat stopped');
        }
    }
    
    /**
     * Show/hide customer typing indicator
     * @param {boolean} isTyping - Whether customer is typing
     */
    showCustomerTyping(isTyping) {
        const indicator = document.getElementById('customer-typing-indicator');
        if (indicator) {
            if (isTyping) {
                indicator.classList.remove('hidden');
            } else {
                indicator.classList.add('hidden');
            }
        }
    }
    
    /**
     * Send agent typing status
     * @param {boolean} isTyping - Whether agent is typing
     */
    sendTypingStatus(isTyping) {
        if (this.socket && this.socket.connected && this.currentChatId) {
            this.socket.emit('agent-typing', {
                conversationId: this.currentChatId,
                isTyping: isTyping
            });
        }
    }
    
    // Connection error and reconnection handling simplified
    // Socket.io handles reconnection automatically - no custom logic needed
    
    /**
     * Fall back to polling when WebSocket fails
     */
    fallbackToPolling() {
        if (this.pollingInterval) {
            return; // Already polling
        }
        
        console.log('Starting polling fallback due to WebSocket issues');
        this.pollingInterval = setInterval(() => {
            this.loadConversations();
            if (this.currentChatId) {
                this.loadChatMessages(this.currentChatId);
                this.checkForPendingSuggestion(this.currentChatId);
            }
        }, this.pollInterval);
    }




    /**
     * Refresh a single conversation data from server
     * @param {string} conversationId - Conversation ID to refresh
     */
    async refreshConversation(conversationId) {
        try {
            const response = await fetch(`${this.apiUrl}/api/admin/conversations`);
            if (response.ok) {
                const data = await response.json();
                const updatedConv = data.conversations.find(c => c.id === conversationId);
                
                if (updatedConv) {
                    // Update the conversation in our local Map
                    this.conversations.set(conversationId, updatedConv);
                    
                    // Update UI if this is the current conversation
                    if (this.currentChatId === conversationId) {
                    }
                }
            }
        } catch (error) {
            console.error('Error refreshing conversation:', error);
        }
    }



    /**
     * Utility method to show element
     * @param {string} elementId - ID of element to show
     */
    showElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove('hidden');
        }
    }

    /**
     * Utility method to hide element
     * @param {string} elementId - ID of element to hide
     */
    hideElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('hidden');
        }
    }

    /**
     * Convert markdown text to HTML
     */
    markdownToHtml(text) {
        if (!text) return '';
        
        return text
            // Bold text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic text
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Links
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color: #4F46E5; text-decoration: underline;">$1</a>')
            // Line breaks
            .replace(/\n/g, '<br>')
            // Headers
            .replace(/^### (.*$)/gm, '<h3 style="margin: 8px 0; font-size: 16px; font-weight: bold;">$1</h3>')
            .replace(/^## (.*$)/gm, '<h2 style="margin: 8px 0; font-size: 18px; font-weight: bold;">$1</h2>')
            .replace(/^# (.*$)/gm, '<h1 style="margin: 8px 0; font-size: 20px; font-weight: bold;">$1</h1>');
    }

    /**
     * Format date for conversation display
     * Today: show time, yesterday/few days: "X days ago", older: full date
     */
    formatConversationDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            // Today - show time
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            // Yesterday
            return 'Yesterday';
        } else if (diffDays <= 7) {
            // Few days ago
            return `${diffDays} days ago`;
        } else {
            // Older - show date in current format
            return date.toLocaleDateString();
        }
    }

    /**
     * Escape HTML to prevent XSS attacks
     */
    escapeHtml(text) {
        if (!text) return '';
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Toggle conversation selection for bulk operations
     */
    toggleConversationSelection(conversationId) {
        if (this.selectedConversations.has(conversationId)) {
            this.selectedConversations.delete(conversationId);
        } else {
            this.selectedConversations.add(conversationId);
        }
        
        // Update Select All checkbox state based on current selection
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            // Get all filtered conversations
            const filteredConversations = this.filterConversations(this.allConversations, this.currentFilter);
            const filteredIds = new Set(filteredConversations.map(conv => conv.id));
            
            // Check if all filtered conversations are selected
            const allSelected = filteredConversations.length > 0 && 
                filteredConversations.every(conv => this.selectedConversations.has(conv.id));
            selectAllCheckbox.checked = allSelected;
            
            // Set indeterminate state if some but not all filtered conversations are selected
            const selectedFromFilter = Array.from(this.selectedConversations).filter(id => filteredIds.has(id));
            const someSelected = selectedFromFilter.length > 0 && selectedFromFilter.length < filteredConversations.length;
            selectAllCheckbox.indeterminate = someSelected;
        }
        
        this.updateBulkActionsPanel();
        this.updateSelectionUI();
    }

    /**
     * Toggle select/deselect all filtered conversations
     */
    toggleSelectAll(selectAll) {
        if (selectAll) {
            // Get all conversations that match current filters
            const filteredConversations = this.filterConversations(this.allConversations, this.currentFilter);
            
            // Select all filtered conversations (not just visible in DOM)
            filteredConversations.forEach(conv => {
                this.selectedConversations.add(conv.id);
            });
        } else {
            // Deselect all
            this.selectedConversations.clear();
        }
        
        this.updateBulkActionsPanel();
        this.updateSelectionUI();
    }

    /**
     * Clear all conversation selections
     */
    clearAllSelections() {
        this.selectedConversations.clear();
        
        // Also uncheck the Select All checkbox if it exists
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
        }
        
        this.updateBulkActionsPanel();
        this.updateSelectionUI();
    }

    /**
     * Update the bulk actions panel visibility and content
     */
    updateBulkActionsPanel() {
        const panel = document.getElementById('bulk-actions-panel');
        const selectedCount = this.selectedConversations.size;
        
        if (selectedCount > 0) {
            panel.classList.remove('hidden');
            document.getElementById('selected-count').textContent = selectedCount;
            // Update buttons when panel becomes visible
            this.updateBulkActionButtons();
        } else {
            panel.classList.add('hidden');
        }
    }
    
    /**
     * Update bulk action buttons based on archive filter
     */
    updateBulkActionButtons() {
        const archiveBtn = document.getElementById('bulk-archive');
        const unarchiveBtn = document.getElementById('bulk-unarchive');
        const assignMeBtn = document.getElementById('bulk-assign-me');
        const assignAgentDropdown = document.getElementById('bulk-assign-agent');
        
        if (this.archiveFilter === 'archived') {
            // In archive view - only show unarchive button
            if (archiveBtn) archiveBtn.style.display = 'none';
            if (unarchiveBtn) unarchiveBtn.style.display = 'block';
            if (assignMeBtn) assignMeBtn.style.display = 'none';
            if (assignAgentDropdown) assignAgentDropdown.style.display = 'none';
        } else {
            // In active view - show archive and assign buttons
            if (archiveBtn) archiveBtn.style.display = 'block';
            if (unarchiveBtn) unarchiveBtn.style.display = 'none';
            if (assignMeBtn) assignMeBtn.style.display = 'block';
            if (assignAgentDropdown) {
                assignAgentDropdown.style.display = 'block';
                // Populate agents dropdown if not already populated
                this.populateAgentsDropdown();
            }
        }
    }
    
    /**
     * Populate the agents dropdown with available agents
     */
    populateAgentsDropdown() {
        const dropdown = document.getElementById('bulk-assign-agent');
        if (!dropdown || dropdown.options.length > 1) return; // Already populated
        
        // Clear and add default option
        dropdown.innerHTML = '<option value="">Assign to...</option>';
        
        // Add connected agents from our tracking
        this.connectedAgents.forEach((status, agentEmail) => {
            if (agentEmail !== this.agentId) { // Don't include self
                const option = document.createElement('option');
                option.value = agentEmail;
                option.textContent = agentEmail.split('@')[0]; // Show just the username part
                dropdown.appendChild(option);
            }
        });
        
        // If no other agents, add a disabled message
        if (dropdown.options.length === 1) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No other agents online';
            option.disabled = true;
            dropdown.appendChild(option);
        }
    }

    /**
     * Update selection UI (checkboxes)
     */
    updateSelectionUI() {
        document.querySelectorAll('.conversation-checkbox').forEach(checkbox => {
            const conversationId = checkbox.dataset.conversationId;
            checkbox.checked = this.selectedConversations.has(conversationId);
        });
    }

    /**
     * Toggle between active and archived conversations
     */
    toggleArchiveFilter() {
        this.archiveFilter = this.archiveFilter === 'active' ? 'archived' : 'active';
        
        // Update archive icon style
        const archiveToggle = document.getElementById('archive-toggle');
        if (archiveToggle) {
            if (this.archiveFilter === 'archived') {
                archiveToggle.className = 'text-orange-600 hover:text-orange-800 transition-colors';
                archiveToggle.title = 'Switch to Active View';
            } else {
                archiveToggle.className = 'text-gray-400 hover:text-gray-600 transition-colors';
                archiveToggle.title = 'Toggle Archive View';
            }
        }
        
        // Disable/enable assignment filter buttons based on archive mode
        const assignmentButtons = ['filter-mine', 'filter-unassigned', 'filter-others', 'filter-all'];
        assignmentButtons.forEach(buttonId => {
            const button = document.getElementById(buttonId);
            if (button) {
                if (this.archiveFilter === 'archived') {
                    button.disabled = true;
                    button.className = button.className.replace(/bg-\w+-\d+/g, 'bg-gray-200').replace(/text-\w+-\d+/g, 'text-gray-500');
                } else {
                    button.disabled = false;
                    // Restore button styles - will be handled by updateFilterButtons()
                }
            }
        });
        
        // Update bulk action buttons based on archive mode
        this.updateBulkActionButtons();
        
        // Update filter button styles if we're switching back to active
        if (this.archiveFilter === 'active') {
            this.updateFilterButtons();
        }
        
        this.applyFilter();
    }

    /**
     * Bulk archive selected conversations
     */
    async bulkArchiveConversations() {
        const selectedIds = Array.from(this.selectedConversations);
        if (selectedIds.length === 0) return;

        try {
            const response = await fetch(`${this.apiUrl}/api/admin/conversations/bulk-archive`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('agent_token')}`
                },
                body: JSON.stringify({ conversationIds: selectedIds })
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Archived ${result.data.archivedCount} conversations`);
                this.clearAllSelections();
                console.log('✅ Archive operation successful, refreshing conversation list...');
                this.modernConversationLoader.refresh();
                await this.loadConversations();
                console.log('✅ Conversation list refreshed after archive operation');
            } else {
                const errorText = await response.text();
                console.error('Failed to archive conversations:', response.status, errorText);
                this.showToast(`Failed to archive conversations: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            this.handleBulkOperationError(error, 'archive');
        }
    }

    /**
     * Bulk unarchive selected conversations
     */
    async bulkUnarchiveConversations() {
        const selectedIds = Array.from(this.selectedConversations);
        if (selectedIds.length === 0) return;

        try {
            const response = await fetch(`${this.apiUrl}/api/admin/conversations/bulk-unarchive`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('agent_token')}`
                },
                body: JSON.stringify({ conversationIds: selectedIds })
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Unarchived ${result.data.unarchivedCount} conversations`);
                this.clearAllSelections();
                console.log('✅ Unarchive operation successful, refreshing conversation list...');
                this.modernConversationLoader.refresh();
                await this.loadConversations();
                console.log('✅ Conversation list refreshed after unarchive operation');
            } else {
                const errorText = await response.text();
                console.error('Failed to unarchive conversations:', response.status, errorText);
                this.showToast(`Failed to unarchive conversations: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            this.handleBulkOperationError(error, 'unarchive');
        }
    }

    /**
     * Bulk assign selected conversations to current agent
     */
    async bulkAssignToMe() {
        await this.bulkAssignToAgent(this.agentId);
    }
    
    /**
     * Bulk assign selected conversations to specific agent
     */
    async bulkAssignToAgent(agentId) {
        const selectedIds = Array.from(this.selectedConversations);
        if (selectedIds.length === 0) return;

        try {
            const response = await fetch(`${this.apiUrl}/api/admin/conversations/bulk-assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('agent_token')}`
                },
                body: JSON.stringify({ 
                    conversationIds: selectedIds,
                    agentId: agentId
                })
            });

            if (response.ok) {
                const result = await response.json();
                const assignedTo = agentId === this.agentId ? 'me' : agentId.split('@')[0];
                console.log(`✅ Assigned ${result.data.assignedCount} conversations to ${assignedTo}`);
                this.clearAllSelections();
                console.log('✅ Bulk assign operation successful, refreshing conversation list...');
                this.modernConversationLoader.refresh();
                await this.loadConversations();
                console.log('✅ Conversation list refreshed after bulk assign operation');
            } else {
                const errorText = await response.text();
                console.error('Failed to assign conversations:', response.status, errorText);
                this.showToast(`Failed to assign conversations: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            this.handleBulkOperationError(error, 'assign');
        }
    }
}

// Logout function for agent dashboard
async function logoutAgent() {
    if (confirm('Ar tikrai norite atsijungti?')) {
        try {
            // Call backend logout endpoint to invalidate refresh token
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
                await fetch('http://localhost:3002/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ refreshToken })
                });
            }
        } catch (error) {
            console.error('Logout API call failed:', error);
        }
        
        // Clear all stored authentication data
        localStorage.removeItem('agent_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('agentUser'); // Clear old system data too
        
        // Clear any agent status data
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('agentStatus_')) {
                localStorage.removeItem(key);
            }
        });
        
        // Redirect to login page
        window.location.href = 'login.html';
    }
}

// Initialize dashboard immediately when script loads (DOM is already ready at this point)
console.log('🚀 Initializing Agent Dashboard...');
new AgentDashboard();
console.log('✅ Dashboard initialized');