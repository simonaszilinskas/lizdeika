/**
 * Knowledge Management Module
 *
 * Handles AI provider credential configuration and knowledge base management
 * Admin-only access for configuring Flowise/OpenRouter settings
 */

import { Toast } from '../../agent-dashboard/utils/Toast.js';
import { ErrorHandler } from '../../agent-dashboard/utils/ErrorHandler.js';

export class KnowledgeManagementModule {
    constructor(apiManager, stateManager, connectionManager) {
        this.apiManager = apiManager;
        this.stateManager = stateManager;
        this.connectionManager = connectionManager;

        // DOM elements
        this.elements = {
            knowledgeTab: null,

            // AI Provider Form
            providerForm: null,
            providerFlowiseRadio: null,
            providerOpenRouterRadio: null,

            // Flowise Configuration
            flowiseConfig: null,
            flowiseUrl: null,
            flowiseChatflowId: null,
            flowiseApiKey: null,

            // OpenRouter Configuration
            openRouterConfig: null,
            openRouterApiKey: null,
            openRouterModel: null,
            siteUrl: null,
            siteName: null,

            // Provider Status and Controls
            providerStatus: null,
            testProviderBtn: null,
            saveProviderBtn: null
        };

        // Current settings cache
        this.currentProvider = null;
        this.currentSettings = {};
        this.originalSettings = {};
        this.hasUnsavedChanges = false;

        // Connection test state
        this.isTestingConnection = false;

        // Event listeners
        this.eventListeners = [];

        console.log('🧠 KnowledgeManagementModule: Initialized');
    }

