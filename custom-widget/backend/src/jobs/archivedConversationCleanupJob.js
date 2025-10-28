/**
 * AUTOMATED ARCHIVED CONVERSATION CLEANUP JOB
 *
 * Main Purpose: Automatically delete archived conversations older than a configurable retention period
 *
 * Key Responsibilities:
 * - Periodic Execution: Runs daily at 2 AM to clean up old archived conversations
 * - Batch Processing: Deletes conversations in batches to avoid database locks
 * - Safety Features: Dry-run mode, detailed logging, and audit trail
 * - Performance: Cascade deletes handle related messages and statistics automatically
 *
 * Process Flow:
 * 1. Check if cleanup is enabled via CONVERSATION_RETENTION_DAYS env var
 * 2. Find archived conversations older than retention period
 * 3. Delete in batches of 100 to prevent long-running transactions
 * 4. Log detailed information about deleted conversations
 * 5. Track statistics for monitoring
 *
 * Configuration:
 * - Enabled when: CONVERSATION_RETENTION_DAYS environment variable is set
 * - Schedule: Daily at 2 AM ("0 2 * * *")
 * - Batch size: 100 conversations per batch
 * - Cascade deletes: messages, message_statistics, ticket_actions automatically removed
 *
 * Environment Variables:
 * - CONVERSATION_RETENTION_DAYS: Number of days to retain archived conversations (required to enable)
 *
 * Safety Features:
 * - Dry-run mode available via dryRun() method
 * - Singleton pattern prevents concurrent execution
 * - Detailed audit logging of all deletions
 * - Batch processing prevents table locks
 *
 * Notes:
 * - Job only deletes conversations where archived = true
 * - Uses created_at for age calculation
 * - Prisma cascade deletes handle all related records
 * - Can be triggered manually via admin API endpoint
 */

