/**
 * Component Rollback Manager
 * Manages safe rollback of individual components during modernization
 * Provides circuit breaker patterns and automatic fallback mechanisms
 */

class ComponentRollbackManager {
    constructor(featureFlags) {
        this.featureFlags = featureFlags;
        this.componentStates = new Map();
        this.circuitBreakers = new Map();
        this.fallbackComponents = new Map();
        this.performanceMonitors = new Map();
        
        this.config = {
            errorThreshold: 3,
            errorWindowMs: 60000, // 1 minute
            performanceThreshold: 2000, // 2 seconds
            circuitBreakerTimeout: 300000, // 5 minutes
            autoRecoveryAttempts: 3
        };
        
        this.setupEventListeners();
        console.log('🔄 Component Rollback Manager initialized');
    }

    /**
     * Register a component with rollback capabilities
     */
    registerComponent(componentName, config = {}) {
        const componentConfig = {
            name: componentName,
            flagName: `useNew${componentName}`,
            fallbackFlagName: `force${componentName}Fallback`,
            errorThreshold: config.errorThreshold || this.config.errorThreshold,
            performanceThreshold: config.performanceThreshold || this.config.performanceThreshold,
            autoRollback: config.autoRollback !== false,
            monitoring: config.monitoring !== false,
            ...config
        };
        
        this.componentStates.set(componentName, {
            config: componentConfig,
            errors: [],
            performanceMetrics: [],
            lastError: null,
            rollbackCount: 0,
            isRolledBack: false,
            circuitBreakerState: 'closed', // closed, open, half-open
            lastRecoveryAttempt: null
        });
        
        // Initialize circuit breaker
        this.initializeCircuitBreaker(componentName);
        
        console.log(`🔄 Component registered: ${componentName}`);
        return this;
    }

    /**
     * Initialize circuit breaker for component
     */
    initializeCircuitBreaker(componentName) {
        this.circuitBreakers.set(componentName, {
            state: 'closed',
            errorCount: 0,
            lastError: null,
            openTimestamp: null,
            recoveryAttempts: 0
        });
    }

    /**
     * Create component wrapper with automatic rollback
     */
    createComponentWrapper(componentName, newComponent, oldComponent) {
        if (!this.componentStates.has(componentName)) {
            this.registerComponent(componentName);
        }

        return (...args) => {
            const componentState = this.componentStates.get(componentName);
            const circuitBreaker = this.circuitBreakers.get(componentName);
            
            // Check if component is forcibly rolled back
            if (this.featureFlags.isEnabled(componentState.config.fallbackFlagName)) {
                return this.executeWithFallback(componentName, oldComponent, args, 'forced_fallback');
            }
            
            // Check circuit breaker state
            if (circuitBreaker.state === 'open') {
                if (this.shouldAttemptRecovery(componentName)) {
                    circuitBreaker.state = 'half-open';
                    console.log(`🔄 Attempting recovery for ${componentName}`);
                } else {
                    return this.executeWithFallback(componentName, oldComponent, args, 'circuit_breaker_open');
                }
            }
            
            // Check if new component is enabled
            if (!this.featureFlags.isEnabled(componentState.config.flagName)) {
                return this.executeWithFallback(componentName, oldComponent, args, 'feature_disabled');
            }
            
            // Execute new component with monitoring
            return this.executeWithMonitoring(componentName, newComponent, oldComponent, args);
        };
    }

    /**
     * Execute component with monitoring and error handling
     */
    executeWithMonitoring(componentName, newComponent, oldComponent, args) {
        const startTime = performance.now();
        const componentState = this.componentStates.get(componentName);
        
        try {
            // Execute new component
            const result = newComponent(...args);
            
            // If it's a promise, handle async errors
            if (result && typeof result.then === 'function') {
                return result.catch((error) => {
                    this.handleComponentError(componentName, error, 'async_execution');
                    return this.executeWithFallback(componentName, oldComponent, args, 'async_error');
                });
            }
            
            // Record successful execution
            const executionTime = performance.now() - startTime;
            this.recordPerformance(componentName, executionTime);
            
            // Reset circuit breaker on success
            this.resetCircuitBreaker(componentName);
            
            return result;
            
        } catch (error) {
            const executionTime = performance.now() - startTime;
            this.handleComponentError(componentName, error, 'sync_execution');
            return this.executeWithFallback(componentName, oldComponent, args, 'sync_error');
        }
    }

