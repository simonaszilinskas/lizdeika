/**
 * Frontend Logger Utility
 * Provides environment-aware logging with different levels
 */

class Logger {
    constructor() {
        this.isDevelopment = this.checkDevelopmentMode();
        this.logLevel = this.getLogLevel();
    }

    /**
     * Check if we're in development mode
     */
    checkDevelopmentMode() {
        // Check various indicators of development environment
        return (
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.port === '3002' ||
            window.location.search.includes('debug=true') ||
            localStorage.getItem('debug') === 'true'
        );
    }

    /**
     * Get log level from environment or default
     */
    getLogLevel() {
        if (!this.isDevelopment) return 'ERROR';
        
        // Allow override via localStorage or URL param
        const urlParams = new URLSearchParams(window.location.search);
        const urlLogLevel = urlParams.get('logLevel');
        const storageLogLevel = localStorage.getItem('logLevel');
        
        return urlLogLevel || storageLogLevel || 'INFO';
    }

    /**
     * Log levels (lower number = higher priority)
     */
    levels = {
        ERROR: 0,
        WARN: 1, 
        INFO: 2,
        DEBUG: 3
    };

    /**
     * Check if message should be logged based on level
     */
    shouldLog(level) {
        const messageLevel = this.levels[level] || this.levels.INFO;
        const configuredLevel = this.levels[this.logLevel] || this.levels.INFO;
        return messageLevel <= configuredLevel;
    }

    /**
     * Format log message with timestamp and context
     */
    formatMessage(level, message, context = '') {
        const timestamp = new Date().toISOString();
        const ctx = context ? ` [${context}]` : '';
        return `${timestamp} [${level}]${ctx} ${message}`;
    }

    /**
     * Error logging (always shown)
     */
    error(message, context = '', data = null) {
        if (this.shouldLog('ERROR')) {
            console.error(this.formatMessage('ERROR', message, context), data || '');
        }
    }

    /**
     * Warning logging
     */
    warn(message, context = '', data = null) {
        if (this.shouldLog('WARN')) {
            console.warn(this.formatMessage('WARN', message, context), data || '');
        }
    }

    /**
     * Info logging (production-safe important events)
     */
    info(message, context = '', data = null) {
        if (this.shouldLog('INFO')) {
            console.log(this.formatMessage('INFO', message, context), data || '');
        }
    }

    /**
     * Debug logging (development only)
     */
    debug(message, context = '', data = null) {
        if (this.shouldLog('DEBUG')) {
            console.log(this.formatMessage('DEBUG', message, context), data || '');
        }
    }

    /**
     * Polling-specific logging (can be toggled separately)
     */
    polling(message, pollingId = '', data = null) {
        const enablePollingLogs = localStorage.getItem('enablePollingLogs') === 'true' || 
                                 new URLSearchParams(window.location.search).get('polling') === 'true';
        
        if (this.isDevelopment && enablePollingLogs) {
            const ctx = pollingId ? `POLLING-${pollingId.slice(-8)}` : 'POLLING';
            console.log(this.formatMessage('POLL', message, ctx), data || '');
        }
    }

    /**
     * WebSocket-specific logging 
     */
    websocket(message, data = null) {
        if (this.shouldLog('DEBUG')) {
            console.log(this.formatMessage('WS', message, 'WebSocket'), data || '');
        }
    }

    /**
     * API-specific logging
     */
    api(message, endpoint = '', data = null) {
        if (this.shouldLog('DEBUG')) {
            const ctx = endpoint ? `API-${endpoint}` : 'API';
            console.log(this.formatMessage('API', message, ctx), data || '');
        }
    }
}

// Export singleton instance
export const logger = new Logger();

// Legacy console methods for gradual migration
export const legacyLog = {
    log: (message, ...args) => logger.info(message, '', args.length ? args : null),
    error: (message, ...args) => logger.error(message, '', args.length ? args : null),
    warn: (message, ...args) => logger.warn(message, '', args.length ? args : null),
    debug: (message, ...args) => logger.debug(message, '', args.length ? args : null),
};