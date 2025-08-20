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
        this.agentId = 'agent-' + Math.random().toString(36).substring(2, 11);
        this.conversations = new Map();
        this.currentSuggestion = null;
        this.pollInterval = config.pollInterval || 3000;
        this.socket = null;
        this.personalStatus = 'online'; // Personal agent status (online/afk)
        this.systemMode = 'hitl'; // Global system mode (hitl/autopilot/off)
        this.connectedAgents = new Map(); // Track other connected agents
        
        console.log(`Agent Dashboard initialized with API URL: ${this.apiUrl}`);
        this.init();
    }

    async init() {
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
     * Update personal agent status (online/afk)
     * @param {string} status - Personal status (online, afk)
     */
    async updatePersonalStatus(status) {
        const dot = document.getElementById('agent-status-dot');
        if (dot) {
            dot.className = `w-3 h-3 rounded-full agent-${status}`;
        }
        
        // Store personal status
        this.personalStatus = status;
        
        try {
            await fetch(`${this.apiUrl}/api/agent/personal-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: this.agentId, personalStatus: status })
            });
        } catch (error) {
            console.error('Error updating personal status:', error);
        }
    }

    /**
     * Register initial agent status on page load/connection
     */
    async registerInitialStatus() {
        // Get current status from dropdown or default to 'online'
        const statusSelect = document.getElementById('personal-status');
        const currentStatus = statusSelect ? statusSelect.value : 'online';
        
        // Update the personal status to register the agent
        await this.updatePersonalStatus(currentStatus);
        
        console.log(`Agent ${this.agentId} registered with initial status: ${currentStatus}`);
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
        
        const container = document.getElementById('connected-agents');
        const totalAgents = document.getElementById('total-agents');
        
        if (container && totalAgents) {
            totalAgents.textContent = agents.length;
            
            container.innerHTML = agents.map(agent => `
                <div class="flex items-center justify-between py-1 px-2 bg-white rounded text-xs">
                    <div class="flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full ${agent.personalStatus === 'afk' ? 'bg-orange-400' : 'bg-green-400'}"></div>
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
        this.systemMode = mode;
        
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
        
        if (reason === 'agent_afk') {
            if (myLosses.length > 0) {
                message = `${myLosses.length} of your tickets were reassigned while you're AFK`;
            } else if (myReassignments.length > 0) {
                message = `You received ${myReassignments.length} tickets from an AFK agent`;
            }
        } else if (reason === 'agent_online') {
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
     * Load and display conversations
     */
    async loadConversations() {
        try {
            const response = await fetch(`${this.apiUrl}/api/admin/conversations`);
            if (!response.ok) {
                throw new Error(`Failed to load conversations: ${response.status}`);
            }
            const data = await response.json();
            
            this.updateQueueStats(data.conversations);
            this.renderQueue(data.conversations);
        } catch (error) {
            console.error('Error loading conversations:', error);
        }
    }

    /**
     * Update queue statistics display
     * @param {Array} conversations - Array of conversation objects
     */
    updateQueueStats(conversations) {
        const queue = conversations.filter(c => c.status === 'active' && !c.assignedAgent).length;
        const active = conversations.filter(c => c.assignedAgent === this.agentId).length;
        const resolved = conversations.filter(c => c.status === 'resolved').length;

        this.updateElementText('queue-count', queue);
        this.updateElementText('active-count', active);
        this.updateElementText('resolved-count', resolved);
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
        const queueContainer = document.getElementById('chat-queue');
        if (!queueContainer) return;
        
        // Sort conversations by priority
        const sorted = this.sortConversationsByPriority(conversations);

        queueContainer.innerHTML = sorted.map(conv => this.renderQueueItem(conv)).join('');
    }

    /**
     * Sort conversations by priority - MY tickets first, then by urgency and time
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
            
            // Priority 4: Sort by time (newest first for visibility)
            return new Date(b.startedAt) - new Date(a.startedAt);
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
     * Render individual queue item
     * @param {Object} conv - Conversation object
     * @returns {string} HTML string for queue item
     */
    renderQueueItem(conv) {
        const isAssignedToMe = conv.assignedAgent === this.agentId;
        const isUnassigned = !conv.assignedAgent;
        const isActive = conv.id === this.currentChatId;
        const needsResponse = this.conversationNeedsResponse(conv);
        
        const cssClass = this.getQueueItemCssClass(isActive, needsResponse, isAssignedToMe, isUnassigned);
        const statusLabel = this.getQueueItemStatusLabel(needsResponse, isAssignedToMe, isUnassigned, conv);
        const statusCss = this.getQueueItemStatusCss(needsResponse, isAssignedToMe, isUnassigned);
        
        return `
            <div class="chat-queue-item p-3 rounded-lg cursor-pointer border ${cssClass}" 
                 onclick="dashboard.selectChat('${conv.id}')">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2">
                        <div class="avatar w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                            <i class="fas fa-user text-gray-600 text-sm"></i>
                        </div>
                        <div>
                            <div class="font-medium text-sm">${this.escapeHtml(conv.visitorId.substring(0, 12))}...</div>
                            <div class="text-xs text-gray-500">
                                ${new Date(conv.startedAt).toLocaleTimeString()}
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                        ${needsResponse ? '<div class="w-2 h-2 bg-red-500 rounded-full notification-ping"></div>' : ''}
                        <span class="text-xs px-2 py-1 rounded ${statusCss}">
                            ${statusLabel}
                        </span>
                    </div>
                </div>
                <div class="text-sm text-gray-600 truncate">
                    ${needsResponse ? 'Customer message waiting for response' :
                    conv.lastMessage ? this.escapeHtml(conv.lastMessage.content) : 'No messages yet'}
                </div>
                <div class="flex justify-between items-center mt-2 text-xs text-gray-500">
                    <span>${conv.messageCount} messages</span>
                    <span class="capitalize">${conv.status}</span>
                </div>
            </div>
        `;
    }

    /**
     * Get CSS classes for queue item based on status
     */
    getQueueItemCssClass(isActive, needsResponse, isAssignedToMe, isUnassigned) {
        if (isActive) return 'active-chat border-indigo-300 bg-indigo-50';
        
        // MY TICKETS - Strong visual differentiation
        if (isAssignedToMe) {
            if (needsResponse) return 'bg-blue-100 border-blue-300 hover:bg-blue-150 border-l-4 border-l-blue-500';
            return 'bg-blue-50 border-blue-200 hover:bg-blue-100 border-l-4 border-l-blue-400';
        }
        
        // OTHER TICKETS
        if (needsResponse) return 'bg-red-50 border-red-200 hover:bg-red-100 border-l-2 border-l-red-300';
        if (isUnassigned) return 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100';
        
        // Other agents' tickets
        return 'bg-gray-50 border-gray-200 hover:bg-gray-100 opacity-80';
    }

    /**
     * Get status label for queue item
     */
    getQueueItemStatusLabel(needsResponse, isAssignedToMe, isUnassigned, conv) {
        if (needsResponse && isAssignedToMe) return 'YOUR TURN';
        if (needsResponse) return 'URGENT';
        if (isAssignedToMe) return 'MINE';
        if (isUnassigned) return 'UNASSIGNED';
        
        // Show which agent has it
        if (conv && conv.assignedAgent) {
            // Try to find the agent in our connected agents list
            const agent = this.connectedAgents.get(conv.assignedAgent);
            if (agent) {
                return this.getAgentDisplayName(agent).replace('Agent ', '');
            }
            // Fallback to shortened ID
            return conv.assignedAgent.substring(0, 6);
        }
        return 'OTHER';
    }

    /**
     * Get status CSS classes for queue item
     */
    getQueueItemStatusCss(needsResponse, isAssignedToMe, isUnassigned) {
        if (needsResponse && isAssignedToMe) return 'bg-blue-600 text-white font-bold';
        if (needsResponse) return 'bg-red-100 text-red-800 font-semibold';
        if (isAssignedToMe) return 'bg-blue-100 text-blue-800 font-medium';
        if (isUnassigned) return 'bg-yellow-100 text-yellow-800';
        return 'bg-gray-100 text-gray-600 text-xs';
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
            
            // Now get conversation data after loading
            const conversation = this.conversations.get(conversationId);
            console.log('🔍 selectChat - conversation data after loadMessages:', conversation ? 'found' : 'not found');
            console.log('🔍 selectChat - conversation status:', conversation?.status);
            console.log('🔍 selectChat - system mode:', this.systemMode);
            
            // Always check for pending suggestions in HITL mode 
            // The API will return 404 if no suggestion exists, which is fine
            if (this.systemMode === 'hitl') {
                console.log('🔍 selectChat - calling checkForPendingSuggestion (HITL mode)');
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
            
            // Update close/reopen buttons based on conversation status
            this.updateConversationButtons(conv);
            
            // Disable message input for resolved conversations
            this.updateMessageInputState(conv);
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
                <div class="flex items-start gap-3 max-w-[70%]">
                    ${isCustomer ? this.renderCustomerAvatar() : ''}
                    <div class="flex-1">
                        <div class="${this.getMessageBubbleCss(isCustomer, isAI, isSystem)}" style="line-height: 1.6;">
                            ${formattedContent}
                        </div>
                        <div class="text-xs text-gray-500 mt-1 ${isCustomer ? '' : 'text-right'}">
                            ${this.getMessageSenderLabel(isAI, isAgent, isSystem)} • 
                            ${new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                    </div>
                    ${!isCustomer ? this.renderAgentAvatar(isAI, isSystem) : ''}
                </div>
            </div>
        `;
    }

    /**
     * Render customer avatar
     * @returns {string} HTML for customer avatar
     */
    renderCustomerAvatar() {
        return `
            <div class="avatar w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                <i class="fas fa-user text-gray-600 text-sm"></i>
            </div>
        `;
    }

    /**
     * Render agent/AI avatar
     * @param {boolean} isAI - Is AI message
     * @param {boolean} isSystem - Is system message
     * @returns {string} HTML for agent avatar
     */
    renderAgentAvatar(isAI, isSystem) {
        const bgClass = isAI ? 'bg-purple-500' : isSystem ? 'bg-yellow-500' : 'bg-indigo-600';
        const iconClass = isAI ? 'fa-robot' : isSystem ? 'fa-info' : 'fa-headset';
        
        return `
            <div class="avatar w-8 h-8 ${bgClass} rounded-full flex items-center justify-center flex-shrink-0">
                <i class="fas ${iconClass} text-white text-sm"></i>
            </div>
        `;
    }

    /**
     * Get CSS classes for message bubble
     */
    getMessageBubbleCss(isCustomer, isAI, isSystem) {
        const baseClass = 'px-4 py-3 rounded-2xl shadow-sm max-w-full break-words';
        
        if (isCustomer) return `${baseClass} bg-white border border-gray-200 text-gray-800`;
        if (isAI) return `${baseClass} bg-purple-50 border border-purple-200 text-purple-900`;
        if (isSystem) return `${baseClass} bg-yellow-50 border border-yellow-200 text-yellow-900`;
        return `${baseClass} bg-indigo-600 text-white`;
    }

    /**
     * Get sender label for message
     */
    getMessageSenderLabel(isAI, isAgent, isSystem) {
        if (isAI) return 'AI Assistant';
        if (isAgent) return 'You';
        if (isSystem) return 'System';
        return 'Customer';
    }

    /**
     * Send message from input field
     */
    async sendMessage() {
        const input = document.getElementById('message-input');
        if (!input) return;
        
        const message = input.value.trim();
        
        if (!message || !this.currentChatId) return;
        
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
        console.log('🔍 checkForPendingSuggestion called for:', conversationId);
        try {
            const response = await fetch(`${this.apiUrl}/api/conversations/${conversationId}/pending-suggestion`);
            console.log('🔍 API response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('🔍 API response data:', data);
                
                // HITL mode: Show suggestion for human validation
                if (!this.currentSuggestion || this.currentSuggestion !== data.suggestion) {
                    console.log('🔍 Calling showAISuggestion...');
                    this.showAISuggestion(data.suggestion, data.confidence, data.metadata || {});
                } else {
                    console.log('🔍 Suggestion already shown, skipping');
                }
            } else if (response.status === 404) {
                // No pending suggestion - this is normal
                console.log('🔍 No pending suggestion (404)');
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
                    suggestionAction: suggestionAction
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
            
            // Show error to user (you could implement a toast notification here)
            console.warn('User-facing error:', errorMessage);
            
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
                    id: 'rag-config',
                    title: '2. RAG Configuration',
                    data: langchainDebug.step2_ragConfig
                },
                {
                    id: 'query-rephrasing',
                    title: '3. Query Rephrasing (LLM Call #1)',
                    data: langchainDebug.step3_queryRephrasing
                },
                {
                    id: 'document-retrieval',
                    title: '4. Document Retrieval',
                    data: langchainDebug.step4_documentRetrieval
                },
                {
                    id: 'prompt-construction',
                    title: '5. Final Prompt Construction',
                    data: langchainDebug.step5_promptConstruction
                },
                {
                    id: 'llm-response',
                    title: '6. AI Model Response (LLM Call #2)',
                    data: langchainDebug.step6_llmResponse
                },
                {
                    id: 'final-result',
                    title: '7. Final Result',
                    data: {
                        ...langchainDebug.step7_finalResult,
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
            
            // RAG-specific fields
            if (data.contextsUsed) highlights.push(`Contexts: ${data.contextsUsed}`);
            if (data.sources && Array.isArray(data.sources)) highlights.push(`Sources: ${data.sources.length}`);
            if (data.retrievedDocuments !== undefined) highlights.push(`Documents: ${data.retrievedDocuments}`);
            if (data.searchQuery) highlights.push(`Search: "${data.searchQuery}"`);
            
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
     * Initialize WebSocket connection
     */
    initializeWebSocket() {
        const wsUrl = this.apiUrl.replace('http', 'ws');
        this.socket = io(wsUrl);
        
        this.socket.on('connect', () => {
            console.log('Connected to WebSocket server');
            this.socket.emit('join-agent-dashboard', this.agentId);
            
            // Register initial agent status on connection
            this.registerInitialStatus();
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket server');
        });
        
        // Listen for new messages from customers
        this.socket.on('new-message', (data) => {
            console.log('New message received:', data);
            this.loadConversations();
            
            // If this is the current chat, update messages and check for suggestion
            if (data.conversationId === this.currentChatId) {
                this.loadChatMessages(this.currentChatId);
                
                // Only check for pending suggestions in HITL mode
                if (this.systemMode === 'hitl') {
                    this.checkForPendingSuggestion(this.currentChatId);
                }
            }
        });
        
        // Listen for connected agents updates
        this.socket.on('connected-agents-update', (data) => {
            console.log('Connected agents update:', data);
            this.updateConnectedAgents(data.agents);
        });
        
        // Listen for system mode updates
        this.socket.on('system-mode-update', (data) => {
            console.log('System mode update:', data);
            this.updateSystemMode(data.mode);
        });
        
        // Listen for ticket reassignments
        this.socket.on('tickets-reassigned', (data) => {
            console.log('Tickets reassigned:', data);
            this.handleTicketReassignments(data);
            // Refresh conversations to show updated assignments
            setTimeout(() => this.loadConversations(), 500);
        });
        
        // Listen for customer typing status
        this.socket.on('customer-typing-status', (data) => {
            if (data.conversationId === this.currentChatId) {
                this.showCustomerTyping(data.isTyping);
            }
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            this.handleConnectionError();
        });
        
        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`Reconnected to WebSocket server after ${attemptNumber} attempts`);
            this.handleReconnection();
        });
        
        this.socket.on('reconnect_error', (error) => {
            console.error('WebSocket reconnection error:', error);
        });
        
        this.socket.on('reconnect_failed', () => {
            console.error('WebSocket reconnection failed - falling back to polling');
            this.fallbackToPolling();
        });
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
        if (this.socket && this.currentChatId) {
            this.socket.emit('agent-typing', {
                conversationId: this.currentChatId,
                isTyping: isTyping
            });
        }
    }
    
    /**
     * Handle WebSocket connection errors
     */
    handleConnectionError() {
        console.log('WebSocket connection failed, starting polling fallback');
        this.fallbackToPolling();
    }
    
    /**
     * Handle successful WebSocket reconnection
     */
    handleReconnection() {
        // Rejoin agent dashboard
        if (this.socket && this.socket.connected) {
            this.socket.emit('join-agent-dashboard', this.agentId);
            
            // Re-register agent status
            this.registerInitialStatus();
            
            // Rejoin current conversation if any
            if (this.currentChatId) {
                this.socket.emit('join-conversation', this.currentChatId);
            }
        }
        
        // Stop polling if it was started as fallback
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            console.log('WebSocket reconnected, stopping polling fallback');
        }
        
        // Refresh data
        this.loadConversations();
        if (this.currentChatId) {
            this.loadChatMessages(this.currentChatId);
            this.checkForPendingSuggestion(this.currentChatId);
        }
    }
    
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
     * Update conversation close/reopen buttons based on status
     * @param {Object} conversation - Conversation object
     */
    updateConversationButtons(conversation) {
        const closeBtn = document.getElementById('close-conversation-btn');
        const reopenBtn = document.getElementById('reopen-conversation-btn');
        
        if (conversation.status === 'resolved') {
            // Show reopen button, hide close button
            if (closeBtn) closeBtn.classList.add('hidden');
            if (reopenBtn) reopenBtn.classList.remove('hidden');
        } else {
            // Show close button, hide reopen button
            if (closeBtn) closeBtn.classList.remove('hidden');
            if (reopenBtn) reopenBtn.classList.add('hidden');
        }
    }

    /**
     * Update message input state based on conversation status
     * @param {Object} conversation - Conversation object
     */
    updateMessageInputState(conversation) {
        const messageInput = document.getElementById('message-input');
        const sendButton = document.querySelector('#message-input-area button');
        
        if (conversation.status === 'resolved') {
            // Disable input for resolved conversations
            if (messageInput) {
                messageInput.disabled = true;
                messageInput.placeholder = 'Conversation is closed - reopen to send messages';
                messageInput.classList.add('bg-gray-100', 'text-gray-500');
            }
            if (sendButton) {
                sendButton.disabled = true;
                sendButton.classList.add('opacity-50', 'cursor-not-allowed');
            }
        } else {
            // Enable input for active conversations
            if (messageInput) {
                messageInput.disabled = false;
                messageInput.placeholder = 'Type your message...';
                messageInput.classList.remove('bg-gray-100', 'text-gray-500');
            }
            if (sendButton) {
                sendButton.disabled = false;
                sendButton.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
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
                        this.updateConversationButtons(updatedConv);
                        this.updateMessageInputState(updatedConv);
                    }
                }
            }
        } catch (error) {
            console.error('Error refreshing conversation:', error);
        }
    }

    /**
     * Close current conversation
     */
    async closeConversation() {
        if (!this.currentChatId) return;
        
        if (!confirm('Are you sure you want to close this conversation?')) return;
        
        try {
            const response = await fetch(`${this.apiUrl}/api/conversations/${this.currentChatId}/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: this.agentId })
            });
            
            if (response.ok) {
                // Reload messages, queue and update UI
                await this.loadChatMessages(this.currentChatId);
                this.loadConversations();
                
                // Refresh conversation data and update UI
                await this.refreshConversation(this.currentChatId);
                
                this.showNotification('Conversation closed successfully', 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Failed to close conversation', 'error');
            }
        } catch (error) {
            console.error('Error closing conversation:', error);
            this.showNotification('Failed to close conversation', 'error');
        }
    }

    /**
     * Reopen current conversation
     */
    async reopenConversation() {
        if (!this.currentChatId) return;
        
        try {
            const response = await fetch(`${this.apiUrl}/api/conversations/${this.currentChatId}/reopen`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: this.agentId })
            });
            
            if (response.ok) {
                // Reload messages, queue and update UI
                await this.loadChatMessages(this.currentChatId);
                this.loadConversations();
                
                // Refresh conversation data and update UI
                await this.refreshConversation(this.currentChatId);
                
                this.showNotification('Conversation reopened successfully', 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Failed to reopen conversation', 'error');
            }
        } catch (error) {
            console.error('Error reopening conversation:', error);
            this.showNotification('Failed to reopen conversation', 'error');
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
     * Escape HTML to prevent XSS attacks
     */
    escapeHtml(text) {
        if (!text) return '';
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Logout function for agent dashboard
function logoutAgent() {
    if (confirm('Ar tikrai norite atsijungti?')) {
        // Try multiple approaches for iframe communication
        try {
            // Method 1: Call parent window logout
            if (window.parent && window.parent !== window && typeof window.parent.logout === 'function') {
                window.parent.logout();
                return;
            }
        } catch (e) {
            console.log('Parent logout failed:', e.message);
        }
        
        try {
            // Method 2: PostMessage to parent
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ action: 'logout' }, '*');
                
                // Wait a moment then fallback
                setTimeout(() => {
                    window.location.href = '/agent-login.html';
                }, 500);
                return;
            }
        } catch (e) {
            console.log('PostMessage failed:', e.message);
        }
        
        // Method 3: Direct redirect
        window.location.href = '/agent-login.html';
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new AgentDashboard();
});

// Global function for onclick handlers (backward compatibility)
window.dashboard = null;