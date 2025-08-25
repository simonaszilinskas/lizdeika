/**
 * Global Notification System
 * Provides consistent user notifications across all components
 */

class NotificationSystem {
    constructor(options = {}) {
        this.config = {
            position: options.position || 'top-right',
            maxNotifications: options.maxNotifications || 5,
            defaultDuration: options.defaultDuration || 5000,
            enableSound: options.enableSound !== false,
            enableAnimation: options.enableAnimation !== false,
            ...options
        };
        
        this.notifications = new Map();
        this.container = null;
        this.soundEnabled = this.config.enableSound && 'Audio' in window;
        
        this.createContainer();
        this.setupStyles();
        console.log('🔔 Notification System initialized');
    }

    /**
     * Create notification container
     */
    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = `notification-container position-${this.config.position}`;
        document.body.appendChild(this.container);
    }

    /**
     * Setup notification styles
     */
    setupStyles() {
        if (document.getElementById('notification-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification-container {
                position: fixed;
                z-index: 10000;
                pointer-events: none;
                max-width: 400px;
                padding: 16px;
            }
            
            .notification-container.position-top-right {
                top: 0;
                right: 0;
            }
            
            .notification-container.position-top-left {
                top: 0;
                left: 0;
            }
            
            .notification-container.position-bottom-right {
                bottom: 0;
                right: 0;
            }
            
            .notification-container.position-bottom-left {
                bottom: 0;
                left: 0;
            }
            
            .notification-container.position-top-center {
                top: 0;
                left: 50%;
                transform: translateX(-50%);
            }
            
            .notification-container.position-bottom-center {
                bottom: 0;
                left: 50%;
                transform: translateX(-50%);
            }

            .notification {
                pointer-events: auto;
                margin-bottom: 12px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                overflow: hidden;
                transition: all 0.3s ease;
                transform: translateX(100%);
                opacity: 0;
                max-width: 100%;
            }
            
            .notification.show {
                transform: translateX(0);
                opacity: 1;
            }
            
            .notification.hide {
                transform: translateX(100%);
                opacity: 0;
                margin-bottom: 0;
                padding: 0;
                height: 0;
            }
            
            .notification-content {
                padding: 16px;
                display: flex;
                align-items: flex-start;
                min-height: 60px;
            }
            
            .notification-icon {
                flex-shrink: 0;
                width: 20px;
                height: 20px;
                margin-right: 12px;
                margin-top: 2px;
            }
            
            .notification-body {
                flex: 1;
                min-width: 0;
            }
            
            .notification-title {
                font-weight: 600;
                margin-bottom: 4px;
                font-size: 14px;
                line-height: 1.4;
            }
            
            .notification-message {
                font-size: 13px;
                line-height: 1.4;
                word-wrap: break-word;
            }
            
            .notification-close {
                flex-shrink: 0;
                width: 20px;
                height: 20px;
                margin-left: 12px;
                background: none;
                border: none;
                cursor: pointer;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0.5;
                transition: opacity 0.2s ease;
            }
            
            .notification-close:hover {
                opacity: 1;
            }
            
            .notification-progress {
                height: 3px;
                background-color: rgba(255, 255, 255, 0.3);
                position: relative;
                overflow: hidden;
            }
            
            .notification-progress-bar {
                height: 100%;
                background-color: rgba(255, 255, 255, 0.8);
                transition: width linear;
                width: 100%;
            }
            
            /* Notification types */
            .notification.success {
                background-color: #10b981;
                color: white;
            }
            
            .notification.error {
                background-color: #ef4444;
                color: white;
            }
            
            .notification.warning {
                background-color: #f59e0b;
                color: white;
            }
            
            .notification.info {
                background-color: #3b82f6;
                color: white;
            }
            
            .notification.loading {
                background-color: #6b7280;
                color: white;
            }
            
            /* Responsive */
            @media (max-width: 480px) {
                .notification-container {
                    left: 8px;
                    right: 8px;
                    max-width: none;
                    padding: 8px;
                }
                
                .notification-container.position-top-center,
                .notification-container.position-bottom-center {
                    left: 8px;
                    transform: none;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    /**
     * Show notification
     */
    show(options = {}) {
        const config = {
            type: 'info',
            title: '',
            message: '',
            duration: this.config.defaultDuration,
            closable: true,
            showProgress: true,
            actions: [],
            ...options
        };

        const id = this.generateId();
        const notification = this.createNotificationElement(id, config);
        
        // Store notification
        this.notifications.set(id, {
            element: notification,
            config,
            timeoutId: null
        });

        // Add to container
        this.container.appendChild(notification);

        // Trigger show animation
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // Setup auto-close
        if (config.duration > 0) {
            this.startProgressTimer(id, config.duration);
        }

        // Play sound
        if (this.soundEnabled) {
            this.playNotificationSound(config.type);
        }

        // Manage notification count
        this.enforceMaxNotifications();

        console.log(`🔔 Notification shown: ${config.type} - ${config.message}`);
        return id;
    }

    /**
     * Create notification element
     */
    createNotificationElement(id, config) {
        const notification = document.createElement('div');
        notification.className = `notification ${config.type}`;
        notification.dataset.id = id;

        const icon = this.getTypeIcon(config.type);
        const closeButton = config.closable ? `
            <button class="notification-close" onclick="window.notificationSystem.hide('${id}')">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
                </svg>
            </button>
        ` : '';

        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${icon}</div>
                <div class="notification-body">
                    ${config.title ? `<div class="notification-title">${this.escapeHtml(config.title)}</div>` : ''}
                    <div class="notification-message">${this.escapeHtml(config.message)}</div>
                </div>
                ${closeButton}
            </div>
            ${config.showProgress && config.duration > 0 ? '<div class="notification-progress"><div class="notification-progress-bar"></div></div>' : ''}
        `;

        return notification;
    }

    /**
     * Get icon for notification type
     */
    getTypeIcon(type) {
        const icons = {
            success: `<svg fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.061L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/>
            </svg>`,
            error: `<svg fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
            </svg>`,
            warning: `<svg fill="currentColor" viewBox="0 0 16 16">
                <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
            </svg>`,
            info: `<svg fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
            </svg>`,
            loading: `<svg fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
                <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
            </svg>`
        };
        return icons[type] || icons.info;
    }

    /**
     * Start progress timer
     */
    startProgressTimer(id, duration) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        const progressBar = notification.element.querySelector('.notification-progress-bar');
        if (progressBar) {
            progressBar.style.transitionDuration = `${duration}ms`;
            progressBar.style.width = '0%';
        }

        notification.timeoutId = setTimeout(() => {
            this.hide(id);
        }, duration);
    }

    /**
     * Hide notification
     */
    hide(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        // Clear timeout
        if (notification.timeoutId) {
            clearTimeout(notification.timeoutId);
        }

        // Start hide animation
        notification.element.classList.add('hide');
        notification.element.classList.remove('show');

        // Remove after animation
        setTimeout(() => {
            if (notification.element.parentElement) {
                notification.element.remove();
            }
            this.notifications.delete(id);
        }, 300);

        console.log(`🔔 Notification hidden: ${id}`);
    }

    /**
     * Hide all notifications
     */
    hideAll() {
        this.notifications.forEach((_, id) => {
            this.hide(id);
        });
    }

    /**
     * Enforce maximum notification count
     */
    enforceMaxNotifications() {
        const notificationIds = Array.from(this.notifications.keys());
        const excess = notificationIds.length - this.config.maxNotifications;
        
        if (excess > 0) {
            // Remove oldest notifications
            notificationIds.slice(0, excess).forEach(id => {
                this.hide(id);
            });
        }
    }

    /**
     * Play notification sound
     */
    playNotificationSound(type) {
        // Simple beep sound - could be enhanced with actual sound files
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Different frequencies for different types
            const frequencies = {
                success: 800,
                error: 400,
                warning: 600,
                info: 500,
                loading: 450
            };

            oscillator.frequency.setValueAtTime(frequencies[type] || 500, audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            // Sound failed, that's okay
            console.debug('Notification sound failed:', error);
        }
    }

    /**
     * Utility methods
     */
    generateId() {
        return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Quick show methods for common types
     */
    success(message, title = '', duration = this.config.defaultDuration) {
        return this.show({ type: 'success', title, message, duration });
    }

    error(message, title = '', duration = 0) { // Errors don't auto-hide by default
        return this.show({ type: 'error', title, message, duration });
    }

    warning(message, title = '', duration = this.config.defaultDuration * 1.5) {
        return this.show({ type: 'warning', title, message, duration });
    }

    info(message, title = '', duration = this.config.defaultDuration) {
        return this.show({ type: 'info', title, message, duration });
    }

    loading(message, title = 'Loading...', duration = 0) {
        return this.show({ type: 'loading', title, message, duration, closable: false });
    }

    /**
     * Update existing notification
     */
    update(id, updates) {
        const notification = this.notifications.get(id);
        if (!notification) return false;

        // Update config
        Object.assign(notification.config, updates);

        // Update element
        const titleElement = notification.element.querySelector('.notification-title');
        const messageElement = notification.element.querySelector('.notification-message');

        if (updates.title !== undefined) {
            if (titleElement) {
                titleElement.textContent = updates.title;
            }
        }

        if (updates.message !== undefined) {
            if (messageElement) {
                messageElement.textContent = updates.message;
            }
        }

        if (updates.type !== undefined) {
            notification.element.className = `notification ${updates.type} show`;
        }

        return true;
    }

    /**
     * Get notification statistics
     */
    getStats() {
        return {
            total: this.notifications.size,
            byType: Array.from(this.notifications.values()).reduce((acc, notif) => {
                acc[notif.config.type] = (acc[notif.config.type] || 0) + 1;
                return acc;
            }, {}),
            maxNotifications: this.config.maxNotifications
        };
    }

    /**
     * Cleanup
     */
    destroy() {
        this.hideAll();
        if (this.container) {
            this.container.remove();
        }
        const styles = document.getElementById('notification-styles');
        if (styles) {
            styles.remove();
        }
        console.log('🧹 Cleaning up Notification System');
    }
}

// Create global instance
window.notificationSystem = new NotificationSystem();

// Export class
window.NotificationSystem = NotificationSystem;