    /**
     * Execute with fallback component
     */
    executeWithFallback(componentName, fallbackComponent, args, reason) {
        console.log(`🔄 Using fallback for ${componentName}: ${reason}`);
        
        try {
            const result = fallbackComponent(...args);
            this.recordFallbackUsage(componentName, reason);
            return result;
        } catch (fallbackError) {
            console.error(`❌ Fallback also failed for ${componentName}:`, fallbackError);
            this.handleFallbackError(componentName, fallbackError);
            throw fallbackError;
        }
    }

    /**
     * Handle component errors
     */
    handleComponentError(componentName, error, context) {
        const componentState = this.componentStates.get(componentName);
        const circuitBreaker = this.circuitBreakers.get(componentName);
        
        const errorInfo = {
            error: error.message || String(error),
            stack: error.stack,
            context,
            timestamp: Date.now(),
            component: componentName
        };
        
        // Add to error history
        componentState.errors.push(errorInfo);
        componentState.lastError = errorInfo;
        
        // Update circuit breaker
        circuitBreaker.errorCount++;
        circuitBreaker.lastError = errorInfo;
        
        // Clean old errors (outside time window)
        this.cleanOldErrors(componentName);
        
        console.error(`❌ Component error in ${componentName}:`, error);
        
        // Check if we should open circuit breaker
        if (this.shouldOpenCircuitBreaker(componentName)) {
            this.openCircuitBreaker(componentName);
        }
        
        // Check if we should rollback component
        if (componentState.config.autoRollback && this.shouldRollbackComponent(componentName)) {
            this.rollbackComponent(componentName, 'error_threshold_exceeded');
        }
        
        // Emit error event
        this.emitComponentError(componentName, errorInfo);
    }

    /**
     * Handle fallback errors
     */
    handleFallbackError(componentName, error) {
        console.error(`🚨 CRITICAL: Fallback failed for ${componentName}:`, error);
        
        // Emit critical error
        const event = new CustomEvent('componentRollback:fallbackError', {
            detail: {
                component: componentName,
                error: error.message,
                timestamp: Date.now()
            }
        });
        window.dispatchEvent(event);
        
        // Try to use feature flags emergency rollback
        this.featureFlags.emergencyRollback(`Fallback failed for ${componentName}`);
    }

    /**
     * Record performance metrics
     */
    recordPerformance(componentName, executionTime) {
        const componentState = this.componentStates.get(componentName);
        
        const perfMetric = {
            executionTime,
            timestamp: Date.now()
        };
        
        componentState.performanceMetrics.push(perfMetric);
        
        // Keep only recent metrics
        if (componentState.performanceMetrics.length > 50) {
            componentState.performanceMetrics = componentState.performanceMetrics.slice(-50);
        }
        
        // Check performance threshold
        if (executionTime > componentState.config.performanceThreshold) {
            console.warn(`⚡ Performance issue in ${componentName}: ${executionTime}ms`);
            
            if (componentState.config.autoRollback) {
                this.rollbackComponent(componentName, 'performance_threshold_exceeded');
            }
        }
    }

