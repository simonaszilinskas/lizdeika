/**
 * Browser Notification Manager
 * Handles desktop notifications for new messages in the agent dashboard
 */

class BrowserNotificationManager {
    constructor(options = {}) {
        this.config = {
            title: options.title || 'Vilnius Assistant',
            icon: options.icon || '/favicon.ico',
            badge: options.badge || '/favicon.ico',
            requireInteraction: options.requireInteraction !== false,
            tag: options.tag || 'agent-notification',
            sound: options.sound !== false,
            vibrate: options.vibrate || [200, 100, 200],
            ...options
        };
        
        // Permission and settings management
        this.permission = 'default';
        this.enabled = this.loadSettings();
        this.activeNotifications = new Map();
        
        // Logger
        this.logger = options.logger || console;
        
        console.log('🔔 Browser Notification Manager initialized');
        this.checkPermissions();
    }
    
    /**
     * Check current notification permissions
     */
    async checkPermissions() {
        if (!('Notification' in window)) {
            this.logger.warn('Browser notifications not supported');
            return false;
        }
        
        this.permission = Notification.permission;
        this.logger.log(`📋 Notification permission: ${this.permission}`);
        return this.permission === 'granted';
    }
    
    /**
     * Request notification permissions
     */
    async requestPermission() {
        if (!('Notification' in window)) {
            throw new Error('Browser notifications not supported');
        }
        
        if (this.permission === 'granted') {
            return true;
        }
        
        try {
            this.logger.log('📋 Requesting notification permission...');
            const permission = await Notification.requestPermission();
            this.permission = permission;
            
            if (permission === 'granted') {
                this.logger.log('✅ Notification permission granted');
                this.enabled = true;
                this.saveSettings();
                return true;
            } else {
                this.logger.warn('❌ Notification permission denied');
                this.enabled = false;
                this.saveSettings();
                return false;
            }
        } catch (error) {
            this.logger.error('Error requesting notification permission:', error);
            return false;
        }
    }
    
    /**
     * Enable/disable notifications
     */
    async setEnabled(enabled) {
        if (enabled && this.permission !== 'granted') {
            const granted = await this.requestPermission();
            if (!granted) {
                return false;
            }
        }
        
        this.enabled = enabled;
        this.saveSettings();
        this.logger.log(`🔔 Notifications ${enabled ? 'enabled' : 'disabled'}`);
        return true;
    }
    
    /**
     * Show a browser notification
     */
    async showNotification(options = {}) {
        // Check if notifications are enabled and permitted
        if (!this.enabled || this.permission !== 'granted') {
            this.logger.debug('Notifications disabled or not permitted');
            return null;
        }
        
        if (!('Notification' in window)) {
            this.logger.warn('Browser notifications not supported');
            return null;
        }
        
        // Don't show notification if the page is visible and focused (unless forced)
        if (!options.forceShow && document.visibilityState === 'visible' && document.hasFocus()) {
            this.logger.debug('Page is visible and focused, skipping notification');
            return null;
        }
        
        const config = {
            body: options.message || options.body || '',
            icon: options.icon || this.config.icon,
            badge: options.badge || this.config.badge,
            requireInteraction: options.requireInteraction !== undefined ? options.requireInteraction : this.config.requireInteraction,
            tag: options.tag || this.config.tag,
            data: options.data || {},
            ...options
        };
        
        try {
            // Close any existing notification with the same tag
            if (this.activeNotifications.has(config.tag)) {
                this.activeNotifications.get(config.tag).close();
            }
            
            const notification = new Notification(options.title || this.config.title, config);
            
            // Store active notification
            this.activeNotifications.set(config.tag, notification);
            
            // Set up event handlers
            notification.onclick = (event) => {
                event.preventDefault();
                
                // Focus the browser window
                window.focus();
                
                // Custom click handler
                if (options.onClick) {
                    options.onClick(event, notification);
                }
                
                // Close notification
                notification.close();
            };
            
            notification.onclose = () => {
                this.activeNotifications.delete(config.tag);
                if (options.onClose) {
                    options.onClose(notification);
                }
            };
            
            notification.onerror = (error) => {
                this.logger.error('Notification error:', error);
                this.activeNotifications.delete(config.tag);
                if (options.onError) {
                    options.onError(error, notification);
                }
            };
            
            // Auto-close after delay if specified
            if (options.autoClose && options.autoClose > 0) {
                setTimeout(() => {
                    if (this.activeNotifications.has(config.tag)) {
                        notification.close();
                    }
                }, options.autoClose);
            }
            
            this.logger.log(`🔔 Notification shown: ${config.body}`);
            return notification;
            
        } catch (error) {
            this.logger.error('Error showing notification:', error);
            return null;
        }
    }
    
