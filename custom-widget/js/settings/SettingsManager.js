/**
 * Settings Manager - Main Coordinator
 * 
 * Coordinates all settings modules and maintains backward compatibility
 * Replaces the monolithic Settings class with a modular architecture
 */

import { APIManager } from './core/APIManager.js';
import { StateManager } from './core/StateManager.js';
import { ConnectionManager } from './core/ConnectionManager.js';
import { SystemModeModule } from './modules/SystemModeModule.js';
import { AgentStatusModule } from './modules/AgentStatusModule.js';
import { WidgetConfigModule } from './modules/WidgetConfigModule.js';
import { UserManagementModule } from './modules/UserManagementModule.js';
import { Toast } from '../agent-dashboard/utils/Toast.js';
import { ErrorHandler } from '../agent-dashboard/utils/ErrorHandler.js';

export class SettingsManager {
    constructor() {
        this.apiUrl = window.location.protocol + '//' + window.location.hostname + ':3002';
        
        // Initialize core modules
        this.stateManager = new StateManager();
        this.apiManager = new APIManager(this.apiUrl, this.stateManager);
        this.connectionManager = new ConnectionManager(this.apiUrl, this.stateManager);
        
        // Initialize feature modules
        this.systemModeModule = new SystemModeModule(this.apiManager, this.stateManager, this.connectionManager);
        this.agentStatusModule = new AgentStatusModule(this.apiManager, this.stateManager, this.connectionManager);
        this.widgetConfigModule = new WidgetConfigModule(this.apiManager, this.stateManager, this.connectionManager);
        this.userManagementModule = new UserManagementModule(this.apiManager, this.stateManager, this.connectionManager);
        
        // DOM elements - will be initialized in initializeElements
        this.elements = {};
        
        // Legacy compatibility
        this.currentUser = null;
        this.currentMode = null;
        
        console.log('🏗️ SettingsManager: Initializing modular settings system');
    }

    /**
     * Initialize the settings system
     */
    async initialize() {
        try {
            console.log('🚀 SettingsManager: Starting initialization');
            
            // Initialize DOM elements
            this.initializeElements();
            
            // Setup event listeners
            this.attachEventListeners();
            
            // Initialize state manager
            await this.stateManager.initialize();
            
            // Initialize API manager
            await this.apiManager.initialize();
            
            // Initialize feature modules
            console.log('🎯 SettingsManager: Initializing feature modules');
            await this.systemModeModule.initialize();
            await this.agentStatusModule.initialize();
            await this.widgetConfigModule.initialize();
            await this.userManagementModule.initialize();
            console.log('✅ SettingsManager: Feature modules initialized');
            
            // Load initial data
            await this.loadInitialData();
            
            // Initialize connection manager (WebSocket)
            await this.connectionManager.initialize();
            
            // Setup state change listeners
            this.setupStateListeners();
            
            // Start periodic updates
            this.startPeriodicUpdates();
            
            console.log('✅ SettingsManager: Initialization complete');
            
        } catch (error) {
            ErrorHandler.logError(error, 'SettingsManager initialization failed');
            this.showMessage('Failed to initialize settings system', 'error');
        }
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.elements = {
            // Tab elements
            tabButtons: document.querySelectorAll('.tab-button'),
            tabContents: document.querySelectorAll('.tab-content'),
            
            // System mode elements
            currentModeSpan: document.getElementById('current-mode'),
            saveModeButton: document.getElementById('save-mode'),
            agentsList: document.getElementById('agents-list'),
            totalConnected: document.getElementById('total-connected'),
            totalAvailable: document.getElementById('total-available'),
            
            // Widget configuration elements
            widgetConfigDiv: document.getElementById('current-widget-config'),
            generateCodeButton: document.getElementById('generate-code'),
            codeContainer: document.getElementById('integration-code-container'),
            integrationCodeTextarea: document.getElementById('integration-code'),
            copyCodeButton: document.getElementById('copy-code'),
            
            // User management - handled by UserManagementModule
        };
        
        console.log('🎯 SettingsManager: DOM elements initialized');
    }

