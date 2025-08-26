/**
 * Phase 5A: Feature Flags and Rollback System
 * Provides safe component migration with instant rollback capabilities
 * Critical for zero-downtime UI/UX modernization
 */

class FeatureFlagsSystem {
    constructor(config = {}) {
        this.config = {
            storageKey: 'vilnius_feature_flags',
            rollbackStorageKey: 'vilnius_rollback_state',
            enableLocalStorage: config.enableLocalStorage !== false,
            enableRemoteConfig: config.enableRemoteConfig !== false,
            apiEndpoint: config.apiEndpoint || '/api/feature-flags',
            defaultFlags: {
                // Component migration flags
                useNewNotifications: false,
                useNewUserModal: false,
                useNewSettingsForm: false,
                useNewDashboardLayout: false,
                useNewErrorHandling: true, // Already implemented and stable
                
                // Feature flags for gradual rollout
                modernComponentsEnabled: false,
                parallelArchitectureMode: false,
                
                // Emergency controls
                disableAllNewFeatures: false,
                forceOldComponents: false,
                
                // User-specific flags
                betaUser: false,
                adminUser: false
            },
            
            // Rollback configurations
            rollbackConfigs: {
                maxRollbackStates: 10,
                autoRollbackOnError: true,
                errorThreshold: 3, // Max errors before auto-rollback
                performanceThreshold: 5000 // Max load time before rollback (ms)
            },
            
            ...config
        };
        
        this.flags = { ...this.config.defaultFlags };
        this.rollbackStates = [];
        this.errorCount = 0;
        this.performanceMetrics = [];
        this.initialized = false;
        
        this.init();
    }

    /**
     * Initialize the feature flags system
     */
    async init() {
        console.log('🚩 Initializing Feature Flags System...');
        
        // Load flags from storage
        this.loadFlagsFromStorage();
        
        // Load remote configuration if enabled
        if (this.config.enableRemoteConfig) {
            await this.loadRemoteConfig();
        }
        
        // Setup error monitoring integration
        this.setupErrorMonitoring();
        
        // Setup performance monitoring
        this.setupPerformanceMonitoring();
        
        // Setup user detection
        this.setupUserDetection();
        
        // Save initial state as rollback point
        this.createRollbackState('initial_state');
        
        this.initialized = true;
        console.log('✅ Feature Flags System initialized');
        console.log('🚩 Current flags:', this.flags);
    }

    /**
     * Get feature flag value
     */
    isEnabled(flagName, defaultValue = false) {
        if (!this.initialized) {
            console.warn('⚠️ Feature flags not initialized, using default');
            return defaultValue;
        }
        
        // Check for emergency override
        if (this.flags.disableAllNewFeatures && this.isNewFeature(flagName)) {
            return false;
        }
        
        if (this.flags.forceOldComponents && this.isComponentFlag(flagName)) {
            return false;
        }
        
        return this.flags[flagName] ?? defaultValue;
    }

    /**
     * Set feature flag value
     */
    setFlag(flagName, value, createRollback = true) {
        if (createRollback) {
            this.createRollbackState(`before_${flagName}_change`);
        }
        
        const oldValue = this.flags[flagName];
        this.flags[flagName] = value;
        
        console.log(`🚩 Flag '${flagName}' changed: ${oldValue} → ${value}`);
        
        // Save to storage
        this.saveFlagsToStorage();
        
        // Emit change event
        this.emitFlagChange(flagName, value, oldValue);
        
        return this;
    }

    /**
     * Set multiple flags at once
     */
    setFlags(flagsObj, createRollback = true) {
        if (createRollback) {
            this.createRollbackState('bulk_flag_change');
        }
        
        Object.keys(flagsObj).forEach(flagName => {
            const oldValue = this.flags[flagName];
            this.flags[flagName] = flagsObj[flagName];
            this.emitFlagChange(flagName, flagsObj[flagName], oldValue);
        });
        
        this.saveFlagsToStorage();
        console.log('🚩 Bulk flags updated:', flagsObj);
        
        return this;
    }

