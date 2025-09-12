/**
 * Conversation Renderer for Agent Dashboard
 * Handles all conversation and message rendering logic
 * Extracted from agent-dashboard.js for better modularity
 */

// Import utility functions
import {
    getMessageSenderLabel
} from './ui/utils.js';

// Import UI helpers for UI utility functions
import { UIHelpers } from './UIHelpers.js';

export class ConversationRenderer {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.agentId = dashboard.agentId;
        this.stateManager = dashboard.stateManager;
    }

    /**
     * Get sender prefix for message preview
     * @param {string} sender - Message sender (visitor, agent, ai, admin)
     * @returns {string} Prefix string
     */
    getSenderPrefix(sender) {
        if (sender === 'visitor' || sender === 'customer') {
            return 'U:';
        }
        if (sender === 'agent' || sender === 'admin' || sender === 'ai') {
            return 'A:';
        }
        return '';
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
     * Render individual queue item (conversation in the list)
     * @param {Object} conv - Conversation object
     * @returns {string} HTML string for queue item
     */
    renderQueueItem(conv) {
        const isAssignedToMe = conv.assignedAgent === this.agentId;
        const isUnassigned = !conv.assignedAgent;
        const isActive = conv.id === this.stateManager.getCurrentChatId();
        const needsResponse = this.conversationNeedsResponse(conv);
        const isUnseen = this.dashboard.uiHelpers.conversationIsUnseen(conv);
        
        const cssClass = this.dashboard.uiHelpers.getQueueItemCssClass(isActive, needsResponse, isAssignedToMe, isUnassigned, isUnseen);
        const statusLabel = this.dashboard.uiHelpers.getQueueItemStatusLabel(needsResponse, isAssignedToMe, isUnassigned, isUnseen, conv);
        const statusCss = this.dashboard.uiHelpers.getQueueItemStatusCss(needsResponse, isAssignedToMe, isUnassigned, isUnseen);
        
        const isSelected = this.stateManager.getSelectedConversations().has(conv.id);
        const archivedClass = conv.archived ? 'opacity-75 bg-gray-50' : '';
        
        // Calculate unread indicator
        const unreadCount = this.dashboard.uiHelpers.getUnreadMessageCount(conv, isAssignedToMe);
        const urgencyIcon = this.dashboard.uiHelpers.getUrgencyIcon(isUnseen, needsResponse, isAssignedToMe);
        const priorityClass = this.dashboard.uiHelpers.getPriorityAnimationClass(isUnseen, needsResponse, isAssignedToMe);

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
                                ${unreadCount > 0 ? `<span class="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">${unreadCount}</span>` : ''}
                                ${conv.archived ? '<i class="fas fa-archive text-gray-400" title="Archived"></i>' : ''}
                            </div>
                            <div class="text-xs text-gray-500">
                                ${UIHelpers.formatConversationDate(conv.startedAt)}
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col items-end gap-1">
                        <span class="text-xs px-2 py-1 rounded ${statusCss}">
                            ${statusLabel}
                        </span>
                        ${this.dashboard.uiHelpers.getTimeUrgencyIndicator(conv)}
                    </div>
                </div>
                <div class="text-sm truncate text-gray-600 message-preview">
                    ${conv.lastMessage ? 
                        this.getSenderPrefix(conv.lastMessage.sender) + ' ' + UIHelpers.escapeHtml(conv.lastMessage.content) : 
                        'No messages yet'}
                </div>
                
                <div class="text-xs mt-2">
                    ${this.dashboard.uiHelpers.renderAssignmentButtons(isAssignedToMe, isUnassigned, conv.id, conv.archived)}
                </div>
            </div>
        `;
    }

    /**
     * Render chat messages in the message container
     * @param {Array} messages - Array of message objects
     */
    renderMessages(messages) {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        
        const filteredMessages = this.filterSystemMessages(messages);
        
        container.innerHTML = filteredMessages.map(msg => this.renderMessage(msg)).join('');
        container.scrollTop = container.scrollHeight;
        
        // Update conversation preview with the last message
        if (filteredMessages.length > 0) {
            const lastMessage = filteredMessages[filteredMessages.length - 1];
            const currentChatId = this.stateManager.getCurrentChatId();
            if (currentChatId) {
                this.updateConversationPreview(currentChatId, lastMessage);
            }
        }
    }

    /**
     * Append a single message to the chat UI without reloading all messages
     * @param {Object} message - Message object to append
     */
    appendMessageToChat(message) {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        
        // Don't append system messages that should be filtered
        if (message.sender === 'system') {
            const shouldFilter = message.content.includes('[Message pending agent response') ||
                               message.content.includes('Agent has joined the conversation') ||
                               message.content.includes('Conversation assigned to agent') ||
                               message.content.includes('[Debug information stored]') ||
                               (message.metadata && message.metadata.debugOnly) ||
                               message.content.trim() === '';
            if (shouldFilter) return;
        }
        
        // Create message HTML and append
        const messageHtml = this.renderMessage(message);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = messageHtml;
        container.appendChild(tempDiv.firstElementChild);
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
        
        // Update conversation preview immediately
        const currentChatId = this.stateManager.getCurrentChatId();
        if (currentChatId) {
            this.updateConversationPreview(currentChatId, message);
        }
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
            UIHelpers.escapeHtml(msg.content);
        
        return `
            <div class="flex ${isCustomer ? '' : 'justify-end'} mb-4" data-message-id="${msg.id}">
                <div class="max-w-[70%]">
                    <div class="${this.getMessageBubbleCss(isCustomer, isAI, isSystem, msg)}" style="line-height: 1.6;">
                        ${formattedContent}
                    </div>
                    <div class="text-xs text-gray-500 mt-1 ${isCustomer ? '' : 'text-right'}">
                        ${getMessageSenderLabel(isAI, isAgent, isSystem, msg)} • 
                        ${new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get CSS classes for message bubble
     * @param {boolean} isCustomer - Is customer message
     * @param {boolean} isAI - Is AI message
     * @param {boolean} isSystem - Is system message
     * @param {Object} msg - Message object (optional)
     * @returns {string} CSS classes
     */
    getMessageBubbleCss(isCustomer, isAI, isSystem, msg = null) {
        const baseClass = 'px-4 py-3 rounded-2xl shadow-sm max-w-full break-words';
        
        if (isCustomer) return `${baseClass} bg-white border border-gray-200 text-gray-800`;
        if (isAI) return `${baseClass} bg-purple-50 border border-purple-200 text-purple-900`;
        if (isSystem) return `${baseClass} bg-yellow-50 border border-yellow-200 text-yellow-900`;
        
        // Standard styling for all agent messages - no special color coding needed
        return `${baseClass} bg-indigo-500 text-white`;
    }

    /**
     * Convert markdown to HTML
     * @param {string} text - Markdown text
     * @returns {string} HTML string
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
            .replace(/\n/g, '<br>');
    }

    /**
     * Append message to chat in real-time (immediate display)
     * @param {Object} messageData - WebSocket message data
     */
    appendMessageRealTime(messageData) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) {
            console.warn('⚠️ Messages container not found, skipping real-time append');
            return;
        }

        console.log('✅ FIXED: Using correct container #chat-messages for real-time messages');

        // Debug: Log the raw WebSocket message data
        console.log('🐛 Raw WebSocket message data:', JSON.stringify(messageData, null, 2));

        // Debug: Check container visibility and state
        const isHidden = messagesContainer.classList.contains('hidden');
        console.log('📊 Container state:', {
            exists: !!messagesContainer,
            isVisible: messagesContainer.style.display !== 'none',
            hasHiddenClass: isHidden,
            hasClass: messagesContainer.className,
            childCount: messagesContainer.children.length,
            scrollHeight: messagesContainer.scrollHeight
        });

        // CRITICAL FIX: Ensure container is visible for real-time messages
        if (isHidden) {
            console.log('🔧 CRITICAL: Container was hidden, making it visible for real-time message');
            messagesContainer.classList.remove('hidden');
            
            // Also ensure the parent elements are visible
            const noChat = document.getElementById('no-chat-selected');
            if (noChat) {
                noChat.style.display = 'none';
            }
            
            // Show other required elements
            const chatHeader = document.getElementById('chat-header');
            const messageInputArea = document.getElementById('message-input-area');
            if (chatHeader) chatHeader.classList.remove('hidden');
            if (messageInputArea) messageInputArea.classList.remove('hidden');
        }

        // Check if message already exists to prevent duplicates
        // Extract the message ID from nested structure
        const messageId = (messageData.message && messageData.message.id) || messageData.id;
        
        // First check by ID
        const existingMessageById = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (existingMessageById) {
            console.log('📨 Message already exists by ID, skipping duplicate:', messageId);
            return;
        }
        
        // Also check by content and timestamp to catch edge cases
        const messageContent = messageData.message ? messageData.message.content : (messageData.content || '');
        const messageTimestamp = messageData.message ? messageData.message.timestamp : messageData.timestamp;
        const existingMessages = messagesContainer.querySelectorAll('[data-message-id]');
        
        for (const existing of existingMessages) {
            const existingContent = existing.querySelector('div > div')?.textContent?.trim();
            const existingTime = existing.querySelector('.text-xs')?.textContent;
            
            if (existingContent === messageContent && existingTime && existingTime.includes(new Date(messageTimestamp).toLocaleTimeString())) {
                console.log('📨 Message already exists by content/time, skipping duplicate');
                return;
            }
        }

        // Create message object compatible with renderMessage
        // WebSocket sends nested structure: { message: { content: "...", sender: "..." } }
        let content = '';
        let sender = '';
        
        // Extract from nested message object (primary structure)
        if (messageData.message && typeof messageData.message === 'object') {
            content = messageData.message.content || '';
            sender = messageData.message.sender || '';
        }
        // Fallback to direct properties (backup structure)
        else {
            if (typeof messageData.content === 'string') {
                content = messageData.content;
            } else if (typeof messageData.content === 'object' && messageData.content) {
                content = messageData.content.text || messageData.content.content || messageData.content.message || JSON.stringify(messageData.content);
            } else {
                content = messageData.message || messageData.text || '';
            }
            sender = messageData.sender || '';
        }

        // Normalize sender type - WebSocket might send 'customer' but renderMessage expects 'visitor'
        if (sender === 'customer') {
            sender = 'visitor';
        }

        const message = {
            id: (messageData.message && messageData.message.id) || messageData.id || `temp-${Date.now()}`,
            content: String(content),
            sender: sender,
            timestamp: (messageData.message && messageData.message.timestamp) || messageData.timestamp || new Date().toISOString(),
            metadata: (messageData.message && messageData.message.metadata) || messageData.metadata || {}
        };

        console.log('🐛 DEBUG: Processed message for rendering:', JSON.stringify(message, null, 2));

        // Render message HTML
        const messageHtml = this.renderMessage(message);
        console.log('🐛 DEBUG: Rendered HTML:', messageHtml);
        
        // Append to messages container
        messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
        
        // Scroll to bottom to show new message
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Debug: Verify message was actually added
        console.log('📊 After append container state:', {
            childCount: messagesContainer.children.length,
            scrollHeight: messagesContainer.scrollHeight,
            lastChild: messagesContainer.lastElementChild?.getAttribute('data-message-id')
        });
        
        console.log('⚡ Message appended in real-time:', { 
            sender: message.sender, 
            content: String(message.content || '').substring(0, 50) + '...',
            messageId: message.id
        });
        
        // Update conversation preview immediately
        const currentChatId = this.stateManager.getCurrentChatId();
        if (currentChatId) {
            this.updateConversationPreview(currentChatId, message);
        }
    }

    /**
     * Update conversation preview in queue - Simple, reliable method
     * @param {string} conversationId - Conversation ID
     * @param {Object} message - Message object with content and sender
     */
    updateConversationPreview(conversationId, message) {
        const queueItem = document.querySelector(`[data-conversation-id="${conversationId}"]`);
        if (!queueItem) {
            return; // Queue item not visible, no update needed
        }

        const messagePreview = queueItem.querySelector('.message-preview');
        if (!messagePreview) {
            return; // No preview element found
        }

        // Get sender prefix and content
        const senderPrefix = this.getSenderPrefix(message.sender);
        const content = String(message.content || '');
        const fullPreview = senderPrefix ? `${senderPrefix} ${content}` : content;
        
        // Update preview text
        messagePreview.textContent = fullPreview.length > 50 ? 
            fullPreview.substring(0, 50) + '...' : fullPreview;
    }
}