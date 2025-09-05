/**
 * Enhanced Settings JavaScript
 * Handles comprehensive system settings including system mode, widget config, and user management
 */

class Settings {
    constructor() {
        this.apiUrl = window.location.protocol + '//' + window.location.hostname + ':3002';
        this.currentUser = null;
        this.currentMode = null;
        
        // Smart connection management
        this.socket = null;
        // ConnectionManager removed - now using simple polling
        this.lastDataTimestamp = {
            connectedAgents: 0,
            systemMode: 0
        };
        this.lastAgentsData = null;
        
        // Simple error handling with SimpleErrorHandler
        this.apiRequest = null;
        
        
        // Heartbeat management
        this.heartbeatInterval = null;
        
        this.initializeErrorHandling();
        this.initializeElements();
        // Delay WebSocket initialization until after user is loaded
        this.attachEventListeners();
        this.loadInitialData();
    }

    /**
     * Initialize simple error handling system
     */
    initializeErrorHandling() {
        // Use simple API request helper with basic error logging
        this.apiRequest = async (url, options) => {
            try {
                const response = await fetch(`${this.apiUrl}${url}`, options);
                if (!response.ok) {
                    const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                    if (window.SimpleErrorHandler) {
                        window.SimpleErrorHandler.logError(error, `API request to ${url}`);
                    }
                    throw error;
                }
                return response;
            } catch (error) {
                if (window.SimpleErrorHandler) {
                    window.SimpleErrorHandler.logError(error, `API request failed: ${url}`);
                }
                throw error;
            }
        };
        
        console.log('✅ Settings: Error handling initialized');
    }


    initializeElements() {
        // Tab elements
        this.tabButtons = document.querySelectorAll('.tab-button');
        this.tabContents = document.querySelectorAll('.tab-content');
        
        // System mode elements
        this.currentModeSpan = document.getElementById('current-mode');
        this.saveModeButton = document.getElementById('save-mode');
        this.agentsList = document.getElementById('agents-list');
        this.totalConnected = document.getElementById('total-connected');
        this.totalAvailable = document.getElementById('total-available');
        
        // Widget configuration elements
        this.widgetConfigDiv = document.getElementById('current-widget-config');
        this.generateCodeButton = document.getElementById('generate-code');
        this.codeContainer = document.getElementById('integration-code-container');
        this.integrationCodeTextarea = document.getElementById('integration-code');
        this.copyCodeButton = document.getElementById('copy-code');
        
        // User management elements
        this.totalUsersSpan = document.getElementById('total-users');
        this.usersTableBody = document.getElementById('users-table-body');
        
        // Notification settings elements
        this.notificationsEnabled = document.getElementById('notifications-enabled');
        this.notificationPermission = document.getElementById('notification-permission');
        this.permissionStatusIcon = document.getElementById('permission-status-icon');
        this.permissionStatusText = document.getElementById('permission-status-text');
        this.requestPermissionBtn = document.getElementById('request-permission-btn');
        this.testNotificationBtn = document.getElementById('test-notification-btn');
        
        // Modal elements
        this.editUserModal = document.getElementById('edit-user-modal');
        this.newPasswordModal = document.getElementById('new-password-modal');
        this.addUserModal = document.getElementById('add-user-modal');
        this.editUserForm = document.getElementById('edit-user-form');
        this.addUserForm = document.getElementById('add-user-form');
        
        // Message elements
        this.messageDiv = document.getElementById('message');
        this.messageIcon = document.getElementById('message-icon');
        this.messageText = document.getElementById('message-text');
    }

    attachEventListeners() {
        // Tab switching
        this.tabButtons.forEach(button => {
            button.addEventListener('click', () => this.switchTab(button.dataset.tab));
        });
        
        // System mode
        this.saveModeButton.addEventListener('click', () => this.saveSystemMode());
        
        // Widget configuration
        this.generateCodeButton.addEventListener('click', () => this.generateIntegrationCode());
        this.copyCodeButton.addEventListener('click', () => this.copyCodeToClipboard());
        
        // User management
        this.editUserForm.addEventListener('submit', (e) => this.handleEditUserSubmit(e));
        this.addUserForm.addEventListener('submit', (e) => this.handleAddUserSubmit(e));
        document.getElementById('add-user-btn').addEventListener('click', () => this.openAddUserModal());
        
        
        // Modal handling
        this.setupModalEventListeners();
    }

