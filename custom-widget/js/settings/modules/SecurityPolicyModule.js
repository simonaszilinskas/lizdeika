/**
 * SecurityPolicyModule
 * Handles organization-wide security policy settings
 */

import { ErrorHandler } from '../../agent-dashboard/utils/ErrorHandler.js';
import { Toast } from '../../agent-dashboard/utils/Toast.js';

export default class SecurityPolicyModule {
    /**
     * @param {APIManager} apiManager - Manages API requests
     * @param {StateManager} stateManager - Manages application state
     */
    constructor(apiManager, stateManager) {
        this.apiManager = apiManager;
        this.stateManager = stateManager;
        this.toggle = null;
        this.userCountElement = null;
    }

    /**
     * Initialize the security policy module
     */
    async initialize() {
        console.log('🔐 SecurityPolicyModule: Initializing...');

        this.toggle = document.getElementById('require-2fa-toggle');
        this.userCountElement = document.getElementById('users-without-2fa-count');

        if (!this.toggle) {
            console.warn('⚠️ SecurityPolicyModule: Toggle element not found');
            return;
        }

        this.attachEventListeners();
        await this.loadSecurityPolicy();
        await this.updateUserStats();

        console.log('✅ SecurityPolicyModule: Initialized successfully');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        if (this.toggle) {
            this.toggle.addEventListener('change', async (e) => {
                await this.handleToggleChange(e.target.checked);
            });
        }
    }

    /**
     * Load current security policy from server
     */
    async loadSecurityPolicy() {
        try {
            const setting = await this.apiManager.getSetting('REQUIRE_2FA_FOR_ALL_USERS', 'security');
            const isEnabled = setting === true || setting === 'true';

            if (this.toggle) {
                this.toggle.checked = isEnabled;
            }

            console.log('✅ SecurityPolicyModule: Policy loaded -', isEnabled ? 'ENABLED' : 'DISABLED');
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load security policy');
        }
    }

    /**
     * Update user statistics (count of users without 2FA)
     */
    async updateUserStats() {
        if (!this.userCountElement) return;

        try {
            const users = this.stateManager.getUsers();

            if (!users || users.length === 0) {
                this.userCountElement.textContent = 'Loading user statistics...';
                return;
            }

            const usersWithout2FA = users.filter(u => !u.totpEnabled).length;
            const totalUsers = users.length;
            const usersWith2FA = totalUsers - usersWithout2FA;

            this.userCountElement.innerHTML = `
                <i class="fas fa-users mr-1"></i>
                ${usersWith2FA} of ${totalUsers} users have 2FA enabled
                ${usersWithout2FA > 0 ? `<span class="text-amber-600 font-medium">(${usersWithout2FA} without 2FA)</span>` : '<span class="text-green-600 font-medium">(All users protected)</span>'}
            `;
        } catch (error) {
            console.error('Failed to update user stats:', error);
            this.userCountElement.textContent = 'Unable to load user statistics';
        }
    }

    /**
     * Handle toggle change
     */
    async handleToggleChange(isEnabled) {
        const action = isEnabled ? 'enable' : 'disable';

        // Confirm action with admin
        if (isEnabled) {
            const users = this.stateManager.getUsers();
            const usersWithout2FA = users.filter(u => !u.totpEnabled).length;

            const message = usersWithout2FA > 0
                ? `Are you sure you want to require 2FA for all users?\n\n${usersWithout2FA} users will be required to set up 2FA on their next login.`
                : 'Are you sure you want to require 2FA for all users?\n\nAll new users will be required to set up 2FA upon registration.';

            if (!confirm(message)) {
                this.toggle.checked = false;
                return;
            }
        } else {
            if (!confirm('Are you sure you want to disable the mandatory 2FA policy?\n\nUsers will no longer be required to set up 2FA.')) {
                this.toggle.checked = true;
                return;
            }
        }

        try {
            console.log(`🔐 SecurityPolicyModule: ${action === 'enable' ? 'Enabling' : 'Disabling'} mandatory 2FA policy...`);

            await this.apiManager.updateSetting('REQUIRE_2FA_FOR_ALL_USERS', isEnabled, 'security');

            Toast.success(
                `Mandatory 2FA policy ${isEnabled ? 'enabled' : 'disabled'}`,
                isEnabled ? 'Users without 2FA will be prompted to set it up on next login' : ''
            );

            console.log(`✅ SecurityPolicyModule: Policy ${action}d successfully`);

        } catch (error) {
            ErrorHandler.logError(error, `Failed to ${action} 2FA policy`);
            Toast.error(`Failed to ${action} 2FA policy`, error.message);

            // Revert toggle on error
            this.toggle.checked = !isEnabled;
        }
    }

    /**
     * Refresh module data
     */
    async refresh() {
        await this.loadSecurityPolicy();
        await this.updateUserStats();
    }
}
