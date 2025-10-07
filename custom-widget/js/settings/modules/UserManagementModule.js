/**
 * User Management Module
 * 
 * Handles complete user CRUD operations, modals, forms, and table management
 * Extracted from SettingsManager and APIManager for better modularity and single responsibility
 */

import { Toast } from '../../agent-dashboard/utils/Toast.js';
import { ErrorHandler } from '../../agent-dashboard/utils/ErrorHandler.js';

export class UserManagementModule {
    constructor(apiManager, stateManager, connectionManager) {
        this.apiManager = apiManager;
        this.stateManager = stateManager;
        this.connectionManager = connectionManager;
        
        // DOM elements
        this.elements = {
            // Table elements
            usersTableBody: null,
            totalUsersSpan: null,
            addUserButton: null,
            
            // Modal elements
            addUserModal: null,
            editUserModal: null,
            newPasswordModal: null,
            
            // Form elements
            addUserForm: null,
            editUserForm: null
        };
        
        // Event listeners
        this.eventListeners = [];
        
        // Current state
        this.currentEditUserId = null;
        
        console.log('👥 UserManagementModule: Initialized');
    }

    /**
     * Initialize the user management module
     */
    async initialize() {
        try {
            // Initialize DOM elements
            this.initializeElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup state change listeners
            this.setupStateListeners();
            
            // Load initial users if admin
            await this.loadUsersIfAdmin();
            
            console.log('✅ UserManagementModule: Initialization complete');
            
        } catch (error) {
            ErrorHandler.logError(error, 'UserManagementModule initialization failed');
            throw error;
        }
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.elements = {
            // Table elements
            usersTableBody: document.getElementById('users-table-body'),
            totalUsersSpan: document.getElementById('total-users'),
            addUserButton: document.getElementById('add-user-btn'),

            // Modal elements
            addUserModal: document.getElementById('add-user-modal'),
            editUserModal: document.getElementById('edit-user-modal'),
            newPasswordModal: document.getElementById('new-password-modal'),
            totpSetupModal: document.getElementById('totp-setup-modal'),
            backupCodesModal: document.getElementById('backup-codes-modal'),

            // Form elements
            addUserForm: document.getElementById('add-user-form'),
            editUserForm: document.getElementById('edit-user-form')
        };

        console.log('🎯 UserManagementModule: DOM elements initialized');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Add user button
        if (this.elements.addUserButton) {
            const addUserHandler = () => this.showAddUserModal();
            this.elements.addUserButton.addEventListener('click', addUserHandler);
            this.eventListeners.push({
                element: this.elements.addUserButton,
                event: 'click',
                handler: addUserHandler
            });
        }
        
        // Add user form
        if (this.elements.addUserForm) {
            const addFormHandler = (e) => this.handleAddUserSubmit(e);
            this.elements.addUserForm.addEventListener('submit', addFormHandler);
            this.eventListeners.push({
                element: this.elements.addUserForm,
                event: 'submit',
                handler: addFormHandler
            });
        }
        
        // Edit user form
        if (this.elements.editUserForm) {
            const editFormHandler = (e) => this.handleEditUserSubmit(e);
            this.elements.editUserForm.addEventListener('submit', editFormHandler);
            this.eventListeners.push({
                element: this.elements.editUserForm,
                event: 'submit',
                handler: editFormHandler
            });
        }
        
        // Modal close handlers
        this.setupModalCloseHandlers();
        
        console.log('🔗 UserManagementModule: Event listeners setup');
    }

