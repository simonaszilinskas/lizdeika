/**
 * STRUCTURED LOGGER FACTORY
 * 
 * Main Purpose: Provide centralized, structured logging with correlation IDs for the entire application
 * 
 * Key Responsibilities:
 * - Create Winston logger instances with consistent configuration
 * - Support multiple transport targets (console, file, database)
 * - Automatically include correlation IDs in all log entries
 * - Provide environment-aware logging levels and formats
 * - Handle log rotation and cleanup
 * 
 * Features:
 * - Correlation ID tracking across async operations
 * - JSON structured logging for machine parsing
 * - Daily rotating file logs with compression
 * - Environment-specific log levels and transports
 * - Automatic metadata injection (service, module, timestamp)
 * - Performance-optimized for production use
 * 
 * Log Structure:
 * {
 *   timestamp: "2025-01-08T10:30:00.000Z",
 *   level: "info|warn|error|debug",
 *   correlationId: "req_abc123", 
 *   service: "vilnius-assistant-backend",
 *   module: "conversationService",
 *   message: "Conversation assigned to agent",
 *   userId: "user_123",
 *   metadata: {} // context-specific data
 * }
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const cls = require('cls-hooked');
const DatabaseTransport = require('./databaseTransport');

// Create continuation-local storage namespace for correlation IDs
const correlationNamespace = cls.createNamespace('correlation');

class LoggerFactory {
    constructor() {
        this.loggers = new Map();
        this.service = 'vilnius-assistant-backend';
        this.logDir = process.env.LOG_DIR || path.join(__dirname, '../../logs');
        
        // Ensure logs directory exists
        const fs = require('fs');
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    /**
     * Get correlation ID from async context
     * @returns {string|null} Current correlation ID
     */
    getCorrelationId() {
        return correlationNamespace.get('correlationId') || null;
    }

    /**
     * Set correlation ID in async context
     * @param {string} correlationId - Correlation ID to set
     */
    setCorrelationId(correlationId) {
        correlationNamespace.set('correlationId', correlationId);
    }

    /**
     * Run function with correlation context
     * @param {string} correlationId - Correlation ID
     * @param {function} fn - Function to run
     */
    runWithCorrelation(correlationId, fn) {
        return correlationNamespace.run(() => {
            this.setCorrelationId(correlationId);
            return fn();
        });
    }

    /**
     * Custom log format with correlation ID and structured fields
     */
    createLogFormat() {
        return winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.printf(({ timestamp, level, message, module, userId, metadata, stack, ...rest }) => {
                const correlationId = this.getCorrelationId();
                
                const logEntry = {
                    timestamp,
                    level,
                    correlationId,
                    service: this.service,
                    module,
                    message,
                    userId,
                    metadata,
                    ...rest
                };

                // Include stack trace for errors
                if (stack) {
                    logEntry.stack = stack;
                }

                // Remove undefined fields
                Object.keys(logEntry).forEach(key => {
                    if (logEntry[key] === undefined || logEntry[key] === null) {
                        delete logEntry[key];
                    }
                });

                return JSON.stringify(logEntry);
            })
        );
    }

    /**
     * Create console transport with appropriate formatting
     */
    createConsoleTransport() {
        const isDevelopment = process.env.NODE_ENV === 'development';
        
        return new winston.transports.Console({
            level: isDevelopment ? 'debug' : 'info',
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'HH:mm:ss' }),
                winston.format.printf(({ timestamp, level, message, module, correlationId }) => {
                    const correlation = correlationId ? `[${correlationId}]` : '';
                    const moduleStr = module ? `[${module}]` : '';
                    return `${timestamp} ${level} ${correlation} ${moduleStr} ${message}`;
                })
            )
        });
    }

    /**
     * Create file transport for structured logs
     */
    createFileTransport() {
        return new DailyRotateFile({
            filename: path.join(this.logDir, 'vilnius-assistant-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
            format: this.createLogFormat(),
            level: 'info'
        });
    }

    /**
     * Create error-specific file transport
     */
    createErrorFileTransport() {
        return new DailyRotateFile({
            filename: path.join(this.logDir, 'errors-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
            format: this.createLogFormat(),
            level: 'error'
        });
    }

    /**
     * Create database transport for structured log storage
     */
    createDatabaseTransport() {
        return new DatabaseTransport({
            level: 'info' // Only store info+ levels in database
        });
    }

    /**
     * Create logger for a specific module
     * @param {string} module - Module name (e.g., 'conversationService', 'authController')
     * @returns {winston.Logger} Configured logger instance
     */
    createLogger(module) {
        if (this.loggers.has(module)) {
            return this.loggers.get(module);
        }

        const transports = [this.createConsoleTransport()];
        
        // Add file transports in production or when LOG_TO_FILE is enabled
        if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
            transports.push(this.createFileTransport());
            transports.push(this.createErrorFileTransport());
        }

        // Add database transport for structured logging storage
        if (process.env.LOG_TO_DATABASE !== 'false') {
            transports.push(this.createDatabaseTransport());
        }

        const logger = winston.createLogger({
            level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
            defaultMeta: { module },
            transports,
            exitOnError: false
        });

        // Add custom methods for structured logging
        const originalLog = logger.log.bind(logger);
        logger.log = (level, message, meta = {}) => {
            return originalLog(level, message, {
                ...meta,
                module,
                correlationId: this.getCorrelationId()
            });
        };

        // Convenience methods with automatic metadata injection
        logger.logWithUser = (level, message, userId, metadata = {}) => {
            return logger.log(level, message, { userId, metadata });
        };

        logger.logError = (error, context = {}) => {
            return logger.error(error.message || error, {
                stack: error.stack,
                ...context
            });
        };

        logger.logActivity = (action, details = {}) => {
            return logger.info(`Activity: ${action}`, { metadata: details });
        };

        this.loggers.set(module, logger);
        return logger;
    }

    /**
     * Get the correlation namespace for middleware
     */
    getNamespace() {
        return correlationNamespace;
    }
}

// Singleton instance
const loggerFactory = new LoggerFactory();

module.exports = {
    LoggerFactory,
    createLogger: (module) => loggerFactory.createLogger(module),
    getCorrelationId: () => loggerFactory.getCorrelationId(),
    setCorrelationId: (id) => loggerFactory.setCorrelationId(id),
    runWithCorrelation: (id, fn) => loggerFactory.runWithCorrelation(id, fn),
    getNamespace: () => loggerFactory.getNamespace()
};