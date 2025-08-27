/**
 * Phase 2 Testing Script for Incremental Updates
 * Run in browser console after loading agent dashboard
 */

console.log('🧪 Phase 2: Testing Incremental Updates for New Messages...');

// Test utility functions
const testUtils = {
    // Enable incremental updates
    enableIncrementalUpdates() {
        if (window.dashboard?.conversationUpdateManager) {
            window.dashboard.conversationUpdateManager.enableNewMessageUpdates();
            console.log('✅ Incremental updates enabled');
            return true;
        } else {
            console.error('❌ ConversationUpdateManager not available');
            return false;
        }
    },

    // Disable incremental updates (back to full reload)
    disableIncrementalUpdates() {
        if (window.dashboard?.conversationUpdateManager) {
            window.dashboard.conversationUpdateManager.disableIncrementalUpdates();
            console.log('✅ Incremental updates disabled - back to full reload');
            return true;
        } else {
            console.error('❌ ConversationUpdateManager not available');
            return false;
        }
    },

    // Get current status and metrics
    getStatus() {
        if (window.dashboard?.conversationUpdateManager) {
            const status = window.dashboard.conversationUpdateManager.getStatus();
            console.log('📊 Current Status:', status);
            return status;
        } else {
            console.error('❌ ConversationUpdateManager not available');
            return null;
        }
    },

    // Test incremental update manually
    testIncrementalUpdate(conversationId = 'test-conversation-id') {
        if (window.dashboard?.conversationUpdateManager) {
            const testData = {
                conversationId,
                message: 'Test message for incremental update',
                timestamp: new Date().toISOString()
            };
            
            console.log('🧪 Testing incremental update with data:', testData);
            
            return window.dashboard.conversationUpdateManager
                .handleWebSocketUpdate('new_message', testData)
                .then(() => {
                    console.log('✅ Manual incremental update test succeeded');
                    return true;
                })
                .catch((error) => {
                    console.log('⚠️ Manual incremental update test failed:', error.message);
                    return false;
                });
        } else {
            console.error('❌ ConversationUpdateManager not available');
            return Promise.resolve(false);
        }
    },

    // Compare performance between incremental and full reload
    async performanceTest() {
        console.log('📊 Starting performance comparison test...');
        
        const results = {
            fullReload: { times: [], average: 0 },
            incremental: { times: [], average: 0 }
        };

        // Test full reload (disabled incremental)
        this.disableIncrementalUpdates();
        console.log('⏱️ Testing full reload performance...');
        
        for (let i = 0; i < 3; i++) {
            const startTime = performance.now();
            await window.dashboard.loadConversations();
            const endTime = performance.now();
            results.fullReload.times.push(endTime - startTime);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between tests
        }
        
        results.fullReload.average = results.fullReload.times.reduce((a, b) => a + b, 0) / results.fullReload.times.length;

        // Test incremental update (enabled incremental)
        this.enableIncrementalUpdates();
        console.log('⏱️ Testing incremental update performance...');
        
        for (let i = 0; i < 3; i++) {
            const startTime = performance.now();
            try {
                await this.testIncrementalUpdate(`test-perf-${i}`);
            } catch (error) {
                console.log(`Incremental test ${i} failed, skipping`);
            }
            const endTime = performance.now();
            results.incremental.times.push(endTime - startTime);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between tests
        }

        results.incremental.average = results.incremental.times.reduce((a, b) => a + b, 0) / results.incremental.times.length;

        console.log('📊 Performance Test Results:');
        console.log(`Full Reload Average: ${results.fullReload.average.toFixed(2)}ms`);
        console.log(`Incremental Average: ${results.incremental.average.toFixed(2)}ms`);
        console.log(`Performance Improvement: ${((results.fullReload.average - results.incremental.average) / results.fullReload.average * 100).toFixed(1)}%`);

        return results;
    }
};

// Make testUtils available globally
window.testUtils = testUtils;

// Initial status check
console.log('🔍 Checking initial state...');
testUtils.getStatus();

console.log('🎯 Phase 2 testing ready! Available commands:');
console.log('  testUtils.enableIncrementalUpdates()  - Enable incremental updates');
console.log('  testUtils.disableIncrementalUpdates() - Disable incremental updates');
console.log('  testUtils.getStatus()                 - Get current status');
console.log('  testUtils.testIncrementalUpdate()     - Test manual incremental update');
console.log('  testUtils.performanceTest()           - Compare performance');

// Auto-enable for initial testing
console.log('🚀 Auto-enabling incremental updates for Phase 2 testing...');
testUtils.enableIncrementalUpdates();