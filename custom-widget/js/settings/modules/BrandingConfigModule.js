/**
 * Branding Configuration Module
 * 
 * Handles runtime branding settings management with live preview functionality
 * Admin-only access for updating widget appearance, colors, and site configuration
 */

import { Toast } from '../../agent-dashboard/utils/Toast.js';
import { ErrorHandler } from '../../agent-dashboard/utils/ErrorHandler.js';

export class BrandingConfigModule {
    constructor(apiManager, stateManager, connectionManager) {
        this.apiManager = apiManager;
        this.stateManager = stateManager;
        this.connectionManager = connectionManager;
        
        // DOM elements
        this.elements = {
            brandingConfigDiv: null,
            
            // Form elements
            widgetNameInput: null,
            primaryColorInput: null,
            colorPreview: null,
            allowedDomainsTextarea: null,
            
            // Buttons
            saveButton: null,
            resetButton: null,
            previewButton: null,
            
            // Preview area
            previewContainer: null,
            previewWidget: null,
            
            // Status
            statusDiv: null
        };
        
        // Current settings cache
        this.currentSettings = {};
        this.originalSettings = {};
        this.hasUnsavedChanges = false;
        
        // Event listeners
        this.eventListeners = [];
        
        console.log('🎨 BrandingConfigModule: Initialized');
    }

