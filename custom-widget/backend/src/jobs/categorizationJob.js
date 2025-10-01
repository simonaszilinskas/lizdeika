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

        console.log('📋 Categorization Job initialized');
        console.log(`   Schedule: ${this.schedule}`);
        console.log(`   Status: ${this.stats.isEnabled ? 'ENABLED' : 'DISABLED'}`);
    }

    /**
     * Execute the categorization job
     * @returns {Promise<{processed: number, successful: number, failed: number}>}
     */
    async execute() {
        if (this.isRunning) {
            console.log('⏭️  Categorization job already running, skipping this cycle');
            return { processed: 0, successful: 0, failed: 0, skipped: true };
        }

        if (!this.stats.isEnabled) {
            return { processed: 0, successful: 0, failed: 0, disabled: true };
        }

        this.isRunning = true;
        const startTime = Date.now();
        this.stats.totalRuns++;
        this.stats.lastRun = new Date();

        console.log('');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log(`🤖 Auto-Categorization Job #${this.stats.totalRuns} Started`);
        console.log(`   Timestamp: ${this.stats.lastRun.toISOString()}`);
        console.log('═══════════════════════════════════════════════════════════════');

        try {
            // Use the AI categorization service to batch process tickets
            const result = await aiCategorizationService.batchCategorizeTickets(10);

            // Update statistics
            this.stats.totalProcessed += result.processed;
            this.stats.totalSuccessful += result.successful;
            this.stats.totalFailed += result.failed;
            this.stats.lastRunDuration = Date.now() - startTime;

            // Log summary
            console.log('');
            console.log('───────────────────────────────────────────────────────────────');
            console.log('📊 Job Summary:');
            console.log(`   Processed: ${result.processed} tickets`);
            console.log(`   Successful: ${result.successful} tickets`);
            console.log(`   Failed: ${result.failed} tickets`);
            console.log(`   Duration: ${this.stats.lastRunDuration}ms`);
            console.log('───────────────────────────────────────────────────────────────');

            // Log detailed results if any tickets were processed
            if (result.results && result.results.length > 0) {
                console.log('');
                console.log('📝 Detailed Results:');
                result.results.forEach((ticketResult, idx) => {
                    const status = ticketResult.success ? '✅' : '❌';
                    const category = ticketResult.categoryName || 'N/A';
                    const confidence = ticketResult.confidence
                        ? `${(ticketResult.confidence * 100).toFixed(0)}%`
                        : 'N/A';

                    console.log(`   ${idx + 1}. ${status} Ticket ${ticketResult.ticketNumber}`);
                    console.log(`      Category: ${category} (confidence: ${confidence})`);
                    if (ticketResult.reasoning) {
                        console.log(`      Reasoning: ${ticketResult.reasoning.substring(0, 80)}...`);
                    }
                    if (!ticketResult.success && ticketResult.message) {
                        console.log(`      Reason: ${ticketResult.message}`);
                    }
                });
            }

            console.log('');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log(`✅ Auto-Categorization Job #${this.stats.totalRuns} Completed`);
            console.log('═══════════════════════════════════════════════════════════════');
            console.log('');

            return result;

        } catch (error) {
            this.stats.lastRunDuration = Date.now() - startTime;
            console.error('');
            console.error('═══════════════════════════════════════════════════════════════');
            console.error(`❌ Auto-Categorization Job #${this.stats.totalRuns} Failed`);
            console.error(`   Error: ${error.message}`);
            console.error(`   Duration: ${this.stats.lastRunDuration}ms`);
            console.error('═══════════════════════════════════════════════════════════════');
            console.error('');

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
            console.log('⚠️  Categorization job already started');
            return;
        }

        if (!this.stats.isEnabled) {
            console.log('ℹ️  Categorization job disabled via environment variable');
            return;
        }

        try {
            console.log('🚀 Starting automatic categorization job...');
            console.log(`   Schedule: ${this.schedule} (every 5 minutes)`);

            // Validate cron schedule first
            if (!cron.validate(this.schedule)) {
                throw new Error(`Invalid cron schedule: ${this.schedule}`);
            }

            this.task = cron.schedule(this.schedule, async () => {
                try {
                    await this.execute();
                } catch (error) {
                    console.error('Categorization job execution error:', error);
                }
            });

            console.log('✅ Categorization job started successfully');
        } catch (error) {
            console.error('❌ Failed to start categorization job:', error.message);
            throw error;
        }
    }

    /**
     * Stop the cron job
     */
    stop() {
        if (!this.task) {
            console.log('⚠️  Categorization job not running');
            return;
        }

        console.log('🛑 Stopping categorization job...');
        this.task.stop();
        this.task = null;
        console.log('✅ Categorization job stopped');
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
        console.log('✅ Categorization job enabled');

        if (!this.task) {
            this.start();
        }
    }

    /**
     * Disable the job
     */
    disable() {
        this.stats.isEnabled = false;
        console.log('⏸️  Categorization job disabled');

        if (this.task) {
            this.stop();
        }
    }

    /**
     * Manually trigger job execution (for testing or admin control)
     * @returns {Promise<Object>} Execution results
     */
    async trigger() {
        console.log('🔧 Manual trigger of categorization job');
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
        console.log('🔄 Job statistics reset');
    }
}

// Export singleton instance
module.exports = new CategorizationJob();
