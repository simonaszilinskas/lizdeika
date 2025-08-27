/**
 * Conversation Update Manager
 * Handles incremental updates to conversation list instead of full reloads
 * Phase 1: Infrastructure only - zero behavior changes
 */

/**
 * Feature Flag System for Incremental Updates
 */
class FeatureFlags {
    constructor() {
        this.flags = {
            incrementalUpdates: false, // Start disabled - Phase 1 keeps this false
            animatedTransitions: false,
            debugMode: false
        };
    }

    isEnabled(flagName) {
        return this.flags[flagName] === true;
    }

    enable(flagName) {
        this.flags[flagName] = true;
        console.log(`🚩 Feature flag enabled: ${flagName}`);
    }

    disable(flagName) {
        this.flags[flagName] = false;
        console.log(`🚩 Feature flag disabled: ${flagName}`);
    }

    getStatus() {
        return { ...this.flags };
    }
}

/**
 * Update Monitoring and Debugging
 */
class UpdateMonitor {
    constructor(featureFlags) {
        this.featureFlags = featureFlags;
        this.metrics = [];
        this.maxMetrics = 100; // Keep last 100 metrics
        this.errorThreshold = 0.1; // 10% error rate threshold
    }

    trackUpdate(eventType, success, duration, details = {}) {
        const metric = {
            eventType,
            success,
            duration,
            details,
            timestamp: Date.now()
        };

        this.metrics.push(metric);
        
        // Keep only recent metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }

        // Check error rate and auto-disable if too high
        const recentMetrics = this.metrics.slice(-20); // Last 20 operations
        const errorRate = recentMetrics.filter(m => !m.success).length / recentMetrics.length;
        
        if (errorRate > this.errorThreshold && recentMetrics.length >= 10) {
            console.warn(`🚨 High error rate detected: ${(errorRate * 100).toFixed(1)}% - Disabling incremental updates`);
            this.featureFlags.disable('incrementalUpdates');
        }

        if (this.featureFlags.isEnabled('debugMode')) {
            console.log(`📊 Update tracked: ${eventType} - ${success ? 'SUCCESS' : 'FAILED'} (${duration}ms)`, details);
        }
    }

    getErrorRate() {
        if (this.metrics.length === 0) return 0;
        const failedCount = this.metrics.filter(m => !m.success).length;
        return failedCount / this.metrics.length;
    }

    getMetrics() {
        return {
            total: this.metrics.length,
            errorRate: this.getErrorRate(),
            recentMetrics: this.metrics.slice(-10)
        };
    }
}

/**
 * Main Conversation Update Manager
 * Phase 1: Infrastructure only - all methods built but not used yet
 */
class ConversationUpdateManager {
    constructor(config = {}) {
        this.loader = config.loader; // Reference to ModernConversationLoader
        this.renderer = config.renderer; // Function to render conversation list
        this.logger = config.logger || console;
        
        // Feature flags system
        this.featureFlags = new FeatureFlags();
        
        // Monitoring system
        this.monitor = new UpdateMonitor(this.featureFlags);
        
        // Conversation tracking
        this.conversations = new Map(); // Track individual conversations by ID
        this.updateQueue = [];
        this.isUpdating = false;
        
        this.logger.log('🔧 ConversationUpdateManager initialized (Phase 1 - Infrastructure only)');
        
        // In Phase 1, we build everything but don't change behavior
        // Feature flags keep incremental updates disabled
    }

    /**
     * Main WebSocket event handler - replaces direct loadConversations() calls
     * Phase 1: Always falls back to full reload (feature flag disabled)
     */
    async handleWebSocketUpdate(eventType, eventData) {
        const startTime = Date.now();
        
        try {
            if (this.featureFlags.isEnabled('incrementalUpdates')) {
                // Future phases: process incremental update
                await this.processIncrementalUpdate(eventType, eventData);
                this.monitor.trackUpdate(eventType, true, Date.now() - startTime, { incremental: true });
            } else {
                // Phase 1: Always use fallback (maintains current behavior)
                await this.fallbackToFullReload();
                this.monitor.trackUpdate(eventType, true, Date.now() - startTime, { incremental: false });
            }
        } catch (error) {
            this.logger.warn(`Incremental update failed for ${eventType}, falling back to full reload:`, error);
            await this.fallbackToFullReload();
            this.monitor.trackUpdate(eventType, false, Date.now() - startTime, { error: error.message });
        }
    }

