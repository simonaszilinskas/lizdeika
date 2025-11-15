/**
 * Account Management Module
 *
 * Handles user account settings and password management
 * - Display password expiry status and warnings
 * - Handle password change operations
 * - Show progressive warnings as password expiry approaches
 */

import { Toast } from '../../agent-dashboard/utils/Toast.js';
import { ErrorHandler } from '../../agent-dashboard/utils/ErrorHandler.js';

export class AccountManagementModule {
    constructor(apiManager, stateManager) {
        this.apiManager = apiManager;
        this.stateManager = stateManager;

        // DOM elements
        this.elements = {
            passwordForm: null,
            currentPasswordInput: null,
            newPasswordInput: null,
            confirmPasswordInput: null,
            changePasswordButton: null,
            passwordStatusContainer: null,
            warningBanner: null,
            daysRemainingSpan: null,
            warningMessageSpan: null
        };

        // State
        this.passwordStatus = null;
        this.isChangingPassword = false;

        // Event listeners
        this.eventListeners = [];

        console.log('👤 AccountManagementModule: Initialized');
    }

    /**
     * Initialize the account management module
     */
    async initialize() {
        try {
            // Initialize DOM elements
            this.initializeElements();

            // Setup event listeners
            this.setupEventListeners();

            // Load password status
            await this.loadPasswordStatus();

            console.log('✅ AccountManagementModule: Initialization complete');

        } catch (error) {
            ErrorHandler.logError(error, 'AccountManagementModule initialization failed');
            // Don't throw - allow settings to load even if password status fails
            console.warn('⚠️ AccountManagementModule: Failed to load password status');
        }
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.elements = {
            passwordForm: document.getElementById('password-change-form'),
            currentPasswordInput: document.getElementById('current-password'),
            newPasswordInput: document.getElementById('new-password'),
            confirmPasswordInput: document.getElementById('confirm-password'),
            changePasswordButton: document.getElementById('change-password-btn'),
            passwordStatusContainer: document.getElementById('password-status-container'),
            warningBanner: document.getElementById('password-warning-banner'),
            daysRemainingSpan: document.getElementById('days-remaining'),
            warningMessageSpan: document.getElementById('warning-message')
        };

        console.log('🎯 AccountManagementModule: DOM elements initialized');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Password form submission
        if (this.elements.passwordForm) {
            const submitHandler = (e) => this.handlePasswordFormSubmit(e);
            this.elements.passwordForm.addEventListener('submit', submitHandler);
            this.eventListeners.push({
                element: this.elements.passwordForm,
                event: 'submit',
                handler: submitHandler
            });
        }

        // Real-time password confirmation validation
        if (this.elements.confirmPasswordInput && this.elements.newPasswordInput) {
            const validateHandler = () => this.validatePasswordMatch();
            this.elements.confirmPasswordInput.addEventListener('input', validateHandler);
            this.elements.newPasswordInput.addEventListener('input', validateHandler);
            this.eventListeners.push({
                element: this.elements.confirmPasswordInput,
                event: 'input',
                handler: validateHandler
            });
            this.eventListeners.push({
                element: this.elements.newPasswordInput,
                event: 'input',
                handler: validateHandler
            });
        }

        console.log('🔗 AccountManagementModule: Event listeners setup');
    }

    /**
     * Load password status from API
     */
    async loadPasswordStatus() {
        try {
            const response = await this.apiManager.get('/api/auth/password-status');

            if (response && response.success) {
                this.passwordStatus = response.data;
                this.renderPasswordStatus();
                console.log('📊 Password status loaded:', this.passwordStatus);
            }
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load password status');
            Toast.show('Unable to load password status. Please refresh the page.', 'warning');
            // Keep status section visible but show error state
            if (this.elements.daysRemainingSpan) {
                this.elements.daysRemainingSpan.textContent = 'Error';
                this.elements.daysRemainingSpan.className = 'badge bg-secondary';
            }
        }
    }

