/**
 * Knowledge Management Module
 *
 * Handles AI provider configuration with separate main and rephrasing models,
 * vector database management, and knowledge base operations.
 *
 * Based on the existing backend implementation with:
 * - Main models: google/gemini-2.5-flash, anthropic/claude-sonnet-4, openai/gpt-5-chat
 * - Rephrasing models: google/gemini-2.5-flash-lite, openai/gpt-5-nano
 * - Full API integration with /api/settings/ai_providers
 */

export class KnowledgeManagementModule {
    constructor(apiManager, stateManager, connectionManager) {
        this.apiManager = apiManager;
        this.stateManager = stateManager;
        this.connectionManager = connectionManager;

        // DOM elements - will be initialized in initialize()
        this.elements = {};

        // Module state
        this.currentProvider = 'openrouter';
        this.formData = {};

        console.log('📚 KnowledgeManagementModule: Initialized');
    }

    /**
     * Get authentication headers for API requests
     */
    getAuthHeaders() {
        const token = localStorage.getItem('agent_token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Initialize the knowledge management module
     */
    async initialize() {
        try {
            console.log('📚 KnowledgeManagementModule: Starting initialization');

            // Initialize DOM elements
            this.initializeElements();

            // Setup event listeners
            this.attachEventListeners();

            console.log('✅ KnowledgeManagementModule: Initialization complete');

        } catch (error) {
            console.error('❌ KnowledgeManagementModule: Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.elements = {
            // Form and provider elements
            providerForm: document.getElementById('ai-provider-form'),
            providerFlowiseRadio: document.getElementById('provider-flowise'),
            providerOpenRouterRadio: document.getElementById('provider-openrouter'),

            // Flowise configuration
            flowiseUrl: document.getElementById('flowise-url'),
            flowiseChatflowId: document.getElementById('flowise-chatflow-id'),
            testFlowiseButton: document.getElementById('test-flowise'),

            // OpenRouter configuration
            openRouterApiKey: document.getElementById('openrouter-api-key'),
            openRouterModel: document.getElementById('openrouter-model'),
            rephrasingModel: document.getElementById('rephrasing-model'),
            siteUrl: document.getElementById('site-url'),
            siteName: document.getElementById('site-name'),
            testOpenRouterButton: document.getElementById('test-openrouter'),

            // Form controls
            resetFormButton: document.getElementById('reset-provider-form'),
            saveConfigButton: document.getElementById('save-provider-config'),

            // Vector database elements
            chromadbStatus: document.getElementById('chromadb-status'),
            totalDocuments: document.getElementById('total-documents'),
            totalEmbeddings: document.getElementById('total-embeddings'),
            refreshVectorStatsButton: document.getElementById('refresh-vector-stats'),
            clearVectorDbButton: document.getElementById('clear-vector-db')
        };

        console.log('📚 KnowledgeManagementModule: DOM elements initialized');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Provider selection
        if (this.elements.providerFlowiseRadio) {
            this.elements.providerFlowiseRadio.addEventListener('change', () => this.onProviderChanged('flowise'));
        }
        if (this.elements.providerOpenRouterRadio) {
            this.elements.providerOpenRouterRadio.addEventListener('change', () => this.onProviderChanged('openrouter'));
        }

        // Test connection buttons
        if (this.elements.testFlowiseButton) {
            this.elements.testFlowiseButton.addEventListener('click', () => this.testFlowiseConnection());
        }
        if (this.elements.testOpenRouterButton) {
            this.elements.testOpenRouterButton.addEventListener('click', () => this.testOpenRouterConnection());
        }

        // Form controls
        if (this.elements.resetFormButton) {
            this.elements.resetFormButton.addEventListener('click', () => this.resetForm());
        }
        if (this.elements.saveConfigButton) {
            this.elements.saveConfigButton.addEventListener('click', () => this.saveConfiguration());
        }
        if (this.elements.providerForm) {
            this.elements.providerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveConfiguration();
            });
        }

        // Vector database controls
        if (this.elements.refreshVectorStatsButton) {
            this.elements.refreshVectorStatsButton.addEventListener('click', () => this.refreshVectorStats());
        }
        if (this.elements.clearVectorDbButton) {
            this.elements.clearVectorDbButton.addEventListener('click', () => this.clearVectorDatabase());
        }

        console.log('📚 KnowledgeManagementModule: Event listeners attached');
    }

    /**
     * Load knowledge settings when tab is opened
     */
    async loadKnowledgeSettings() {
        try {
            console.log('📚 KnowledgeManagementModule: Loading knowledge settings');

            // Load current configuration
            await this.loadProviderConfiguration();

            // Load vector database stats
            await this.refreshVectorStats();

        } catch (error) {
            console.error('❌ KnowledgeManagementModule: Failed to load knowledge settings:', error);
            this.showMessage('Failed to load knowledge settings', 'error');
        }
    }

    /**
     * Load current AI provider configuration
     */
    async loadProviderConfiguration() {
        try {
            console.log('📚 KnowledgeManagementModule: Loading provider configuration');

            const response = await fetch('/api/settings/ai_providers', {
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    this.updateFormFromConfig(result.data);
                } else {
                    console.log('📚 KnowledgeManagementModule: No existing configuration found');
                    this.setDefaultConfiguration();
                }
            } else {
                console.error('❌ Failed to load configuration:', response.statusText);
                this.setDefaultConfiguration();
            }

        } catch (error) {
            console.error('❌ KnowledgeManagementModule: Failed to load provider configuration:', error);
            this.setDefaultConfiguration();
        }
    }

    /**
     * Update form fields from configuration data
     */
    updateFormFromConfig(data) {
        console.log('📚 KnowledgeManagementModule: Updating form from config:', data);

        // Set provider
        const provider = data.ai_provider?.value || 'openrouter';
        this.currentProvider = provider;

        if (provider === 'flowise' && this.elements.providerFlowiseRadio) {
            this.elements.providerFlowiseRadio.checked = true;
        } else if (provider === 'openrouter' && this.elements.providerOpenRouterRadio) {
            this.elements.providerOpenRouterRadio.checked = true;
        }

        // Set Flowise fields
        if (this.elements.flowiseUrl) {
            this.elements.flowiseUrl.value = data.flowise_url?.value || '';
        }
        if (this.elements.flowiseChatflowId) {
            this.elements.flowiseChatflowId.value = data.flowise_chatflow_id?.value || '';
        }

        // Set OpenRouter fields
        if (this.elements.openRouterApiKey && data.openrouter_api_key?.value) {
            this.elements.openRouterApiKey.value = '••••••••'; // Mask the key
        }
        if (this.elements.openRouterModel) {
            this.elements.openRouterModel.value = data.openrouter_model?.value || 'google/gemini-2.5-flash';
        }
        if (this.elements.rephrasingModel) {
            this.elements.rephrasingModel.value = data.rephrasing_model?.value || 'google/gemini-2.5-flash-lite';
        }
        if (this.elements.siteUrl) {
            this.elements.siteUrl.value = data.site_url?.value || '';
        }
        if (this.elements.siteName) {
            this.elements.siteName.value = data.site_name?.value || '';
        }

        this.onProviderChanged(provider);
    }

    /**
     * Set default configuration
     */
    setDefaultConfiguration() {
        this.currentProvider = 'openrouter';
        if (this.elements.providerOpenRouterRadio) {
            this.elements.providerOpenRouterRadio.checked = true;
        }
        if (this.elements.openRouterModel) {
            this.elements.openRouterModel.value = 'google/gemini-2.5-flash';
        }
        if (this.elements.rephrasingModel) {
            this.elements.rephrasingModel.value = 'google/gemini-2.5-flash-lite';
        }
        this.onProviderChanged('openrouter');
    }

    /**
     * Handle provider selection change
     */
    onProviderChanged(provider) {
        this.currentProvider = provider;
        console.log('📚 KnowledgeManagementModule: Provider changed to:', provider);

        // Update visual state (no DOM manipulation needed for radio buttons)
        // They already handle the visual state automatically
    }

    /**
     * Test Flowise connection
     */
    async testFlowiseConnection() {
        const url = this.elements.flowiseUrl?.value;
        const chatflowId = this.elements.flowiseChatflowId?.value;

        if (!url || !chatflowId) {
            this.showMessage('Please enter both Flowise URL and Chatflow ID', 'warning');
            return;
        }

        try {
            this.elements.testFlowiseButton.disabled = true;
            this.elements.testFlowiseButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Testing...';

            const response = await fetch('/api/system/test-ai-provider', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    provider: 'flowise',
                    config: { url, chatflowId }
                })
            });