const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class ArchivedConversationCleanupJob {
    constructor() {
        this.isRunning = false;
        this.schedule = '0 2 * * *'; // Daily at 2 AM
        this.batchSize = 100; // Magic number - process 100 conversations at a time
        this.task = null;
        this.stats = {
            totalRuns: 0,
            totalDeleted: 0,
            lastRun: null,
            lastRunDuration: 0,
            lastRunDeleted: 0,
            isEnabled: !!process.env.CONVERSATION_RETENTION_DAYS,
            retentionDays: parseInt(process.env.CONVERSATION_RETENTION_DAYS) || null
        };

        console.log('🗑️  Archived Conversation Cleanup Job initialized');
        console.log(`   Schedule: ${this.schedule} (daily at 2 AM)`);
        console.log(`   Status: ${this.stats.isEnabled ? 'ENABLED' : 'DISABLED'}`);
        if (this.stats.isEnabled) {
            console.log(`   Retention: ${this.stats.retentionDays} days`);
            console.log(`   Batch Size: ${this.batchSize} conversations`);
        }
    }

    /**
     * Execute the cleanup job
     * @param {boolean} dryRun - If true, only preview deletions without executing
     * @returns {Promise<{deleted: number, batches: number, conversations: Array}>}
     */
    async execute(dryRun = false) {
        if (this.isRunning) {
            console.log('⏭️  Cleanup job already running, skipping this cycle');
            return { deleted: 0, batches: 0, conversations: [], skipped: true };
        }

        if (!this.stats.isEnabled) {
            return { deleted: 0, batches: 0, conversations: [], disabled: true };
        }

        this.isRunning = true;
        const startTime = Date.now();
        this.stats.totalRuns++;
        this.stats.lastRun = new Date();

        const mode = dryRun ? 'DRY-RUN' : 'EXECUTION';

        console.log('');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log(`🗑️  Conversation Cleanup Job #${this.stats.totalRuns} Started (${mode})`);
        console.log(`   Timestamp: ${this.stats.lastRun.toISOString()}`);
        console.log(`   Retention: ${this.stats.retentionDays} days`);
        console.log('═══════════════════════════════════════════════════════════════');

        try {
            // Calculate cutoff date
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.stats.retentionDays);

            console.log(`📅 Cutoff date: ${cutoffDate.toISOString()}`);
            console.log(`   Deleting archived conversations created before this date...`);

            // Find eligible conversations
            const eligibleConversations = await prisma.tickets.findMany({
                where: {
                    archived: true,
                    created_at: {
                        lt: cutoffDate
                    }
                },
                select: {
                    id: true,
                    ticket_number: true,
                    created_at: true,
                    subject: true
                },
                orderBy: {
                    created_at: 'asc'
                }
            });

            console.log(`📊 Found ${eligibleConversations.length} eligible conversations`);

            if (eligibleConversations.length === 0) {
                console.log('✅ No conversations to delete');
                console.log('═══════════════════════════════════════════════════════════════');
                this.isRunning = false;
                return { deleted: 0, batches: 0, conversations: [] };
            }

            let totalDeleted = 0;
            let batchCount = 0;
            const deletedConversations = [];

            // Process in batches
            for (let i = 0; i < eligibleConversations.length; i += this.batchSize) {
                const batch = eligibleConversations.slice(i, i + this.batchSize);
                batchCount++;

                console.log('');
                console.log(`📦 Processing batch ${batchCount} (${batch.length} conversations)...`);

                if (!dryRun) {
                    // Delete conversations (cascade will handle related records)
                    const batchIds = batch.map(c => c.id);
                    const deleteResult = await prisma.tickets.deleteMany({
                        where: {
                            id: {
                                in: batchIds
                            }
                        }
                    });

                    totalDeleted += deleteResult.count;
                    console.log(`   ✅ Deleted ${deleteResult.count} conversations`);
                } else {
                    console.log(`   🔍 Would delete ${batch.length} conversations`);
                }

                // Log first 5 conversations in this batch
                const previewCount = Math.min(5, batch.length);
                console.log(`   Preview (first ${previewCount}):`);
                batch.slice(0, previewCount).forEach((conv, idx) => {
                    const age = Math.floor((Date.now() - conv.created_at.getTime()) / (1000 * 60 * 60 * 24));
                    console.log(`   ${idx + 1}. ${conv.ticket_number} - ${age} days old - "${conv.subject.substring(0, 50)}${conv.subject.length > 50 ? '...' : ''}"`);
                    deletedConversations.push({
                        id: conv.id,
                        ticketNumber: conv.ticket_number,
                        age: age,
                        subject: conv.subject
                    });
                });

                if (batch.length > previewCount) {
                    console.log(`   ... and ${batch.length - previewCount} more`);
                }
            }

            // Update statistics
            this.stats.lastRunDeleted = totalDeleted;
            if (!dryRun) {
                this.stats.totalDeleted += totalDeleted;
            }
            this.stats.lastRunDuration = Date.now() - startTime;

            // Log summary
            console.log('');
            console.log('───────────────────────────────────────────────────────────────');
            console.log(`📊 ${mode} Summary:`);
            console.log(`   ${dryRun ? 'Would delete' : 'Deleted'}: ${dryRun ? eligibleConversations.length : totalDeleted} conversations`);
            console.log(`   Batches: ${batchCount}`);
            console.log(`   Duration: ${this.stats.lastRunDuration}ms`);
            if (!dryRun) {
                console.log(`   Total deleted (lifetime): ${this.stats.totalDeleted}`);
            }
            console.log('───────────────────────────────────────────────────────────────');
            console.log('');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log(`✅ Cleanup Job #${this.stats.totalRuns} Completed (${mode})`);
            console.log('═══════════════════════════════════════════════════════════════');
            console.log('');

            return {
                deleted: dryRun ? 0 : totalDeleted,
                wouldDelete: dryRun ? eligibleConversations.length : undefined,
                batches: batchCount,
                conversations: deletedConversations,
                dryRun: dryRun
            };

        } catch (error) {
            this.stats.lastRunDuration = Date.now() - startTime;
            console.error('');
            console.error('═══════════════════════════════════════════════════════════════');
            console.error(`❌ Cleanup Job #${this.stats.totalRuns} Failed (${mode})`);
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
     * Perform a dry-run to preview what would be deleted
     * @returns {Promise<Object>} Preview of deletions
     */
    async dryRun() {
        console.log('🔍 Executing dry-run of cleanup job');
        return await this.execute(true);
    }

    /**
     * Start the cron job
     */
    start() {
        if (this.task) {
            console.log('⚠️  Cleanup job already started');
            return;
        }

        if (!this.stats.isEnabled) {
            console.log('ℹ️  Cleanup job disabled (CONVERSATION_RETENTION_DAYS not set)');
            return;
        }

        try {
            console.log('🚀 Starting archived conversation cleanup job...');
            console.log(`   Schedule: ${this.schedule} (daily at 2 AM)`);
            console.log(`   Retention: ${this.stats.retentionDays} days`);

            // Validate cron schedule
            if (!cron.validate(this.schedule)) {
                throw new Error(`Invalid cron schedule: ${this.schedule}`);
            }

            this.task = cron.schedule(this.schedule, async () => {
                try {
                    await this.execute(false);
                } catch (error) {
                    console.error('Cleanup job execution error:', error);
                }
            });

            console.log('✅ Cleanup job started successfully');
        } catch (error) {
            console.error('❌ Failed to start cleanup job:', error.message);
            throw error;
        }
    }

    /**
     * Stop the cron job
     */
    stop() {
        if (!this.task) {
            console.log('⚠️  Cleanup job not running');
            return;
        }

        console.log('🛑 Stopping cleanup job...');
        this.task.stop();
        this.task = null;
        console.log('✅ Cleanup job stopped');
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
            batchSize: this.batchSize,
            nextRun: this.task ? 'Scheduled (daily at 2 AM)' : 'Not scheduled'
        };
    }

    /**
     * Manually trigger job execution
     * @param {boolean} dryRun - If true, only preview deletions
     * @returns {Promise<Object>} Execution results
     */
    async trigger(dryRun = false) {
        console.log(`🔧 Manual trigger of cleanup job (${dryRun ? 'DRY-RUN' : 'EXECUTION'})`);
        return await this.execute(dryRun);
    }
}

// Export singleton instance
module.exports = new ArchivedConversationCleanupJob();
