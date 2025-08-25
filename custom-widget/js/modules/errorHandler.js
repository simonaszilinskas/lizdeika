/**
 * Comprehensive Error Handling System
 * Provides centralized error management, retry mechanisms, and user-friendly notifications
 */

class ErrorHandler {
    constructor(options = {}) {
        this.config = {
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 1000,
            retryMultiplier: options.retryMultiplier || 2,
            enableLogging: options.enableLogging !== false,
            enableUserNotifications: options.enableUserNotifications !== false,
            logEndpoint: options.logEndpoint || null,
            ...options
        };
        
        this.errorTypes = {
            NETWORK: 'network',
            API: 'api',
            VALIDATION: 'validation',
            AUTHENTICATION: 'authentication',
            PERMISSION: 'permission',
            SYSTEM: 'system',
            UNKNOWN: 'unknown'
        };
        
        this.retryableErrors = [
            'NetworkError',
            'TimeoutError',
            'AbortError',
            500, 502, 503, 504, 408, 429
        ];
        
        this.setupErrorLogger();
        console.log('🛡️ Error Handler initialized');
    }

    /**
     * Setup error logging and monitoring
     */
    setupErrorLogger() {
        // Global error handlers
        window.addEventListener('error', (event) => {
            this.handleGlobalError(event.error, {
                source: event.filename,
                line: event.lineno,
                column: event.colno
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.handleGlobalError(event.reason, {
                type: 'unhandledPromiseRejection'
            });
        });
    }

    /**
     * Main error handling method
     */
    async handleError(error, context = {}) {
        const errorInfo = this.classifyError(error, context);
        
        // Log error
        if (this.config.enableLogging) {
            this.logError(errorInfo);
        }
        
        // Send error to monitoring service if configured
        if (this.config.logEndpoint) {
            this.sendErrorToService(errorInfo);
        }
        
        // Show user notification if enabled
        if (this.config.enableUserNotifications && errorInfo.showToUser) {
            this.showUserNotification(errorInfo);
        }
        
        return errorInfo;
    }

    /**
     * Classify error type and severity
     */
    classifyError(error, context = {}) {
        const errorInfo = {
            id: this.generateErrorId(),
            timestamp: new Date().toISOString(),
            type: this.errorTypes.UNKNOWN,
            severity: 'medium',
            message: error.message || String(error),
            originalError: error,
            context: context,
            showToUser: true,
            userMessage: 'An error occurred. Please try again.',
            retryable: false
        };

        // Network errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorInfo.type = this.errorTypes.NETWORK;
            errorInfo.severity = 'high';
            errorInfo.userMessage = 'Network connection error. Please check your internet connection.';
            errorInfo.retryable = true;
        }

        // HTTP status errors
        if (context.status) {
            errorInfo.httpStatus = context.status;
            
            if (context.status >= 500) {
                errorInfo.type = this.errorTypes.API;
                errorInfo.severity = 'high';
                errorInfo.userMessage = 'Server error. Please try again in a few moments.';
                errorInfo.retryable = true;
            } else if (context.status === 401) {
                errorInfo.type = this.errorTypes.AUTHENTICATION;
                errorInfo.severity = 'high';
                errorInfo.userMessage = 'Session expired. Please log in again.';
                errorInfo.retryable = false;
            } else if (context.status === 403) {
                errorInfo.type = this.errorTypes.PERMISSION;
                errorInfo.severity = 'medium';
                errorInfo.userMessage = 'You do not have permission to perform this action.';
                errorInfo.retryable = false;
            } else if (context.status === 400) {
                errorInfo.type = this.errorTypes.VALIDATION;
                errorInfo.severity = 'low';
                errorInfo.userMessage = 'Invalid request. Please check your input.';
                errorInfo.retryable = false;
            } else if (context.status === 429) {
                errorInfo.type = this.errorTypes.API;
                errorInfo.severity = 'medium';
                errorInfo.userMessage = 'Too many requests. Please wait a moment and try again.';
                errorInfo.retryable = true;
            }
        }

        // Validation errors
        if (error.name === 'ValidationError' || context.type === 'validation') {
            errorInfo.type = this.errorTypes.VALIDATION;
            errorInfo.severity = 'low';
            errorInfo.userMessage = error.message || 'Please check your input and try again.';
            errorInfo.retryable = false;
        }

        // API response errors
        if (context.apiError && typeof context.apiError === 'object') {
            errorInfo.userMessage = context.apiError.error || context.apiError.message || errorInfo.userMessage;
        }

        return errorInfo;
    }

    /**
     * Enhanced fetch with automatic retry and error handling
     */
    async fetchWithRetry(url, options = {}, customConfig = {}) {
        const config = {
            maxRetries: customConfig.maxRetries || this.config.maxRetries,
            retryDelay: customConfig.retryDelay || this.config.retryDelay,
            retryMultiplier: customConfig.retryMultiplier || this.config.retryMultiplier,
            ...customConfig
        };

        let lastError;
        let attempt = 0;

        while (attempt <= config.maxRetries) {
            try {
                const response = await fetch(url, {
                    ...options,
                    signal: options.signal || AbortSignal.timeout(30000) // 30s timeout
                });

                // Handle HTTP errors
                if (!response.ok) {
                    const errorContext = {
                        url,
                        status: response.status,
                        statusText: response.statusText,
                        attempt: attempt + 1
                    };

                    try {
                        const errorData = await response.json();
                        errorContext.apiError = errorData;
                    } catch (jsonError) {
                        // Error response is not JSON
                        errorContext.responseText = await response.text();
                    }

                    const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                    const errorInfo = await this.handleError(error, errorContext);

                    // Check if we should retry
                    if (attempt < config.maxRetries && this.shouldRetry(response.status, error)) {
                        attempt++;
                        await this.delay(config.retryDelay * Math.pow(config.retryMultiplier, attempt - 1));
                        continue;
                    }

                    throw error;
                }

                // Successful response
                console.log(`✅ Request successful: ${url} (attempt ${attempt + 1})`);
                return response;

            } catch (error) {
                lastError = error;
                
                const errorContext = {
                    url,
                    attempt: attempt + 1,
                    maxRetries: config.maxRetries
                };

                const errorInfo = await this.handleError(error, errorContext);

                // Check if we should retry
                if (attempt < config.maxRetries && this.shouldRetry(null, error)) {
                    attempt++;
                    console.log(`🔄 Retrying request (${attempt}/${config.maxRetries}): ${url}`);
                    await this.delay(config.retryDelay * Math.pow(config.retryMultiplier, attempt - 1));
                    continue;
                }

                // Max retries exceeded or non-retryable error
                console.error(`❌ Request failed after ${attempt + 1} attempts: ${url}`);
                throw error;
            }
        }

        throw lastError;
    }

    /**
     * Check if error should be retried
     */
    shouldRetry(status, error) {
        // Check by HTTP status
        if (status && this.retryableErrors.includes(status)) {
            return true;
        }

        // Check by error type
        if (error.name && this.retryableErrors.includes(error.name)) {
            return true;
        }

        // Network-related errors
        if (error.message && (
            error.message.includes('fetch') ||
            error.message.includes('network') ||
            error.message.includes('timeout') ||
            error.message.includes('abort')
        )) {
            return true;
        }

        return false;
    }

    /**
     * Show user-friendly notification
     */
    showUserNotification(errorInfo) {
        // Try to find existing notification system
        if (window.showMessage && typeof window.showMessage === 'function') {
            window.showMessage(errorInfo.userMessage, 'error');
            return;
        }

        // Check if we're in settings page context
        if (window.settingsApp && window.settingsApp.showMessage) {
            window.settingsApp.showMessage(errorInfo.userMessage, 'error');
            return;
        }

        // Check if we're in agent dashboard context
        if (window.agentDashboard && window.agentDashboard.showNotification) {
            window.agentDashboard.showNotification(errorInfo.userMessage, 'error');
            return;
        }

        // Fallback to browser notification
        this.showBrowserNotification(errorInfo);
    }

    /**
     * Show browser notification as fallback
     */
    showBrowserNotification(errorInfo) {
        // Create a simple toast notification
        const toast = document.createElement('div');
        toast.className = 'error-toast';
        toast.innerHTML = `
            <div class="flex items-center p-4 mb-4 text-red-800 border border-red-300 rounded-lg bg-red-50">
                <svg class="flex-shrink-0 w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                </svg>
                <div class="text-sm font-medium">${errorInfo.userMessage}</div>
                <button type="button" class="ml-auto -mx-1.5 -my-1.5 bg-red-50 text-red-500 rounded-lg p-1.5 hover:bg-red-200 focus:ring-2 focus:ring-red-400" onclick="this.parentElement.parentElement.remove()">
                    <span class="sr-only">Close</span>
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
        `;

        // Add to page
        const container = document.body;
        container.appendChild(toast);

        // Style the toast
        toast.style.position = 'fixed';
        toast.style.top = '20px';
        toast.style.right = '20px';
        toast.style.zIndex = '9999';
        toast.style.maxWidth = '400px';

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    /**
     * Log error to console and potentially external service
     */
    logError(errorInfo) {
        const logMessage = `
🛡️ Error Handler - ${errorInfo.type.toUpperCase()} ERROR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ID: ${errorInfo.id}
Type: ${errorInfo.type}
Severity: ${errorInfo.severity}
Time: ${new Date(errorInfo.timestamp).toLocaleString()}
Message: ${errorInfo.message}
User Message: ${errorInfo.userMessage}
Retryable: ${errorInfo.retryable}
Context: ${JSON.stringify(errorInfo.context, null, 2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `;

        console.error(logMessage, errorInfo.originalError);
    }

    /**
     * Send error to external monitoring service
     */
    async sendErrorToService(errorInfo) {
        if (!this.config.logEndpoint) return;

        try {
            await fetch(this.config.logEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...errorInfo,
                    originalError: undefined, // Don't send the actual error object
                    userAgent: navigator.userAgent,
                    url: window.location.href,
                    referrer: document.referrer
                })
            });
        } catch (loggingError) {
            console.warn('Failed to send error to monitoring service:', loggingError);
        }
    }

    /**
     * Handle global errors
     */
    handleGlobalError(error, context = {}) {
        this.handleError(error, {
            ...context,
            global: true
        });
    }

    /**
     * Utility methods
     */
    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get error statistics
     */
    getErrorStats() {
        // This could be expanded to track error frequency, types, etc.
        return {
            isOnline: navigator.onLine,
            errorHandlerActive: true,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create specialized error handlers for common scenarios
     */
    createAPIErrorHandler(apiUrl) {
        return async (url, options = {}) => {
            return this.fetchWithRetry(`${apiUrl}${url}`, options);
        };
    }

    /**
     * Wrap existing functions with error handling
     */
    wrapWithErrorHandling(fn, context = {}) {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                await this.handleError(error, context);
                throw error;
            }
        };
    }

    /**
     * Cleanup method
     */
    destroy() {
        console.log('🧹 Cleaning up Error Handler');
        // Could remove event listeners if needed
    }
}

// Export for use in other modules
window.ErrorHandler = ErrorHandler;