    /**
     * Attach event listeners to DOM elements
     */
    attachEventListeners() {
        // Tab switching
        this.elements.tabButtons.forEach(button => {
            button.addEventListener('click', async () => await this.switchTab(button.dataset.tab));
        });
        
        // System mode
        if (this.elements.saveModeButton) {
            this.elements.saveModeButton.addEventListener('click', () => this.saveSystemMode());
        }
        
        // Widget configuration - handled by WidgetConfigModule
        
        // User management - handled by UserManagementModule
        
        console.log('🔗 SettingsManager: Event listeners attached');
    }

    // Modal event listeners - handled by UserManagementModule

    /**
     * Load initial data for all modules
     */
    async loadInitialData() {
        try {
            console.log('📊 SettingsManager: Loading initial data');
            
            // Load current user to determine admin status
            await this.apiManager.loadCurrentUser();
            
            // Update legacy compatibility properties
            this.currentUser = this.stateManager.getCurrentUser();
            
            // Load system mode and agents
            console.log('🎛️ SettingsManager: Loading system mode');
            await this.apiManager.loadSystemMode();
            
            const loadedMode = this.stateManager.getSystemMode();
            console.log('🎛️ SettingsManager: System mode from state after load:', loadedMode);
            
            // If we have a mode but display wasn't updated, update it manually
            if (loadedMode && this.elements.currentModeSpan && this.elements.currentModeSpan.textContent === 'Loading...') {
                console.log('🎛️ SettingsManager: Manually updating system mode display');
                this.updateSystemModeDisplay(loadedMode);
            }
            
            await this.apiManager.loadConnectedAgents();
            
            // Update legacy compatibility
            this.currentMode = loadedMode;
            
            // Widget configuration - loaded by WidgetConfigModule
            
            // Users loading - handled by UserManagementModule
            if (this.currentUser && this.currentUser.role === 'admin') {
                console.log('👑 SettingsManager: User is admin, showing admin elements');
                
                // Show admin-only elements
                document.body.classList.add('admin-user');
                
                // User display is now handled by UserManagementModule
                
                console.log('✅ SettingsManager: Admin elements shown');
            } else {
                console.log('❌ SettingsManager: User is not admin:', this.currentUser?.role || 'no user');
            }
            
            // Check URL hash for direct tab navigation
            if (window.location.hash === '#users' && this.currentUser && this.currentUser.role === 'admin') {
                await this.switchTab('users');
            }
            
            console.log('✅ SettingsManager: Initial data loaded');
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load initial settings data');
            this.showMessage('Failed to load settings data', 'error');
        }
    }

    /**
     * Setup state change listeners
     */
    setupStateListeners() {
        // Listen for state changes and update UI accordingly
        this.stateManager.on('systemModeChanged', (mode) => {
            this.updateSystemModeDisplay(mode);
        });
        
        this.stateManager.on('connectedAgentsChanged', (agents) => {
            this.updateAgentsDisplay(agents);
        });
        
        // Users changes are now handled by UserManagementModule
        
        console.log('👂 SettingsManager: State listeners setup complete');
    }

    /**
     * Start periodic updates
     */
    startPeriodicUpdates() {
        // Use connection manager for real-time updates when possible
        // Fallback to polling for critical data
        setInterval(() => this.apiManager.loadConnectedAgents(), 30000);
        setInterval(() => this.apiManager.loadSystemMode(), 45000);
        
        console.log('🔄 SettingsManager: Periodic updates started');
    }

    // =========================
    // UI UPDATE METHODS
    // =========================

