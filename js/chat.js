/**
 * Chat Interface Controller
 * Handles authentication, messaging, and AI suggestion interactions
 */
class ChatController {
    constructor() {
        this.messagesContainer = document.getElementById('messages-container');
        this.messageTextarea = document.getElementById('message-textarea');
        this.actionButtons = document.getElementById('action-buttons');
        this.editArea = document.getElementById('edit-area');
        this.aiSuggestionText = document.getElementById('ai-suggestion-text');
        this.aiOverlay = document.getElementById('ai-overlay');
        
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        this.scrollToBottom();
    }

    /**
     * Check if user is authenticated
     */
    async checkAuth() {
        try {
            const response = await fetch('/api/check-auth');
            if (response.ok) {
                document.getElementById('mainContent').style.display = 'block';
            } else {
                this.showNotification('Please log in to continue', 'error');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.showNotification('Connection error. Please check your internet connection.', 'error');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 3000);
        }
    }

    /**
     * Log out user and redirect to login
     */
    async logout() {
        try {
            const response = await fetch('/api/logout', { method: 'POST' });
            if (response.ok) {
                this.showNotification('Logged out successfully', 'success');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 1000);
            } else {
                throw new Error('Logout failed');
            }
        } catch (error) {
            console.error('Logout error:', error);
            this.showNotification('Logout failed. Redirecting anyway...', 'warning');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
        }
    }

    /**
     * Setup event listeners for textarea auto-resize
     */
    setupEventListeners() {
        if (this.messageTextarea) {
            this.messageTextarea.addEventListener('input', () => {
                this.messageTextarea.style.height = 'auto';
                this.messageTextarea.style.height = (this.messageTextarea.scrollHeight) + 'px';
            });
        }
    }

    /**
     * Scroll messages container to bottom
     */
    scrollToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }

    /**
     * Send AI suggestion as-is without editing
     */
    sendAsIs() {
        const aiText = this.aiSuggestionText.textContent;
        this.sendMessageWithAnimation(aiText);
        this.hideAISuggestionOverlay();
    }

    /**
     * Open edit mode with AI suggestion pre-filled
     */
    editSuggestion() {
        const aiText = this.aiSuggestionText.textContent;
        this.messageTextarea.value = aiText;
        this.showEditArea();
        this.messageTextarea.focus();
    }

    /**
     * Open edit mode with empty textarea
     */
    writeFromScratch() {
        this.messageTextarea.value = '';
        this.showEditArea();
        this.messageTextarea.focus();
    }

    /**
     * Cancel editing and return to action buttons
     */
    cancelEdit() {
        this.hideEditArea();
    }

    /**
     * Send the edited/custom message
     */
    sendMessage() {
        const messageText = this.messageTextarea.value.trim();
        
        if (messageText === '') {
            this.showNotification('Please enter a message', 'error');
            return;
        }
        
        this.sendMessageWithAnimation(messageText);
        this.hideAISuggestionOverlay();
        this.hideEditArea();
    }

    /**
     * Show edit area and hide action buttons
     */
    showEditArea() {
        this.actionButtons.classList.add('hidden');
        this.editArea.classList.remove('hidden');
    }

    /**
     * Hide edit area and show action buttons
     */
    hideEditArea() {
        this.actionButtons.classList.remove('hidden');
        this.editArea.classList.add('hidden');
    }

    /**
     * Hide the AI suggestion overlay
     */
    hideAISuggestionOverlay() {
        if (this.aiOverlay) {
            this.aiOverlay.style.display = 'none';
        }
    }

    /**
     * Send message with typing animation
     * @param {string} messageText - The message to send
     */
    sendMessageWithAnimation(messageText) {
        // Show typing indicator
        const sendingDiv = this.createTypingIndicator();
        this.messagesContainer.appendChild(sendingDiv);
        this.scrollToBottom();
        
        // After 1.5 seconds, replace with actual message
        setTimeout(() => {
            sendingDiv.remove();
            const messageDiv = this.createMessageElement(messageText);
            this.messagesContainer.appendChild(messageDiv);
            this.scrollToBottom();
            this.showNotification('Message sent successfully!', 'success');
        }, 1500);
    }

    /**
     * Create typing indicator element
     * @returns {HTMLElement} The typing indicator element
     */
    createTypingIndicator() {
        const sendingDiv = document.createElement('div');
        sendingDiv.className = 'mb-4 flex items-start justify-end';
        sendingDiv.innerHTML = `
            <div class="text-right">
                <div class="bg-indigo-100 rounded-lg p-3 inline-block max-w-[80%]">
                    <div class="flex items-center">
                        <span class="typing-indicator"></span>
                        <span class="typing-indicator"></span>
                        <span class="typing-indicator"></span>
                    </div>
                </div>
            </div>
            <div class="w-8 h-8 rounded-full ml-3 bg-indigo-100 flex items-center justify-center">
                <i class="fas fa-user text-indigo-500 text-sm"></i>
            </div>
        `;
        return sendingDiv;
    }

    /**
     * Create message element
     * @param {string} messageText - The message text
     * @returns {HTMLElement} The message element
     */
    createMessageElement(messageText) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message-animation mb-4 flex items-start justify-end';
        messageDiv.innerHTML = `
            <div class="text-right">
                <div class="bg-indigo-100 rounded-lg p-3 inline-block max-w-[80%]">
                    <p class="text-gray-800">${window.Utils ? window.Utils.escapeHtml(messageText) : messageText}</p>
                </div>
                <p class="text-xs text-gray-500 mt-1">You • Just now</p>
            </div>
            <div class="w-8 h-8 rounded-full ml-3 bg-indigo-100 flex items-center justify-center">
                <i class="fas fa-user text-indigo-500 text-sm"></i>
            </div>
        `;
        return messageDiv;
    }

    /**
     * Show notification message using shared utility
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, info)
     */
    showNotification(message, type = 'success') {
        if (window.Utils) {
            window.Utils.showNotification(message, type);
        } else {
            // Fallback if utils not loaded
            alert(message);
        }
    }
}

// Initialize chat controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatController = new ChatController();
});

// Global functions for onclick handlers (for backward compatibility)
function logout() {
    if (window.chatController) {
        window.chatController.logout();
    }
}

function sendAsIs() {
    if (window.chatController) {
        window.chatController.sendAsIs();
    }
}

function editSuggestion() {
    if (window.chatController) {
        window.chatController.editSuggestion();
    }
}

function writeFromScratch() {
    if (window.chatController) {
        window.chatController.writeFromScratch();
    }
}

function cancelEdit() {
    if (window.chatController) {
        window.chatController.cancelEdit();
    }
}

function sendMessage() {
    if (window.chatController) {
        window.chatController.sendMessage();
    }
}