    setupModalEventListeners() {
        // Edit user modal
        document.getElementById('close-edit-modal').addEventListener('click', () => this.closeModal('edit-user-modal'));
        document.getElementById('cancel-edit').addEventListener('click', () => this.closeModal('edit-user-modal'));
        
        // New password modal
        document.getElementById('close-password-modal').addEventListener('click', () => this.closeModal('new-password-modal'));
        document.getElementById('password-modal-close').addEventListener('click', () => this.closeModal('new-password-modal'));
        
        // Add user modal
        document.getElementById('close-add-modal').addEventListener('click', () => this.closeModal('add-user-modal'));
        document.getElementById('cancel-add-user').addEventListener('click', () => this.closeModal('add-user-modal'));
        document.getElementById('copy-password').addEventListener('click', () => this.copyPasswordToClipboard());
        
        // Close modals when clicking outside
        [this.editUserModal, this.newPasswordModal, this.addUserModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }

    async loadInitialData() {
        try {
            // Load current user to determine admin status
            await this.loadCurrentUser();
            
            // Initialize WebSocket connection after user is loaded
            this.initializeSmartConnection();
            
            // Load system mode and agents
            await this.loadSystemMode();
            await this.loadConnectedAgents();
            
            // Load widget configuration
            await this.loadWidgetConfiguration();
            
            // Load users if admin
            if (this.currentUser && this.currentUser.role === 'admin') {
                await this.loadUsers();
            }
            
            // Initialize notification UI
            this.updateNotificationUI();
            
            // Start periodic updates
            this.startPeriodicUpdates();
            
            // Check URL hash for direct tab navigation
            if (window.location.hash === '#users' && this.currentUser && this.currentUser.role === 'admin') {
                this.switchTab('users');
            }
            
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showMessage('Failed to load settings data', 'error');
        }
    }

    async loadCurrentUser() {
        console.log('🔍 Starting loadCurrentUser...'); // Debug log
        try {
            const token = localStorage.getItem('agent_token');
            console.log('🎫 Token found:', token ? 'yes' : 'no'); // Debug log
            if (!token) {
                console.log('❌ No token found, skipping user load');
                return;
            }

            console.log('🌐 Fetching user profile from:', `${this.apiUrl}/api/auth/profile`);
            
            // Use enhanced API request with retry mechanism
            const response = await this.apiRequest('/api/auth/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            console.log('📡 Response status:', response.status); // Debug log
            
            const data = await response.json();
            console.log('📦 Raw response data:', data); // Debug log
            
            this.currentUser = data.data; // User data is directly in data, not data.user
            console.log('👤 Current user loaded:', this.currentUser); // Debug log
            
            // Add admin class to body if user is admin
            if (this.currentUser && this.currentUser.role === 'admin') {
                document.body.classList.add('admin-user');
                console.log('✅ Admin class added to body, body classes:', document.body.className);
                
                // Force show admin elements
                const adminElements = document.querySelectorAll('.admin-only');
                console.log('🔧 Found admin-only elements:', adminElements.length);
                adminElements.forEach(el => {
                    el.style.display = 'block';
                    console.log('👁️  Forced show admin element:', el);
                });
            } else {
                console.log('❌ User is not admin, role:', this.currentUser?.role);
            }
        } catch (error) {
            // Error is already handled by the error handler system
            console.error('💥 Failed to load current user:', error);
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        this.tabButtons.forEach(button => {
            if (button.dataset.tab === tabName) {
                button.classList.add('active');
                button.classList.add('border-indigo-600', 'text-indigo-600');
                button.classList.remove('border-transparent', 'text-gray-600');
            } else {
                button.classList.remove('active');
                button.classList.remove('border-indigo-600', 'text-indigo-600');
                button.classList.add('border-transparent', 'text-gray-600');
            }
        });

        // Update tab content
        this.tabContents.forEach(content => {
            if (content.id === `${tabName}-tab`) {
                content.classList.remove('hidden');
            } else {
                content.classList.add('hidden');
            }
        });

        // Load tab-specific data
        if (tabName === 'users' && this.currentUser && this.currentUser.role === 'admin') {
            this.loadUsers();
        }
    }

    // System Mode Methods
    async loadSystemMode() {
        try {
            const response = await fetch(`${this.apiUrl}/api/system/mode`);
            const data = await response.json();
            
            this.currentMode = data.mode;
            this.currentModeSpan.textContent = data.mode.toUpperCase();
            
            const radioButton = document.querySelector(`input[value="${data.mode}"]`);
            if (radioButton) {
                radioButton.checked = true;
            }
        } catch (error) {
            console.error('Error loading system mode:', error);
            this.showMessage('Failed to load system mode', 'error');
        }
    }

    async saveSystemMode() {
        const selectedMode = document.querySelector('input[name="systemMode"]:checked')?.value;
        
        if (!selectedMode) {
            this.showMessage('Please select a system mode', 'error');
            return;
        }
        
        if (selectedMode === this.currentMode) {
            this.showMessage('No changes to save', 'info');
            return;
        }
        
        try {
            this.saveModeButton.disabled = true;
            this.saveModeButton.textContent = 'Saving...';
            
            const response = await fetch(`${this.apiUrl}/api/system/mode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: selectedMode })
            });
            
            if (response.ok) {
                this.currentMode = selectedMode;
                this.currentModeSpan.textContent = selectedMode.toUpperCase();
                this.showMessage(`System mode changed to ${selectedMode.toUpperCase()}`, 'success');
            } else {
                const error = await response.json();
                this.showMessage(error.error || 'Failed to update system mode', 'error');
            }
        } catch (error) {
            console.error('Error updating system mode:', error);
            this.showMessage('Failed to update system mode', 'error');
        } finally {
            this.saveModeButton.disabled = false;
            this.saveModeButton.textContent = 'Save Changes';
        }
    }

    async loadConnectedAgents() {
        try {
            const response = await fetch(`${this.apiUrl}/api/agents/connected`);
            const data = await response.json();
            
            // Check if data has changed for smart polling
            const dataString = JSON.stringify(data.agents);
            const hasChanged = this.lastAgentsData !== dataString;
            this.lastAgentsData = dataString;
            
            this.displayAgents(data.agents);
            this.updateAgentStats(data.agents);
            
            return hasChanged; // Return true if data changed
        } catch (error) {
            console.error('Error loading connected agents:', error);
            return false; // No change on error
        }
    }

    /**
     * Update agent display with new data (used by smart updates)
     */
    updateAgentDisplay(agents) {
        this.displayAgents(agents);
        this.updateAgentStats(agents);
        console.log('📊 Agent display updated via smart update');
    }

    /**
     * Update system mode display (used by smart updates)
     */
    updateSystemModeDisplay(mode) {
        this.currentMode = mode;
        if (this.currentModeSpan) {
            this.currentModeSpan.textContent = mode.toUpperCase();
            this.currentModeSpan.className = `px-3 py-1 text-sm font-semibold rounded-full ${
                mode === 'autopilot' ? 'bg-blue-100 text-blue-800' :
                mode === 'hitl' ? 'bg-green-100 text-green-800' : 
                'bg-red-100 text-red-800'
            }`;
        }
        console.log('🎛️ System mode display updated via smart update:', mode);
    }

    displayAgents(agents) {
        if (agents.length === 0) {
            this.agentsList.innerHTML = '<p class="text-gray-500 text-center py-4">No agents currently connected</p>';
            return;
        }
        
        this.agentsList.innerHTML = agents.map(agent => `
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
    }

    updateAgentStats(agents) {
        const total = agents.length;
        const available = agents.filter(a => a.personalStatus === 'online').length;
        
        this.totalConnected.textContent = total;
        this.totalAvailable.textContent = available;
    }

    // Widget Configuration Methods
    async loadWidgetConfiguration() {
        try {
            const response = await fetch(`${this.apiUrl}/api/widget/config`);
            const data = await response.json();

            if (response.ok) {
                this.renderWidgetConfiguration(data.data);
            } else {
                throw new Error(data.error || 'Failed to load widget configuration');
            }
        } catch (error) {
            console.error('Failed to load widget configuration:', error);
            this.widgetConfigDiv.innerHTML = `
                <h4 class="font-semibold text-red-800">Configuration Error</h4>
                <p class="text-red-600">Unable to load current widget configuration: ${error.message}</p>
            `;
        }
    }

    renderWidgetConfiguration(config) {
        this.widgetConfigDiv.innerHTML = `
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

    async generateIntegrationCode() {
        const button = this.generateCodeButton;
        const originalText = button.textContent;
        
        try {
            button.disabled = true;
            button.textContent = 'Generating...';
            
            const response = await fetch(`${this.apiUrl}/api/widget/integration-code`);
            const data = await response.json();

            if (response.ok) {
                this.integrationCodeTextarea.value = data.data.integrationCode;
                this.codeContainer.classList.remove('hidden');
                this.showMessage('Integration code generated successfully!', 'success');
            } else {
                throw new Error(data.error || 'Failed to generate integration code');
            }
        } catch (error) {
            console.error('Failed to generate integration code:', error);
            this.showMessage(`Failed to generate integration code: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    async copyCodeToClipboard() {
        try {
            await navigator.clipboard.writeText(this.integrationCodeTextarea.value);
            this.showMessage('Integration code copied to clipboard!', 'success');
            
            const button = this.copyCodeButton;
            const originalText = button.textContent;
            button.textContent = '✓ Copied!';
            
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            
            // Fallback: select the text
            this.integrationCodeTextarea.select();
            this.integrationCodeTextarea.setSelectionRange(0, 99999);
            
            try {
                document.execCommand('copy');
                this.showMessage('Integration code copied to clipboard!', 'success');
            } catch (fallbackError) {
                this.showMessage('Please manually select and copy the code above', 'error');
            }
        }
    }

    // User Management Methods
    async loadUsers() {
        if (!this.currentUser || this.currentUser.role !== 'admin') {
            return;
        }

        try {
            const token = localStorage.getItem('agent_token');
            const response = await fetch(`${this.apiUrl}/api/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderUsersTable(data.data);
                this.totalUsersSpan.textContent = data.data.length;
            } else {
                throw new Error('Failed to load users');
            }
        } catch (error) {
            console.error('Failed to load users:', error);
            this.showMessage('Failed to load users', 'error');
        }
    }

    renderUsersTable(users) {
        if (users.length === 0) {
            this.usersTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-gray-500">No users found</td>
                </tr>
            `;
            return;
        }

        this.usersTableBody.innerHTML = users.map(user => `
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
                    <button onclick="settings.editUser('${user.id}')" class="text-indigo-600 hover:text-indigo-900">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="settings.regeneratePassword('${user.id}')" class="text-yellow-600 hover:text-yellow-900" title="Regenerate Password">
                        <i class="fas fa-key"></i>
                    </button>
                    <button onclick="settings.toggleUserStatus('${user.id}', ${user.isActive})" class="${user.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}" title="${user.isActive ? 'Deactivate' : 'Reactivate'} User">
                        <i class="fas fa-${user.isActive ? 'user-slash' : 'user-check'}"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async editUser(userId) {
        try {
            const token = localStorage.getItem('agent_token');
            const response = await fetch(`${this.apiUrl}/api/users/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                const user = data.data;
                
                // Populate form
                document.getElementById('edit-user-id').value = user.id;
                document.getElementById('edit-first-name').value = user.firstName;
                document.getElementById('edit-last-name').value = user.lastName;
                document.getElementById('edit-email').value = user.email;
                document.getElementById('edit-role').value = user.role;
                
                // Show modal
                this.editUserModal.classList.remove('hidden');
            } else {
                throw new Error('Failed to load user data');
            }
        } catch (error) {
            console.error('Failed to load user for editing:', error);
            this.showMessage('Failed to load user data', 'error');
        }
    }

    async handleEditUserSubmit(e) {
        e.preventDefault();
        
        const userId = document.getElementById('edit-user-id').value;
        const firstName = document.getElementById('edit-first-name').value;
        const lastName = document.getElementById('edit-last-name').value;
        const email = document.getElementById('edit-email').value;
        const role = document.getElementById('edit-role').value;

        try {
            const token = localStorage.getItem('agent_token');
            const response = await fetch(`${this.apiUrl}/api/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    email,
                    role
                })
            });

            if (response.ok) {
                this.closeModal('edit-user-modal');
                this.showMessage('User updated successfully', 'success');
                this.loadUsers(); // Refresh the users table
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update user');
            }
        } catch (error) {
            console.error('Failed to update user:', error);
            this.showMessage(error.message, 'error');
        }
    }

    openAddUserModal() {
        // Clear the form
        this.addUserForm.reset();
        
        // Show the modal
        this.addUserModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    async handleAddUserSubmit(e) {
        e.preventDefault();
        
        const firstName = document.getElementById('add-first-name').value;
        const lastName = document.getElementById('add-last-name').value;
        const email = document.getElementById('add-email').value;
        const role = document.getElementById('add-role').value;

        try {
            const token = localStorage.getItem('agent_token');
            const response = await fetch(`${this.apiUrl}/api/users`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    email,
                    role
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.closeModal('add-user-modal');
                this.showMessage('User created successfully', 'success');
                this.loadUsers(); // Refresh the users table
                
                // Show the generated password if provided
                if (result.data && result.data.password) {
                    document.getElementById('generated-password').textContent = result.data.password;
                    this.newPasswordModal.classList.remove('hidden');
                }
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create user');
            }
        } catch (error) {
            console.error('Failed to create user:', error);
            this.showMessage(error.message, 'error');
        }
    }

    async regeneratePassword(userId) {
        if (!confirm('Are you sure you want to regenerate this user\'s password? This will invalidate their current password.')) {
            return;
        }

        try {
            const token = localStorage.getItem('agent_token');
            const response = await fetch(`${this.apiUrl}/api/users/${userId}/regenerate-password`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                
                // Show the new password in modal
                document.getElementById('generated-password').textContent = data.data.newPassword;
                this.newPasswordModal.classList.remove('hidden');
                
                this.showMessage('New password generated successfully', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Failed to regenerate password');
            }
        } catch (error) {
            console.error('Failed to regenerate password:', error);
            this.showMessage(error.message, 'error');
        }
    }

    async toggleUserStatus(userId, isCurrentlyActive) {
        const action = isCurrentlyActive ? 'deactivate' : 'reactivate';
        const actionText = isCurrentlyActive ? 'deactivate' : 'reactivate';
        
        if (!confirm(`Are you sure you want to ${actionText} this user?`)) {
            return;
        }

        try {
            const token = localStorage.getItem('agent_token');
            const response = await fetch(`${this.apiUrl}/api/users/${userId}/${action}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                this.showMessage(`User ${actionText}d successfully`, 'success');
                this.loadUsers(); // Refresh the users table
            } else {
                const error = await response.json();
                throw new Error(error.error || `Failed to ${actionText} user`);
            }
        } catch (error) {
            console.error(`Failed to ${actionText} user:`, error);
            this.showMessage(error.message, 'error');
        }
    }

    async copyPasswordToClipboard() {
        try {
            const password = document.getElementById('generated-password').textContent;
            await navigator.clipboard.writeText(password);
            
            const button = document.getElementById('copy-password');
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i>';
            
            setTimeout(() => {
                button.innerHTML = originalHTML;
            }, 2000);
        } catch (error) {
            console.error('Failed to copy password:', error);
        }
    }


    // Modal Methods
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('hidden');
    }

    /**
     * Initialize smart connection with WebSocket and intelligent polling
     */
    initializeSmartConnection() {
        try {
            // Initialize WebSocket connection
            if (typeof io !== 'undefined') {
                this.socket = io(this.apiUrl, {
                    transports: ['websocket', 'polling'],
                    timeout: 5000,
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                });

                this.setupWebSocketListeners();
            }

            // Use simple polling instead of complex connection manager
            console.log('📊 Using simple polling for connected agents and system mode');
            this.startBasicPolling();
        } catch (error) {
            console.error('Error initializing smart connection:', error);
            this.startBasicPolling();
        }
    }

    /**
     * Setup WebSocket event listeners
     */
    setupWebSocketListeners() {
        this.socket.on('connect', async () => {
            console.log('🔌 Settings: WebSocket connected');
            
            // If current user is an agent or admin, join agent dashboard to be counted
            if (this.currentUser && (this.currentUser.role === 'agent' || this.currentUser.role === 'admin')) {
                console.log('📡 Settings: Joining agent dashboard as:', this.currentUser.id);
                this.socket.emit('join-agent-dashboard', this.currentUser.id);
                
                // Send heartbeat to register as online
                this.socket.emit('heartbeat', { timestamp: Date.now() });
                
                // Start sending periodic heartbeats to keep status active
                this.startHeartbeat();
            }
            
            // WebSocket connected - heartbeat will keep connection alive
            // Using simple HTTP polling instead of smart updates
        });

        this.socket.on('disconnect', () => {
            console.log('🔌 Settings: WebSocket disconnected');
            this.stopHeartbeat();
        });

        // Smart update listeners removed - using simple HTTP polling instead
    }

    // Smart update handler methods removed - using simple HTTP polling instead

    // Smart polling functionality removed - now using simple HTTP polling

    // Smart load methods removed - using direct HTTP calls instead

    // Utility Methods
    startPeriodicUpdates() {
        console.log('⚠️ Using deprecated startPeriodicUpdates - smart polling should be used instead');
        this.startBasicPolling();
    }

    /**
     * Simple polling - replaces complex ConnectionManager
     */
    startBasicPolling() {
        console.log('📊 Starting simple HTTP polling (30s agents, 45s system mode)');
        // Direct HTTP polling - simple and reliable
        setInterval(() => this.loadConnectedAgents(), 30000);
        setInterval(() => this.loadSystemMode(), 45000);
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString();
    }

    formatDate(timestamp) {
        return new Date(timestamp).toLocaleDateString();
    }

    /**
     * Start sending periodic heartbeats to keep agent status active
     */
    startHeartbeat() {
        // Clear any existing interval
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        // Send heartbeat every 15 seconds to keep agent appearing as online
        this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.socket.connected) {
                this.socket.emit('heartbeat', { timestamp: Date.now() });
                console.log('💓 Settings: Heartbeat sent');
            }
        }, 15000); // 15 seconds
    }

    /**
     * Stop sending heartbeats
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
            console.log('💔 Settings: Heartbeat stopped');
        }
    }

    showMessage(text, type = 'info', title = '') {
        // Use simple toast system
        if (window.toast) {
            switch (type) {
                case 'success':
                    return window.toast.success(text, title);
                case 'error':
                    return window.toast.error(text, title);
                case 'warning':
                    return window.toast.warning(text, title);
                default:
                    return window.toast.info(text, title);
            }
        }
        
        // Fallback to old system if notification system not available
        this.messageText.textContent = text;
        
        // Reset classes
        this.messageDiv.className = 'fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-40 max-w-sm';
        this.messageIcon.className = 'fas';
        
        // Set type-specific styles
        if (type === 'success') {
            this.messageDiv.className += ' bg-green-500 text-white';
            this.messageIcon.className += ' fa-check-circle';
        } else if (type === 'error') {
            this.messageDiv.className += ' bg-red-500 text-white';
            this.messageIcon.className += ' fa-exclamation-circle';
        } else {
            this.messageDiv.className += ' bg-blue-500 text-white';
            this.messageIcon.className += ' fa-info-circle';
        }
        
        this.messageDiv.classList.remove('hidden');
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            this.messageDiv.classList.add('hidden');
        }, 5000);
    }
}

// Initialize when DOM is loaded
let settings;
document.addEventListener('DOMContentLoaded', () => {
    settings = new Settings();
});