    /**
     * Toggle feature flag
     */
    toggleFlag(flagName, createRollback = true) {
        const currentValue = this.isEnabled(flagName);
        return this.setFlag(flagName, !currentValue, createRollback);
    }

    /**
     * Create rollback state
     */
    createRollbackState(description, metadata = {}) {
        const rollbackState = {
            id: `rollback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            description,
            flags: { ...this.flags },
            metadata: {
                userAgent: navigator.userAgent,
                url: window.location.href,
                ...metadata
            }
        };
        
        this.rollbackStates.unshift(rollbackState);
        
        // Maintain max rollback states
        if (this.rollbackStates.length > this.config.rollbackConfigs.maxRollbackStates) {
            this.rollbackStates = this.rollbackStates.slice(0, this.config.rollbackConfigs.maxRollbackStates);
        }
        
        // Save to storage
        this.saveRollbackStatesToStorage();
        
        console.log(`💾 Rollback state created: ${description}`);
        return rollbackState.id;
    }

    /**
     * Rollback to previous state
     */
    rollback(rollbackId = null, reason = 'manual') {
        let targetState;
        
        if (rollbackId) {
            targetState = this.rollbackStates.find(state => state.id === rollbackId);
        } else {
            targetState = this.rollbackStates[0]; // Most recent
        }
        
        if (!targetState) {
            console.error('❌ No rollback state found');
            return false;
        }
        
        console.log(`🔄 Rolling back to: ${targetState.description} (${reason})`);
        
        // Apply rollback state
        this.flags = { ...targetState.flags };
        this.saveFlagsToStorage();
        
        // Emit rollback event
        this.emitRollback(targetState, reason);
        
        // Reset error count
        this.errorCount = 0;
        
        console.log('✅ Rollback completed');
        return true;
    }

    /**
     * Emergency rollback - disables all new features
     */
    emergencyRollback(reason = 'emergency') {
        console.warn(`🚨 EMERGENCY ROLLBACK TRIGGERED: ${reason}`);
        
        this.setFlags({
            disableAllNewFeatures: true,
            forceOldComponents: true,
            modernComponentsEnabled: false,
            parallelArchitectureMode: false,
            
            // Keep error handling since it's stable
            useNewErrorHandling: true
        }, false);
        
        this.emitEmergencyRollback(reason);
        
        // Send alert if possible
        this.sendEmergencyAlert(reason);
        
        return true;
    }

    /**
     * Setup error monitoring integration
     */
    setupErrorMonitoring() {
        // Integration with existing error monitoring
        if (window.errorMonitoring) {
            const originalReportError = window.errorMonitoring.reportError;
            const self = this;
            
            window.errorMonitoring.reportError = function(error, context = {}, errorInfo = null) {
                // Call original reporter
                const result = originalReportError.call(this, error, context, errorInfo);
                
                // Track errors for auto-rollback
                self.trackError(error, context, errorInfo);
                
                return result;
            };
        }
        
        // Global error listeners
        window.addEventListener('error', (event) => {
            this.trackError(event.error, {
                type: 'javascript',
                filename: event.filename,
                lineno: event.lineno
            });
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.trackError(event.reason, {
                type: 'promise_rejection'
            });
        });
    }

    /**
     * Track errors for auto-rollback
     */
    trackError(error, context = {}, errorInfo = null) {
        this.errorCount++;
        
        console.log(`⚠️ Error tracked (${this.errorCount}/${this.config.rollbackConfigs.errorThreshold}):`, error.message);
        
        // Check if we should auto-rollback
        if (this.config.rollbackConfigs.autoRollbackOnError && 
            this.errorCount >= this.config.rollbackConfigs.errorThreshold) {
            
            this.emergencyRollback(`Error threshold exceeded (${this.errorCount} errors)`);
        }
    }

    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Monitor page load performance
        if ('performance' in window) {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    const loadTime = performance.now();
                    this.trackPerformance('page_load', loadTime);
                }, 0);
            });
        }
        
        // Monitor navigation performance
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType === 'navigation') {
                            this.trackPerformance('navigation', entry.duration);
                        }
                    }
                });
                observer.observe({ entryTypes: ['navigation'] });
            } catch (error) {
                console.debug('Performance observer not supported:', error);
            }
        }
    }

    /**
     * Track performance metrics
     */
    trackPerformance(metric, value) {
        this.performanceMetrics.push({
            metric,
            value,
            timestamp: Date.now()
        });
        
        // Keep only last 50 metrics
        if (this.performanceMetrics.length > 50) {
            this.performanceMetrics = this.performanceMetrics.slice(-50);
        }
        
        // Check performance threshold
        if (value > this.config.rollbackConfigs.performanceThreshold) {
            console.warn(`⚡ Performance issue detected: ${metric} took ${value}ms`);
            
            if (this.config.rollbackConfigs.autoRollbackOnError) {
                this.emergencyRollback(`Performance threshold exceeded: ${metric} (${value}ms)`);
            }
        }
    }

    /**
     * Setup user detection for user-specific flags
     */
    setupUserDetection() {
        // Try to get user data from various sources
        this.detectUserRole();
        this.detectBetaUser();
    }

    /**
     * Detect user role
     */
    detectUserRole() {
        try {
            // From localStorage
            const userData = localStorage.getItem('user_data');
            if (userData) {
                const user = JSON.parse(userData);
                if (user.role === 'admin') {
                    this.setFlag('adminUser', true, false);
                }
            }
            
            // From DOM or other indicators
            if (document.body.classList.contains('admin-user')) {
                this.setFlag('adminUser', true, false);
            }
        } catch (error) {
            console.debug('Could not detect user role:', error);
        }
    }

    /**
     * Detect beta user
     */
    detectBetaUser() {
        try {
            // Check URL params
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('beta') === 'true') {
                this.setFlag('betaUser', true, false);
            }
            
            // Check localStorage
            if (localStorage.getItem('beta_user') === 'true') {
                this.setFlag('betaUser', true, false);
            }
        } catch (error) {
            console.debug('Could not detect beta user:', error);
        }
    }

    /**
     * Load flags from localStorage
     */
    loadFlagsFromStorage() {
        if (!this.config.enableLocalStorage) return;
        
        try {
            const storedFlags = localStorage.getItem(this.config.storageKey);
            if (storedFlags) {
                const parsed = JSON.parse(storedFlags);
                this.flags = { ...this.config.defaultFlags, ...parsed };
                console.log('🚩 Flags loaded from storage');
            }
            
            const storedRollbacks = localStorage.getItem(this.config.rollbackStorageKey);
            if (storedRollbacks) {
                this.rollbackStates = JSON.parse(storedRollbacks);
                console.log(`💾 ${this.rollbackStates.length} rollback states loaded`);
            }
        } catch (error) {
            console.warn('⚠️ Failed to load flags from storage:', error);
        }
    }

    /**
     * Save flags to localStorage
     */
    saveFlagsToStorage() {
        if (!this.config.enableLocalStorage) return;
        
        try {
            localStorage.setItem(this.config.storageKey, JSON.stringify(this.flags));
        } catch (error) {
            console.warn('⚠️ Failed to save flags to storage:', error);
        }
    }

    /**
     * Save rollback states to localStorage
     */
    saveRollbackStatesToStorage() {
        if (!this.config.enableLocalStorage) return;
        
        try {
            localStorage.setItem(this.config.rollbackStorageKey, JSON.stringify(this.rollbackStates));
        } catch (error) {
            console.warn('⚠️ Failed to save rollback states:', error);
        }
    }

    /**
     * Load remote configuration
     */
    async loadRemoteConfig() {
        try {
            const response = await fetch(this.config.apiEndpoint);
            if (response.ok) {
                const remoteFlags = await response.json();
                this.flags = { ...this.flags, ...remoteFlags };
                console.log('🌐 Remote flags loaded');
            }
        } catch (error) {
            console.debug('Could not load remote config:', error);
        }
    }

    /**
     * Helper methods
     */
    isNewFeature(flagName) {
        const newFeatureFlags = [
            'useNewNotifications', 'useNewUserModal', 'useNewSettingsForm',
            'useNewDashboardLayout', 'modernComponentsEnabled', 'parallelArchitectureMode'
        ];
        return newFeatureFlags.includes(flagName);
    }

    isComponentFlag(flagName) {
        const componentFlags = [
            'useNewNotifications', 'useNewUserModal', 'useNewSettingsForm', 'useNewDashboardLayout'
        ];
        return componentFlags.includes(flagName);
    }

    /**
     * Event emission
     */
    emitFlagChange(flagName, newValue, oldValue) {
        const event = new CustomEvent('featureFlag:change', {
            detail: { flagName, newValue, oldValue }
        });
        window.dispatchEvent(event);
    }

    emitRollback(rollbackState, reason) {
        const event = new CustomEvent('featureFlag:rollback', {
            detail: { rollbackState, reason }
        });
        window.dispatchEvent(event);
    }

    emitEmergencyRollback(reason) {
        const event = new CustomEvent('featureFlag:emergencyRollback', {
            detail: { reason, timestamp: new Date().toISOString() }
        });
        window.dispatchEvent(event);
    }

    /**
     * Send emergency alert
     */
    sendEmergencyAlert(reason) {
        try {
            // Try to send alert to monitoring endpoint
            fetch('/api/alerts/emergency', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'feature_flag_emergency_rollback',
                    reason,
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    url: window.location.href
                })
            });
        } catch (error) {
            console.debug('Could not send emergency alert:', error);
        }
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            flags: { ...this.flags },
            rollbackStatesCount: this.rollbackStates.length,
            errorCount: this.errorCount,
            performanceMetrics: this.performanceMetrics.slice(-10), // Last 10
            lastRollback: this.rollbackStates[0] || null
        };
    }

    /**
     * Debug methods
     */
    debug() {
        console.group('🚩 Feature Flags Debug Info');
        console.log('Status:', this.getStatus());
        console.log('Rollback States:', this.rollbackStates);
        console.log('Performance Metrics:', this.performanceMetrics);
        console.groupEnd();
    }

    /**
     * Administrative methods
     */
    enableBetaMode() {
        this.setFlags({
            betaUser: true,
            useNewNotifications: true,
            useNewUserModal: true,
            modernComponentsEnabled: true
        });
        console.log('🧪 Beta mode enabled');
    }

    disableBetaMode() {
        this.setFlags({
            betaUser: false,
            useNewNotifications: false,
            useNewUserModal: false,
            modernComponentsEnabled: false
        });
        console.log('🧪 Beta mode disabled');
    }

    enableSafeMode() {
        this.emergencyRollback('Safe mode activated');
        console.log('🛡️ Safe mode enabled - all new features disabled');
    }

    /**
     * Component wrapper utilities
     */
    wrapComponent(componentName, newComponent, oldComponent) {
        return (...args) => {
            const flagName = `useNew${componentName}`;
            if (this.isEnabled(flagName)) {
                try {
                    return newComponent(...args);
                } catch (error) {
                    console.error(`❌ New ${componentName} failed:`, error);
                    this.trackError(error, { component: componentName });
                    return oldComponent(...args);
                }
            } else {
                return oldComponent(...args);
            }
        };
    }

    /**
     * Cleanup
     */
    destroy() {
        // Save current state
        this.saveFlagsToStorage();
        this.saveRollbackStatesToStorage();
        
        console.log('🧹 Feature Flags System cleaned up');
    }
}

// Create global instance
const featureFlags = new FeatureFlagsSystem();

// Export for use
window.featureFlags = featureFlags;
window.FeatureFlagsSystem = FeatureFlagsSystem;

// Development helpers
if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    window.enableBeta = () => featureFlags.enableBetaMode();
    window.disableBeta = () => featureFlags.disableBetaMode();
    window.emergencyRollback = (reason) => featureFlags.emergencyRollback(reason);
    window.debugFlags = () => featureFlags.debug();
}