    /**
     * Switch between tabs
     */
    async switchTab(tabName) {
        // Update tab buttons
        this.elements.tabButtons.forEach(button => {
            if (button.dataset.tab === tabName) {
                button.classList.add('active', 'border-indigo-600', 'text-indigo-600');
                button.classList.remove('border-transparent', 'text-gray-600');
            } else {
                button.classList.remove('active', 'border-indigo-600', 'text-indigo-600');
                button.classList.add('border-transparent', 'text-gray-600');
            }
        });

        // Update tab content
        this.elements.tabContents.forEach(content => {
            if (content.id === `${tabName}-tab`) {
                content.classList.remove('hidden');
            } else {
                content.classList.add('hidden');
            }
        });

        // Load tab-specific data
        if (tabName === 'users' && this.currentUser && this.currentUser.role === 'admin') {
            console.log('👥 SettingsManager: Switching to users tab, loading users and updating display');
            
            // User management is now handled by UserManagementModule
            await this.userManagementModule.loadUsers();
        } else if (tabName === 'users') {
            console.log('❌ SettingsManager: Cannot switch to users tab, user not admin:', this.currentUser?.role || 'no user');
        }
    }

    /**
     * Update system mode display
     */
    updateSystemModeDisplay(mode) {
        if (this.elements.currentModeSpan) {
            this.elements.currentModeSpan.textContent = mode.toUpperCase();
        }
        
        // Update radio button
        const radioButton = document.querySelector(`input[value="${mode}"]`);
        if (radioButton) {
            radioButton.checked = true;
        }
        
        // Update legacy compatibility
        this.currentMode = mode;
    }

    /**
     * Update agents display
     */
    updateAgentsDisplay(agents) {
        if (!this.elements.agentsList) return;
        
        if (agents.length === 0) {
            this.elements.agentsList.innerHTML = '<p class="text-gray-500 text-center py-4">No agents currently connected</p>';
            return;
        }
        
        this.elements.agentsList.innerHTML = agents.map(agent => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center gap-3">
                    <div class="w-3 h-3 rounded-full ${agent.personalStatus === 'online' ? 'bg-green-400' : 'bg-gray-400'}"></div>
                    <div>
                        <div class="font-medium text-gray-900">${agent.id.substring(0, 12)}...</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-sm font-medium text-gray-900 capitalize">
                        ${agent.personalStatus || 'online'}
                    </div>
                    <div class="text-xs text-gray-500">
                        Last seen: ${this.formatTime(agent.lastSeen)}
                    </div>
                </div>
            </div>
        `).join('');
        
        // Update stats
        const total = agents.length;
        const available = agents.filter(a => a.personalStatus === 'online').length;
        
        if (this.elements.totalConnected) this.elements.totalConnected.textContent = total;
        if (this.elements.totalAvailable) this.elements.totalAvailable.textContent = available;
    }

    // User display methods - handled by UserManagementModule

    // =========================
    // LEGACY COMPATIBILITY METHODS
    // =========================

    /**
     * Save system mode (legacy method)
     */
    async saveSystemMode() {
        return this.apiManager.saveSystemMode();
    }

    // Widget configuration methods - handled by WidgetConfigModule

    // User management methods - handled by UserManagementModule

    // Modal and password methods - handled by UserManagementModule

    // =========================
    // UTILITY METHODS
    // =========================

    /**
     * Show message using Toast system
     */
    showMessage(text, type = 'info', title = '') {
        switch (type) {
            case 'success':
                Toast.success(text, title);
                break;
            case 'error':
                Toast.error(text, title);
                break;
            case 'warning':
                Toast.warning(text, title);
                break;
            default:
                Toast.info(text, title);
        }
    }

    /**
     * Format timestamp to time string
     */
    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString();
    }

    /**
     * Format timestamp to date string
     */
    formatDate(timestamp) {
        return new Date(timestamp).toLocaleDateString();
    }

    /**
     * Cleanup method for proper shutdown
     */
    destroy() {
        if (this.connectionManager) {
            this.connectionManager.destroy();
        }
        
        console.log('🧹 SettingsManager: Cleanup complete');
    }
}

// Initialize when DOM is loaded and make globally available for legacy compatibility
let settingsManager;
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎬 SettingsManager: DOM loaded, starting initialization');
    settingsManager = new SettingsManager();
    await settingsManager.initialize();
    
    // Legacy compatibility - expose as global
    window.settings = settingsManager;
    window.settingsManager = settingsManager;
});

// Export for ES6 module usage
export default SettingsManager;