            if (response.ok) {
                this.showMessage('Flowise connection successful', 'success');
            } else {
                const error = await response.text();
                this.showMessage(`Flowise test failed: ${error}`, 'error');
            }

        } catch (error) {
            console.error('❌ Flowise test failed:', error);
            this.showMessage('Flowise connection failed', 'error');
        } finally {
            this.elements.testFlowiseButton.disabled = false;
            this.elements.testFlowiseButton.innerHTML = '<i class="fas fa-flask mr-2"></i>Test Connection';
        }
    }

    /**
     * Test OpenRouter connection
     */
    async testOpenRouterConnection() {
        const apiKey = this.elements.openRouterApiKey?.value;
        const model = this.elements.openRouterModel?.value;

        if (!apiKey || apiKey === '••••••••') {
            this.showMessage('Please enter OpenRouter API key', 'warning');
            return;
        }

        try {
            this.elements.testOpenRouterButton.disabled = true;
            this.elements.testOpenRouterButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Testing...';

            const response = await fetch('/api/system/test-ai-provider', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    provider: 'openrouter',
                    config: { apiKey, model }
                })
            });

            if (response.ok) {
                this.showMessage('OpenRouter connection successful', 'success');
            } else {
                const error = await response.text();
                this.showMessage(`OpenRouter test failed: ${error}`, 'error');
            }

        } catch (error) {
            console.error('❌ OpenRouter test failed:', error);
            this.showMessage('OpenRouter connection failed', 'error');
        } finally {
            this.elements.testOpenRouterButton.disabled = false;
            this.elements.testOpenRouterButton.innerHTML = '<i class="fas fa-flask mr-2"></i>Test Connection';
        }
    }

    /**
     * Save AI provider configuration
     */
    async saveConfiguration() {
        try {
            this.elements.saveConfigButton.disabled = true;
            this.elements.saveConfigButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';

            // Collect form data
            const config = {
                ai_provider: this.currentProvider,
                // Flowise configuration
                flowise_url: this.elements.flowiseUrl?.value || '',
                flowise_chatflow_id: this.elements.flowiseChatflowId?.value || '',
                // OpenRouter configuration
                openrouter_api_key: this.elements.openRouterApiKey?.value || '',
                openrouter_model: this.elements.openRouterModel?.value || 'google/gemini-2.5-flash',
                rephrasing_model: this.elements.rephrasingModel?.value || 'google/gemini-2.5-flash-lite',
                // Site configuration
                site_url: this.elements.siteUrl?.value || '',
                site_name: this.elements.siteName?.value || ''
            };

            // Don't save masked API key
            if (config.openrouter_api_key === '••••••••') {
                delete config.openrouter_api_key;
            }

            console.log('📚 KnowledgeManagementModule: Saving configuration:', config);

            const response = await fetch('/api/settings/ai_providers', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(config)
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.showMessage('AI provider configuration saved successfully', 'success');
                } else {
                    this.showMessage(`Failed to save: ${result.message}`, 'error');
                }
            } else {
                const error = await response.text();
                this.showMessage(`Failed to save configuration: ${error}`, 'error');
            }

        } catch (error) {
            console.error('❌ Failed to save configuration:', error);
            this.showMessage('Failed to save configuration', 'error');
        } finally {
            this.elements.saveConfigButton.disabled = false;
            this.elements.saveConfigButton.innerHTML = '<i class="fas fa-save mr-2"></i>Save Configuration';
        }
    }

    /**
     * Reset form to default values
     */
    resetForm() {
        this.setDefaultConfiguration();
        this.showMessage('Form reset to defaults', 'info');
    }

    /**
     * Refresh vector database statistics
     */
    async refreshVectorStats() {
        try {
            if (this.elements.refreshVectorStatsButton) {
                this.elements.refreshVectorStatsButton.disabled = true;
                this.elements.refreshVectorStatsButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Loading...';
            }

            const response = await fetch('/api/knowledge/stats', {
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.updateVectorStats(result);
                } else {
                    this.updateVectorStats({ documents: 0, embeddings: 0, status: 'error' });
                }
            } else {
                this.updateVectorStats({ documents: 0, embeddings: 0, status: 'error' });
            }

        } catch (error) {
            console.error('❌ Failed to refresh vector stats:', error);
            this.updateVectorStats({ documents: 0, embeddings: 0, status: 'error' });
        } finally {
            if (this.elements.refreshVectorStatsButton) {
                this.elements.refreshVectorStatsButton.disabled = false;
                this.elements.refreshVectorStatsButton.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Refresh Stats';
            }
        }
    }

    /**
     * Update vector database statistics display
     */
    updateVectorStats(stats) {
        if (this.elements.totalDocuments) {
            this.elements.totalDocuments.textContent = stats.documents || 0;
        }
        if (this.elements.totalEmbeddings) {
            this.elements.totalEmbeddings.textContent = stats.embeddings || 0;
        }
        if (this.elements.chromadbStatus) {
            const status = stats.status || 'disconnected';
            this.elements.chromadbStatus.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            this.elements.chromadbStatus.className = `text-lg font-semibold ${
                status === 'connected' ? 'text-green-600' :
                status === 'error' ? 'text-red-600' : 'text-gray-600'
            }`;
        }
    }

    /**
     * Clear vector database
     */
    async clearVectorDatabase() {
        if (!confirm('Are you sure you want to clear the entire vector database? This action cannot be undone.')) {
            return;
        }

        try {
            this.elements.clearVectorDbButton.disabled = true;
            this.elements.clearVectorDbButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Clearing...';

            const response = await fetch('/api/knowledge/documents/clear', {
                method: 'POST',
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                this.showMessage('Vector database cleared successfully', 'success');
                await this.refreshVectorStats();
            } else {
                const error = await response.text();
                this.showMessage(`Failed to clear database: ${error}`, 'error');
            }

        } catch (error) {
            console.error('❌ Failed to clear vector database:', error);
            this.showMessage('Failed to clear vector database', 'error');
        } finally {
            this.elements.clearVectorDbButton.disabled = false;
            this.elements.clearVectorDbButton.innerHTML = '<i class="fas fa-trash mr-2"></i>Clear Database';
        }
    }

    /**
     * Show message to user
     */
    showMessage(text, type = 'info', title = '') {
        // Use the global toast system
        if (window.settingsManager && window.settingsManager.showMessage) {
            window.settingsManager.showMessage(text, type, title);
        } else {
            console.log(`📚 KnowledgeManagementModule: ${type.toUpperCase()}: ${text}`);
        }
    }

    /**
     * Cleanup method
     */
    destroy() {
        console.log('🧹 KnowledgeManagementModule: Cleanup complete');
    }
}