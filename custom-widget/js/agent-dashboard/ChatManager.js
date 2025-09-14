/**
 * Chat Manager for Agent Dashboard
 * Handles all chat and messaging operations
 * Extracted from agent-dashboard.js for better modularity
 */

// Import UI helpers
import { UIHelpers } from './UIHelpers.js';

export class ChatManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.stateManager = dashboard.stateManager;
        this.apiManager = dashboard.apiManager;
        this.conversationRenderer = dashboard.conversationRenderer;
        this.systemMode = dashboard.systemMode;
    }

    /**
     * Select and load a chat conversation with AI suggestion polling cancellation
     * 
     * This method safely switches between conversations by:
     * - Canceling any ongoing AI suggestion polling for the previous conversation
     * - Loading messages and conversation data for the new conversation
     * - Setting up the UI for the selected conversation
     * - Checking for existing pending suggestions in HITL mode
     * 
     * @param {string} conversationId - ID of conversation to select
     * @returns {Promise<void>} Resolves when conversation is loaded and UI is updated
     * 
     * @example
     * // Switch to a different conversation
     * await chatManager.selectChat('conversation-456');
     */
    async selectChat(conversationId) {
        // Cancel any ongoing AI suggestion polling when switching conversations
        if (this.dashboard.currentPollingId) {
            console.log('🛑 Canceling AI suggestion polling when switching conversations');
            this.dashboard.currentPollingId = null;
        }
        
        this.stateManager.setCurrentChatId(conversationId);
        
        // Mark conversation as seen immediately when selected
        this.conversationRenderer.markConversationAsSeen(conversationId);
        
        try {
            // Load messages first (this also updates conversation data)
            await this.loadChatMessages(conversationId);
            
            // Always check for pending suggestions in HITL mode 
            // The API will return 404 if no suggestion exists, which is fine
            if (this.dashboard.systemMode === 'hitl') {
                await this.checkForPendingSuggestion(conversationId);
            }
            
            // Show chat interface
            this.showChatInterface(conversationId);

            // Refresh conversation styling without full reload to preserve scroll position
            this.conversationRenderer.refreshConversationStyling(conversationId);
        } catch (error) {
            console.error('Error selecting chat:', error);
        }
    }

    /**
     * Show chat interface elements
     * @param {string} conversationId - ID of current conversation
     */
    showChatInterface(conversationId) {
        this.dashboard.hideElement('no-chat-selected');
        this.dashboard.showElement('chat-header');
        this.dashboard.showElement('chat-messages');
        this.dashboard.showElement('message-input-area');
        
        // Update header with conversation info
        const conv = this.stateManager.getConversation(conversationId);
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
            const data = await this.apiManager.loadConversationMessages(conversationId);
            
            this.stateManager.setConversation(conversationId, data);
            this.conversationRenderer.renderMessages(data.messages);
        } catch (error) {
            console.error('Error loading messages:', error);
        }
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
            this.dashboard.showToast('Please enter a message before sending', 'warning');
            input.focus();
            return;
        }
        
        if (!this.stateManager.getCurrentChatId()) {
            this.dashboard.showToast('Please select a conversation first', 'warning');
            return;
        }
        
        // Determine suggestion action
        const suggestionAction = this.stateManager.getCurrentSuggestion() ? 
            (message === this.stateManager.getCurrentSuggestion() ? 'as-is' : 'edited') : 
            'from-scratch';
        
        await this.sendAgentResponse(message, suggestionAction);
    }

    /**
     * Send agent response message with AI suggestion polling cancellation
     * 
     * This method sends an agent's response while ensuring clean state management:
     * - Cancels any ongoing AI suggestion polling since the agent is now responding
     * - Disables the UI during message sending to prevent duplicate sends
     * - Sends the message with proper suggestion attribution metadata
     * - Refreshes the conversation view and checks for new suggestions
     * 
     * @param {string} message - Message text to send
     * @param {string} suggestionAction - Type of suggestion action:
     *   - 'as-is': Agent sent AI suggestion unchanged
     *   - 'edited': Agent modified AI suggestion before sending
     *   - 'from-scratch': Agent wrote custom message without using AI suggestion
     * @returns {Promise<void>} Resolves when message is sent and UI is updated
     * 
     * @example
     * // Send AI suggestion as-is
     * await chatManager.sendAgentResponse('Hello! How can I help?', 'as-is');
     * 
     * // Send edited suggestion
     * await chatManager.sendAgentResponse('Hi there! How may I assist you?', 'edited');
     * 
     * // Send custom response
     * await chatManager.sendAgentResponse('Thanks for contacting us!', 'from-scratch');
     */
    async sendAgentResponse(message, suggestionAction) {
        if (!this.stateManager.getCurrentChatId()) return;
        
        // Cancel any ongoing AI suggestion polling when sending a message
        if (this.dashboard.currentPollingId) {
            console.log('🛑 Canceling AI suggestion polling when sending agent response');
            this.dashboard.currentPollingId = null;
        }
        
        const input = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');
        
        try {
            // Disable UI
            if (input) input.disabled = true;
            if (sendButton) sendButton.disabled = true;
            
            // Send message
            const response = await this.apiManager.sendAgentMessage(
                this.stateManager.getCurrentChatId(), 
                message, 
                suggestionAction,
                {} // Empty metadata object
            );
            
            if (response.success === true) {
                // Clear input and reset UI
                if (input) {
                    input.value = '';
                    this.resizeTextarea();
                }
                
                // Hide suggestion panel
                this.hideAISuggestion();
                
                // Refresh messages to show the sent message
                await this.loadChatMessages(this.stateManager.getCurrentChatId());

                // Move conversation to top of list for immediate visual feedback
                this.conversationRenderer.reorderConversationList(this.stateManager.getCurrentChatId());

                // Show confirmation
                this.dashboard.showToast('Message sent successfully', 'success');
                
                // If in HITL mode, check for new pending suggestions
                if (this.dashboard.systemMode === 'hitl') {
                    setTimeout(() => {
                        this.checkForPendingSuggestion(this.stateManager.getCurrentChatId());
                    }, 1500); // Give backend time to generate new suggestion
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.dashboard.showToast('Failed to send message. Please try again.', 'error');
        } finally {
            // Re-enable UI
            if (input) input.disabled = false;
            if (sendButton) sendButton.disabled = false;
            if (input) input.focus();
        }
    }

    /**
     * Get AI assistance for current conversation
     */
    async getAIAssistance() {
        if (!this.stateManager.getCurrentChatId()) return;
        
        try {
            const data = await this.apiManager.getAISuggestion(this.stateManager.getCurrentChatId());
            if (data) {
                this.showAISuggestion(data.suggestion, data.confidence);
            }
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
            const data = await this.apiManager.getPendingSuggestion(conversationId);
            
            if (data) {
                // HITL mode: Show suggestion for human validation
                if (!this.stateManager.getCurrentSuggestion() || this.stateManager.getCurrentSuggestion() !== data.suggestion) {
                    this.showAISuggestion(data.suggestion, data.confidence, data.metadata || {});
                }
            } else {
                // No pending suggestion - this is normal
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
            suggestionText.innerHTML = this.conversationRenderer.markdownToHtml(suggestion);
        }
        
        // Update header based on metadata
        const headerText = metadata.messageCount > 1 
            ? `AI Suggestion (responding to ${metadata.messageCount} messages)`
            : 'AI Suggestion';
            
        const headerElement = document.querySelector('#ai-suggestion-panel .font-semibold');
        if (headerElement) {
            headerElement.textContent = headerText;
        }
        
        // Re-enable action buttons (in case they were disabled during loading)
        const actionButtons = document.querySelectorAll('#ai-suggestion-panel button');
        actionButtons.forEach(button => {
            button.disabled = false;
            button.style.opacity = '1';
        });
        
        if (panel) {
            panel.classList.remove('hidden');
        }
        
        this.stateManager.setCurrentSuggestion(suggestion);
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
        
        this.stateManager.setCurrentSuggestion(null);
    }

    /**
     * Show AI suggestion loading state
     */
    showAISuggestionLoading() {
        const suggestionText = document.getElementById('ai-suggestion-text');
        const panel = document.getElementById('ai-suggestion-panel');
        
        if (suggestionText) {
            suggestionText.innerHTML = `
                <div class="flex items-center justify-center space-x-3 py-4">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                    <span class="text-gray-600">Generating AI suggestion...</span>
                </div>
            `;
        }
        
        // Update header for loading state
        const headerElement = document.querySelector('#ai-suggestion-panel .font-semibold');
        if (headerElement) {
            headerElement.textContent = 'AI Suggestion (Loading...)';
        }
        
        // Hide action buttons during loading
        const actionButtons = document.querySelectorAll('#ai-suggestion-panel button');
        actionButtons.forEach(button => {
            button.disabled = true;
            button.style.opacity = '0.5';
        });
        
        if (panel) {
            panel.classList.remove('hidden');
        }
        
        console.log('🤖 AI suggestion loading state shown');
    }

    /**
     * Send AI suggestion as-is
     */
    async sendAsIs() {
        if (!this.stateManager.getCurrentSuggestion()) return;
        await this.sendAgentResponse(this.stateManager.getCurrentSuggestion(), 'as-is');
    }

    /**
     * Edit AI suggestion in input field
     */
    editSuggestion() {
        if (!this.stateManager.getCurrentSuggestion()) return;
        
        const input = document.getElementById('message-input');
        if (input) {
            input.value = this.stateManager.getCurrentSuggestion();
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
     * Update element text content safely
     * @param {string} elementId - Element ID
     * @param {string} text - Text content
     */
    updateElementText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    }

    /**
     * Auto-resize textarea based on content
     */
    resizeTextarea() {
        const textarea = document.getElementById('message-input');
        if (!textarea) return;
        
        // Store scroll position
        const scrollTop = textarea.scrollTop;
        
        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = 'auto';
        
        // Calculate new height
        const newHeight = Math.min(Math.max(textarea.scrollHeight, 38), 300); // Min 38px (single line), Max 300px
        
        // Apply new height
        textarea.style.height = newHeight + 'px';
        
        // Restore scroll position if content overflows
        if (textarea.scrollHeight > 300) {
            textarea.scrollTop = scrollTop;
        }
    }

    /**
     * Get sender label for message
     * @param {boolean} isAI - Is AI message
     * @param {boolean} isAgent - Is agent message
     * @param {boolean} isSystem - Is system message
     * @param {Object} msg - Message object
     * @returns {string} Sender label
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
}