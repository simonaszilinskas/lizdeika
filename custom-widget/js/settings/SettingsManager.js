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
            
            // User management elements
            totalUsersSpan: document.getElementById('total-users'),
            usersTableBody: document.getElementById('users-table-body'),
            
            // Modal elements
            editUserModal: document.getElementById('edit-user-modal'),
            newPasswordModal: document.getElementById('new-password-modal'),
            addUserModal: document.getElementById('add-user-modal'),
            editUserForm: document.getElementById('edit-user-form'),
            addUserForm: document.getElementById('add-user-form')
        };
        
        console.log('🎯 SettingsManager: DOM elements initialized');
    }

    /**
     * Attach event listeners to DOM elements
     */
    attachEventListeners() {
        // Tab switching
        this.elements.tabButtons.forEach(button => {
            button.addEventListener('click', () => this.switchTab(button.dataset.tab));
        });
        
        // System mode
        if (this.elements.saveModeButton) {
            this.elements.saveModeButton.addEventListener('click', () => this.saveSystemMode());
        }
        
        // Widget configuration - handled by WidgetConfigModule
        
        // User management forms
        if (this.elements.editUserForm) {
            this.elements.editUserForm.addEventListener('submit', (e) => this.handleEditUserSubmit(e));
        }
        if (this.elements.addUserForm) {
            this.elements.addUserForm.addEventListener('submit', (e) => this.handleAddUserSubmit(e));
        }
        
        // Add user button
        const addUserBtn = document.getElementById('add-user-btn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => this.openAddUserModal());
        }
        
        // Setup modal event listeners
        this.setupModalEventListeners();
        
        console.log('🔗 SettingsManager: Event listeners attached');
    }

    /**
     * Setup modal event listeners
     */
    setupModalEventListeners() {
        // Modal close buttons
        const modalCloseButtons = [
            { id: 'close-edit-modal', modal: 'edit-user-modal' },
            { id: 'cancel-edit', modal: 'edit-user-modal' },
            { id: 'close-password-modal', modal: 'new-password-modal' },
            { id: 'password-modal-close', modal: 'new-password-modal' },
            { id: 'close-add-modal', modal: 'add-user-modal' },
            { id: 'cancel-add-user', modal: 'add-user-modal' },
            { id: 'copy-password', action: 'copyPassword' }
        ];
        
        modalCloseButtons.forEach(({ id, modal, action }) => {
            const element = document.getElementById(id);
            if (element) {
                if (action === 'copyPassword') {
                    element.addEventListener('click', () => this.copyPasswordToClipboard());
                } else {
                    element.addEventListener('click', () => this.closeModal(modal));
                }
            }
        });
        
        // Close modals when clicking outside
        [this.elements.editUserModal, this.elements.newPasswordModal, this.elements.addUserModal].forEach(modal => {
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.closeModal(modal.id);
                    }
                });
            }
        });
    }

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
            
            // Load users if admin
            if (this.currentUser && this.currentUser.role === 'admin') {
                console.log('👑 SettingsManager: User is admin, loading users and showing admin elements');
                await this.apiManager.loadUsers();
                
                // Show admin-only elements
                document.body.classList.add('admin-user');
                
                // Update users display immediately if we're on the users tab or have users data
                const currentUsers = this.stateManager.getUsers();
                if (currentUsers && currentUsers.length > 0) {
                    console.log('👥 SettingsManager: Updating users display after initial load');
                    this.updateUsersDisplay(currentUsers);
                }
                
                console.log('✅ SettingsManager: Admin elements shown');
            } else {
                console.log('❌ SettingsManager: User is not admin:', this.currentUser?.role || 'no user');
            }
            
            // Check URL hash for direct tab navigation
            if (window.location.hash === '#users' && this.currentUser && this.currentUser.role === 'admin') {
                this.switchTab('users');
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
        
        this.stateManager.on('usersChanged', (users) => {
            console.log('👥 SettingsManager: Users changed event received:', users?.length || 'null');
            this.updateUsersDisplay(users);
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
    switchTab(tabName) {
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
            
            // Always update UI with current users data when switching to users tab
            const existingUsers = this.stateManager.getUsers();
            if (existingUsers && existingUsers.length > 0) {
                console.log('👥 SettingsManager: Users already in state, updating display immediately');
                this.updateUsersDisplay(existingUsers);
            }
            
            // Also trigger a refresh to get latest data
            this.apiManager.loadUsers();
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

    /**
     * Update users display
     */
    updateUsersDisplay(users) {
        console.log('🎨 SettingsManager: updateUsersDisplay called with users:', users?.length || 'null');
        console.log('  - Users table body element:', !!this.elements.usersTableBody);
        
        if (!this.elements.usersTableBody) {
            console.log('❌ SettingsManager: No usersTableBody element found');
            return;
        }
        
        if (!users || users.length === 0) {
            console.log('📝 SettingsManager: No users to display, showing empty state');
            this.elements.usersTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-500">No users found</td>
                </tr>
            `;
            return;
        }
        
        console.log('📝 SettingsManager: Rendering users table for', users.length, 'users');

        this.elements.usersTableBody.innerHTML = users.map(user => `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${user.firstName} ${user.lastName}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${user.email}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                    }">
                        ${user.role}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }">
                        ${user.isActive ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${user.lastLogin ? this.formatDate(user.lastLogin) : 'Never'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button onclick="settingsManager.editUser('${user.id}')" class="text-indigo-600 hover:text-indigo-900">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="settingsManager.regeneratePassword('${user.id}')" class="text-yellow-600 hover:text-yellow-900" title="Regenerate Password">
                        <i class="fas fa-key"></i>
                    </button>
                    <button onclick="settingsManager.toggleUserStatus('${user.id}', ${user.isActive})" class="${user.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}" title="${user.isActive ? 'Deactivate' : 'Reactivate'} User">
                        <i class="fas fa-${user.isActive ? 'user-slash' : 'user-check'}"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        if (this.elements.totalUsersSpan) {
            this.elements.totalUsersSpan.textContent = users.length;
        }
    }

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

    /**
     * Edit user (legacy method)
     */
    async editUser(userId) {
        return this.apiManager.editUser(userId);
    }

    /**
     * Handle edit user form submit (legacy method)
     */
    async handleEditUserSubmit(e) {
        return this.apiManager.handleEditUserSubmit(e);
    }

    /**
     * Handle add user form submit (legacy method)
     */
    async handleAddUserSubmit(e) {
        return this.apiManager.handleAddUserSubmit(e);
    }

    /**
     * Regenerate user password (legacy method)
     */
    async regeneratePassword(userId) {
        return this.apiManager.regeneratePassword(userId);
    }

    /**
     * Toggle user status (legacy method)
     */
    async toggleUserStatus(userId, isCurrentlyActive) {
        return this.apiManager.toggleUserStatus(userId, isCurrentlyActive);
    }

    /**
     * Open add user modal
     */
    openAddUserModal() {
        if (this.elements.addUserForm) {
            this.elements.addUserForm.reset();
        }
        
        if (this.elements.addUserModal) {
            this.elements.addUserModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Close modal
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    /**
     * Copy password to clipboard
     */
    async copyPasswordToClipboard() {
        try {
            const password = document.getElementById('generated-password')?.textContent;
            if (password) {
                await navigator.clipboard.writeText(password);
                
                const button = document.getElementById('copy-password');
                if (button) {
                    const originalHTML = button.innerHTML;
                    button.innerHTML = '<i class="fas fa-check"></i>';
                    
                    setTimeout(() => {
                        button.innerHTML = originalHTML;
                    }, 2000);
                }
            }
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to copy password to clipboard');
        }
    }

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