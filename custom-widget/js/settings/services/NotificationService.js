/**
 * NOTIFICATION SERVICE
 * 
 * Provides user-friendly toast notifications to replace browser alerts
 * Improves UX with non-blocking, styled notifications
 * 
 * @version 1.0.0
 */

export class NotificationService {
    
    constructor() {
        this.container = null;
        this.notifications = new Map();
        this.nextId = 1;
        this.setupContainer();
    }
    
    /**
     * Create notification container if it doesn't exist
     */
    setupContainer() {
        // Check if container already exists
        this.container = document.getElementById('notification-container');
        if (this.container) return;
        
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = 'fixed top-4 right-4 z-50 space-y-2';
        this.container.style.zIndex = '9999';
        
        document.body.appendChild(this.container);
    }
    
    /**
     * Show success notification
     * @param {string} message - Success message
     * @param {number} duration - Auto-hide duration in ms (default: 5000)
     * @returns {number} Notification ID
     */
    showSuccess(message, duration = 5000) {
        return this.show(message, 'success', duration);
    }
    
    /**
     * Show error notification
     * @param {string} message - Error message
     * @param {number} duration - Auto-hide duration in ms (default: 8000)
     * @returns {number} Notification ID
     */
    showError(message, duration = 8000) {
        return this.show(message, 'error', duration);
    }
    
    /**
     * Show warning notification
     * @param {string} message - Warning message
     * @param {number} duration - Auto-hide duration in ms (default: 6000)
     * @returns {number} Notification ID
     */
    showWarning(message, duration = 6000) {
        return this.show(message, 'warning', duration);
    }
    
    /**
     * Show info notification
     * @param {string} message - Info message
     * @param {number} duration - Auto-hide duration in ms (default: 4000)
     * @returns {number} Notification ID
     */
    showInfo(message, duration = 4000) {
        return this.show(message, 'info', duration);
    }
    
    /**
     * Show validation error notification with detailed errors
     * @param {Array} errors - Array of error messages
     * @param {number} duration - Auto-hide duration in ms (default: 10000)
     * @returns {number} Notification ID
     */
    showValidationErrors(errors, duration = 10000) {
        const errorList = errors.map(error => `• ${error.replace(/<\/?code>/g, '')}`).join('\\n');
        const message = `Validation Errors:\\n\\n${errorList}`;\n        
        return this.show(message, 'error', duration, true);
    }
    
    /**
     * Show generic notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (success, error, warning, info)
     * @param {number} duration - Auto-hide duration in ms
     * @param {boolean} multiline - Whether to preserve line breaks
     * @returns {number} Notification ID
     */
    show(message, type = 'info', duration = 5000, multiline = false) {
        const id = this.nextId++;\n        
        // Create notification element
        const notification = this.createNotificationElement(id, message, type, multiline);
        
        // Add to container and map
        this.container.appendChild(notification);
        this.notifications.set(id, { element: notification, type, message });
        
        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full', 'opacity-0');
        }, 10);
        
        // Auto-hide if duration is set
        if (duration > 0) {
            setTimeout(() => {
                this.hide(id);
            }, duration);
        }
        
        return id;
    }
    
    /**
     * Create notification DOM element
     * @param {number} id - Notification ID
     * @param {string} message - Message text
     * @param {string} type - Notification type
     * @param {boolean} multiline - Whether to preserve line breaks
     * @returns {HTMLElement} Notification element
     */
    createNotificationElement(id, message, type, multiline) {
        const notification = document.createElement('div');
        notification.className = `
            transform translate-x-full opacity-0 transition-all duration-300 ease-in-out
            max-w-md bg-white rounded-lg shadow-lg border-l-4 p-4 flex items-start gap-3
            ${this.getTypeStyles(type)}
        `.trim().replace(/\\s+/g, ' ');
        
        notification.innerHTML = `
            <div class="flex-shrink-0">
                <i class="fas ${this.getTypeIcon(type)} ${this.getTypeIconColor(type)} text-lg"></i>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 ${multiline ? 'whitespace-pre-line' : ''}">${message}</p>
            </div>
            <button class="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600" 
                    onclick="window.notificationService?.hide(${id})">
                <i class="fas fa-times text-sm"></i>
            </button>
        `;
        
        return notification;
    }
    
    /**
     * Get CSS styles for notification type
     * @param {string} type - Notification type
     * @returns {string} CSS classes
     */
    getTypeStyles(type) {
        const styles = {
            success: 'border-green-400 bg-green-50',
            error: 'border-red-400 bg-red-50',
            warning: 'border-yellow-400 bg-yellow-50',
            info: 'border-blue-400 bg-blue-50'
        };
        return styles[type] || styles.info;
    }
    
    /**
     * Get icon for notification type
     * @param {string} type - Notification type
     * @returns {string} FontAwesome icon class
     */
    getTypeIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }
    
    /**
     * Get icon color for notification type
     * @param {string} type - Notification type
     * @returns {string} CSS color class
     */
    getTypeIconColor(type) {
        const colors = {
            success: 'text-green-600',
            error: 'text-red-600',
            warning: 'text-yellow-600',
            info: 'text-blue-600'
        };
        return colors[type] || colors.info;
    }
    
    /**
     * Hide specific notification
     * @param {number} id - Notification ID
     */
    hide(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;
        
        const element = notification.element;
        
        // Animate out
        element.classList.add('translate-x-full', 'opacity-0');
        
        // Remove from DOM after animation
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            this.notifications.delete(id);
        }, 300);
    }
    
    /**
     * Hide all notifications
     */
    hideAll() {
        this.notifications.forEach((notification, id) => {
            this.hide(id);
        });
    }
    
    /**
     * Get all active notification IDs
     * @returns {Array} Array of notification IDs
     */
    getActiveNotifications() {
        return Array.from(this.notifications.keys());
    }
    
    /**
     * Check if any notifications are active
     * @returns {boolean}
     */
    hasActiveNotifications() {
        return this.notifications.size > 0;
    }
    
    /**
     * Update existing notification
     * @param {number} id - Notification ID
     * @param {string} message - New message
     * @param {string} type - New type (optional)
     */
    update(id, message, type) {
        const notification = this.notifications.get(id);
        if (!notification) return;
        
        const messageElement = notification.element.querySelector('p');
        const iconElement = notification.element.querySelector('i');
        
        if (messageElement) {
            messageElement.textContent = message;
        }
        
        if (type && type !== notification.type) {
            // Update type-specific styles
            notification.element.className = notification.element.className
                .replace(this.getTypeStyles(notification.type), this.getTypeStyles(type));\n            
            if (iconElement) {
                iconElement.className = iconElement.className
                    .replace(this.getTypeIcon(notification.type), this.getTypeIcon(type))
                    .replace(this.getTypeIconColor(notification.type), this.getTypeIconColor(type));
            }
            
            notification.type = type;
        }
        
        notification.message = message;
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.notificationService = new NotificationService();
}

export default NotificationService;