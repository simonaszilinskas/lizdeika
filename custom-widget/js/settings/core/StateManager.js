/**
 * State Manager for Settings System
 * 
 * Manages application state, provides reactive updates, and handles data persistence
 * Replaces scattered state management from the monolithic Settings class
 */

import { ErrorHandler } from '../../agent-dashboard/utils/ErrorHandler.js';

export class StateManager {
    constructor() {
        // Application state
        this.state = {
            currentUser: null,
            systemMode: null,
            connectedAgents: [],
            users: [],
            widgetConfiguration: null,
            uiPreferences: {
                activeTab: 'system',
                lastRefresh: null
            }
        };
        
        // Event listeners for state changes
        this.listeners = new Map();
        
        console.log('🗂️ StateManager: Initialized');
    }

    /**
     * Initialize state manager
     */
    async initialize() {
        try {
            // Load persisted UI preferences
            this.loadUIPreferences();
            
            console.log('✅ StateManager: Initialization complete');
        } catch (error) {
            ErrorHandler.logError(error, 'StateManager initialization failed');
            throw error;
        }
    }

    // =========================
    // EVENT SYSTEM
    // =========================

    /**
     * Add event listener for state changes
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        
        console.log(`📡 StateManager: Listener added for event: ${event}`);
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    /**
     * Emit state change event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        if (!this.listeners.has(event)) return;
        
        this.listeners.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                ErrorHandler.logError(error, `StateManager event callback failed for: ${event}`);
            }
        });
        
        console.log(`📤 StateManager: Event emitted: ${event}`);
    }

    // =========================
    // USER STATE MANAGEMENT
    // =========================

    /**
     * Set current user
     * @param {Object|null} user - User object
     */
    setCurrentUser(user) {
        const previousUser = this.state.currentUser;
        this.state.currentUser = user;
        
        // Emit change event if user actually changed
        if (JSON.stringify(previousUser) !== JSON.stringify(user)) {
            this.emit('currentUserChanged', user);
            console.log('👤 StateManager: Current user updated:', user?.email || 'null');
        }
    }

    /**
     * Get current user
     * @returns {Object|null} Current user object
     */
    getCurrentUser() {
        return this.state.currentUser;
    }

    /**
     * Check if current user is admin
     * @returns {boolean} True if user is admin
     */
    isCurrentUserAdmin() {
        return this.state.currentUser && this.state.currentUser.role === 'admin';
    }

    // =========================
    // SYSTEM MODE STATE MANAGEMENT
    // =========================

    /**
     * Set system mode
     * @param {string} mode - System mode (hitl, autopilot, off)
     */
    setSystemMode(mode) {
        const previousMode = this.state.systemMode;
        this.state.systemMode = mode;
        
        // Emit change event if mode actually changed
        if (previousMode !== mode) {
            this.emit('systemModeChanged', mode);
            console.log('🎛️ StateManager: System mode updated:', mode);
        }
    }

    /**
     * Get current system mode
     * @returns {string|null} Current system mode
     */
    getSystemMode() {
        return this.state.systemMode;
    }

    // =========================
    // CONNECTED AGENTS STATE MANAGEMENT
    // =========================

    /**
     * Set connected agents
     * @param {Array} agents - Array of connected agent objects
     */
    setConnectedAgents(agents) {
        const previousAgents = this.state.connectedAgents;
        this.state.connectedAgents = agents || [];
        
        // Check if agents data actually changed
        const hasChanged = JSON.stringify(previousAgents) !== JSON.stringify(agents);
        
        if (hasChanged) {
            this.emit('connectedAgentsChanged', agents);
            console.log('👥 StateManager: Connected agents updated:', agents.length);
        }
    }

    /**
     * Get connected agents
     * @returns {Array} Array of connected agents
     */
    getConnectedAgents() {
        return this.state.connectedAgents || [];
    }

    /**
     * Get connected agents statistics
     * @returns {Object} Statistics object
     */
    getConnectedAgentsStats() {
        const agents = this.getConnectedAgents();
        return {
            total: agents.length,
            online: agents.filter(a => a.personalStatus === 'online').length,
            offline: agents.filter(a => a.personalStatus !== 'online').length
        };
    }

    // =========================
    // USERS STATE MANAGEMENT (Admin only)
    // =========================

    /**
     * Set users list
     * @param {Array} users - Array of user objects
     */
    setUsers(users) {
        const previousUsers = this.state.users;
        this.state.users = users || [];
        
        // Check if users data actually changed
        const hasChanged = JSON.stringify(previousUsers) !== JSON.stringify(users);
        
        if (hasChanged) {
            this.emit('usersChanged', users);
            console.log('👥 StateManager: Users list updated:', users.length);
        }
    }

    /**
     * Get users list
     * @returns {Array} Array of users
     */
    getUsers() {
        return this.state.users || [];
    }

    /**
     * Get user by ID
     * @param {string} userId - User ID
     * @returns {Object|null} User object or null
     */
    getUserById(userId) {
        return this.state.users.find(user => user.id === userId) || null;
    }

