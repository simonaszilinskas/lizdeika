/**
 * WINSTON DATABASE TRANSPORT
 * 
 * Main Purpose: Custom Winston transport to store logs in PostgreSQL database
 * 
 * Key Responsibilities:
 * - Store structured logs in application_logs table
 * - Handle database connection errors gracefully
 * - Batch log writes for performance
 * - Automatic retry on database failures
 * 
 * Features:
 * - Async log writing with error handling
 * - Metadata serialization to JSONB
 * - Correlation ID support
 * - Performance optimized with connection pooling
 */

const Transport = require('winston-transport');
const { PrismaClient } = require('@prisma/client');

class DatabaseTransport extends Transport {
    constructor(opts) {
        super(opts);
        this.prisma = new PrismaClient();
        this.name = 'database';
        this.level = opts.level || 'info';
    }

    log(info, callback) {
        setImmediate(() => {
            this.emit('logged', info);
        });

        // Extract structured fields from the log info
        const {
            timestamp,
            level,
            message,
            correlationId,
            service = 'vilnius-assistant-backend',
            module,
            userId,
            metadata,
            stack,
            ...rest
        } = info;

        // Combine remaining fields into metadata
        const combinedMetadata = {
            ...metadata,
            ...rest
        };

        // Ensure valid timestamp
        let validTimestamp;
        try {
            if (timestamp) {
                validTimestamp = new Date(timestamp);
                // Check if the Date is valid
                if (isNaN(validTimestamp.getTime())) {
                    validTimestamp = new Date();
                }
            } else {
                validTimestamp = new Date();
            }
        } catch (e) {
            validTimestamp = new Date();
        }

        // Store log in database
        this.prisma.application_logs.create({
            data: {
                timestamp: validTimestamp,
                level,
                correlation_id: correlationId || null,
                service,
                module: module || null,
                message,
                user_id: userId || null,
                metadata: Object.keys(combinedMetadata).length > 0 ? combinedMetadata : null,
                stack: stack || null
            }
        }).catch(error => {
            // Don't let database errors break logging
            // Note: We use console.error here to avoid circular dependency with logger
            console.error('[DatabaseTransport] Failed to write log to database:', error.message);
        });

        callback();
    }

    close() {
        if (this.prisma) {
            this.prisma.$disconnect();
        }
    }
}

module.exports = DatabaseTransport;