    /**
     * Process incremental updates (Future phases implementation)
     * Phase 1: Built but not used
     */
    async processIncrementalUpdate(eventType, eventData) {
        switch (eventType) {
            case 'new_message':
                return this.updateConversationMessage(eventData);
            case 'assignment_changed':
                return this.updateConversationAssignment(eventData);
            case 'conversation_archived':
                return this.updateConversationArchiveStatus(eventData);
            case 'tickets_reassigned':
                return this.updateMultipleConversationAssignments(eventData);
            default:
                throw new Error(`Unknown event type: ${eventType}`);
        }
    }

    /**
     * Update single conversation with new message
     * Phase 1: Built but not used
     */
    async updateConversationMessage(eventData) {
        // Future implementation: update only the specific conversation
        // that received a new message without full reload
        this.logger.log('📨 Would update conversation message incrementally:', eventData);
        throw new Error('Not implemented in Phase 1');
    }

    /**
     * Update conversation assignment
     * Phase 1: Built but not used
     */
    async updateConversationAssignment(eventData) {
        // Future implementation: update assignment status without full reload
        this.logger.log('👤 Would update conversation assignment incrementally:', eventData);
        throw new Error('Not implemented in Phase 1');
    }

    /**
     * Update conversation archive status
     * Phase 1: Built but not used
     */
    async updateConversationArchiveStatus(eventData) {
        // Future implementation: move conversation between active/archived views
        this.logger.log('📁 Would update conversation archive status incrementally:', eventData);
        throw new Error('Not implemented in Phase 1');
    }

    /**
     * Update multiple conversation assignments (tickets-reassigned event)
     * Phase 1: Built but not used
     */
    async updateMultipleConversationAssignments(eventData) {
        // Future implementation: update multiple assignments without full reload
        this.logger.log('🔄 Would update multiple conversation assignments incrementally:', eventData);
        throw new Error('Not implemented in Phase 1');
    }

    /**
     * Fallback to full reload - uses existing loadConversations()
     * This is the safety net that maintains current behavior
     */
    async fallbackToFullReload() {
        this.logger.log('🔄 Falling back to full conversation reload');
        
        if (this.loader && typeof this.loader.refresh === 'function') {
            this.loader.refresh(); // Clear cache
            // The actual loading will be handled by the existing loadConversations() method
            // We don't call it directly here to avoid changing current behavior
        }
        
        return true; // Signal successful fallback
    }

    /**
     * Enable feature flags (for future phases)
     * Phase 1: Available but not used
     */
    enableIncrementalUpdates() {
        this.logger.log('🚩 Enabling incremental updates');
        this.featureFlags.enable('incrementalUpdates');
    }

    /**
     * Disable feature flags (safety mechanism)
     */
    disableIncrementalUpdates() {
        this.logger.log('🚩 Disabling incremental updates');
        this.featureFlags.disable('incrementalUpdates');
    }

    /**
     * Enable debug mode for monitoring
     */
    enableDebugMode() {
        this.featureFlags.enable('debugMode');
        this.logger.log('🐛 Debug mode enabled for ConversationUpdateManager');
    }

    /**
     * Get current status and metrics
     */
    getStatus() {
        return {
            featureFlags: this.featureFlags.getStatus(),
            metrics: this.monitor.getMetrics(),
            conversations: this.conversations.size,
            isUpdating: this.isUpdating
        };
    }

    /**
     * Test method to verify infrastructure is working
     * Phase 1: Simple test method
     */
    testInfrastructure() {
        this.logger.log('🧪 Testing ConversationUpdateManager infrastructure...');
        
        // Test feature flags
        const flagsWorking = typeof this.featureFlags.isEnabled === 'function';
        
        // Test monitoring
        const monitorWorking = typeof this.monitor.trackUpdate === 'function';
        
        // Test fallback
        const fallbackWorking = typeof this.fallbackToFullReload === 'function';
        
        const results = {
            featureFlags: flagsWorking,
            monitoring: monitorWorking,
            fallback: fallbackWorking,
            overallStatus: flagsWorking && monitorWorking && fallbackWorking ? 'PASS' : 'FAIL'
        };
        
        this.logger.log('🧪 Infrastructure test results:', results);
        return results;
    }

    /**
     * Circuit breaker - disable incremental updates if too many errors
     */
    triggerCircuitBreaker(reason) {
        this.logger.warn(`🚨 Circuit breaker triggered: ${reason}`);
        this.disableIncrementalUpdates();
    }
}

// Export for use in agent dashboard
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ConversationUpdateManager, FeatureFlags, UpdateMonitor };
} else {
    // Browser environment - make available globally
    window.ConversationUpdateManager = ConversationUpdateManager;
    window.FeatureFlags = FeatureFlags;
    window.UpdateMonitor = UpdateMonitor;
}