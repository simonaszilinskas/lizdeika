/**
 * Error Monitoring and Logging System
 * Tracks, aggregates, and reports frontend errors for debugging and monitoring
 */

class ErrorMonitoring {
    constructor(options = {}) {
        this.config = {
            apiUrl: options.apiUrl || '',
            enableLocalStorage: options.enableLocalStorage !== false,
            enableConsoleReporting: options.enableConsoleReporting !== false,
            enableRemoteReporting: options.enableRemoteReporting !== false,
            maxLocalErrors: options.maxLocalErrors || 100,
            reportingInterval: options.reportingInterval || 60000, // 1 minute
            enableUserFeedback: options.enableUserFeedback !== false,
            ...options
        };

        this.errors = [];
        this.errorStats = {
            total: 0,
            byType: {},
            bySeverity: {},
            byHour: {},
            lastReset: new Date().toISOString()
        };

        this.reportingTimer = null;
        this.initialized = false;

        this.init();
    }

    /**
     * Initialize the monitoring system
     */
    init() {
        this.loadStoredErrors();
        this.setupErrorReporting();
        this.startPeriodicReporting();
        this.initialized = true;
        console.log('📊 Error Monitoring initialized');
    }

    /**
     * Load previously stored errors from localStorage
     */
    loadStoredErrors() {
        if (!this.config.enableLocalStorage) return;

        try {
            const storedErrors = localStorage.getItem('error_monitoring_data');
            const storedStats = localStorage.getItem('error_monitoring_stats');

            if (storedErrors) {
                this.errors = JSON.parse(storedErrors);
            }

            if (storedStats) {
                this.errorStats = { ...this.errorStats, ...JSON.parse(storedStats) };
            }

            console.log(`📈 Loaded ${this.errors.length} stored errors`);
        } catch (error) {
            console.warn('Failed to load stored error data:', error);
            this.errors = [];
            this.resetStats();
        }
    }

