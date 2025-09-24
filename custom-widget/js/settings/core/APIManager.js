/**
 * API Manager for Settings System
 * 
 * Handles all HTTP requests, authentication, and API communication
 * Extracted from the monolithic Settings class for better modularity
 */

import { ErrorHandler } from '../../agent-dashboard/utils/ErrorHandler.js';
import { Toast } from '../../agent-dashboard/utils/Toast.js';

export class APIManager {
    constructor(apiUrl, stateManager) {
        this.apiUrl = apiUrl;
        this.stateManager = stateManager;
        this.agentToken = null;
        
        console.log('🌐 APIManager: Initialized with URL:', this.apiUrl);
    }

    /**
     * Initialize API Manager
     */
    async initialize() {
        try {
            // Get authentication token
            this.agentToken = localStorage.getItem('agent_token');
            
            console.log('✅ APIManager: Initialization complete');
        } catch (error) {
            ErrorHandler.logError(error, 'APIManager initialization failed');
            throw error;
        }
    }

    /**
     * Get authorization headers for API requests
     */
    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.agentToken) {
            headers['Authorization'] = `Bearer ${this.agentToken}`;
        }
        
        return headers;
    }

    /**
     * Enhanced API request with error handling
     */
    async apiRequest(url, options = {}) {
        try {
            const response = await fetch(`${this.apiUrl}${url}`, {
                ...options,
                headers: {
                    ...this.getAuthHeaders(),
                    ...(options.headers || {})
                }
            });

            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                ErrorHandler.logError(error, `API request to ${url}`);
                throw error;
            }

            return response;
        } catch (error) {
            ErrorHandler.logError(error, `API request failed: ${url}`);
            throw error;
        }
    }

    /**
     * HTTP GET request helper
     */
    async get(url) {
        const response = await this.apiRequest(url, { method: 'GET' });
        return await response.json();
    }

    /**
     * HTTP POST request helper
     */
    async post(url, data = null) {
        const options = { method: 'POST' };
        if (data) {
            options.body = JSON.stringify(data);
        }
        const response = await this.apiRequest(url, options);
        return await response.json();
    }

    /**
     * HTTP PUT request helper
     */
    async put(url, data = null) {
        const options = { method: 'PUT' };
        if (data) {
            options.body = JSON.stringify(data);
        }
        const response = await this.apiRequest(url, options);
        return await response.json();
    }

    /**
     * HTTP DELETE request helper
     */
    async delete(url) {
        const response = await this.apiRequest(url, { method: 'DELETE' });
        return await response.json();
    }

    // =========================
    // USER AUTHENTICATION API
    // =========================

    /**
     * Load current user profile
     */
    async loadCurrentUser() {
        try {
            console.log('👤 APIManager: Loading current user');
            
            if (!this.agentToken) {
                console.log('❌ APIManager: No token found, skipping user load');
                return;
            }

            const response = await this.apiRequest('/api/auth/profile');
            const data = await response.json();
            
            // Update state manager
            this.stateManager.setCurrentUser(data.data);
            
            console.log('✅ APIManager: Current user loaded:', data.data);
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load current user');
            this.stateManager.setCurrentUser(null);
        }
    }

    // =========================
    // SYSTEM MODE API
    // =========================

    /**
     * Load system mode
     */
    async loadSystemMode() {
        try {
            console.log('🎛️ APIManager: Loading system mode');
            
            const response = await fetch(`${this.apiUrl}/api/system/mode`);
            const data = await response.json();
            
            // Update state manager
            this.stateManager.setSystemMode(data.mode);
            
            console.log('✅ APIManager: System mode loaded:', data.mode);
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load system mode');
            Toast.error('Failed to load system mode', '');
        }
    }

    /**
     * Save system mode
     */
    async saveSystemMode() {
        const selectedMode = document.querySelector('input[name="systemMode"]:checked')?.value;
        
        if (!selectedMode) {
            Toast.error('Please select a system mode', '');
            return;
        }
        
        const currentMode = this.stateManager.getSystemMode();
        if (selectedMode === currentMode) {
            Toast.info('No changes to save', '');
            return;
        }
        
        try {
            console.log('💾 APIManager: Saving system mode:', selectedMode);
            
            const saveModeButton = document.getElementById('save-mode');
            if (saveModeButton) {
                saveModeButton.disabled = true;
                saveModeButton.textContent = 'Saving...';
            }
            
            const response = await fetch(`${this.apiUrl}/api/system/mode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: selectedMode })
            });
            
            if (response.ok) {
                // Update state manager
                this.stateManager.setSystemMode(selectedMode);
                Toast.success(`System mode changed to ${selectedMode.toUpperCase()}`, '');
                
                console.log('✅ APIManager: System mode saved:', selectedMode);
            } else {
                const error = await response.json();
                Toast.error(error.error || 'Failed to update system mode', '');
            }
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to save system mode');
            Toast.error('Failed to update system mode', '');
        } finally {
            const saveModeButton = document.getElementById('save-mode');
            if (saveModeButton) {
                saveModeButton.disabled = false;
                saveModeButton.textContent = 'Save Changes';
            }
        }
    }

    // =========================
    // CONNECTED AGENTS API
    // =========================

    /**
     * Load connected agents
     */
    async loadConnectedAgents() {
        try {
            const response = await fetch(`${this.apiUrl}/api/agents/connected`);
            const data = await response.json();
            
            // Update state manager
            this.stateManager.setConnectedAgents(data.agents);
            
            return true; // Indicate successful update
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load connected agents');
            return false;
        }
    }

    // =========================
    // WIDGET CONFIGURATION API
    // =========================

    /**
     * Load widget configuration
     */
    async loadWidgetConfiguration() {
        try {
            console.log('🔧 APIManager: Loading widget configuration');
            
            const response = await fetch(`${this.apiUrl}/api/widget/config`);
            const data = await response.json();

            if (response.ok) {
                // Update state manager
                this.stateManager.setWidgetConfiguration(data.data);
                
                // Update UI
                this.renderWidgetConfiguration(data.data);
                
                console.log('✅ APIManager: Widget configuration loaded');
            } else {
                throw new Error(data.error || 'Failed to load widget configuration');
            }
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load widget configuration');
            
            const widgetConfigDiv = document.getElementById('current-widget-config');
            if (widgetConfigDiv) {
                widgetConfigDiv.innerHTML = `
                    <h4 class="font-semibold text-red-800">Configuration Error</h4>
                    <p class="text-red-600">Unable to load current widget configuration: ${error.message}</p>
                `;
            }
        }
    }

    /**
     * Render widget configuration in UI
     */
    renderWidgetConfiguration(config) {
        const widgetConfigDiv = document.getElementById('current-widget-config');
        if (!widgetConfigDiv) return;
        
        widgetConfigDiv.innerHTML = `
            <h4 class="font-semibold text-blue-800 mb-2">Current Configuration</h4>
            <div class="space-y-2 text-blue-700">
                <p><strong>Widget Name:</strong> ${config.name}</p>
                <p><strong>Primary Color:</strong> 
                    <span class="inline-flex items-center gap-2">
                        ${config.primaryColor}
                        <span class="w-5 h-5 rounded border border-blue-300" style="background-color: ${config.primaryColor};"></span>
                    </span>
                </p>
                <p><strong>Allowed Domains:</strong> ${config.allowedDomains}</p>
                <p><strong>Server URL:</strong> ${config.serverUrl}</p>
            </div>
        `;
    }

    /**
     * Generate integration code
     */
    async generateIntegrationCode() {
        const button = document.getElementById('generate-code');
        const originalText = button?.textContent;
        
        try {
            console.log('📝 APIManager: Generating integration code');
            
            if (button) {
                button.disabled = true;
                button.textContent = 'Generating...';
            }
            
            const response = await fetch(`${this.apiUrl}/api/widget/integration-code`);
            const data = await response.json();

            if (response.ok) {
                const integrationCodeTextarea = document.getElementById('integration-code');
                const codeContainer = document.getElementById('integration-code-container');
                
                if (integrationCodeTextarea) {
                    integrationCodeTextarea.value = data.data.integrationCode;
                }
                
                if (codeContainer) {
                    codeContainer.classList.remove('hidden');
                }
                
                Toast.success('Integration code generated successfully!', '');
                console.log('✅ APIManager: Integration code generated');
            } else {
                throw new Error(data.error || 'Failed to generate integration code');
            }
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to generate integration code');
            Toast.error(`Failed to generate integration code: ${error.message}`, '');
        } finally {
            if (button && originalText) {
                button.disabled = false;
                button.textContent = originalText;
            }
        }
    }

    // =========================
    // USER MANAGEMENT API
    // =========================

    /**
     * Load users (admin only)
     */
    async loadUsers() {
        const currentUser = this.stateManager.getCurrentUser();
        console.log('🔍 APIManager: Checking user for loadUsers:', currentUser);
        
        if (!currentUser || currentUser.role !== 'admin') {
            console.log('❌ APIManager: User is not admin or not loaded, skipping loadUsers');
            return;
        }

        try {
            console.log('👥 APIManager: Loading users');
            
            const response = await this.apiRequest('/api/users');
            console.log('📡 APIManager: Users API response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('📦 APIManager: Users API response data:', data);
                
                // Update state manager
                this.stateManager.setUsers(data.data);
                
                console.log('✅ APIManager: Users loaded and set in state:', data.data?.length || 'null');
            } else {
                const errorText = await response.text();
                console.error('❌ APIManager: Users API error response:', errorText);
                throw new Error(`Failed to load users: ${response.status} ${errorText}`);
            }
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load users');
            Toast.error('Failed to load users', '');
            console.error('❌ APIManager: loadUsers error:', error);
        }
    }

    /**
     * Edit user - load user data and show modal
     */
    async editUser(userId) {
        try {
            console.log('✏️ APIManager: Loading user for editing:', userId);
            
            const response = await this.apiRequest(`/api/users/${userId}`);

            if (response.ok) {
                const data = await response.json();
                const user = data.data;
                
                // Populate form
                const elements = {
                    'edit-user-id': user.id,
                    'edit-first-name': user.firstName,
                    'edit-last-name': user.lastName,
                    'edit-email': user.email,
                    'edit-role': user.role
                };
                
                Object.entries(elements).forEach(([id, value]) => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.value = value;
                    }
                });
                
                // Show modal
                const editUserModal = document.getElementById('edit-user-modal');
                if (editUserModal) {
                    editUserModal.classList.remove('hidden');
                }
            } else {
                throw new Error('Failed to load user data');
            }
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load user for editing');
            Toast.error('Failed to load user data', '');
        }
    }

    /**
     * Handle edit user form submission
     */
    async handleEditUserSubmit(e) {
        e.preventDefault();
        
        const userId = document.getElementById('edit-user-id')?.value;
        const firstName = document.getElementById('edit-first-name')?.value;
        const lastName = document.getElementById('edit-last-name')?.value;
        const email = document.getElementById('edit-email')?.value;
        const role = document.getElementById('edit-role')?.value;

        if (!userId) return;

        try {
            console.log('💾 APIManager: Updating user:', userId);
            
            const response = await this.apiRequest(`/api/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    firstName,
                    lastName,
                    email,
                    role
                })
            });

            if (response.ok) {
                const editUserModal = document.getElementById('edit-user-modal');
                if (editUserModal) {
                    editUserModal.classList.add('hidden');
                }
                
                Toast.success('User updated successfully', '');
                
                // Refresh users list
                this.loadUsers();
                
                console.log('✅ APIManager: User updated:', userId);
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update user');
            }
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to update user');
            Toast.error(error.message, '');
        }
    }

    /**
     * Handle add user form submission
     */
    async handleAddUserSubmit(e) {
        e.preventDefault();
        
        const firstName = document.getElementById('add-first-name')?.value;
        const lastName = document.getElementById('add-last-name')?.value;
        const email = document.getElementById('add-email')?.value;
        const role = document.getElementById('add-role')?.value;

        try {
            console.log('👤 APIManager: Creating new user:', email);
            
            const response = await this.apiRequest('/api/users', {
                method: 'POST',
                body: JSON.stringify({
                    firstName,
                    lastName,
                    email,
                    role
                })
            });

            if (response.ok) {
                const result = await response.json();
                
                const addUserModal = document.getElementById('add-user-modal');
                if (addUserModal) {
                    addUserModal.classList.add('hidden');
                }
                
                Toast.success('User created successfully', '');
                
                // Refresh users list
                this.loadUsers();
                
                // Show generated password if provided
                if (result.data && result.data.password) {
                    const generatedPasswordElement = document.getElementById('generated-password');
                    const newPasswordModal = document.getElementById('new-password-modal');
                    
                    if (generatedPasswordElement) {
                        generatedPasswordElement.textContent = result.data.password;
                    }
                    
                    if (newPasswordModal) {
                        newPasswordModal.classList.remove('hidden');
                    }
                }
                
                console.log('✅ APIManager: User created:', email);
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create user');
            }
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to create user');
            Toast.error(error.message, '');
        }
    }

    /**
     * Regenerate user password
     */
    async regeneratePassword(userId) {
        if (!confirm('Are you sure you want to regenerate this user\'s password? This will invalidate their current password.')) {
            return;
        }

        try {
            console.log('🔑 APIManager: Regenerating password for user:', userId);
            
            const response = await this.apiRequest(`/api/users/${userId}/regenerate-password`, {
                method: 'POST'
            });

            if (response.ok) {
                const data = await response.json();
                
                // Show the new password in modal
                const generatedPasswordElement = document.getElementById('generated-password');
                const newPasswordModal = document.getElementById('new-password-modal');
                
                if (generatedPasswordElement) {
                    generatedPasswordElement.textContent = data.data.newPassword;
                }
                
                if (newPasswordModal) {
                    newPasswordModal.classList.remove('hidden');
                }
                
                Toast.success('New password generated successfully', '');
                console.log('✅ APIManager: Password regenerated for user:', userId);
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to regenerate password');
            }
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to regenerate password');
            Toast.error(error.message, '');
        }
    }

    /**
     * Toggle user active status
     */
    async toggleUserStatus(userId, isCurrentlyActive) {
        const action = isCurrentlyActive ? 'deactivate' : 'reactivate';
        const actionText = isCurrentlyActive ? 'deactivate' : 'reactivate';
        
        if (!confirm(`Are you sure you want to ${actionText} this user?`)) {
            return;
        }

        try {
            console.log(`🔄 APIManager: ${actionText} user:`, userId);
            
            const response = await this.apiRequest(`/api/users/${userId}/${action}`, {
                method: 'POST'
            });

            if (response.ok) {
                Toast.success(`User ${actionText}d successfully`, '');
                
                // Refresh users list
                this.loadUsers();
                
                console.log(`✅ APIManager: User ${actionText}d:`, userId);
            } else {
                const error = await response.json();
                throw new Error(error.error || `Failed to ${actionText} user`);
            }
        } catch (error) {
            ErrorHandler.logError(error, `Failed to ${actionText} user`);
            Toast.error(error.message, '');
        }
    }

    // =========================
    // UTILITY METHODS
    // =========================

    /**
     * Check if current user has admin privileges
     */
    isAdmin() {
        const currentUser = this.stateManager.getCurrentUser();
        return currentUser && currentUser.role === 'admin';
    }

    /**
     * Get current authentication token
     */
    getToken() {
        return this.agentToken;
    }

    /**
     * Update authentication token
     */
    setToken(token) {
        this.agentToken = token;
        if (token) {
            localStorage.setItem('agent_token', token);
        } else {
            localStorage.removeItem('agent_token');
        }
    }
}