    /**
     * Record fallback usage
     */
    recordFallbackUsage(componentName, reason) {
        const componentState = this.componentStates.get(componentName);
        
        // Track fallback usage for analytics
        if (!componentState.fallbackUsage) {
            componentState.fallbackUsage = [];
        }
        
        componentState.fallbackUsage.push({
            reason,
            timestamp: Date.now()
        });
        
        // Emit fallback event
        const event = new CustomEvent('componentRollback:fallbackUsed', {
            detail: {
                component: componentName,
                reason,
                timestamp: Date.now()
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * Circuit breaker logic
     */
    shouldOpenCircuitBreaker(componentName) {
        const componentState = this.componentStates.get(componentName);
        const circuitBreaker = this.circuitBreakers.get(componentName);
        
        return circuitBreaker.errorCount >= componentState.config.errorThreshold;
    }

    openCircuitBreaker(componentName) {
        const circuitBreaker = this.circuitBreakers.get(componentName);
        
        circuitBreaker.state = 'open';
        circuitBreaker.openTimestamp = Date.now();
        
        console.warn(`🔌 Circuit breaker OPENED for ${componentName}`);
        
        // Emit circuit breaker event
        const event = new CustomEvent('componentRollback:circuitBreakerOpened', {
            detail: {
                component: componentName,
                timestamp: Date.now()
            }
        });
        window.dispatchEvent(event);
        
        // Schedule recovery attempt
        this.scheduleRecoveryAttempt(componentName);
    }

    resetCircuitBreaker(componentName) {
        const circuitBreaker = this.circuitBreakers.get(componentName);
        
        if (circuitBreaker.state !== 'closed') {
            circuitBreaker.state = 'closed';
            circuitBreaker.errorCount = 0;
            circuitBreaker.recoveryAttempts = 0;
            
            console.log(`✅ Circuit breaker CLOSED for ${componentName}`);
        }
    }

    shouldAttemptRecovery(componentName) {
        const circuitBreaker = this.circuitBreakers.get(componentName);
        
        if (!circuitBreaker.openTimestamp) return false;
        
        const timeOpen = Date.now() - circuitBreaker.openTimestamp;
        const canAttemptRecovery = timeOpen >= this.config.circuitBreakerTimeout;
        const hasRecoveryAttemptsLeft = circuitBreaker.recoveryAttempts < this.config.autoRecoveryAttempts;
        
        return canAttemptRecovery && hasRecoveryAttemptsLeft;
    }

    scheduleRecoveryAttempt(componentName) {
        setTimeout(() => {
            const circuitBreaker = this.circuitBreakers.get(componentName);
            if (circuitBreaker.state === 'open') {
                circuitBreaker.recoveryAttempts++;
                console.log(`🔄 Scheduled recovery attempt ${circuitBreaker.recoveryAttempts} for ${componentName}`);
            }
        }, this.config.circuitBreakerTimeout);
    }

    /**
     * Component rollback logic
     */
    shouldRollbackComponent(componentName) {
        const componentState = this.componentStates.get(componentName);
        
        // Count recent errors
        const now = Date.now();
        const recentErrors = componentState.errors.filter(
            error => (now - error.timestamp) <= this.config.errorWindowMs
        );
        
        return recentErrors.length >= componentState.config.errorThreshold;
    }

    rollbackComponent(componentName, reason) {
        const componentState = this.componentStates.get(componentName);
        
        // Set fallback flag
        this.featureFlags.setFlag(componentState.config.fallbackFlagName, true);
        
        componentState.isRolledBack = true;
        componentState.rollbackCount++;
        
        console.warn(`🔄 Component ROLLED BACK: ${componentName} (${reason})`);
        
        // Emit rollback event
        const event = new CustomEvent('componentRollback:componentRolledBack', {
            detail: {
                component: componentName,
                reason,
                rollbackCount: componentState.rollbackCount,
                timestamp: Date.now()
            }
        });
        window.dispatchEvent(event);
        
        // Create feature flags rollback state
        this.featureFlags.createRollbackState(`component_rollback_${componentName}`, {
            component: componentName,
            reason,
            errors: componentState.errors.slice(-5) // Last 5 errors
        });
    }

    /**
     * Manually rollback component
     */
    manualRollback(componentName, reason = 'manual') {
        if (!this.componentStates.has(componentName)) {
            console.error(`❌ Component ${componentName} not registered`);
            return false;
        }
        
        this.rollbackComponent(componentName, reason);
        return true;
    }

    /**
     * Restore component
     */
    restoreComponent(componentName) {
        if (!this.componentStates.has(componentName)) {
            console.error(`❌ Component ${componentName} not registered`);
            return false;
        }
        
        const componentState = this.componentStates.get(componentName);
        
        // Clear fallback flag
        this.featureFlags.setFlag(componentState.config.fallbackFlagName, false);
        
        // Reset state
        componentState.isRolledBack = false;
        componentState.errors = [];
        
        // Reset circuit breaker
        this.resetCircuitBreaker(componentName);
        
        console.log(`✅ Component restored: ${componentName}`);
        
        // Emit restore event
        const event = new CustomEvent('componentRollback:componentRestored', {
            detail: {
                component: componentName,
                timestamp: Date.now()
            }
        });
        window.dispatchEvent(event);
        
        return true;
    }

    /**
     * Clean old errors
     */
    cleanOldErrors(componentName) {
        const componentState = this.componentStates.get(componentName);
        const now = Date.now();
        
        componentState.errors = componentState.errors.filter(
            error => (now - error.timestamp) <= this.config.errorWindowMs
        );
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for feature flag changes
        window.addEventListener('featureFlag:change', (event) => {
            const { flagName, newValue } = event.detail;
            
            // Check if this affects any of our components
            for (const [componentName, state] of this.componentStates) {
                if (flagName === state.config.flagName && !newValue) {
                    console.log(`🚩 Component ${componentName} disabled via feature flag`);
                }
            }
        });
        
        // Listen for emergency rollback
        window.addEventListener('featureFlag:emergencyRollback', (event) => {
            console.log('🚨 Emergency rollback detected, rolling back all components');
            this.rollbackAllComponents('emergency_rollback');
        });
    }

    /**
     * Rollback all components
     */
    rollbackAllComponents(reason = 'manual') {
        for (const componentName of this.componentStates.keys()) {
            this.rollbackComponent(componentName, reason);
        }
        
        console.warn(`🔄 ALL COMPONENTS ROLLED BACK: ${reason}`);
    }

    /**
     * Emit component error event
     */
    emitComponentError(componentName, errorInfo) {
        const event = new CustomEvent('componentRollback:componentError', {
            detail: {
                component: componentName,
                error: errorInfo,
                timestamp: Date.now()
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * Get component status
     */
    getComponentStatus(componentName) {
        const componentState = this.componentStates.get(componentName);
        const circuitBreaker = this.circuitBreakers.get(componentName);
        
        if (!componentState) return null;
        
        return {
            name: componentName,
            isEnabled: this.featureFlags.isEnabled(componentState.config.flagName),
            isRolledBack: componentState.isRolledBack,
            rollbackCount: componentState.rollbackCount,
            errorCount: componentState.errors.length,
            lastError: componentState.lastError,
            circuitBreakerState: circuitBreaker.state,
            avgPerformance: this.getAveragePerformance(componentName),
            fallbackUsage: componentState.fallbackUsage?.length || 0
        };
    }

    /**
     * Get all components status
     */
    getAllComponentsStatus() {
        const status = {};
        for (const componentName of this.componentStates.keys()) {
            status[componentName] = this.getComponentStatus(componentName);
        }
        return status;
    }

    /**
     * Get average performance for component
     */
    getAveragePerformance(componentName) {
        const componentState = this.componentStates.get(componentName);
        const metrics = componentState.performanceMetrics;
        
        if (metrics.length === 0) return 0;
        
        const sum = metrics.reduce((acc, metric) => acc + metric.executionTime, 0);
        return Math.round(sum / metrics.length);
    }

    /**
     * Debug information
     */
    debug() {
        console.group('🔄 Component Rollback Manager Debug');
        console.log('All Components Status:', this.getAllComponentsStatus());
        console.log('Circuit Breakers:', Object.fromEntries(this.circuitBreakers));
        console.groupEnd();
    }
}

// Export for use
window.ComponentRollbackManager = ComponentRollbackManager;