    /**
     * Setup modal close handlers
     */
    setupModalCloseHandlers() {
        const modals = [
            this.elements.addUserModal,
            this.elements.editUserModal,
            this.elements.newPasswordModal,
            this.elements.totpSetupModal,
            this.elements.backupCodesModal
        ];

        modals.forEach(modal => {
            if (modal) {
                // Close on backdrop click
                const backdropHandler = (e) => {
                    if (e.target === modal) {
                        this.hideModal(modal);
                    }
                };
                modal.addEventListener('click', backdropHandler);
                this.eventListeners.push({
                    element: modal,
                    event: 'click',
                    handler: backdropHandler
                });

                // Close on X button click
                const closeButton = modal.querySelector('.modal-close');
                if (closeButton) {
                    const closeHandler = () => this.hideModal(modal);
                    closeButton.addEventListener('click', closeHandler);
                    this.eventListeners.push({
                        element: closeButton,
                        event: 'click',
                        handler: closeHandler
                    });
                }
            }
        });

        // Specific close button handlers for 2FA modals
        const totpCloseBtn = document.getElementById('close-totp-modal');
        const totpCancelBtn = document.getElementById('cancel-totp-setup');
        const totpVerifyBtn = document.getElementById('verify-totp-button');
        const backupCloseBtn = document.getElementById('close-backup-codes-modal');
        const backupDoneBtn = document.getElementById('close-backup-codes');

        [totpCloseBtn, totpCancelBtn, totpVerifyBtn].forEach(btn => {
            if (btn) {
                const handler = () => this.hideModal(this.elements.totpSetupModal);
                btn.addEventListener('click', handler);
                this.eventListeners.push({ element: btn, event: 'click', handler });
            }
        });

        [backupCloseBtn, backupDoneBtn].forEach(btn => {
            if (btn) {
                const handler = () => this.hideModal(this.elements.backupCodesModal);
                btn.addEventListener('click', handler);
                this.eventListeners.push({ element: btn, event: 'click', handler });
            }
        });

        // Password modal close buttons
        const passwordCloseBtn = document.getElementById('close-password-modal');
        const passwordModalCloseBtn = document.getElementById('password-modal-close');

        [passwordCloseBtn, passwordModalCloseBtn].forEach(btn => {
            if (btn) {
                const handler = () => this.hideModal(this.elements.newPasswordModal);
                btn.addEventListener('click', handler);
                this.eventListeners.push({ element: btn, event: 'click', handler });
            }
        });

        // Copy password button
        const copyPasswordBtn = document.getElementById('copy-password');
        if (copyPasswordBtn) {
            const handler = () => this.copyPasswordToClipboard();
            copyPasswordBtn.addEventListener('click', handler);
            this.eventListeners.push({ element: copyPasswordBtn, event: 'click', handler });
        }
    }

    /**
     * Setup state change listeners
     */
    setupStateListeners() {
        // Listen for user list changes from other sources
        this.stateManager.on('usersChanged', (users) => {
            console.log('👥 UserManagementModule: Users changed via state:', users?.length || 0);
            this.renderUserTable(users);
        });
        
        console.log('👂 UserManagementModule: State listeners setup');
    }

    // =========================
    // CORE FUNCTIONALITY
    // =========================

    /**
     * Load users if current user is admin
     */
    async loadUsersIfAdmin() {
        const currentUser = this.stateManager.getCurrentUser();
        
        if (!currentUser || currentUser.role !== 'admin') {
            console.log('❌ UserManagementModule: User is not admin, skipping user load');
            return;
        }
        
        await this.loadUsers();
    }

