/**
 * AUTOMATIC TICKET CATEGORIZATION JOB
 *
 * Main Purpose: Background job that automatically categorizes uncategorized support tickets using AI
 *
 * Key Responsibilities:
 * - Periodic Execution: Runs every 5 minutes to process eligible tickets
 * - Batch Processing: Processes up to 10 tickets per run to avoid overload
 * - Error Handling: Gracefully handles failures and continues processing
 * - Logging: Provides detailed logs for monitoring and debugging
 * - Resource Management: Respects rate limits and prevents AI service overload
 *
 * Process Flow:
 * 1. Find tickets eligible for auto-categorization (1+ hours old, no category)
 * 2. Process each ticket in sequence with AI categorization service
 * 3. Update tickets with AI-suggested categories
 * 4. Log success/failure for each ticket
 * 5. Report summary statistics
 *
 * Configuration:
 * - Runs every 5 minutes via cron schedule
 * - Processes max 10 tickets per run
 * - Respects ENABLE_AUTO_CATEGORIZATION environment variable
 * - Uses AI categorization service configuration
 *
 * Dependencies:
 * - AI categorization service for ticket classification
 * - Prisma for database operations
 * - Node-cron for scheduling
 *
 * Notes:
 * - Job runs independently of HTTP requests
 * - Does not block server startup
 * - Can be triggered manually via API endpoint
 * - Handles concurrent execution safely
 */

const cron = require('node-cron');
const aiCategorizationService = require('../services/aiCategorizationService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('categorizationJob');

class CategorizationJob {
    constructor() {
        this.isRunning = false;
        this.schedule = '*/5 * * * *'; // Every 5 minutes
        this.task = null;
        this.stats = {
            totalRuns: 0,
            totalProcessed: 0,
            totalSuccessful: 0,
            totalFailed: 0,
            lastRun: null,
            lastRunDuration: 0,
            isEnabled: process.env.ENABLE_AUTO_CATEGORIZATION !== 'false'
        };

        logger.info('Categorization Job initialized', {
            schedule: this.schedule,
            status: this.stats.isEnabled ? 'ENABLED' : 'DISABLED'
        });
    }

    /**
     * Execute the categorization job
     * @returns {Promise<{processed: number, successful: number, failed: number}>}
     */
    async execute() {
        if (this.isRunning) {
            logger.info('Categorization job already running, skipping this cycle');
            return { processed: 0, successful: 0, failed: 0, skipped: true };
        }

        if (!this.stats.isEnabled) {
            return { processed: 0, successful: 0, failed: 0, disabled: true };
        }

        this.isRunning = true;
        const startTime = Date.now();
        this.stats.totalRuns++;
        this.stats.lastRun = new Date();

        logger.info('Auto-Categorization Job Started', {
            jobNumber: this.stats.totalRuns,
            timestamp: this.stats.lastRun.toISOString()
        });

        try {
            // Use the AI categorization service to batch process tickets
            const result = await aiCategorizationService.batchCategorizeTickets(10);

            // Update statistics
            this.stats.totalProcessed += result.processed;
            this.stats.totalSuccessful += result.successful;
            this.stats.totalFailed += result.failed;
            this.stats.lastRunDuration = Date.now() - startTime;

            // Log summary
            logger.info('Job Summary', {
                processed: result.processed,
                successful: result.successful,
                failed: result.failed,
                duration: this.stats.lastRunDuration
            });

            // Log detailed results if any tickets were processed
            if (result.results && result.results.length > 0) {
                const detailedResults = result.results.map((ticketResult, idx) => ({
                    index: idx + 1,
                    success: ticketResult.success,
                    ticketNumber: ticketResult.ticketNumber,
                    category: ticketResult.categoryName || 'N/A',
                    confidence: ticketResult.confidence ? `${(ticketResult.confidence * 100).toFixed(0)}%` : 'N/A',
                    reasoning: ticketResult.reasoning ? ticketResult.reasoning.substring(0, 80) : null,
                    failureReason: !ticketResult.success ? ticketResult.message : null
                }));

                logger.info('Detailed categorization results', { results: detailedResults });
            }

            logger.info('Auto-Categorization Job Completed', { jobNumber: this.stats.totalRuns });

            return result;

        } catch (error) {
            this.stats.lastRunDuration = Date.now() - startTime;
            logger.error('Auto-Categorization Job Failed', {
                jobNumber: this.stats.totalRuns,
                error: error.message,
                stack: error.stack,
                duration: this.stats.lastRunDuration
            });

            throw error;

        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Start the cron job
     */
    start() {
        if (this.task) {
            logger.warn('Categorization job already started');
            return;
        }

        if (!this.stats.isEnabled) {
            logger.info('Categorization job disabled via environment variable');
            return;
        }

        try {
            logger.info('Starting automatic categorization job', {
                schedule: this.schedule,
                description: 'every 5 minutes'
            });

            // Validate cron schedule first
            if (!cron.validate(this.schedule)) {
                throw new Error(`Invalid cron schedule: ${this.schedule}`);
            }

            this.task = cron.schedule(this.schedule, async () => {
                try {
                    await this.execute();
                } catch (error) {
                    logger.error('Categorization job execution error', { error: error.message, stack: error.stack });
                }
            });

            logger.info('Categorization job started successfully');
        } catch (error) {
            logger.error('Failed to start categorization job', { error: error.message, stack: error.stack });
            throw error;
        }
    }

    /**
     * Stop the cron job
     */
    stop() {
        if (!this.task) {
            logger.warn('Categorization job not running');
            return;
        }

        logger.info('Stopping categorization job');
        this.task.stop();
        this.task = null;
        logger.info('Categorization job stopped');
    }

    /**
     * Get job statistics
     * @returns {Object} Job statistics
     */
    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            schedule: this.schedule,
            nextRun: this.task ? 'Scheduled' : 'Not scheduled'
        };
    }

    /**
     * Enable the job
     */
    enable() {
        this.stats.isEnabled = true;
        logger.info('Categorization job enabled');

        if (!this.task) {
            this.start();
        }
    }

    /**
     * Disable the job
     */
    disable() {
        this.stats.isEnabled = false;
        logger.info('Categorization job disabled');

        if (this.task) {
            this.stop();
        }
    }

    /**
     * Manually trigger job execution (for testing or admin control)
     * @returns {Promise<Object>} Execution results
     */
    async trigger() {
        logger.info('Manual trigger of categorization job');
        return await this.execute();
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats.totalRuns = 0;
        this.stats.totalProcessed = 0;
        this.stats.totalSuccessful = 0;
        this.stats.totalFailed = 0;
        this.stats.lastRun = null;
        this.stats.lastRunDuration = 0;
        logger.info('Job statistics reset');
    }
}

// Export singleton instance
module.exports = new CategorizationJob();
