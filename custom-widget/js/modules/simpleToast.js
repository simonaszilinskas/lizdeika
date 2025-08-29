/**
 * Simple Toast Notification System
 * 
 * A lightweight replacement for the complex NotificationSystem.
 * Provides basic toast notifications without the overhead of animations, 
 * sounds, complex positioning, and state management.
 */

class SimpleToast {
    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - The type of toast (info, success, error, warning)
     * @param {number} duration - Duration in milliseconds (0 = no auto-hide)
     */
    static show(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `simple-toast toast-${type}`;
        
        // Create toast content
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-message">${this.escapeHtml(message)}</span>
                <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Add styles if not already added
        this.ensureStyles();
        
        // Add to page
        document.body.appendChild(toast);
        
        // Trigger entrance animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // Auto-remove if duration is set
        if (duration > 0) {
            setTimeout(() => {
                this.hide(toast);
            }, duration);
        }
        
        return toast;
    }
    
    /**
     * Hide a toast notification
     * @param {HTMLElement} toast - The toast element to hide
     */
    static hide(toast) {
        if (!toast || !toast.parentElement) return;
        
        toast.classList.add('hiding');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }
    
    /**
     * Success notification
     * @param {string} message - The message to display
     * @param {string} title - Optional title (combined with message)
     * @param {number} duration - Duration in milliseconds
     */
    static success(message, title = '', duration = 5000) {
        const fullMessage = title ? `${title}: ${message}` : message;
        return this.show(fullMessage, 'success', duration);
    }
    
    /**
     * Error notification (doesn't auto-hide by default)
     * @param {string} message - The message to display
     * @param {string} title - Optional title (combined with message)
     * @param {number} duration - Duration in milliseconds (0 = no auto-hide)
     */
    static error(message, title = '', duration = 0) {
        const fullMessage = title ? `${title}: ${message}` : message;
        return this.show(fullMessage, 'error', duration);
    }
    
    /**
     * Warning notification
     * @param {string} message - The message to display
     * @param {string} title - Optional title (combined with message)
     * @param {number} duration - Duration in milliseconds
     */
    static warning(message, title = '', duration = 7500) {
        const fullMessage = title ? `${title}: ${message}` : message;
        return this.show(fullMessage, 'warning', duration);
    }
    
    /**
     * Info notification
     * @param {string} message - The message to display
     * @param {string} title - Optional title (combined with message)
     * @param {number} duration - Duration in milliseconds
     */
    static info(message, title = '', duration = 5000) {
        const fullMessage = title ? `${title}: ${message}` : message;
        return this.show(fullMessage, 'info', duration);
    }
    
    /**
     * Escape HTML to prevent XSS
     * @private
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Ensure CSS styles are loaded
     * @private
     */
    static ensureStyles() {
        if (document.getElementById('simple-toast-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'simple-toast-styles';
        styles.textContent = `
            .simple-toast {
                position: fixed;
                top: 20px;
                right: 20px;
                max-width: 400px;
                padding: 16px;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 14px;
                z-index: 9999;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
                margin-bottom: 8px;
            }
            
            .simple-toast.show {
                opacity: 1;
                transform: translateX(0);
            }
            
            .simple-toast.hiding {
                opacity: 0;
                transform: translateX(100%);
            }
            
            .simple-toast.toast-success {
                background: #d4edda;
                border: 1px solid #c3e6cb;
                color: #155724;
            }
            
            .simple-toast.toast-error {
                background: #f8d7da;
                border: 1px solid #f5c6cb;
                color: #721c24;
            }
            
            .simple-toast.toast-warning {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                color: #856404;
            }
            
            .simple-toast.toast-info {
                background: #d1ecf1;
                border: 1px solid #bee5eb;
                color: #0c5460;
            }
            
            .toast-content {
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .toast-message {
                flex: 1;
                margin-right: 12px;
            }
            
            .toast-close {
                background: none;
                border: none;
                font-size: 18px;
                font-weight: bold;
                cursor: pointer;
                opacity: 0.5;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .toast-close:hover {
                opacity: 1;
            }
        `;
        
        document.head.appendChild(styles);
    }
}

// Make available globally for compatibility
window.SimpleToast = SimpleToast;
window.toast = SimpleToast; // Short alias

// Auto-initialize styles when loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SimpleToast.ensureStyles());
} else {
    SimpleToast.ensureStyles();
}

// Also provide as module export if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleToast;
}