    /**
     * Load users from API
     */
    async loadUsers() {
        try {
            console.log('📥 UserManagementModule: Loading users');
            
            const response = await fetch(`${this.apiManager.apiUrl}/api/users`, {
                headers: this.apiManager.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // Update state manager
                this.stateManager.setUsers(data.data || []);
                
                console.log('✅ UserManagementModule: Users loaded successfully');
            } else {
                const errorText = await response.text();
                throw new Error(`Failed to load users: ${response.status} ${errorText}`);
            }
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load users');
            Toast.error('Failed to load users', '');
            console.error('❌ UserManagementModule: loadUsers error:', error);
        }
    }

    /**
     * Create new user
     */
    async createUser(userData) {
        try {
            console.log('➕ UserManagementModule: Creating user:', userData.email);
            
            const response = await fetch(`${this.apiManager.apiUrl}/api/users`, {
                method: 'POST',
                headers: this.apiManager.getAuthHeaders(),
                body: JSON.stringify(userData)
            });
            
            if (response.ok) {
                const result = await response.json();
                
                Toast.success('User created successfully', '');
                
                // Refresh users list
                await this.loadUsers();
                
                // Show generated password if provided
                if (result.data && result.data.password) {
                    this.showNewPasswordModal(result.data.password);
                }
                
                console.log('✅ UserManagementModule: User created successfully');
                return result.data;
                
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create user');
            }
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to create user');
            Toast.error('Failed to create user: ' + error.message, '');
            throw error;
        }
    }

    /**
     * Update existing user
     */
    async updateUser(userId, userData) {
        try {
            console.log('✏️ UserManagementModule: Updating user:', userId);
            
            const response = await fetch(`${this.apiManager.apiUrl}/api/users/${userId}`, {
                method: 'PUT',
                headers: this.apiManager.getAuthHeaders(),
                body: JSON.stringify(userData)
            });
            
            if (response.ok) {
                Toast.success('User updated successfully', '');
                
                // Refresh users list
                await this.loadUsers();
                
                console.log('✅ UserManagementModule: User updated successfully');
                
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update user');
            }
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to update user');
            Toast.error('Failed to update user: ' + error.message, '');
            throw error;
        }
    }

    /**
     * Delete user
     */
    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }
        
