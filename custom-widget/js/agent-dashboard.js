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
        // Agent status change
        const statusSelect = document.getElementById('agent-status');
        if (statusSelect) {
            statusSelect.addEventListener('change', (e) => {
                this.updateAgentStatus(e.target.value);
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

        if (sendAsIsBtn) {
            sendAsIsBtn.addEventListener('click', () => this.sendAsIs());
        }

        if (editSuggestionBtn) {
            editSuggestionBtn.addEventListener('click', () => this.editSuggestion());
        }

        if (writeFromScratchBtn) {
            writeFromScratchBtn.addEventListener('click', () => this.writeFromScratch());
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
     * Update agent status and notify backend
     * @param {string} status - Agent status (online, busy, offline)
     */
    async updateAgentStatus(status) {
        const dot = document.getElementById('agent-status-dot');
        if (dot) {
            dot.className = `w-3 h-3 rounded-full agent-${status}`;
        }
        
        try {
            await fetch(`${this.apiUrl}/api/agent/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: this.agentId, status })
            });
        } catch (error) {
            console.error('Error updating agent status:', error);
        }
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
     * Sort conversations by priority (needing response first, then assigned, then others)
     * @param {Array} conversations - Array of conversation objects
     * @returns {Array} Sorted conversations
     */
    sortConversationsByPriority(conversations) {
        return conversations.sort((a, b) => {
            const aNeedsResponse = this.conversationNeedsResponse(a);
            const bNeedsResponse = this.conversationNeedsResponse(b);
            
            if (aNeedsResponse && !bNeedsResponse) return -1;
            if (!aNeedsResponse && bNeedsResponse) return 1;
            
            if (a.assignedAgent === this.agentId && b.assignedAgent !== this.agentId) return -1;
            if (a.assignedAgent !== this.agentId && b.assignedAgent === this.agentId) return 1;
            
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
        const statusLabel = this.getQueueItemStatusLabel(needsResponse, isAssignedToMe, isUnassigned);
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
        if (isActive) return 'active-chat border-indigo-200';
        if (needsResponse) return 'bg-red-50 border-red-200 hover:bg-red-100';
        if (isAssignedToMe) return 'bg-blue-50 border-blue-100 hover:bg-blue-100';
        if (isUnassigned) return 'bg-white border-gray-200 hover:bg-gray-50';
        return 'bg-gray-50 border-gray-100 opacity-75';
    }

    /**
     * Get status label for queue item
     */
    getQueueItemStatusLabel(needsResponse, isAssignedToMe, isUnassigned) {
        if (needsResponse) return 'Needs Response';
        if (isAssignedToMe) return 'You';
        if (isUnassigned) return 'Unassigned';
        return 'Other Agent';
    }

    /**
     * Get status CSS classes for queue item
     */
    getQueueItemStatusCss(needsResponse, isAssignedToMe, isUnassigned) {
        if (needsResponse) return 'bg-red-100 text-red-700';
        if (isAssignedToMe) return 'bg-blue-100 text-blue-700';
        if (isUnassigned) return 'bg-yellow-100 text-yellow-700';
        return 'bg-gray-100 text-gray-600';
    }

    /**
     * Select and load a chat conversation
     * @param {string} conversationId - ID of conversation to select
     */
    async selectChat(conversationId) {
        this.currentChatId = conversationId;
        
        try {
            // Take ownership if unassigned
            await fetch(`${this.apiUrl}/api/conversations/${conversationId}/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: this.agentId })
            });

            // Load messages and check for suggestions
            await this.loadChatMessages(conversationId);
            await this.checkForPendingSuggestion(conversationId);
            
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
                       !msg.content.includes('Conversation assigned to agent');
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
     * Check for pending AI suggestions
     * @param {string} conversationId - ID of conversation
     */
    async checkForPendingSuggestion(conversationId) {
        try {
            const response = await fetch(`${this.apiUrl}/api/conversations/${conversationId}/pending-suggestion`);
            if (response.ok) {
                const data = await response.json();
                
                // Update suggestion if it's different (handles follow-up messages)
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
                this.checkForPendingSuggestion(this.currentChatId);
            }
        });
        
        // Listen for agent status updates
        this.socket.on('agent-status-update', (data) => {
            console.log('Agent status update:', data);
            // Update UI to show other agents' status if needed
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

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new AgentDashboard();
});

// Global function for onclick handlers (backward compatibility)
window.dashboard = null;