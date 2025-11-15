/**
 * Settings Manager - Main Coordinator
 * 
 * Coordinates all settings modules and maintains backward compatibility
 * Replaces the monolithic Settings class with a modular architecture
 */

import { APIManager } from './core/APIManager.js';
import { StateManager } from './core/StateManager.js';
import { ConnectionManager } from './core/ConnectionManager.js';
import { AccountManagementModule } from './modules/AccountManagementModule.js';
import { SystemModeModule } from './modules/SystemModeModule.js';
import { WidgetConfigModule } from './modules/WidgetConfigModule.js';
import { UserManagementModule } from './modules/UserManagementModule.js';
import { BrandingConfigModule } from './modules/BrandingConfigModule.js';
import { ContextEngineeringModule } from './modules/ContextEngineeringModule.js';
import { KnowledgeManagementModule } from './modules/KnowledgeManagementModule.js';
import { CategoryManagementModule } from './modules/CategoryManagementModule.js';
import { TemplateManagementModule } from './modules/TemplateManagementModule.js';
import SecurityPolicyModule from './modules/SecurityPolicyModule.js';
import StatisticsModule from './modules/StatisticsModule.js';
import { Toast } from '../agent-dashboard/utils/Toast.js';
import { ErrorHandler } from '../agent-dashboard/utils/ErrorHandler.js';

export class SettingsManager {
    constructor() {
        this.apiUrl = window.location.origin;
        
        // Initialize core modules
        this.stateManager = new StateManager();
        this.apiManager = new APIManager(this.apiUrl, this.stateManager);
        this.connectionManager = new ConnectionManager(this.apiUrl, this.stateManager);

        // Initialize feature modules
        this.accountManagementModule = new AccountManagementModule(this.apiManager, this.stateManager);
        this.systemModeModule = new SystemModeModule(this.apiManager, this.stateManager, this.connectionManager);
        this.widgetConfigModule = new WidgetConfigModule(this.apiManager, this.stateManager, this.connectionManager);
        this.userManagementModule = new UserManagementModule(this.apiManager, this.stateManager, this.connectionManager);
        this.brandingConfigModule = new BrandingConfigModule(this.apiManager, this.stateManager, this.connectionManager);
        this.contextEngineeringModule = new ContextEngineeringModule(this.apiManager, this.stateManager, this.connectionManager);
        this.knowledgeManagementModule = new KnowledgeManagementModule(this.apiManager, this.stateManager, this.connectionManager);
        this.categoryManagementModule = new CategoryManagementModule(this.apiManager, this.stateManager, this.connectionManager);
        this.templateManagementModule = new TemplateManagementModule(this.apiManager, this.stateManager, this.connectionManager);
        this.securityPolicyModule = new SecurityPolicyModule(this.apiManager, this.stateManager);
        this.statisticsModule = new StatisticsModule(this.apiManager, this.stateManager);

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
            
            // Check authentication - redirect if no token
            if (!this.apiManager.agentToken) {
                console.log('⚠️ No authentication token found, redirecting to login');
                window.location.href = '/login.html';
                return;
            }

            // Load current user BEFORE initializing modules so they have access to user data
            console.log('👤 SettingsManager: Loading current user before module initialization');
            await this.apiManager.loadCurrentUser();
            this.currentUser = this.stateManager.getCurrentUser();
            console.log('✅ SettingsManager: User loaded:', this.currentUser?.email, 'Role:', this.currentUser?.role);

            // Initialize feature modules
            console.log('🎯 SettingsManager: Initializing feature modules');
            await this.accountManagementModule.initialize();
            await this.systemModeModule.initialize();
            await this.widgetConfigModule.initialize();
            await this.userManagementModule.initialize();
            await this.brandingConfigModule.initialize();
            await this.contextEngineeringModule.initialize();
            await this.knowledgeManagementModule.initialize();
            await this.categoryManagementModule.initialize();
            await this.templateManagementModule.initialize();
            await this.securityPolicyModule.initialize();
            await this.statisticsModule.initialize();
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

            // User already loaded before module initialization
            // Just ensure legacy compatibility properties are set
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
        } else if (tabName === 'branding' && this.currentUser && this.currentUser.role === 'admin') {
            console.log('🎨 SettingsManager: Switching to branding tab, loading branding settings');
            
            // Branding configuration is handled by BrandingConfigModule
            await this.brandingConfigModule.loadBrandingSettings();
        } else if (tabName === 'branding') {
            console.log('❌ SettingsManager: Cannot switch to branding tab, user not admin:', this.currentUser?.role || 'no user');
        } else if (tabName === 'knowledge' && this.currentUser && this.currentUser.role === 'admin') {
            console.log('📚 SettingsManager: Switching to knowledge tab, loading knowledge settings');

            // Knowledge management is handled by KnowledgeManagementModule
            await this.knowledgeManagementModule.loadKnowledgeSettings();
        } else if (tabName === 'knowledge') {
            console.log('❌ SettingsManager: Cannot switch to knowledge tab, user not admin:', this.currentUser?.role || 'no user');
        } else if (tabName === 'templates' && this.currentUser && this.currentUser.role === 'admin') {
            console.log('📝 SettingsManager: Switching to templates tab, loading templates');

            // Template management is handled by TemplateManagementModule
            await this.templateManagementModule.loadTemplates();
        } else if (tabName === 'templates') {
            console.log('❌ SettingsManager: Cannot switch to templates tab, user not admin:', this.currentUser?.role || 'no user');
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