    /**
     * Initialize the branding configuration module
     */
    async initialize() {
        try {
            // Initialize DOM elements
            this.initializeElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load current branding settings
            await this.loadBrandingSettings();
            
            // Setup state change listeners
            this.setupStateListeners();
            
            // Don't render initial UI - using static HTML now
            // this.renderBrandingForm();
            
            console.log('✅ BrandingConfigModule: Initialization complete');
            
        } catch (error) {
            ErrorHandler.logError(error, 'BrandingConfigModule initialization failed');
            throw error;
        }
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.elements = {
            brandingConfigDiv: document.getElementById('branding-config'),
            statusDiv: document.getElementById('branding-status'),
            
            // Form elements
            widgetNameInput: document.getElementById('widget-name'),
            primaryColorInput: document.getElementById('widget-primary-color'),
            colorHexInput: document.getElementById('widget-primary-color-text'),
            userMessageColorInput: document.getElementById('user-message-color'),
            userMessageColorHexInput: document.getElementById('user-message-color-text'),
            allowedDomainsTextarea: document.getElementById('widget-allowed-domains'),
            welcomeMessageInput: document.getElementById('welcome-message'),
            privacyCheckboxTextInput: document.getElementById('privacy-checkbox-text'),

            // Form and buttons
            form: document.getElementById('branding-form'),
            saveButton: document.getElementById('branding-save-btn'),
            resetButton: document.getElementById('branding-reset-btn'),
            previewButton: document.getElementById('branding-preview-btn'),
            cancelButton: document.getElementById('branding-cancel-btn'),
            
            // Integration code elements
            generateCodeButton: document.getElementById('generate-integration-code'),
            copyCodeButton: document.getElementById('copy-integration-code'),
            codeContainer: document.getElementById('integration-code-container'),
            integrationCodeTextarea: document.getElementById('integration-code')
        };
        
        console.log('🎯 BrandingConfigModule: DOM elements initialized', {
            widgetNameInput: !!this.elements.widgetNameInput,
            primaryColorInput: !!this.elements.primaryColorInput,
            colorHexInput: !!this.elements.colorHexInput,
            allowedDomainsTextarea: !!this.elements.allowedDomainsTextarea
        });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Form submission
        if (this.elements.form) {
            this.elements.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Preview button
        if (this.elements.previewButton) {
            this.elements.previewButton.addEventListener('click', () => this.previewBrandingChanges());
        }

        // Reset button
        if (this.elements.resetButton) {
            this.elements.resetButton.addEventListener('click', () => this.resetBrandingSettings());
        }

        // Cancel button
        if (this.elements.cancelButton) {
            this.elements.cancelButton.addEventListener('click', () => this.cancelChanges());
        }

        // Save button
        if (this.elements.saveButton) {
            this.elements.saveButton.addEventListener('click', () => this.saveBrandingSettings());
        }

        // Integration code buttons
        console.log('🔍 BrandingConfigModule: Generate code button found:', !!this.elements.generateCodeButton);
        if (this.elements.generateCodeButton) {
            this.elements.generateCodeButton.addEventListener('click', () => {
                console.log('🎯 BrandingConfigModule: Generate code button clicked - event fired');
                this.generateIntegrationCode();
            });
        }
        
        console.log('🔍 BrandingConfigModule: Copy code button found:', !!this.elements.copyCodeButton);
        if (this.elements.copyCodeButton) {
            this.elements.copyCodeButton.addEventListener('click', () => {
                console.log('🎯 BrandingConfigModule: Copy code button clicked - event fired');
                this.copyIntegrationCode();
            });
        }

        // Live preview functionality - listen to input changes
        this.setupLivePreview();
        
        // Form change detection
        this.setupFormChangeListeners();
        
        // Real-time color preview
        this.setupColorPreview();
        
        // Save/Reset buttons
        this.setupButtonHandlers();
        
        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        console.log('🔗 BrandingConfigModule: Event listeners setup');
    }

    setupLivePreview() {
        const inputs = [
            'widget-name',
            'widget-primary-color',
            'widget-primary-color-text',
            'user-message-color',
            'user-message-color-text',
            'welcome-message',
            'privacy-checkbox-text'
        ];

        inputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                // Live preview updates
                input.addEventListener('input', () => {
                    this.updateLivePreview();
                    this.validateFieldInRealTime(input);
                });
                
                // For color inputs, also sync with text input
                if (inputId === 'widget-primary-color') {
                    input.addEventListener('change', () => {
                        const colorTextInput = document.getElementById('widget-primary-color-text');
                        if (colorTextInput) {
                            colorTextInput.value = input.value;
                        }
                    });
                } else if (inputId === 'widget-primary-color-text') {
                    input.addEventListener('input', () => {
                        const colorInput = document.getElementById('widget-primary-color');
                        if (colorInput && this.isValidHexColor(input.value)) {
                            colorInput.value = input.value;
                        }
                    });
                } else if (inputId === 'user-message-color') {
                    input.addEventListener('change', () => {
                        const colorTextInput = document.getElementById('user-message-color-text');
                        if (colorTextInput) {
                            colorTextInput.value = input.value;
                        }
                    });
                } else if (inputId === 'user-message-color-text') {
                    input.addEventListener('input', () => {
                        const colorInput = document.getElementById('user-message-color');
                        if (colorInput && this.isValidHexColor(input.value)) {
                            colorInput.value = input.value;
                        }
                    });
                }
            }
        });

        // Initial preview update
        setTimeout(() => this.updateLivePreview(), 100);
    }

    updateLivePreview() {
        const settings = this.getCurrentFormValues();
        
        // Update widget name in preview
        const previewWidgetName = document.getElementById('preview-widget-name');
        if (previewWidgetName) {
            previewWidgetName.textContent = settings.widget_name || 'Lizdeika';
        }

        // Update primary color in preview
        const previewHeader = document.getElementById('preview-header');
        const previewSendButton = previewHeader?.parentElement?.querySelector('button[style*="background-color"]');
        
        if (previewHeader && settings.widget_primary_color) {
            previewHeader.style.backgroundColor = settings.widget_primary_color;
        }
        
        if (previewSendButton && settings.widget_primary_color) {
            previewSendButton.style.backgroundColor = settings.widget_primary_color;
        }

        // Update welcome message in preview
        const previewWelcomeMessage = document.getElementById('preview-welcome-message');
        if (previewWelcomeMessage) {
            previewWelcomeMessage.textContent = settings.welcome_message || 'Hello! How can I help you today?';
        }

        // Update user message color in preview
        const previewUserMessage = document.getElementById('preview-user-message');
        if (previewUserMessage && settings.user_message_color) {
            previewUserMessage.style.backgroundColor = settings.user_message_color;
        }
    }

    getCurrentFormValues() {
        return {
            widget_name: document.getElementById('widget-name')?.value || '',
            widget_primary_color: document.getElementById('widget-primary-color')?.value || '#2c5530',
            user_message_color: document.getElementById('user-message-color')?.value || '#3b82f6',
            widget_allowed_domains: document.getElementById('widget-allowed-domains')?.value || '*',
            welcome_message: document.getElementById('welcome-message')?.value || '',
            privacy_checkbox_text: document.getElementById('privacy-checkbox-text')?.value || ''
        };
    }

    isValidHexColor(color) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
    }

    /**
     * Validate a field in real-time as user types
     */
    validateFieldInRealTime(input) {
        if (!input) return;

        const fieldName = input.name || input.id.replace('-', '_');
        const value = input.value;
        
        // Get field-specific errors
        const errors = this.validateField(fieldName, value);
        
        // Show/hide errors for this field
        this.showFieldError(fieldName, errors);
        
        // Update the current settings
        this.updateSettingsFromForm();
        this.checkForChanges();
        this.updateSaveButton();
    }

    /**
     * Setup state change listeners
     */
    setupStateListeners() {
        // Listen for branding settings changes from other sources
        this.stateManager.on('brandingSettingsChanged', (settings) => {
            console.log('🎨 BrandingConfigModule: Settings changed via state:', settings);
            this.currentSettings = { ...settings };
            this.renderBrandingForm();
        });
        
        console.log('👂 BrandingConfigModule: State listeners setup');
    }

    // =========================
    // CORE FUNCTIONALITY
    // =========================

    /**
     * Load current branding settings from API
     */
    async loadBrandingSettings() {
        try {
            console.log('📥 BrandingConfigModule: Loading branding settings');
            
            const response = await fetch(`${this.apiManager.apiUrl}/api/config/branding`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load branding settings');
            }
            
            // Extract settings values
            this.currentSettings = {};
            this.originalSettings = {};
            
            for (const [key, setting] of Object.entries(data.data)) {
                // Skip site_name as it's been removed from the system
                if (key === 'site_name') continue;
                this.currentSettings[key] = setting.value;
                this.originalSettings[key] = setting.value;
            }
            
            // Apply fallbacks for missing settings
            this.applyDefaultValues();
            
            this.hasUnsavedChanges = false;
            console.log('✅ BrandingConfigModule: Settings loaded:', this.currentSettings);
            
            // Populate form if it exists
            this.populateFormFromSettings();
            this.updateLivePreview();
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load branding settings');
            this.renderBrandingError(error.message);
            throw error;
        }
    }

    /**
     * Apply default values for missing settings
     */
    applyDefaultValues() {
        const defaults = {
            widget_name: 'Lizdeika',
            widget_primary_color: '#2c5530',
            user_message_color: '#3b82f6',
            widget_allowed_domains: '*',
            welcome_message: 'Hello! How can I help you today?',
            privacy_checkbox_text: 'I agree to the [Privacy Policy](https://example.com/privacy) and [Terms of Service](https://example.com/terms).'
        };
        
        for (const [key, defaultValue] of Object.entries(defaults)) {
            if (!this.currentSettings[key]) {
                this.currentSettings[key] = defaultValue;
                this.originalSettings[key] = defaultValue;
            }
        }
    }

    /**
     * Save branding settings
     */
    async saveBrandingSettings() {
        try {
            console.log('💾 BrandingConfigModule: Saving branding settings');
            this.setSaveButtonState('saving');
            
            // Validate settings
            const validationErrors = this.validateSettings();
            if (validationErrors) {
                // Clear any existing errors first
                this.clearAllFieldErrors();
                
                // Show field-specific errors
                validationErrors.forEach(error => {
                    this.showFieldError(error.field, [error.message]);
                });
                
                throw new Error(`Validation failed: ${validationErrors.map(e => e.message).join(', ')}`);
            }
            
            // Filter out site_name before sending to server
            const settingsToSave = { ...this.currentSettings };
            delete settingsToSave.site_name;
            
            const response = await fetch(`${this.apiManager.apiUrl}/api/config/branding`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('agent_token')}`
                },
                body: JSON.stringify({
                    settings: settingsToSave
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to save branding settings');
            }
            
            // Clear any validation errors on successful save
            this.clearAllFieldErrors();
            
            // Update original settings (excluding site_name)
            this.originalSettings = { ...this.currentSettings };
            delete this.originalSettings.site_name;
            delete this.currentSettings.site_name;
            this.hasUnsavedChanges = false;
            
            Toast.success('Branding settings saved successfully', 'Settings will take effect immediately');
            this.updateStatus('Settings saved successfully', 'success');
            
            // Notify other modules
            this.stateManager.emit('brandingSettingsChanged', this.currentSettings);
            
            console.log('✅ BrandingConfigModule: Settings saved successfully');
            
        } catch (error) {
            console.error('❌ BrandingConfigModule: Save failed:', error);
            ErrorHandler.logError(error, 'Failed to save branding settings');
            
            // Provide user-friendly error messages
            let userMessage = error.message;
            if (error.message.includes('Failed to fetch')) {
                userMessage = 'Network error: Please check your connection and try again';
            } else if (error.message.includes('401')) {
                userMessage = 'Authentication expired: Please refresh the page and log in again';
            } else if (error.message.includes('403')) {
                userMessage = 'Access denied: Admin privileges required';
            } else if (error.message.includes('500')) {
                userMessage = 'Server error: Please try again later';
            }
            
            Toast.error('Failed to save settings', userMessage);
            this.updateStatus(userMessage, 'error');
        } finally {
            this.setSaveButtonState('normal');
        }
    }

    /**
     * Reset branding settings to defaults
     */
    async resetBrandingSettings() {
        try {
            const confirmed = confirm(
                'Are you sure you want to reset all branding settings to defaults? This action cannot be undone.'
            );
            
            if (!confirmed) return;
            
            console.log('🔄 BrandingConfigModule: Resetting branding settings');
            this.setResetButtonState('resetting');
            
            const response = await fetch(`${this.apiManager.apiUrl}/api/config/branding/reset`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('agent_token')}`
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to reset branding settings');
            }
            
            // Reload settings from server
            await this.loadBrandingSettings();
            this.renderBrandingForm();
            
            Toast.success('Branding settings reset to defaults', 'All customizations have been removed');
            this.updateStatus('Settings reset to defaults', 'success');
            
            console.log('✅ BrandingConfigModule: Settings reset successfully');
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to reset branding settings');
            Toast.error('Failed to reset settings', error.message);
            this.updateStatus(error.message, 'error');
        } finally {
            this.setResetButtonState('normal');
        }
    }

    /**
     * Handle form submission
     */
    async handleFormSubmit(e) {
        e.preventDefault();
        await this.saveBrandingSettings();
    }

    /**
     * Preview branding changes (same as generatePreview)
     */
    previewBrandingChanges() {
        this.generatePreview();
        Toast.info('Preview updated', 'Changes shown in preview section');
    }

    /**
     * Cancel changes and revert to original settings
     */
    cancelChanges() {
        if (this.hasUnsavedChanges) {
            const confirmed = confirm('Are you sure you want to discard your changes?');
            if (!confirmed) return;
        }

        // Revert to original settings
        this.currentSettings = { ...this.originalSettings };
        this.hasUnsavedChanges = false;

        // Re-populate form
        this.populateFormFromSettings();
        this.updateLivePreview();
        Toast.info('Changes cancelled', 'Form reverted to saved settings');
    }

    /**
     * Populate form fields from current settings
     */
    populateFormFromSettings() {
        const settings = this.currentSettings;

        if (this.elements.widgetNameInput) {
            this.elements.widgetNameInput.value = settings.widget_name || '';
        }

        if (this.elements.primaryColorInput) {
            this.elements.primaryColorInput.value = settings.widget_primary_color || '#2c5530';
        }

        if (this.elements.colorHexInput) {
            this.elements.colorHexInput.value = settings.widget_primary_color || '#2c5530';
        }

        if (this.elements.userMessageColorInput) {
            this.elements.userMessageColorInput.value = settings.user_message_color || '#3b82f6';
        }

        if (this.elements.userMessageColorHexInput) {
            this.elements.userMessageColorHexInput.value = settings.user_message_color || '#3b82f6';
        }

        if (this.elements.allowedDomainsTextarea) {
            this.elements.allowedDomainsTextarea.value = settings.widget_allowed_domains || '*';
        }

        if (this.elements.welcomeMessageInput) {
            this.elements.welcomeMessageInput.value = settings.welcome_message || 'Hello! How can I help you today?';
        }

        if (this.elements.privacyCheckboxTextInput) {
            this.elements.privacyCheckboxTextInput.value = settings.privacy_checkbox_text || 'I agree to the [Privacy Policy](https://example.com/privacy) and [Terms of Service](https://example.com/terms).';
        }

        console.log('📝 BrandingConfigModule: Form populated from settings', settings);
    }

    /**
     * Generate live preview
     */
    generatePreview() {
        if (!this.elements.previewContainer) return;
        
        const { widget_name, widget_primary_color } = this.currentSettings;
        
        this.elements.previewContainer.innerHTML = `
            <div class="border-2 border-gray-200 rounded-lg p-4 bg-white">
                <h4 class="font-semibold text-gray-800 mb-3">Live Preview</h4>
                
                <!-- Widget Preview -->
                <div class="relative">
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <!-- Simulated website header -->
                        <div class="text-center mb-4 text-gray-600 text-sm">
                            Your Website
                        </div>
                        
                        <!-- Widget preview -->
                        <div class="relative inline-block">
                            <!-- Chat bubble -->
                            <div class="bg-white border-2 rounded-lg shadow-lg p-4 max-w-sm" 
                                 style="border-color: ${widget_primary_color};">
                                <!-- Header -->
                                <div class="flex items-center space-x-2 mb-3 pb-2 border-b" 
                                     style="border-color: ${widget_primary_color}20;">
                                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                                         style="background-color: ${widget_primary_color};">
                                        ${(widget_name || 'VA').charAt(0)}
                                    </div>
                                    <div>
                                        <div class="font-semibold text-gray-800 text-sm">${widget_name || 'Assistant'}</div>
                                        <div class="text-xs text-gray-500">Online</div>
                                    </div>
                                </div>
                                
                                <!-- Sample message -->
                                <div class="space-y-2">
                                    <div class="bg-gray-100 rounded-lg p-2 text-sm text-gray-700">
                                        Hello! How can I help you today?
                                    </div>
                                </div>
                                
                                <!-- Input area -->
                                <div class="flex items-center space-x-2 mt-3 pt-2 border-t border-gray-100">
                                    <input type="text" placeholder="Type a message..." 
                                           class="flex-1 text-xs p-2 border border-gray-200 rounded-lg"
                                           disabled>
                                    <button class="p-2 rounded-lg text-white text-xs" 
                                            style="background-color: ${widget_primary_color};">
                                        Send
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Widget toggle button -->
                            <div class="absolute -bottom-2 -right-2 w-12 h-12 rounded-full text-white flex items-center justify-center shadow-lg cursor-pointer"
                                 style="background-color: ${widget_primary_color};">
                                <i class="fas fa-comment text-sm"></i>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Integration Code Section -->
                <div class="mt-8 pt-6 border-t border-gray-200">
                    <h4 class="font-semibold text-gray-800 mb-4">
                        <i class="fas fa-code text-indigo-600 mr-2"></i>
                        Widget Integration Code
                    </h4>
                    
                    <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <h5 class="font-semibold text-green-800 mb-2">Embed Widget on Your Website</h5>
                        <p class="text-green-700">Copy and paste this code into your website's HTML to add the chat widget with your current branding.</p>
                    </div>
                    
                    <button id="generate-integration-code" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors mb-4">
                        <i class="fas fa-magic mr-2"></i>Generate Integration Code
                    </button>
                    
                    <div id="integration-code-container" class="hidden">
                        <div class="mb-4">
                            <label for="integration-code" class="block text-sm font-medium text-gray-700 mb-2">HTML Integration Code</label>
                            <textarea id="integration-code" readonly rows="10" class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"></textarea>
                        </div>
                        <button id="copy-integration-code" class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors">
                            <i class="fas fa-copy mr-2"></i>Copy to Clipboard
                        </button>
                        
                        <div class="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h5 class="font-semibold text-blue-800 mb-2">Integration Instructions:</h5>
                            <ol class="list-decimal list-inside text-blue-700 space-y-1">
                                <li>Copy the integration code above</li>
                                <li>Paste it into your website's HTML, preferably before the closing &lt;/body&gt; tag</li>
                                <li>The widget will appear as a floating chat button in the bottom-right corner</li>
                                <li>Users can click it to start chatting with the assistant</li>
                                <li>The widget will use your current branding settings automatically</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // =========================
    // UI RENDERING METHODS
    // =========================

    /**
     * Render the branding configuration form
     */
    renderBrandingForm() {
        if (!this.elements.brandingConfigDiv) return;
        
        const { widget_name, widget_primary_color, widget_allowed_domains } = this.currentSettings;
        
        this.elements.brandingConfigDiv.innerHTML = `
            <div class="space-y-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900">Branding Configuration</h3>
                        <p class="text-sm text-gray-600">Customize the appearance, branding, and integration of your chat widget</p>
                    </div>
                    <div class="flex space-x-2">
                        <!-- Preview button removed - live preview makes this redundant -->
                        <button id="reset-branding" class="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200">
                            <i class="fas fa-undo mr-1"></i>Reset
                        </button>
                        <button id="save-branding" class="px-4 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50" disabled>
                            <i class="fas fa-save mr-1"></i>Save Changes
                        </button>
                    </div>
                </div>
                
                <!-- Form Grid -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Left Column: Form Fields -->
                    <div class="space-y-4">
                        <div class="bg-white p-4 rounded-lg border">
                            <h4 class="font-medium text-gray-900 mb-4">Widget Appearance</h4>
                            
                            <!-- Widget Name -->
                            <div class="mb-4">
                                <label for="widget-name" class="block text-sm font-medium text-gray-700 mb-1">
                                    Widget Name
                                </label>
                                <input type="text" id="widget-name" 
                                       value="${widget_name || ''}" 
                                       maxlength="100"
                                       class="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                       placeholder="e.g., Lizdeika">
                                <p class="text-xs text-gray-500 mt-1">Display name for your chat widget</p>
                            </div>
                            
                            <!-- Primary Color -->
                            <div class="mb-4">
                                <label for="primary-color" class="block text-sm font-medium text-gray-700 mb-1">
                                    Primary Color
                                </label>
                                <div class="flex items-center space-x-3">
                                    <input type="color" id="primary-color" 
                                           value="${widget_primary_color || '#2c5530'}"
                                           class="w-12 h-10 border border-gray-300 rounded cursor-pointer">
                                    <input type="text" id="color-hex" 
                                           value="${widget_primary_color || '#2c5530'}"
                                           pattern="^#[0-9A-Fa-f]{6}$"
                                           class="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                                           placeholder="#2c5530">
                                    <div id="color-preview" 
                                         class="w-10 h-10 border border-gray-300 rounded"
                                         style="background-color: ${widget_primary_color || '#2c5530'};"></div>
                                </div>
                                <p class="text-xs text-gray-500 mt-1">Main color for buttons and highlights</p>
                            </div>
                            
                        </div>
                        
                        <div class="bg-white p-4 rounded-lg border">
                            <h4 class="font-medium text-gray-900 mb-4">Security Settings</h4>
                            
                            <!-- Allowed Domains -->
                            <div class="mb-4">
                                <label for="allowed-domains" class="block text-sm font-medium text-gray-700 mb-1">
                                    Allowed Domains
                                </label>
                                <textarea id="allowed-domains" rows="3" 
                                          class="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                          placeholder="*.example.com, specific-domain.com, or * for all">${widget_allowed_domains || ''}</textarea>
                                <p class="text-xs text-gray-500 mt-1">
                                    Domains where the widget can be embedded (one per line). Use * for all domains.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Right Column: Preview -->
                    <div class="space-y-4">
                        <div id="preview-container" class="sticky top-4">
                            <!-- Preview will be rendered here -->
                        </div>
                    </div>
                </div>
                
                <!-- Status -->
                <div id="branding-form-status" class="hidden mt-4"></div>
            </div>
        `;
        
        // Re-initialize elements after rendering
        this.initializeFormElements();
        
        // Generate initial preview
        this.generatePreview();
    }

    /**
     * Initialize form elements after rendering
     */
    initializeFormElements() {
        this.elements = {
            ...this.elements,
            widgetNameInput: document.getElementById('widget-name'),
            primaryColorInput: document.getElementById('primary-color'),
            colorHexInput: document.getElementById('color-hex'),
            colorPreview: document.getElementById('color-preview'),
            allowedDomainsTextarea: document.getElementById('allowed-domains'),
            
            saveButton: document.getElementById('save-branding'),
            resetButton: document.getElementById('reset-branding'),
            // Removed: previewButton (redundant with live preview)
            
            previewContainer: document.getElementById('preview-container'),
            statusDiv: document.getElementById('branding-form-status'),
            
            // Integration code elements
            generateCodeButton: document.getElementById('generate-integration-code'),
            copyCodeButton: document.getElementById('copy-integration-code'),
            codeContainer: document.getElementById('integration-code-container'),
            integrationCodeTextarea: document.getElementById('integration-code')
        };
        
        // Re-setup event listeners for form elements
        this.setupFormEventListeners();
    }

    /**
     * Setup event listeners for form elements
     */
    setupFormEventListeners() {
        // Form change detection
        [
            this.elements.widgetNameInput,
            this.elements.primaryColorInput,
            this.elements.colorHexInput,
            this.elements.allowedDomainsTextarea
        ].forEach(element => {
            if (element) {
                const changeHandler = () => this.handleFormChange();
                element.addEventListener('input', changeHandler);
                element.addEventListener('change', changeHandler);
            }
        });
        
        // Color picker sync
        if (this.elements.primaryColorInput && this.elements.colorHexInput) {
            this.elements.primaryColorInput.addEventListener('input', (e) => {
                this.elements.colorHexInput.value = e.target.value;
                this.updateColorPreview(e.target.value);
                this.handleFormChange();
            });
            
            this.elements.colorHexInput.addEventListener('input', (e) => {
                const color = e.target.value;
                if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                    this.elements.primaryColorInput.value = color;
                    this.updateColorPreview(color);
                }
                this.handleFormChange();
            });
        }
        
        // Button handlers
        if (this.elements.saveButton) {
            this.elements.saveButton.addEventListener('click', () => this.saveBrandingSettings());
        }
        
        if (this.elements.resetButton) {
            this.elements.resetButton.addEventListener('click', () => this.resetBrandingSettings());
        }
        
        // Removed: previewButton event listener (redundant with live preview)
        
        // Integration code event listeners
        if (this.elements.generateCodeButton) {
            this.elements.generateCodeButton.addEventListener('click', () => this.generateIntegrationCode());
        }
        
        if (this.elements.copyCodeButton) {
            this.elements.copyCodeButton.addEventListener('click', () => this.copyIntegrationCode());
        }
    }

    // =========================
    // EVENT HANDLERS
    // =========================

    /**
     * Handle form changes
     */
    handleFormChange() {
        // Update current settings from form
        this.updateSettingsFromForm();
        
        // Check for changes
        this.checkForChanges();
        
        // Update preview
        this.generatePreview();
        
        // Update save button state
        this.updateSaveButton();
    }

    /**
     * Update current settings from form values
     */
    updateSettingsFromForm() {
        if (this.elements.widgetNameInput) {
            this.currentSettings.widget_name = this.elements.widgetNameInput.value;
        }
        
        if (this.elements.colorHexInput) {
            this.currentSettings.widget_primary_color = this.elements.colorHexInput.value;
        }
        
        if (this.elements.userMessageColorHexInput) {
            this.currentSettings.user_message_color = this.elements.userMessageColorHexInput.value;
        }
        
        if (this.elements.welcomeMessageInput) {
            this.currentSettings.welcome_message = this.elements.welcomeMessageInput.value;
        }

        if (this.elements.allowedDomainsTextarea) {
            this.currentSettings.widget_allowed_domains = this.elements.allowedDomainsTextarea.value;
        }

        if (this.elements.privacyCheckboxTextInput) {
            this.currentSettings.privacy_checkbox_text = this.elements.privacyCheckboxTextInput.value.trim();
        }
    }

    /**
     * Check if there are unsaved changes
     */
    checkForChanges() {
        this.hasUnsavedChanges = false;
        
        for (const [key, value] of Object.entries(this.currentSettings)) {
            if (this.originalSettings[key] !== value) {
                this.hasUnsavedChanges = true;
                break;
            }
        }
    }

    /**
     * Update color preview
     */
    updateColorPreview(color) {
        if (this.elements.colorPreview) {
            this.elements.colorPreview.style.backgroundColor = color;
        }
    }

    /**
     * Update save button state
     */
    updateSaveButton() {
        if (!this.elements.saveButton) return;
        
        this.elements.saveButton.disabled = !this.hasUnsavedChanges;
        
        if (this.hasUnsavedChanges) {
            this.elements.saveButton.classList.remove('bg-gray-400');
            this.elements.saveButton.classList.add('bg-blue-600');
        } else {
            this.elements.saveButton.classList.remove('bg-blue-600');
            this.elements.saveButton.classList.add('bg-gray-400');
        }
    }

    // =========================
    // UTILITY METHODS
    // =========================

    /**
     * Validate current settings
     */
    validateSettings() {
        const { widget_name, widget_primary_color, widget_allowed_domains, welcome_message, privacy_checkbox_text } = this.currentSettings;
        const errors = [];

        // Widget name validation
        if (!widget_name?.trim()) {
            errors.push({ field: 'widget_name', message: 'Widget name is required' });
        } else if (widget_name.length > 100) {
            errors.push({ field: 'widget_name', message: 'Widget name must be 100 characters or less' });
        }

        // Primary color validation
        if (!widget_primary_color || !/^#[0-9A-Fa-f]{6}$/.test(widget_primary_color)) {
            errors.push({ field: 'widget_primary_color', message: 'Primary color must be a valid hex color (e.g., #2c5530)' });
        }


        // Welcome message validation
        if (welcome_message && welcome_message.length > 500) {
            errors.push({ field: 'welcome_message', message: 'Welcome message must be 500 characters or less' });
        }

        // Privacy checkbox text validation
        if (!privacy_checkbox_text?.trim()) {
            errors.push({ field: 'privacy_checkbox_text', message: 'Privacy checkbox text is required' });
        } else if (privacy_checkbox_text.length > 500) {
            errors.push({ field: 'privacy_checkbox_text', message: 'Privacy checkbox text must be 500 characters or less' });
        } else {
            // Validate URLs in Markdown links [text](url)
            const urlValidationError = this.validateMarkdownUrls(privacy_checkbox_text);
            if (urlValidationError) {
                errors.push({ field: 'privacy_checkbox_text', message: urlValidationError });
            }
        }

        // Allowed domains validation
        if (!widget_allowed_domains?.trim()) {
            errors.push({ field: 'widget_allowed_domains', message: 'Allowed domains setting is required' });
        } else {
            // Validate domain format
            const domains = widget_allowed_domains.split('\n').map(d => d.trim()).filter(d => d);
            for (const domain of domains) {
                if (domain !== '*' && !this.isValidDomain(domain)) {
                    errors.push({ field: 'widget_allowed_domains', message: `Invalid domain format: ${domain}` });
                    break;
                }
            }
        }
        
        return errors.length > 0 ? errors : null;
    }

    /**
     * Validate individual field in real-time
     */
    validateField(fieldName, value) {
        const errors = [];
        
        switch (fieldName) {
            case 'widget_name':
                if (!value?.trim()) {
                    errors.push('Widget name is required');
                } else if (value.length > 100) {
                    errors.push('Widget name must be 100 characters or less');
                }
                break;
                
            case 'widget_primary_color':
                if (!value || !/^#[0-9A-Fa-f]{6}$/.test(value)) {
                    errors.push('Must be a valid hex color (e.g., #2c5530)');
                }
                break;
                
                
            case 'welcome_message':
                if (value && value.length > 500) {
                    errors.push('Welcome message must be 500 characters or less');
                }
                break;

            case 'privacy_checkbox_text':
                if (!value?.trim()) {
                    errors.push('Privacy checkbox text is required');
                } else if (value.length > 500) {
                    errors.push('Privacy checkbox text must be 500 characters or less');
                } else {
                    // Validate URLs in Markdown links
                    const urlError = this.validateMarkdownUrls(value);
                    if (urlError) {
                        errors.push(urlError);
                    }
                }
                break;

            case 'widget_allowed_domains':
                if (!value?.trim()) {
                    errors.push('Allowed domains setting is required');
                } else {
                    const domains = value.split('\n').map(d => d.trim()).filter(d => d);
                    for (const domain of domains) {
                        if (domain !== '*' && !this.isValidDomain(domain)) {
                            errors.push(`Invalid domain format: ${domain}`);
                            break;
                        }
                    }
                }
                break;
        }
        
        return errors;
    }

    /**
     * Check if a domain format is valid
     */
    isValidDomain(domain) {
        // Allow wildcards like *.example.com
        const wildcardPattern = /^\*\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        // Allow regular domains like example.com
        const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

        return wildcardPattern.test(domain) || domainPattern.test(domain);
    }

    /**
     * Validate URLs in Markdown text (align with backend validation)
     */
    validateMarkdownUrls(text) {
        // Extract URLs from Markdown links [text](url)
        const markdownLinkPattern = /\[(.*?)\]\((.*?)\)/g;
        let match;

        while ((match = markdownLinkPattern.exec(text)) !== null) {
            const url = match[2];

            try {
                // Validate URL format
                const parsedUrl = new URL(url);
                const protocol = parsedUrl.protocol.toLowerCase();

                // Only allow http and https protocols (matches backend validation)
                if (protocol !== 'http:' && protocol !== 'https:') {
                    return `Invalid URL protocol in link. Only http and https are allowed. Found: ${url}`;
                }
            } catch (error) {
                // Invalid URL format
                return `Invalid URL format in link: ${url}`;
            }
        }

        return null; // No errors
    }

    /**
     * Display field validation error
     */
    showFieldError(fieldName, errors) {
        const input = document.getElementById(fieldName.replace('_', '-'));
        if (!input) return;

        // Remove existing error styling
        input.classList.remove('border-red-500', 'ring-red-500');
        
        // Remove existing error message
        const existingError = input.parentElement.querySelector('.validation-error');
        if (existingError) {
            existingError.remove();
        }

        if (errors.length > 0) {
            // Add error styling
            input.classList.add('border-red-500', 'ring-red-500');
            
            // Add error message
            const errorDiv = document.createElement('div');
            errorDiv.className = 'validation-error text-red-600 text-xs mt-1';
            errorDiv.textContent = errors[0]; // Show first error
            input.parentElement.appendChild(errorDiv);
        }
    }

    /**
     * Clear all field validation errors
     */
    clearAllFieldErrors() {
        const fields = ['widget-name', 'widget-primary-color', 'widget-primary-color-text', 'welcome-message', 'privacy-checkbox-text', 'widget-allowed-domains'];

        fields.forEach(fieldId => {
            const input = document.getElementById(fieldId);
            if (input) {
                input.classList.remove('border-red-500', 'ring-red-500');
                const existingError = input.parentElement.querySelector('.validation-error');
                if (existingError) {
                    existingError.remove();
                }
            }
        });
    }

    /**
     * Update status message
     */
    updateStatus(message, type = 'info') {
        if (!this.elements.statusDiv) return;
        
        const colors = {
            success: 'bg-green-100 text-green-800 border-green-200',
            error: 'bg-red-100 text-red-800 border-red-200',
            info: 'bg-blue-100 text-blue-800 border-blue-200',
            warning: 'bg-yellow-100 text-yellow-800 border-yellow-200'
        };
        
        this.elements.statusDiv.className = `p-3 rounded-lg border text-sm ${colors[type] || colors.info}`;
        this.elements.statusDiv.textContent = message;
        this.elements.statusDiv.classList.remove('hidden');
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                this.elements.statusDiv?.classList.add('hidden');
            }, 5000);
        }
    }

    /**
     * Set save button state
     */
    setSaveButtonState(state) {
        if (!this.elements.saveButton) return;
        
        switch (state) {
            case 'saving':
                this.elements.saveButton.disabled = true;
                this.elements.saveButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Saving...';
                break;
            case 'normal':
            default:
                this.elements.saveButton.innerHTML = '<i class="fas fa-save mr-1"></i>Save Changes';
                this.updateSaveButton(); // Reset based on changes
                break;
        }
    }

    /**
     * Set reset button state
     */
    setResetButtonState(state) {
        if (!this.elements.resetButton) return;
        
        switch (state) {
            case 'resetting':
                this.elements.resetButton.disabled = true;
                this.elements.resetButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Resetting...';
                break;
            case 'normal':
            default:
                this.elements.resetButton.disabled = false;
                this.elements.resetButton.innerHTML = '<i class="fas fa-undo mr-1"></i>Reset';
                break;
        }
    }

    /**
     * Render error state
     */
    renderBrandingError(errorMessage) {
        if (!this.elements.brandingConfigDiv) return;
        
        this.elements.brandingConfigDiv.innerHTML = `
            <div class="text-center py-8">
                <div class="text-red-600 mb-4">
                    <i class="fas fa-exclamation-circle text-3xl"></i>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Failed to Load Branding Settings</h3>
                <p class="text-gray-600 mb-4">${errorMessage}</p>
                <button onclick="location.reload()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Retry
                </button>
            </div>
        `;
    }

    /**
     * Setup additional event listeners
     */
    setupFormChangeListeners() {
        // Set up change listeners for all form inputs
        const inputElements = [
            this.elements.widgetNameInput,
            this.elements.primaryColorInput,
            this.elements.colorHexInput,
            this.elements.userMessageColorInput,
            this.elements.userMessageColorHexInput,
            this.elements.welcomeMessageInput,
            this.elements.privacyCheckboxTextInput,
            this.elements.allowedDomainsTextarea
        ];

        inputElements.forEach(element => {
            if (element) {
                const changeHandler = () => {
                    this.updateSettingsFromForm();
                    this.checkForChanges();
                    this.updateSaveButton();
                    this.updateLivePreview();
                };
                
                element.addEventListener('input', changeHandler);
                element.addEventListener('change', changeHandler);
                element.addEventListener('blur', changeHandler);
            }
        });

        // Special handling for color sync between color picker and text input
        if (this.elements.primaryColorInput && this.elements.colorHexInput) {
            this.elements.primaryColorInput.addEventListener('input', (e) => {
                this.elements.colorHexInput.value = e.target.value;
            });
            
            this.elements.colorHexInput.addEventListener('input', (e) => {
                const color = e.target.value;
                if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                    this.elements.primaryColorInput.value = color;
                }
            });
        }

        // Color sync for user message color
        if (this.elements.userMessageColorInput && this.elements.userMessageColorHexInput) {
            this.elements.userMessageColorInput.addEventListener('input', (e) => {
                this.elements.userMessageColorHexInput.value = e.target.value;
            });
            
            this.elements.userMessageColorHexInput.addEventListener('input', (e) => {
                const color = e.target.value;
                if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                    this.elements.userMessageColorInput.value = color;
                }
            });
        }

        console.log('🔗 BrandingConfigModule: Form change listeners setup complete');
    }

    setupColorPreview() {
        // This will be called after form rendering
    }

    setupButtonHandlers() {
        // This will be called after form rendering
    }

    setupKeyboardShortcuts() {
        // Ctrl+S to save
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (this.hasUnsavedChanges) {
                    this.saveBrandingSettings();
                }
            }
        });
    }

    /**
     * Get module status for debugging
     */
    getStatus() {
        return {
            hasUnsavedChanges: this.hasUnsavedChanges,
            currentSettings: this.currentSettings,
            originalSettings: this.originalSettings,
            elements: {
                brandingConfigDiv: !!this.elements.brandingConfigDiv,
                saveButton: !!this.elements.saveButton,
                formInputs: !!(this.elements.widgetNameInput && this.elements.primaryColorInput)
            }
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
        
        console.log('🧹 BrandingConfigModule: Cleanup complete');
    }
    
    // =========================
    // INTEGRATION CODE METHODS
    // =========================
    
    /**
     * Generate integration code with current branding settings
     */
    async generateIntegrationCode() {
        try {
            console.log('📝 BrandingConfigModule: Generate Integration Code button clicked');
            console.log('📝 BrandingConfigModule: Generating integration code with branding');
            
            // Update UI to show generating state
            if (this.elements.generateCodeButton) {
                this.elements.generateCodeButton.disabled = true;
                this.elements.generateCodeButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generating...';
            }
            
            // Get current widget configuration URL
            const widgetUrl = `${window.location.origin}/widget.js`;

            // Use current settings from memory instead of reloading
            const currentSettings = this.currentSettings;

            const integrationCode = `<!-- Lizdeika Chat Widget -->
<script src="https://cdn.socket.io/4.8.1/socket.io.min.js"
        integrity="sha384-mkQ3/7FUtcGyoppY6bz/PORYoGqOl7/aSUMn2ymDOJcapfS6PHqxhRTMh1RR0Q6+"
        crossorigin="anonymous"></script>
<script type="text/javascript">
(function() {
    var config = {
        apiUrl: '${window.location.origin}',
        widgetName: '${currentSettings?.widget_name || 'Lizdeika'}',
        primaryColor: '${currentSettings?.widget_primary_color || '#2c5530'}',
        allowedDomains: '${currentSettings?.widget_allowed_domains || '*'}'
    };

    // Create widget container
    var widgetContainer = document.createElement('div');
    widgetContainer.id = 'vilnius-widget-container';
    document.body.appendChild(widgetContainer);

    // Load and initialize widget
    var script = document.createElement('script');
    script.src = '${widgetUrl}';
    script.onload = function() {
        if (window.VilniusChat) {
            window.VilniusChat.init(config);
        }
    };
    document.head.appendChild(script);
})();
</script>
<!-- End Lizdeika Chat Widget -->`;
            
            // Update UI with generated code
            if (this.elements.integrationCodeTextarea) {
                this.elements.integrationCodeTextarea.value = integrationCode;
            }
            
            // Show the code container
            if (this.elements.codeContainer) {
                this.elements.codeContainer.classList.remove('hidden');
            }
            
            Toast.success('Integration code generated with current branding!');
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to generate integration code');
            Toast.error('Failed to generate integration code: ' + error.message);
        } finally {
            // Reset button state
            if (this.elements.generateCodeButton) {
                this.elements.generateCodeButton.disabled = false;
                this.elements.generateCodeButton.innerHTML = '<i class="fas fa-magic mr-2"></i>Generate Integration Code';
            }
        }
    }
    
    /**
     * Copy integration code to clipboard
     */
    async copyIntegrationCode() {
        try {
            console.log('📋 BrandingConfigModule: Copy Integration Code button clicked');
            
            if (!this.elements.integrationCodeTextarea || !this.elements.integrationCodeTextarea.value) {
                Toast.warning('Please generate the integration code first');
                return;
            }
            
            // Copy to clipboard
            await navigator.clipboard.writeText(this.elements.integrationCodeTextarea.value);
            Toast.success('Integration code copied to clipboard!');
            
            // Temporarily update button text
            const originalText = this.elements.copyCodeButton.innerHTML;
            this.elements.copyCodeButton.innerHTML = '<i class="fas fa-check mr-2"></i>Copied!';
            this.elements.copyCodeButton.classList.add('bg-green-600');
            this.elements.copyCodeButton.classList.remove('bg-gray-600');
            
            setTimeout(() => {
                this.elements.copyCodeButton.innerHTML = originalText;
                this.elements.copyCodeButton.classList.remove('bg-green-600');
                this.elements.copyCodeButton.classList.add('bg-gray-600');
            }, 2000);
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to copy integration code');
            Toast.error('Failed to copy to clipboard: ' + error.message);
        }
    }
}