    /**
     * Add or update user in the list
     * @param {Object} user - User object
     */
    upsertUser(user) {
        if (!user || !user.id) return;
        
        const users = [...this.state.users];
        const existingIndex = users.findIndex(u => u.id === user.id);
        
        if (existingIndex >= 0) {
            users[existingIndex] = user;
        } else {
            users.push(user);
        }
        
        this.setUsers(users);
    }

    /**
     * Remove user from the list
     * @param {string} userId - User ID to remove
     */
    removeUser(userId) {
        const users = this.state.users.filter(user => user.id !== userId);
        this.setUsers(users);
    }

    // =========================
    // WIDGET CONFIGURATION STATE MANAGEMENT
    // =========================

    /**
     * Set widget configuration
     * @param {Object} config - Widget configuration object
     */
    setWidgetConfiguration(config) {
        const previousConfig = this.state.widgetConfiguration;
        this.state.widgetConfiguration = config;
        
        // Check if config actually changed
        const hasChanged = JSON.stringify(previousConfig) !== JSON.stringify(config);
        
        if (hasChanged) {
            this.emit('widgetConfigurationChanged', config);
            console.log('🔧 StateManager: Widget configuration updated');
        }
    }

    /**
     * Get widget configuration
     * @returns {Object|null} Widget configuration object
     */
    getWidgetConfiguration() {
        return this.state.widgetConfiguration;
    }

    // =========================
    // UI PREFERENCES STATE MANAGEMENT
    // =========================

    /**
     * Set active tab
     * @param {string} tabName - Name of active tab
     */
    setActiveTab(tabName) {
        const previousTab = this.state.uiPreferences.activeTab;
        this.state.uiPreferences.activeTab = tabName;
        
        if (previousTab !== tabName) {
            this.emit('activeTabChanged', tabName);
            this.saveUIPreferences();
            console.log('📋 StateManager: Active tab updated:', tabName);
        }
    }

    /**
     * Get active tab
     * @returns {string} Active tab name
     */
    getActiveTab() {
        return this.state.uiPreferences.activeTab;
    }

    /**
     * Update last refresh timestamp
     */
    updateLastRefresh() {
        this.state.uiPreferences.lastRefresh = Date.now();
        this.saveUIPreferences();
    }

    /**
     * Get last refresh timestamp
     * @returns {number|null} Last refresh timestamp
     */
    getLastRefresh() {
        return this.state.uiPreferences.lastRefresh;
    }

    // =========================
    // PERSISTENCE
    // =========================

    /**
     * Save UI preferences to localStorage
     */
    saveUIPreferences() {
        try {
            const preferences = {
                activeTab: this.state.uiPreferences.activeTab,
                lastRefresh: this.state.uiPreferences.lastRefresh
            };
            
            localStorage.setItem('settings_ui_preferences', JSON.stringify(preferences));
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to save UI preferences');
        }
    }

    /**
     * Load UI preferences from localStorage
     */
    loadUIPreferences() {
        try {
            const stored = localStorage.getItem('settings_ui_preferences');
            if (stored) {
                const preferences = JSON.parse(stored);
                
                this.state.uiPreferences = {
                    ...this.state.uiPreferences,
                    ...preferences
                };
                
                console.log('📁 StateManager: UI preferences loaded from localStorage');
            }
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load UI preferences');
            // Reset to defaults if loading fails
            this.state.uiPreferences = {
                activeTab: 'system',
                lastRefresh: null
            };
        }
    }

    /**
     * Clear all persisted data
     */
    clearPersistedData() {
        try {
            localStorage.removeItem('settings_ui_preferences');
            console.log('🗑️ StateManager: Persisted data cleared');
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to clear persisted data');
        }
    }

    // =========================
    // DEBUGGING & UTILITIES
    // =========================

    /**
     * Get current state snapshot (for debugging)
     * @returns {Object} Current state object
     */
    getStateSnapshot() {
        return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * Get state summary for debugging
     * @returns {Object} State summary
     */
    getStateSummary() {
        return {
            hasUser: !!this.state.currentUser,
            userRole: this.state.currentUser?.role || null,
            systemMode: this.state.systemMode,
            agentsCount: this.state.connectedAgents.length,
            usersCount: this.state.users.length,
            hasWidgetConfig: !!this.state.widgetConfiguration,
            activeTab: this.state.uiPreferences.activeTab,
            listenerCount: Array.from(this.listeners.entries()).reduce((acc, [event, callbacks]) => {
                acc[event] = callbacks.length;
                return acc;
            }, {})
        };
    }

    /**
     * Reset all state to initial values
     */
    reset() {
        this.state = {
            currentUser: null,
            systemMode: null,
            connectedAgents: [],
            users: [],
            widgetConfiguration: null,
            uiPreferences: {
                activeTab: 'system',
                lastRefresh: null
            }
        };
        
        // Clear all listeners
        this.listeners.clear();
        
        console.log('🔄 StateManager: State reset to initial values');
    }

    /**
     * Cleanup method for proper shutdown
     */
    destroy() {
        // Clear all listeners
        this.listeners.clear();
        
        // Save current preferences
        this.saveUIPreferences();
        
        console.log('🧹 StateManager: Cleanup complete');
    }
}