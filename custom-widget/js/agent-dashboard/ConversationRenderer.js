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
        
        // Direct state updates from WebSocket
    }

    /**
     * Check if a system message should be filtered out
     * @param {Object} message - Message object
     * @returns {boolean} True if message should be filtered
     */
    isSystemMessageFiltered(message) {
        if (message.sender !== 'system') return false;

        return message.content.includes('[Message pending agent response') ||
               message.content.includes('Agent has joined the conversation') ||
               message.content.includes('Conversation assigned to agent') ||
               message.content.includes('[Debug information stored]') ||
               (message.metadata && message.metadata.debugOnly) ||
               message.content.trim() === '';
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
        if (sender === 'system') {
            return 'S:';
        }
        return '';
    }

    /**
     * Render conversation queue with differential updates
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

        // Use differential updates instead of full re-render
        this.updateQueueDifferentially(queueContainer, sorted);
        console.log('✅ Queue updated differentially');
    }

    /**
     * Update queue using differential updates to minimize DOM manipulation
     * @param {Element} container - Queue container element
     * @param {Array} conversations - Sorted conversation array
     */
    updateQueueDifferentially(container, conversations) {
        const existingItems = Array.from(container.children);
        const existingIds = existingItems.map(item => item.dataset.conversationId);
        const newIds = conversations.map(conv => conv.id);

        let updateCount = 0;
        let insertCount = 0;
        let removeCount = 0;

        // Process each conversation
        conversations.forEach((conv, index) => {
            const existingIndex = existingIds.indexOf(conv.id);
            const newHtml = this.renderQueueItem(conv);

            if (existingIndex === -1) {
                // New conversation - insert
                const newElement = this.createElementFromHTML(newHtml);
                if (index < container.children.length) {
                    container.insertBefore(newElement, container.children[index]);
                } else {
                    container.appendChild(newElement);
                }
                insertCount++;
            } else {
                // Existing conversation - check if update needed
                const existingElement = existingItems[existingIndex];

                // Move to correct position if needed
                if (existingIndex !== index) {
                    if (index < container.children.length) {
                        container.insertBefore(existingElement, container.children[index]);
                    } else {
                        container.appendChild(existingElement);
                    }
                }

                // Check if content needs update by comparing HTML
                if (existingElement.outerHTML !== newHtml) {
                    existingElement.outerHTML = newHtml;
                    updateCount++;
                }
            }
        });

        // Remove conversations that no longer exist
        existingItems.forEach(item => {
            if (!newIds.includes(item.dataset.conversationId)) {
                item.remove();
                removeCount++;
            }
        });

        console.log(`📊 Differential update stats: ${updateCount} updated, ${insertCount} inserted, ${removeCount} removed`);
    }

    /**
     * Create DOM element from HTML string
     * @param {string} htmlString - HTML string
     * @returns {Element} DOM element
     */
    createElementFromHTML(htmlString) {
        const template = document.createElement('template');
        template.innerHTML = htmlString.trim();
        return template.content.firstChild;
    }

    /**
     * Preserve scroll position during DOM operations
     * @param {Element} container - Scrollable container element
     * @param {Function} operation - Function that modifies the DOM
     */
    preserveScrollPosition(container, operation) {
        // Save current scroll position
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;

        // Perform the DOM operation
        operation();

        // Restore scroll position after DOM settles
        requestAnimationFrame(() => {
            // Validate scroll position is still valid
            const newScrollHeight = container.scrollHeight;
            const maxScrollTop = Math.max(0, newScrollHeight - clientHeight);

            // Restore original position, or adjust if content shrunk
            const targetScrollTop = Math.min(scrollTop, maxScrollTop);

            container.scrollTop = targetScrollTop;

            console.log(`📍 Scroll position preserved: ${scrollTop} → ${targetScrollTop}`);
        });
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
     * Render category badge for conversation
     * @param {Object} categoryData - Category data object
     * @returns {string} HTML string for category badge
     */
    renderCategoryBadge(categoryData) {
        if (!categoryData || !categoryData.name) {
            return '';
        }

        const color = categoryData.color || '#6B7280';
        const isGlobal = categoryData.scope === 'global';
        const badgeClass = isGlobal
            ? 'bg-blue-100 text-blue-700 border border-blue-200'
            : 'bg-gray-100 text-gray-700 border border-gray-200';

        return `
            <div class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${badgeClass}"
                 title="Category: ${categoryData.name}${isGlobal ? ' (Global)' : ''}">
                <div class="w-2 h-2 rounded-full" style="background-color: ${color};"></div>
                <span class="max-w-16 truncate">${categoryData.name}</span>
                ${isGlobal ? '<i class="fas fa-globe text-xs"></i>' : ''}
            </div>
        `;
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
        
        // Calculate unseen indicator (shows 1 if conversation is unseen, 0 otherwise)
        const unseenCount = this.dashboard.uiHelpers.getUnseenIndicatorCount(conv, isAssignedToMe);
        const urgencyIcon = this.dashboard.uiHelpers.getUrgencyIcon(isUnseen, needsResponse, isAssignedToMe);
        const priorityClass = this.dashboard.uiHelpers.getPriorityAnimationClass(isUnseen, needsResponse, isAssignedToMe);

        return `
            <div class="chat-queue-item p-3 rounded-lg cursor-pointer border ${cssClass} ${archivedClass} ${priorityClass}"
                 data-conversation-id="${conv.id}"
                 onclick="dashboard.selectChat('${conv.id}')">
                <!-- Collapsed state indicator (only visible when sidebar is collapsed) -->
                <div class="collapsed-conversation-indicator">
                    <span class="conversation-number">${conv.userNumber || '?'}</span>
                    ${(unseenCount > 0 || isUnseen) ? '<div class="conversation-unread-dot"></div>' : ''}
                </div>

                <!-- Normal expanded content -->
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
                                ${unseenCount > 0 ? `<span class="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">${unseenCount}</span>` : ''}
                                ${conv.archived ? '<i class="fas fa-archive text-gray-400" title="Archived"></i>' : ''}
                                ${this.renderCategoryBadge(conv.categoryData)}
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
                        ${this.dashboard.uiHelpers.getTimeUrgencyIndicator(conv, needsResponse, isAssignedToMe)}
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
        console.log('📨 appendMessageToChat called with message:', message);

        const container = document.getElementById('chat-messages');
        if (!container) {
            console.log('⚠️ Chat messages container not found');
            return;
        }

        // Don't append system messages that should be filtered
        if (this.isSystemMessageFiltered(message)) {
            console.log('🚫 Message filtered out (system message)');
            return;
        }
        
        // Check if user is at the bottom before adding message
        const wasAtBottom = container.scrollTop >= (container.scrollHeight - container.clientHeight - 50); // 50px tolerance

        // Create message HTML and append
        const messageHtml = this.renderMessage(message);
        console.log('🎨 Rendered message HTML length:', messageHtml.length);

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = messageHtml;
        const messageElement = tempDiv.firstElementChild;

        if (messageElement) {
            container.appendChild(messageElement);
            console.log('✅ Message appended to chat, new message count:', container.children.length);
        } else {
            console.log('⚠️ No message element created from HTML');
        }

        // Smart scroll: only scroll to bottom if user was already at bottom
        if (wasAtBottom) {
            container.scrollTop = container.scrollHeight;
            console.log('📜 Auto-scrolled to bottom');
        } else {
            console.log('📜 Staying at current scroll position');
        }
        
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
        return messages.filter(msg => !this.isSystemMessageFiltered(msg));
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
            <div class="flex ${(isCustomer || isSystem) ? '' : 'justify-end'} mb-4" data-message-id="${msg.id}">
                <div class="max-w-[70%]">
                    <div class="${this.getMessageBubbleCss(isCustomer, isAI, isSystem, msg)}" style="line-height: 1.6;">
                        ${formattedContent}
                    </div>
                    <div class="text-xs text-gray-500 mt-1 ${(isCustomer || isSystem) ? '' : 'text-right'}">
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

        // Handle AI suggestion object format
        let content = text;
        if (typeof text === 'object' && text.response) {
            content = text.response;
        } else if (typeof text === 'object') {
            content = String(text);
        }

        // Ensure content is a string
        if (typeof content !== 'string') {
            content = String(content);
        }

        return content
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

        // Render message HTML
        const messageHtml = this.renderMessage(message);
        
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
            
            // CRITICAL FIX: Mark conversation as seen when receiving real-time messages for active conversation
            // This ensures the conversation doesn't show as "unseen" when agent is actively viewing it
            this.markConversationAsSeen(currentChatId);
        }
    }

    /**
     * Update conversation preview in queue - Now with persistent caching
     * @param {string} conversationId - Conversation ID
     * @param {Object} message - Message object with content and sender
     */
    updateConversationPreview(conversationId, message) {
        console.log(`🔄 SIMPLIFIED: Updating preview for ${conversationId}:`, {
            sender: message.sender,
            content: String(message.content || '').substring(0, 50) + '...'
        });
        
        // Update DOM preview text and refresh styling
        // State updates are handled by the main WebSocket event handler
        this.applyPreviewUpdate(conversationId, message);
        this.refreshConversationStyling(conversationId);
    }
    
    /**
     * Apply a single preview update to DOM
     * @param {string} conversationId - Conversation ID
     * @param {Object} message - Message object with content and sender
     */
    applyPreviewUpdate(conversationId, message, retryCount = 0) {
        const maxRetries = 3;
        const retryDelay = 100; // 100ms delay between retries
        
        console.log(`🔍 DEBUG: Attempting to update preview for ${conversationId} (retry: ${retryCount})`, {
            sender: message.sender,
            content: String(message.content || '').substring(0, 50)
        });
        
        const queueItem = document.querySelector(`[data-conversation-id="${conversationId}"]`);
        if (!queueItem) {
            console.log(`❌ DEBUG: No queue item found for ${conversationId}`);
            return; // Queue item not visible, will be applied after next render
        }

        console.log(`✅ DEBUG: Found queue item for ${conversationId}`);
        const messagePreview = queueItem.querySelector('.message-preview');
        if (!messagePreview) {
            console.log(`❌ DEBUG: No message preview element found for ${conversationId} (retry: ${retryCount})`);
            console.log(`🔍 DEBUG: Queue item HTML:`, queueItem.innerHTML);
            
            // Retry if DOM is not ready yet and we haven't exceeded max retries
            if (retryCount < maxRetries) {
                console.log(`🔄 DEBUG: Retrying preview update for ${conversationId} in ${retryDelay}ms`);
                setTimeout(() => {
                    this.applyPreviewUpdate(conversationId, message, retryCount + 1);
                }, retryDelay);
                return;
            }
            
            console.log(`❌ DEBUG: Max retries exceeded for ${conversationId}, giving up`);
            return; // No preview element found after retries
        }

        console.log(`✅ DEBUG: Found message preview element for ${conversationId} (retry: ${retryCount})`);

        // Get sender prefix and content
        const senderPrefix = this.getSenderPrefix(message.sender);
        const content = String(message.content || '');
        const fullPreview = senderPrefix ? `${senderPrefix} ${content}` : content;
        
        console.log(`🔍 DEBUG: Preview will be set to: "${fullPreview}"`);
        
        // Update preview text
        messagePreview.textContent = fullPreview.length > 50 ? 
            fullPreview.substring(0, 50) + '...' : fullPreview;
            
        console.log(`✅ Preview updated for ${conversationId}: ${fullPreview.substring(0, 30)}... (after ${retryCount} retries)`);
    }
    
    // State is updated directly via WebSocket
    
    /**
     * Mark conversation as seen by current agent
     * Updates localStorage with current timestamp and immediately refreshes UI
     * @param {string} conversationId - ID of conversation to mark as seen
     */
    async markConversationAsSeen(conversationId) {
        const timestamp = new Date().toISOString();
        localStorage.setItem(`lastSeen_${conversationId}`, timestamp);
        console.log(`👁️ Marking conversation ${conversationId} as seen at ${timestamp}`);

        try {
            // Make API call to mark messages as seen in the backend
            const response = await fetch(`/api/conversations/${conversationId}/mark-seen`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    agentId: this.agentId
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Successfully marked conversation ${conversationId} as seen in backend:`, result);
            } else {
                console.error(`❌ Failed to mark conversation ${conversationId} as seen in backend:`, response.status);
            }
        } catch (error) {
            console.error(`💥 Error marking conversation ${conversationId} as seen:`, error);
        }

        // Trigger immediate styling refresh for real-time updates without full reload
        this.refreshConversationStyling(conversationId);
    }

    /**
     * Refresh visual styling for a single conversation item in the queue
     * Updates CSS classes to reflect current seen/unseen state without full reload
     * @param {string} conversationId - Conversation ID to refresh
     */
    refreshConversationStyling(conversationId) {
        const queueItem = document.querySelector(`[data-conversation-id="${conversationId}"]`);
        if (!queueItem) {
            console.log(`⚠️ Queue item not found for ${conversationId}, cannot refresh styling`);
            return false;
        }

        // Get the conversation data from the modern loader
        const conversationData = this.dashboard.modernConversationLoader.getConversations();
        const conversation = conversationData.all.find(conv => conv.id === conversationId);

        if (!conversation) {
            console.log(`⚠️ Conversation data not found for ${conversationId}, cannot refresh styling`);
            return false;
        }

        // Calculate current state values
        const currentChatId = this.stateManager.getCurrentChatId();
        const isActive = conversation.id === currentChatId;
        const needsResponse = !!(conversation.lastMessage &&
                                conversation.lastMessage.metadata &&
                                conversation.lastMessage.metadata.pendingAgent === true);
        const isAssignedToMe = conversation.assignedAgent === this.dashboard.agentId;
        const isUnassigned = !conversation.assignedAgent;
        const isUnseen = this.dashboard.uiHelpers.conversationIsUnseen(conversation);

        // Get updated CSS classes
        const newCssClass = this.dashboard.uiHelpers.getQueueItemCssClass(isActive, needsResponse, isAssignedToMe, isUnassigned, isUnseen);
        const newStatusLabel = this.dashboard.uiHelpers.getQueueItemStatusLabel(needsResponse, isAssignedToMe, isUnassigned, isUnseen, conversation);
        const newStatusCss = this.dashboard.uiHelpers.getQueueItemStatusCss(needsResponse, isAssignedToMe, isUnassigned, isUnseen);

        // Update the queue item's CSS classes while preserving base layout classes
        queueItem.className = `chat-queue-item p-3 rounded-lg cursor-pointer border ${newCssClass}`;

        // Update status label and styling - use correct selector for status element
        const statusElement = queueItem.querySelector('.flex.flex-col.items-end.gap-1 span:first-child');
        if (statusElement) {
            statusElement.textContent = newStatusLabel;
            statusElement.className = `text-xs px-2 py-1 rounded ${newStatusCss}`;
        }

        // Update unseen count badge - remove if conversation is now seen
        const unseenCount = this.dashboard.uiHelpers.getUnseenIndicatorCount(conversation, isAssignedToMe);
        const unseenBadge = queueItem.querySelector('.bg-red-600.rounded-full');

        if (unseenCount === 0 && unseenBadge) {
            // Remove unseen badge immediately when conversation is marked as seen
            unseenBadge.remove();
            console.log(`🏷️ Removed unseen badge for ${conversationId}`);
        } else if (unseenCount > 0 && !unseenBadge) {
            // Add unseen badge if needed (rare case, but for completeness)
            const userNumberSpan = queueItem.querySelector('.font-medium.text-sm .flex.items-center.gap-2');
            if (userNumberSpan) {
                const badge = document.createElement('span');
                badge.className = 'inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full';
                badge.textContent = unseenCount.toString();
                userNumberSpan.appendChild(badge);
                console.log(`🏷️ Added unseen badge for ${conversationId}`);
            }
        }

        console.log(`✨ Refreshed styling for ${conversationId}: isUnseen=${isUnseen}, unseenCount=${unseenCount}, CSS=${newCssClass}`);
        return true;
    }

    /**
     * Reorder conversation list to move a specific conversation to the top
     * This provides immediate visual feedback when messages are sent/received
     * @param {string} conversationId - ID of conversation to move to top
     */
    reorderConversationList(conversationId) {
        const container = document.getElementById('chat-queue');
        if (!container) {
            console.log('⚠️ Chat queue container not found');
            return;
        }

        const targetItem = container.querySelector(`[data-conversation-id="${conversationId}"]`);
        if (!targetItem) {
            console.log(`⚠️ Conversation item not found for ${conversationId}`);
            return;
        }

        // Preserve scroll position during reorder
        this.preserveScrollPosition(container, () => {
            // Remove the item from its current position
            const parent = targetItem.parentElement;
            parent.removeChild(targetItem);

            // Insert at the beginning (after any pinned items if they exist)
            const firstChild = parent.firstChild;
            if (firstChild) {
                parent.insertBefore(targetItem, firstChild);
            } else {
                parent.appendChild(targetItem);
            }
        });

        // Update the lastMessage timestamp in state to reflect the new order
        const conversationData = this.dashboard.modernConversationLoader.getConversations();
        const conversation = conversationData.all.find(conv => conv.id === conversationId);
        if (conversation && conversation.lastMessage) {
            conversation.lastMessage.createdAt = new Date().toISOString();
        }

        console.log(`🔝 Moved conversation ${conversationId} to top of list`);
    }
}