    /**
     * Initialize the knowledge management module
     */
    async initialize() {
        try {
            // Initialize DOM elements
            this.initializeElements();

            // Setup event listeners
            this.setupEventListeners();

            // Load current AI provider settings
            await this.loadAIProviderSettings();

            // Setup state change listeners
            this.setupStateListeners();

            console.log('✅ KnowledgeManagementModule: Initialization complete');

        } catch (error) {
            ErrorHandler.logError(error, 'KnowledgeManagementModule initialization failed');
            throw error;
        }
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.elements = {
            knowledgeTab: document.getElementById('knowledge-tab'),

            // AI Provider Form
            providerForm: document.getElementById('ai-provider-form'),
            providerFlowiseRadio: document.getElementById('provider-flowise'),
            providerOpenRouterRadio: document.getElementById('provider-openrouter'),

            // Flowise Configuration
            flowiseConfig: document.getElementById('flowise-config'),
            flowiseUrl: document.getElementById('flowise-url'),
            flowiseChatflowId: document.getElementById('flowise-chatflow-id'),
            flowiseApiKey: document.getElementById('flowise-api-key'),

            // OpenRouter Configuration
            openRouterConfig: document.getElementById('openrouter-config'),
            openRouterApiKey: document.getElementById('openrouter-api-key'),
            openRouterModel: document.getElementById('openrouter-model'),
            rephrasingModel: document.getElementById('rephrasing-model'),
            siteUrl: document.getElementById('site-url'),
            siteName: document.getElementById('site-name'),

            // Provider Status and Controls
            providerStatus: document.getElementById('provider-status'),
            testProviderBtn: document.getElementById('test-provider-btn'),
            saveProviderBtn: document.getElementById('save-provider-btn')
        };

        console.log('🎯 KnowledgeManagementModule: DOM elements initialized', {
            providerForm: !!this.elements.providerForm,
            flowiseConfig: !!this.elements.flowiseConfig,
            openRouterConfig: !!this.elements.openRouterConfig,
            testProviderBtn: !!this.elements.testProviderBtn
        });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Provider selection change
        if (this.elements.providerFlowiseRadio) {
            this.elements.providerFlowiseRadio.addEventListener('change', () => this.handleProviderChange('flowise'));
        }

        if (this.elements.providerOpenRouterRadio) {
            this.elements.providerOpenRouterRadio.addEventListener('change', () => this.handleProviderChange('openrouter'));
        }

        // Form input changes
        const formInputs = [
            this.elements.flowiseUrl,
            this.elements.flowiseChatflowId,
            this.elements.flowiseApiKey,
            this.elements.openRouterApiKey,
            this.elements.openRouterModel,
            this.elements.rephrasingModel,
            this.elements.siteUrl,
            this.elements.siteName
        ].filter(Boolean);

        formInputs.forEach(input => {
            input.addEventListener('input', () => this.handleFormChange());
        });

        // Form submission
        if (this.elements.providerForm) {
            this.elements.providerForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Test connection button
        if (this.elements.testProviderBtn) {
            this.elements.testProviderBtn.addEventListener('click', () => this.testProviderConnection());
        }

        // Save configuration button
        if (this.elements.saveProviderBtn) {
            this.elements.saveProviderBtn.addEventListener('click', () => this.saveProviderSettings());
        }

        console.log('📡 KnowledgeManagementModule: Event listeners setup complete');
    }

    /**
     * Setup state change listeners
     */
    setupStateListeners() {
        // Listen for connection changes
        if (this.connectionManager) {
            this.connectionManager.on('connect', () => {
                console.log('🔄 KnowledgeManagementModule: Connection restored');
            });

            this.connectionManager.on('disconnect', () => {
                console.log('⚠️ KnowledgeManagementModule: Connection lost');
            });
        }
    }

    /**
     * Load current AI provider settings
     */
    async loadAIProviderSettings() {
        try {
            console.log('📊 KnowledgeManagementModule: Loading AI provider settings...');

            const response = await this.apiManager.get('/api/settings/ai_providers');
            const settings = response.data || {};

            this.originalSettings = { ...settings };
            this.currentSettings = { ...settings };

            this.populateForm(settings);
            this.updateProviderStatus();

            console.log('✅ KnowledgeManagementModule: AI provider settings loaded', settings);

        } catch (error) {
            console.error('❌ KnowledgeManagementModule: Failed to load AI provider settings:', error);
            ErrorHandler.logError(error, 'Failed to load AI provider settings');

            // Show user-friendly error
            Toast.error('Failed to load AI provider settings. Please check your connection and try again.');
        }
    }

    /**
     * Populate form with settings data
     */
    populateForm(settings) {
        const provider = settings.ai_provider?.value || 'flowise';

        // Set provider selection
        if (provider === 'flowise' && this.elements.providerFlowiseRadio) {
            this.elements.providerFlowiseRadio.checked = true;
            this.handleProviderChange('flowise', false);
        } else if (provider === 'openrouter' && this.elements.providerOpenRouterRadio) {
            this.elements.providerOpenRouterRadio.checked = true;
            this.handleProviderChange('openrouter', false);
        }

        // Populate Flowise settings
        if (this.elements.flowiseUrl) {
            this.elements.flowiseUrl.value = settings.flowise_url?.value || '';
        }
        if (this.elements.flowiseChatflowId) {
            this.elements.flowiseChatflowId.value = settings.flowise_chatflow_id?.value || '';
        }
        if (this.elements.flowiseApiKey) {
            this.elements.flowiseApiKey.value = settings.flowise_api_key?.value || '';
        }

        // Populate OpenRouter settings
        if (this.elements.openRouterApiKey) {
            this.elements.openRouterApiKey.value = settings.openrouter_api_key?.value || '';
        }
        if (this.elements.openRouterModel) {
            this.elements.openRouterModel.value = settings.openrouter_model?.value || 'google/gemini-2.5-flash';
        }
        if (this.elements.rephrasingModel) {
            this.elements.rephrasingModel.value = settings.rephrasing_model?.value || 'google/gemini-2.5-flash-lite';
        }
        if (this.elements.siteUrl) {
            this.elements.siteUrl.value = settings.site_url?.value || '';
        }
        if (this.elements.siteName) {
            this.elements.siteName.value = settings.site_name?.value || '';
        }

        this.currentProvider = provider;
    }

    /**
     * Handle provider selection change
     */
    handleProviderChange(provider, markAsChanged = true) {
        this.currentProvider = provider;

        // Show/hide relevant configuration sections
        if (this.elements.flowiseConfig) {
            this.elements.flowiseConfig.style.display = provider === 'flowise' ? 'block' : 'none';
        }
        if (this.elements.openRouterConfig) {
            this.elements.openRouterConfig.style.display = provider === 'openrouter' ? 'block' : 'none';
        }

        if (markAsChanged) {
            this.handleFormChange();
        }

        this.validateForm();

        console.log(`🔄 KnowledgeManagementModule: Provider changed to ${provider}`);
    }

    /**
     * Handle form input changes
     */
    handleFormChange() {
        this.hasUnsavedChanges = true;
        this.validateForm();
        this.updateProviderStatus();
    }

    /**
     * Validate form and enable/disable buttons
     */
    validateForm() {
        let isValid = false;

        if (this.currentProvider === 'flowise') {
            const url = this.elements.flowiseUrl?.value?.trim();
            const chatflowId = this.elements.flowiseChatflowId?.value?.trim();
            isValid = url && chatflowId;
        } else if (this.currentProvider === 'openrouter') {
            const apiKey = this.elements.openRouterApiKey?.value?.trim();
            const model = this.elements.openRouterModel?.value?.trim();
            const siteUrl = this.elements.siteUrl?.value?.trim();
            const siteName = this.elements.siteName?.value?.trim();
            isValid = apiKey && model && siteUrl && siteName;
        }

        // Enable/disable buttons
        if (this.elements.testProviderBtn) {
            this.elements.testProviderBtn.disabled = !isValid;
        }
        if (this.elements.saveProviderBtn) {
            this.elements.saveProviderBtn.disabled = !isValid || !this.hasUnsavedChanges;
        }

        return isValid;
    }

    /**
     * Update provider status display
     */
    updateProviderStatus() {
        if (!this.elements.providerStatus) return;

        const status = this.elements.providerStatus;
        const statusDot = status.querySelector('span');

        if (this.hasUnsavedChanges) {
            if (statusDot) statusDot.className = 'inline-block w-3 h-3 rounded-full bg-yellow-500 mr-2';
            status.innerHTML = `<span class="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-2"></span>Status: Unsaved changes`;
        } else if (this.currentProvider) {
            if (statusDot) statusDot.className = 'inline-block w-3 h-3 rounded-full bg-blue-500 mr-2';
            status.innerHTML = `<span class="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2"></span>Status: ${this.currentProvider} configured`;
        } else {
            if (statusDot) statusDot.className = 'inline-block w-3 h-3 rounded-full bg-gray-300 mr-2';
            status.innerHTML = `<span class="inline-block w-3 h-3 rounded-full bg-gray-300 mr-2"></span>Status: Not configured`;
        }
    }

    /**
     * Handle form submission
     */
    async handleFormSubmit(e) {
        e.preventDefault();
        await this.saveProviderSettings();
    }

    /**
     * Test provider connection
     */
    async testProviderConnection() {
        if (this.isTestingConnection) return;

        this.isTestingConnection = true;
        const testBtn = this.elements.testProviderBtn;

        if (testBtn) {
            testBtn.disabled = true;
            testBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Testing...';
        }

        try {
            console.log('🧪 KnowledgeManagementModule: Testing provider connection...');

            const testData = {
                provider: this.currentProvider,
                config: this.gatherFormData()
            };

            const response = await this.apiManager.post('/api/system/test-ai-provider', testData);

            if (response.success) {
                Toast.success(`${this.currentProvider} connection test successful!`);

                if (this.elements.providerStatus) {
                    this.elements.providerStatus.innerHTML =
                        `<span class="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span>Status: Connection test passed`;
                }
            } else {
                throw new Error(response.message || 'Connection test failed');
            }

        } catch (error) {
            console.error('❌ KnowledgeManagementModule: Connection test failed:', error);

            Toast.error(`Connection test failed: ${error.message}`);

            if (this.elements.providerStatus) {
                this.elements.providerStatus.innerHTML =
                    `<span class="inline-block w-3 h-3 rounded-full bg-red-500 mr-2"></span>Status: Connection test failed`;
            }

        } finally {
            this.isTestingConnection = false;

            if (testBtn) {
                testBtn.disabled = false;
                testBtn.innerHTML = '<i class="fas fa-flask mr-1"></i>Test Connection';
            }
        }
    }

    /**
     * Save provider settings
     */
    async saveProviderSettings() {
        try {
            if (!this.validateForm()) {
                Toast.error('Please fill in all required fields');
                return;
            }

            console.log('💾 KnowledgeManagementModule: Saving AI provider settings...');

            const saveBtn = this.elements.saveProviderBtn;
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Saving...';
            }

            const settingsData = this.gatherFormData();

            const response = await this.apiManager.post('/api/settings/ai_providers', settingsData);

            if (response.success) {
                this.hasUnsavedChanges = false;
                this.originalSettings = { ...this.currentSettings };

                Toast.success('AI provider settings saved successfully!');

                // Update status
                this.updateProviderStatus();

                console.log('✅ KnowledgeManagementModule: Settings saved successfully');

            } else {
                throw new Error(response.message || 'Failed to save settings');
            }

        } catch (error) {
            console.error('❌ KnowledgeManagementModule: Failed to save settings:', error);
            ErrorHandler.logError(error, 'Failed to save AI provider settings');

            Toast.error(`Failed to save settings: ${error.message}`);

        } finally {
            const saveBtn = this.elements.saveProviderBtn;
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i>Save Configuration';
            }
        }
    }

    /**
     * Gather form data for submission
     */
    gatherFormData() {
        const data = {
            ai_provider: this.currentProvider
        };

        if (this.currentProvider === 'flowise') {
            data.flowise_url = this.elements.flowiseUrl?.value?.trim() || null;
            data.flowise_chatflow_id = this.elements.flowiseChatflowId?.value?.trim() || null;
            data.flowise_api_key = this.elements.flowiseApiKey?.value?.trim() || null;
        } else if (this.currentProvider === 'openrouter') {
            data.openrouter_api_key = this.elements.openRouterApiKey?.value?.trim() || null;
            data.openrouter_model = this.elements.openRouterModel?.value?.trim() || null;
            data.rephrasing_model = this.elements.rephrasingModel?.value?.trim() || null;
            data.site_url = this.elements.siteUrl?.value?.trim() || null;
            data.site_name = this.elements.siteName?.value?.trim() || null;
        }

        return data;
    }

    /**
     * Cleanup and destroy module
     */
    destroy() {
        // Remove event listeners
        this.eventListeners.forEach(({ element, event, handler }) => {
            if (element) {
                element.removeEventListener(event, handler);
            }
        });

        this.eventListeners = [];

        console.log('🗑️ KnowledgeManagementModule: Destroyed');
    }
}