    /**
     * Setup automatic error reporting
     */
    setupErrorReporting() {
        // Integrate with ErrorHandler if available
        if (window.ErrorHandler) {
            const originalHandleError = window.ErrorHandler.prototype.handleError;
            const self = this;
            
            window.ErrorHandler.prototype.handleError = function(error, context = {}) {
                // Call original handler
                const result = originalHandleError.call(this, error, context);
                
                // Report to monitoring
                self.reportError(error, context, result);
                
                return result;
            };
        }

        // Global error listeners
        window.addEventListener('error', (event) => {
            this.reportError(event.error, {
                type: 'javascript',
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.reportError(event.reason, {
                type: 'promise_rejection'
            });
        });

        // Performance observer for network errors
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.name.includes('api/') && entry.duration > 5000) {
                            this.reportError(new Error('Slow API Request'), {
                                type: 'performance',
                                url: entry.name,
                                duration: entry.duration,
                                severity: 'low'
                            });
                        }
                    }
                });
                observer.observe({ entryTypes: ['resource'] });
            } catch (error) {
                console.debug('Performance observer not supported:', error);
            }
        }
    }

    /**
     * Report an error to the monitoring system
     */
    reportError(error, context = {}, errorInfo = null) {
        const errorReport = {
            id: this.generateErrorId(),
            timestamp: new Date().toISOString(),
            message: error.message || String(error),
            stack: error.stack || '',
            type: context.type || this.classifyErrorType(error),
            severity: context.severity || this.classifyErrorSeverity(error),
            url: window.location.href,
            userAgent: navigator.userAgent,
            context: context,
            errorInfo: errorInfo,
            sessionId: this.getSessionId(),
            userId: this.getCurrentUserId()
        };

        // Add to errors array
        this.errors.push(errorReport);
        this.enforceMaxErrors();

        // Update statistics
        this.updateStats(errorReport);

        // Store locally
        this.storeErrors();

        // Log if enabled
        if (this.config.enableConsoleReporting) {
            this.logErrorReport(errorReport);
        }

        console.log(`📊 Error reported: ${errorReport.type} - ${errorReport.message}`);
        return errorReport.id;
    }

    /**
     * Classify error type
     */
    classifyErrorType(error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return 'network';
        }
        if (error.name === 'ReferenceError') {
            return 'reference';
        }
        if (error.name === 'SyntaxError') {
            return 'syntax';
        }
        if (error.message && error.message.includes('HTTP')) {
            return 'http';
        }
        return 'unknown';
    }

    /**
     * Classify error severity
     */
    classifyErrorSeverity(error) {
        const criticalKeywords = ['cannot read', 'is not defined', 'failed to fetch'];
        const lowSeverityKeywords = ['warning', 'deprecated'];

        const message = error.message ? error.message.toLowerCase() : '';

        if (criticalKeywords.some(keyword => message.includes(keyword))) {
            return 'high';
        }
        if (lowSeverityKeywords.some(keyword => message.includes(keyword))) {
            return 'low';
        }
        return 'medium';
    }

    /**
     * Update error statistics
     */
    updateStats(errorReport) {
        this.errorStats.total++;
        
        // By type
        this.errorStats.byType[errorReport.type] = (this.errorStats.byType[errorReport.type] || 0) + 1;
        
        // By severity
        this.errorStats.bySeverity[errorReport.severity] = (this.errorStats.bySeverity[errorReport.severity] || 0) + 1;
        
        // By hour
        const hour = new Date(errorReport.timestamp).getHours();
        this.errorStats.byHour[hour] = (this.errorStats.byHour[hour] || 0) + 1;
    }

    /**
     * Store errors in localStorage
     */
    storeErrors() {
        if (!this.config.enableLocalStorage) return;

        try {
            localStorage.setItem('error_monitoring_data', JSON.stringify(this.errors));
            localStorage.setItem('error_monitoring_stats', JSON.stringify(this.errorStats));
        } catch (error) {
            console.warn('Failed to store error data:', error);
        }
    }

    /**
     * Enforce maximum stored errors
     */
    enforceMaxErrors() {
        if (this.errors.length > this.config.maxLocalErrors) {
            const removed = this.errors.splice(0, this.errors.length - this.config.maxLocalErrors);
            console.log(`📊 Removed ${removed.length} old errors to maintain limit`);
        }
    }

    /**
     * Log error report to console
     */
    logErrorReport(errorReport) {
        const logMessage = `
📊 Error Monitoring Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ID: ${errorReport.id}
Type: ${errorReport.type}
Severity: ${errorReport.severity}
Time: ${new Date(errorReport.timestamp).toLocaleString()}
Message: ${errorReport.message}
URL: ${errorReport.url}
Context: ${JSON.stringify(errorReport.context, null, 2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `;

        console.group(`📊 Error ${errorReport.type.toUpperCase()}`);
        console.error(logMessage);
        if (errorReport.stack) {
            console.error('Stack trace:', errorReport.stack);
        }
        console.groupEnd();
    }

    /**
     * Start periodic reporting
     */
    startPeriodicReporting() {
        if (!this.config.enableRemoteReporting) return;

        this.reportingTimer = setInterval(() => {
            this.sendErrorsToServer();
        }, this.config.reportingInterval);
    }

    /**
     * Send accumulated errors to server
     */
    async sendErrorsToServer() {
        if (!this.config.enableRemoteReporting || !this.config.apiUrl || this.errors.length === 0) {
            return;
        }

        try {
            const payload = {
                errors: this.errors.slice(), // Copy array
                stats: this.errorStats,
                metadata: {
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    url: window.location.href,
                    sessionId: this.getSessionId(),
                    userId: this.getCurrentUserId()
                }
            };

            const response = await fetch(`${this.config.apiUrl}/api/errors/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log(`📊 Sent ${this.errors.length} errors to server`);
                this.errors = []; // Clear sent errors
                this.storeErrors();
            } else {
                console.warn('Failed to send errors to server:', response.status);
            }
        } catch (error) {
            console.warn('Error sending error reports:', error);
        }
    }

    /**
     * Get current error statistics
     */
    getStats() {
        return {
            ...this.errorStats,
            currentErrors: this.errors.length,
            lastUpdate: new Date().toISOString()
        };
    }

    /**
     * Get recent errors
     */
    getRecentErrors(limit = 10) {
        return this.errors.slice(-limit).reverse();
    }

    /**
     * Get errors by type
     */
    getErrorsByType(type) {
        return this.errors.filter(error => error.type === type);
    }

    /**
     * Get errors by severity
     */
    getErrorsBySeverity(severity) {
        return this.errors.filter(error => error.severity === severity);
    }

    /**
     * Clear all stored errors
     */
    clearErrors() {
        this.errors = [];
        this.resetStats();
        this.storeErrors();
        console.log('📊 All errors cleared');
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.errorStats = {
            total: 0,
            byType: {},
            bySeverity: {},
            byHour: {},
            lastReset: new Date().toISOString()
        };
    }

    /**
     * Generate error report for debugging
     */
    generateDebugReport() {
        const report = {
            summary: this.getStats(),
            recentErrors: this.getRecentErrors(20),
            errorsByType: {},
            errorsBySeverity: {}
        };

        // Group errors by type
        Object.keys(this.errorStats.byType).forEach(type => {
            report.errorsByType[type] = this.getErrorsByType(type);
        });

        // Group errors by severity
        Object.keys(this.errorStats.bySeverity).forEach(severity => {
            report.errorsBySeverity[severity] = this.getErrorsBySeverity(severity);
        });

        return report;
    }

    /**
     * Display error monitoring dashboard
     */
    showDashboard() {
        const stats = this.getStats();
        const recentErrors = this.getRecentErrors(5);

        console.group('📊 Error Monitoring Dashboard');
        console.log('Total Errors:', stats.total);
        console.log('Current Stored Errors:', stats.currentErrors);
        console.log('Last Reset:', stats.lastReset);
        console.log('By Type:', stats.byType);
        console.log('By Severity:', stats.bySeverity);
        console.log('Recent Errors:', recentErrors);
        console.groupEnd();

        return stats;
    }

    /**
     * Utility methods
     */
    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getSessionId() {
        let sessionId = sessionStorage.getItem('error_monitoring_session');
        if (!sessionId) {
            sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem('error_monitoring_session', sessionId);
        }
        return sessionId;
    }

    getCurrentUserId() {
        try {
            // Try to get user ID from various sources
            if (window.settingsApp && window.settingsApp.currentUser) {
                return window.settingsApp.currentUser.id;
            }
            if (window.agentDashboard && window.agentDashboard.currentUser) {
                return window.agentDashboard.currentUser.id;
            }
            // Check localStorage for user data
            const token = localStorage.getItem('agent_token');
            if (token) {
                // Parse JWT token to get user ID (basic parsing)
                try {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    return payload.userId || payload.sub || 'unknown';
                } catch (e) {
                    return 'unknown';
                }
            }
            return 'anonymous';
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Cleanup method
     */
    destroy() {
        if (this.reportingTimer) {
            clearInterval(this.reportingTimer);
        }
        
        // Send any remaining errors
        if (this.config.enableRemoteReporting && this.errors.length > 0) {
            this.sendErrorsToServer();
        }
        
        console.log('🧹 Cleaning up Error Monitoring');
    }
}

// Create global instance
window.errorMonitoring = new ErrorMonitoring();

// Export class
window.ErrorMonitoring = ErrorMonitoring;