    /**
     * Show notification for new message
     */
    async showNewMessageNotification(messageData) {
        const conversationId = messageData.conversationId || messageData.conversation_id;
        const sender = messageData.sender || 'Customer';
        const content = messageData.content || messageData.message || 'New message received';
        const ticketNumber = messageData.ticketNumber || messageData.ticket_number || conversationId;
        
        // Truncate long messages
        const truncatedContent = content.length > 100 ? content.substring(0, 97) + '...' : content;
        
        return await this.showNotification({
            title: `New message from ${sender}`,
            body: `Ticket #${ticketNumber}: ${truncatedContent}`,
            tag: `message-${conversationId}`,
            data: {
                conversationId,
                type: 'new-message',
                timestamp: new Date().toISOString()
            },
            onClick: (event, notification) => {
                // Focus on the specific conversation
                if (window.dashboard && window.dashboard.openChat) {
                    window.dashboard.openChat(conversationId);
                }
            },
            autoClose: 10000 // Auto-close after 10 seconds
        });
    }
    
    /**
     * Show notification for conversation assignment
     */
    async showAssignmentNotification(assignmentData) {
        const conversationId = assignmentData.conversationId;
        const ticketNumber = assignmentData.ticketNumber || conversationId;
        const reason = assignmentData.reason || 'assignment';
        
        let message = `You've been assigned to ticket #${ticketNumber}`;
        if (reason === 'new_conversation') {
            message = `New conversation assigned: #${ticketNumber}`;
        }
        
        return await this.showNotification({
            title: 'Conversation Assignment',
            body: message,
            tag: `assignment-${conversationId}`,
            data: {
                conversationId,
                type: 'assignment',
                reason,
                timestamp: new Date().toISOString()
            },
            onClick: (event, notification) => {
                if (window.dashboard && window.dashboard.openChat) {
                    window.dashboard.openChat(conversationId);
                }
            },
            autoClose: 8000
        });
    }
    
    /**
     * Close all active notifications
     */
    closeAll() {
        this.activeNotifications.forEach(notification => {
            notification.close();
        });
        this.activeNotifications.clear();
        this.logger.log('🧹 Closed all notifications');
    }
    
    /**
     * Close specific notification by tag
     */
    closeByTag(tag) {
        if (this.activeNotifications.has(tag)) {
            this.activeNotifications.get(tag).close();
            return true;
        }
        return false;
    }
    
    /**
     * Get current settings
     */
    getSettings() {
        return {
            enabled: this.enabled,
            permission: this.permission,
            supported: 'Notification' in window,
            activeCount: this.activeNotifications.size
        };
    }
    
    /**
     * Load settings from localStorage
     */
    loadSettings() {
        try {
            const stored = localStorage.getItem('browserNotifications');
            if (stored) {
                const settings = JSON.parse(stored);
                return settings.enabled !== false; // Default to true
            }
        } catch (error) {
            this.logger.warn('Could not load notification settings:', error);
        }
        return true; // Default to enabled
    }
    
    /**
     * Save settings to localStorage
     */
    saveSettings() {
        try {
            const settings = {
                enabled: this.enabled,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('browserNotifications', JSON.stringify(settings));
        } catch (error) {
            this.logger.warn('Could not save notification settings:', error);
        }
    }
    
    /**
     * Test notification (for settings page)
     */
    async testNotification() {
        this.logger.log('🧪 Testing notification system...');
        this.logger.log(`📊 Current state: enabled=${this.enabled}, permission=${this.permission}, supported=${'Notification' in window}`);
        
        // For test notifications, bypass the visibility check
        const notification = await this.showNotification({
            title: 'Test Notification',
            body: 'Browser notifications are working correctly!',
            tag: 'test-notification',
            autoClose: 5000,
            requireInteraction: false,
            forceShow: true // Special flag for test notifications
        });
        
        if (notification) {
            this.logger.log('✅ Test notification created successfully');
        } else {
            this.logger.warn('❌ Test notification failed to create');
        }
        
        return notification;
    }
    
    /**
     * Get notification statistics
     */
    getStats() {
        return {
            enabled: this.enabled,
            permission: this.permission,
            supported: 'Notification' in window,
            activeNotifications: this.activeNotifications.size,
            totalSent: this.totalSent || 0
        };
    }
    
    /**
     * Cleanup
     */
    destroy() {
        this.closeAll();
        this.enabled = false;
        this.logger.log('🧹 Browser Notification Manager destroyed');
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BrowserNotificationManager;
}

// Make available globally for browser use
if (typeof window !== 'undefined') {
    window.BrowserNotificationManager = BrowserNotificationManager;
}