    /**
     * Render password status UI
     */
    renderPasswordStatus() {
        if (!this.passwordStatus) return;

        const { requiresRenewal, isBlocked, daysRemaining, warningLevel, warningMessage, expiresAt } = this.passwordStatus;

        // Show/hide warning banner
        if (this.elements.warningBanner) {
            if (warningLevel !== 'none' && warningMessage) {
                this.elements.warningBanner.style.display = 'block';
                this.elements.warningBanner.className = `alert alert-${this.getAlertClass(warningLevel)}`;

                if (this.elements.warningMessageSpan) {
                    this.elements.warningMessageSpan.textContent = warningMessage;
                }
            } else {
                this.elements.warningBanner.style.display = 'none';
            }
        }

        // Show days remaining
        if (this.elements.daysRemainingSpan && daysRemaining !== null) {
            if (daysRemaining <= 0) {
                this.elements.daysRemainingSpan.textContent = 'Expired';
                this.elements.daysRemainingSpan.className = 'badge bg-danger';
            } else {
                this.elements.daysRemainingSpan.textContent = `${daysRemaining} days`;
                this.elements.daysRemainingSpan.className = `badge bg-${this.getBadgeClass(warningLevel)}`;
            }
        }

        // If blocked, make password change form more prominent
        if (isBlocked || requiresRenewal) {
            if (this.elements.passwordForm) {
                this.elements.passwordForm.classList.add('form-required');
            }
        }
    }

    /**
     * Get Bootstrap alert class based on warning level
     */
    getAlertClass(warningLevel) {
        const mapping = {
            'critical': 'danger',
            'warning': 'warning',
            'info': 'info',
            'notice': 'info',
            'none': 'secondary'
        };
        return mapping[warningLevel] || 'secondary';
    }

    /**
     * Get Bootstrap badge class based on warning level
     */
    getBadgeClass(warningLevel) {
        const mapping = {
            'critical': 'danger',
            'warning': 'warning',
            'info': 'primary',
            'notice': 'secondary',
            'none': 'success'
        };
        return mapping[warningLevel] || 'success';
    }

    /**
     * Validate password match in real-time
     */
    validatePasswordMatch() {
        if (!this.elements.newPasswordInput || !this.elements.confirmPasswordInput) return;

        const newPassword = this.elements.newPasswordInput.value;
        const confirmPassword = this.elements.confirmPasswordInput.value;

        if (confirmPassword && newPassword !== confirmPassword) {
            this.elements.confirmPasswordInput.setCustomValidity('Passwords do not match');
        } else {
            this.elements.confirmPasswordInput.setCustomValidity('');
        }
    }

    /**
     * Handle password form submission
     */
    async handlePasswordFormSubmit(event) {
        event.preventDefault();

        if (this.isChangingPassword) return;

        try {
            this.isChangingPassword = true;
            this.setFormLoading(true);

            // Get form values
            const currentPassword = this.elements.currentPasswordInput?.value;
            const newPassword = this.elements.newPasswordInput?.value;
            const confirmPassword = this.elements.confirmPasswordInput?.value;

            // Validate passwords match
            if (newPassword !== confirmPassword) {
                Toast.show('Passwords do not match', 'error');
                return;
            }

            // Validate password strength
            if (newPassword.length < 8) {
                Toast.show('Password must be at least 8 characters', 'error');
                return;
            }

            // Make API request
            const response = await this.apiManager.post('/api/auth/change-password', {
                currentPassword,
                newPassword
            });

            if (response && response.success) {
                Toast.show('Password changed successfully', 'success');

                // Clear form
                this.elements.passwordForm?.reset();

                // Reload password status
                await this.loadPasswordStatus();

                // Update state to trigger potential UI refreshes
                this.stateManager.setState('passwordChanged', {
                    timestamp: new Date()
                });

            } else {
                throw new Error(response?.error || 'Failed to change password');
            }

        } catch (error) {
            ErrorHandler.logError(error, 'Password change failed');

            const errorMessage = error.message || 'Failed to change password';
            Toast.show(errorMessage, 'error');

        } finally {
            this.isChangingPassword = false;
            this.setFormLoading(false);
        }
    }

    /**
     * Set form loading state
     */
    setFormLoading(isLoading) {
        if (this.elements.changePasswordButton) {
            this.elements.changePasswordButton.disabled = isLoading;
            this.elements.changePasswordButton.textContent = isLoading ? 'Changing...' : 'Change Password';
        }

        // Disable inputs
        const inputs = [
            this.elements.currentPasswordInput,
            this.elements.newPasswordInput,
            this.elements.confirmPasswordInput
        ];

        inputs.forEach(input => {
            if (input) input.disabled = isLoading;
        });
    }

    /**
     * Cleanup event listeners
     */
    cleanup() {
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];
        console.log('🧹 AccountManagementModule: Cleanup complete');
    }
}