        try {
            console.log('🗑️ UserManagementModule: Deleting user:', userId);
            
            const response = await fetch(`${this.apiManager.apiUrl}/api/users/${userId}`, {
                method: 'DELETE',
                headers: this.apiManager.getAuthHeaders()
            });
            
            if (response.ok) {
                Toast.success('User deleted successfully', '');
                
                // Refresh users list
                await this.loadUsers();
                
                console.log('✅ UserManagementModule: User deleted successfully');
                
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete user');
            }
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to delete user');
            Toast.error('Failed to delete user: ' + error.message, '');
        }
    }

    /**
     * Toggle user active status
     */
    async toggleUserStatus(userId, currentStatus) {
        const action = currentStatus ? 'deactivate' : 'reactivate';
        
        try {
            console.log(`🔄 UserManagementModule: ${action} user:`, userId);
            
            const response = await fetch(`${this.apiManager.apiUrl}/api/users/${userId}/${action}`, {
                method: 'POST',
                headers: this.apiManager.getAuthHeaders()
            });
            
            if (response.ok) {
                Toast.success(`User ${action}d successfully`, '');
                
                // Refresh users list
                await this.loadUsers();
                
                console.log(`✅ UserManagementModule: User ${action}d successfully`);
                
            } else {
                const error = await response.json();
                throw new Error(error.error || `Failed to ${action} user`);
            }
            
        } catch (error) {
            ErrorHandler.logError(error, `Failed to ${action} user`);
            Toast.error(`Failed to ${action} user: ${error.message}`, '');
        }
    }

    /**
     * Regenerate user password
     */
    async regeneratePassword(userId) {
        if (!confirm('Are you sure you want to regenerate this user\'s password? They will need to use the new password to log in.')) {
            return;
        }
        
        try {
            console.log('🔑 UserManagementModule: Regenerating password for user:', userId);
            
            const response = await fetch(`${this.apiManager.apiUrl}/api/users/${userId}/regenerate-password`, {
                method: 'POST',
                headers: this.apiManager.getAuthHeaders()
            });
            
            if (response.ok) {
                const result = await response.json();

                Toast.success('Password regenerated successfully', '');

                // Show new password modal
                if (result.data && result.data.newPassword) {
                    this.showNewPasswordModal(result.data.newPassword);
                }

                console.log('✅ UserManagementModule: Password regenerated successfully');
                
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to regenerate password');
            }
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to regenerate password');
            Toast.error('Failed to regenerate password: ' + error.message, '');
        }
    }

    // =========================
    // UI MANAGEMENT
    // =========================

    /**
     * Render user table
     */
    renderUserTable(users) {
        console.log('🎨 UserManagementModule: Rendering user table with', users?.length || 0, 'users');
        
        if (!this.elements.usersTableBody) {
            console.log('❌ UserManagementModule: No usersTableBody element found');
            return;
        }
        
        // Update user count
        this.updateUserCount(users?.length || 0);
        
        if (!users || users.length === 0) {
            this.elements.usersTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-6 py-4 text-center text-gray-500">
                        No users found
                    </td>
                </tr>
            `;
            return;
        }
        
        this.elements.usersTableBody.innerHTML = users.map(user => this.renderUserRow(user)).join('');
        
        console.log('✅ UserManagementModule: User table rendered');
    }

    /**
     * Render individual user row
     */
    renderUserRow(user) {
        const statusBadge = user.isActive
            ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Active</span>'
            : '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Inactive</span>';

        const roleColor = user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800';
        const roleBadge = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleColor}">${this.capitalizeRole(user.role)}</span>`;

        return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${user.firstName} ${user.lastName}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${user.email}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${roleBadge}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${statusBadge}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button onclick="settingsManager.userManagementModule.editUser('${user.id}')" class="text-indigo-600 hover:text-indigo-900" title="Edit User">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="settingsManager.userManagementModule.regeneratePassword('${user.id}')" class="text-yellow-600 hover:text-yellow-900" title="Regenerate Password">
                        <i class="fas fa-key"></i>
                    </button>
                    <button onclick="settingsManager.userManagementModule.toggleUserStatus('${user.id}', ${user.isActive})" class="${user.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}" title="${user.isActive ? 'Deactivate' : 'Reactivate'} User">
                        <i class="fas fa-${user.isActive ? 'user-slash' : 'user-check'}"></i>
                    </button>
                    <button onclick="settingsManager.userManagementModule.deleteUser('${user.id}')" class="text-red-600 hover:text-red-900" title="Delete User">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    /**
     * Update user count display
     */
    updateUserCount(count) {
        if (this.elements.totalUsersSpan) {
            this.elements.totalUsersSpan.textContent = count;
        }
    }

    // =========================
    // MODAL MANAGEMENT
    // =========================

    /**
     * Show add user modal
     */
    showAddUserModal() {
        if (this.elements.addUserForm) {
            this.elements.addUserForm.reset();
        }
        
        this.showModal(this.elements.addUserModal);
        console.log('📱 UserManagementModule: Add user modal opened');
    }

    /**
     * Show edit user modal
     */
    async showEditUserModal(userId) {
        try {
            console.log('✏️ UserManagementModule: Loading user for editing:', userId);
            
            const response = await fetch(`${this.apiManager.apiUrl}/api/users/${userId}`, {
                headers: this.apiManager.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                const user = data.data;
                
                // Store current edit user ID
                this.currentEditUserId = userId;
                
                // Populate form fields
                const fieldMapping = {
                    'edit-user-id': userId,
                    'edit-first-name': user.firstName,
                    'edit-last-name': user.lastName,
                    'edit-email': user.email,
                    'edit-role': user.role
                };
                
                Object.entries(fieldMapping).forEach(([fieldId, value]) => {
                    const element = document.getElementById(fieldId);
                    if (element) {
                        element.value = value;
                    }
                });
                
                this.showModal(this.elements.editUserModal);
                console.log('📱 UserManagementModule: Edit user modal opened');
                
            } else {
                throw new Error('Failed to load user data');
            }
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load user for editing');
            Toast.error('Failed to load user data', '');
        }
    }

    /**
     * Show new password modal
     */
    showNewPasswordModal(password) {
        const passwordElement = document.getElementById('generated-password');
        if (passwordElement) {
            passwordElement.textContent = password;
        }

        this.showModal(this.elements.newPasswordModal);
        console.log('📱 UserManagementModule: New password modal opened');
    }

    /**
     * Copy password to clipboard
     */
    async copyPasswordToClipboard() {
        const passwordElement = document.getElementById('generated-password');
        if (!passwordElement) {
            return;
        }

        const password = passwordElement.textContent;

        try {
            await navigator.clipboard.writeText(password);
            Toast.success('Password copied to clipboard', '');
            console.log('✅ UserManagementModule: Password copied to clipboard');
        } catch (error) {
            console.error('❌ UserManagementModule: Failed to copy password:', error);
            Toast.error('Failed to copy password', '');
        }
    }

    /**
     * Show modal
     */
    showModal(modal) {
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Hide modal
     */
    hideModal(modal) {
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    /**
     * Hide all modals
     */
    hideAllModals() {
        [
            this.elements.addUserModal,
            this.elements.editUserModal,
            this.elements.newPasswordModal
        ].forEach(modal => this.hideModal(modal));
    }

    // =========================
    // FORM HANDLING
    // =========================

    /**
     * Handle add user form submission
     */
    async handleAddUserSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const userData = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            role: formData.get('role')
        };
        
        // Validate form data
        if (!this.validateUserForm(userData)) {
            return;
        }
        
        try {
            await this.createUser(userData);
            this.hideModal(this.elements.addUserModal);
            
        } catch (error) {
            // Error handling is done in createUser method
        }
    }

    /**
     * Handle edit user form submission
     */
    async handleEditUserSubmit(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const userData = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            role: formData.get('role')
        };
        
        // Validate form data
        if (!this.validateUserForm(userData)) {
            return;
        }
        
        try {
            await this.updateUser(this.currentEditUserId, userData);
            this.hideModal(this.elements.editUserModal);
            this.currentEditUserId = null;
            
        } catch (error) {
            // Error handling is done in updateUser method
        }
    }

    /**
     * Validate user form data
     */
    validateUserForm(userData) {
        // Basic validation
        if (!userData.firstName || !userData.lastName || !userData.email || !userData.role) {
            Toast.error('Please fill in all required fields', '');
            return false;
        }
        
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userData.email)) {
            Toast.error('Please enter a valid email address', '');
            return false;
        }
        
        // Role validation
        const validRoles = ['admin', 'agent'];
        if (!validRoles.includes(userData.role)) {
            Toast.error('Please select a valid role', '');
            return false;
        }
        
        return true;
    }

    // =========================
    // PUBLIC API METHODS
    // =========================

    /**
     * Edit user (called from HTML onclick)
     */
    async editUser(userId) {
        await this.showEditUserModal(userId);
    }

    /**
     * Get current users
     */
    getUsers() {
        return this.stateManager.getUsers();
    }

    /**
     * Force refresh users
     */
    async refresh() {
        console.log('🔄 UserManagementModule: Forcing refresh');
        await this.loadUsers();
    }

    /**
     * Add event listener for user changes
     */
    onUsersChanged(callback) {
        this.stateManager.on('usersChanged', callback);
    }

    /**
     * Remove event listener for user changes
     */
    offUsersChanged(callback) {
        this.stateManager.off('usersChanged', callback);
    }

    // =========================
    // UTILITY METHODS
    // =========================

    /**
     * Format date for display
     */
    formatDate(dateString) {
        if (!dateString) return 'Never';
        
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    /**
     * Capitalize role name
     */
    capitalizeRole(role) {
        return role.charAt(0).toUpperCase() + role.slice(1);
    }

    /**
     * Get module status for debugging
     */
    getStatus() {
        const users = this.getUsers();
        
        return {
            usersCount: users.length,
            currentEditUserId: this.currentEditUserId,
            elements: {
                usersTableBody: !!this.elements.usersTableBody,
                totalUsersSpan: !!this.elements.totalUsersSpan,
                addUserButton: !!this.elements.addUserButton,
                addUserModal: !!this.elements.addUserModal,
                editUserModal: !!this.elements.editUserModal,
                newPasswordModal: !!this.elements.newPasswordModal,
                addUserForm: !!this.elements.addUserForm,
                editUserForm: !!this.elements.editUserForm
            },
            eventListeners: this.eventListeners.length
        };
    }

    /**
     * Cleanup method for proper shutdown
     */
    destroy() {
        // Remove event listeners
        this.eventListeners.forEach(({ element, event, handler }) => {
            if (element && handler) {
                element.removeEventListener(event, handler);
            }
        });
        
        this.eventListeners = [];
        this.currentEditUserId = null;
        
        // Hide all modals
        this.hideAllModals();
        
        console.log('🧹 UserManagementModule: Cleanup complete');
    }
}