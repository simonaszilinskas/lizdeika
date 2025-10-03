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
            clearVectorDbButton: document.getElementById('clear-vector-db'),

            // File upload elements
            fileUploadArea: document.getElementById('file-upload-area'),
            fileInput: document.getElementById('file-input'),
            uploadProgress: document.getElementById('upload-progress'),
            progressBar: document.getElementById('progress-bar'),

            // Document management elements
            documentsList: document.getElementById('documents-list'),
            refreshDocumentsButton: document.getElementById('refresh-documents'),
            clearAllDocumentsButton: document.getElementById('clear-all-documents'),

            // Vector search elements
            vectorSearchInput: document.getElementById('vector-search-input'),
            vectorSearchButton: document.getElementById('vector-search-button'),
            clearVectorSearchButton: document.getElementById('clear-vector-search'),
            vectorSearchResults: document.getElementById('vector-search-results'),

            // Indexed documents elements
            indexedList: document.getElementById('indexed-list'),
            refreshIndexedButton: document.getElementById('refresh-indexed'),

            // Stats elements (enhanced)
            lastUpdated: document.getElementById('last-updated'),
diff --git a/custom-widget/js/settings/modules/KnowledgeManagementModule.js b/custom-widget/js/settings/modules/KnowledgeManagementModule.js
++ b/custom-widget/js/settings/modules/KnowledgeManagementModule.js
@@ -118,7 +118,7 @@ export default class KnowledgeManagementModule {
             apiDocumentationToggles: document.querySelectorAll('[data-toggle]'),
             copyCodeButtons: document.querySelectorAll('.copy-code-btn'),
            apiBaseUrlElements: document.querySelectorAll('[id^="api-base-url-"]'),
             currentSessionStatus: document.getElementById('current-session-status')
@@ -1410,7 +1410,7 @@ export default class KnowledgeManagementModule {
         this.elements.copyCodeButtons.forEach(button => {
             // ...
         });
        this.elements.apiBaseUrlElements.forEach(element => {
             // ...
         });
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

        // File upload controls
        if (this.elements.fileUploadArea) {
            this.elements.fileUploadArea.addEventListener('click', () => this.elements.fileInput?.click());
            this.elements.fileUploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
            this.elements.fileUploadArea.addEventListener('drop', (e) => this.handleDrop(e));
            this.elements.fileUploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        }
        if (this.elements.fileInput) {
            this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // Document management controls
        if (this.elements.refreshDocumentsButton) {
            this.elements.refreshDocumentsButton.addEventListener('click', () => this.refreshDocuments());
        }
        if (this.elements.clearAllDocumentsButton) {
            this.elements.clearAllDocumentsButton.addEventListener('click', () => this.clearAllDocuments());
        }

        // Vector search controls
        if (this.elements.vectorSearchButton) {
            this.elements.vectorSearchButton.addEventListener('click', () => this.performVectorSearch());
        }
        if (this.elements.vectorSearchInput) {
            this.elements.vectorSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performVectorSearch();
                }
            });
        }
        if (this.elements.clearVectorSearchButton) {
            this.elements.clearVectorSearchButton.addEventListener('click', () => this.clearVectorSearch());
        }

        // Indexed documents controls
        if (this.elements.refreshIndexedButton) {
            this.elements.refreshIndexedButton.addEventListener('click', () => this.refreshIndexedDocuments());
        }

        // API Documentation controls
        this.attachApiDocumentationListeners();

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

            // Load documents list
            await this.loadDocuments();

            // Load indexed documents
            await this.loadIndexedDocuments();

            // Initialize API documentation
            await this.initializeApiDocumentation();

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
     * Load documents from the server
     */
    async loadDocuments() {
        try {
            const response = await this.apiManager.get('/api/knowledge/documents');

            if (response.success) {
                this.renderDocuments(response.data);
            } else {
                console.error('❌ Failed to load documents:', response.error);
                if (this.elements.documentsList) {
                    this.elements.documentsList.innerHTML = '<div class="text-center text-gray-500 py-8">Failed to load documents</div>';
                }
            }
        } catch (error) {
            console.error('❌ KnowledgeManagementModule: Failed to load documents:', error);
            if (this.elements.documentsList) {
                this.elements.documentsList.innerHTML = '<div class="text-center text-gray-500 py-8">Error loading documents</div>';
            }
        }
    }

    /**
     * Render documents list
     */
    renderDocuments(documents) {
        if (!this.elements.documentsList) return;

        // Update stats
        if (this.elements.uploadedFiles) {
            this.elements.uploadedFiles.textContent = documents.length;
        }
        if (this.elements.totalDocuments) {
            this.elements.totalDocuments.textContent = documents.length;
        }

        if (documents.length === 0) {
            this.elements.documentsList.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-folder-open text-4xl mb-2"></i>
                    <p>No documents uploaded yet</p>
                </div>
            `;
            return;
        }

        this.elements.documentsList.innerHTML = documents.map(doc => `
            <div class="bg-white rounded-lg border border-gray-200 p-4 mb-3">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <h4 class="font-medium text-gray-900 mb-1">${this.escapeHtml(doc.originalName || doc.name || 'Unnamed Document')}</h4>
                        <div class="text-sm text-gray-500 space-x-4">
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                doc.status === 'processed' ? 'bg-green-100 text-green-800' :
                                doc.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                                doc.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                            }">
                                ${doc.status || 'unknown'}
                            </span>
                            <span>${this.formatBytes(doc.size || 0)}</span>
                            <span>${doc.chunksCount || 0} chunks</span>
                            <span>${doc.uploadTime ? new Date(doc.uploadTime).toLocaleDateString() : 'Unknown date'}</span>
                        </div>
                        ${doc.error ? `<div class="text-xs text-red-600 mt-1">Error: ${this.escapeHtml(doc.error)}</div>` : ''}
                    </div>
                    <div class="flex items-center space-x-2">
                        <button
                            class="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                            onclick="window.settingsManager?.knowledgeManagementModule?.deleteDocument('${doc.id}')"
                        >
                            <i class="fas fa-trash mr-1"></i>Delete
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Update last updated time
        if (this.elements.lastUpdated && documents.length > 0) {
            const latestDoc = documents.reduce((latest, doc) => {
                const docTime = new Date(doc.uploadTime || 0);
                const latestTime = new Date(latest.uploadTime || 0);
                return docTime > latestTime ? doc : latest;
            });
            this.elements.lastUpdated.textContent = latestDoc.uploadTime ?
                new Date(latestDoc.uploadTime).toLocaleString() : 'Never';
        }
    }

    /**
     * Load indexed documents from the vector database
     */
    async loadIndexedDocuments() {
        try {
            const response = await this.apiManager.get('/api/knowledge/indexed?limit=100');

            if (response.success) {
                this.renderIndexedDocuments(response.data);
            } else {
                console.error('❌ Failed to load indexed documents:', response.error);
                if (this.elements.indexedList) {
                    this.elements.indexedList.innerHTML = '<div class="text-center text-gray-500 py-8">Failed to load indexed documents</div>';
                }
            }
        } catch (error) {
            console.error('❌ KnowledgeManagementModule: Failed to load indexed documents:', error);
            if (this.elements.indexedList) {
                this.elements.indexedList.innerHTML = '<div class="text-center text-gray-500 py-8">Error loading indexed documents</div>';
            }
        }
    }

    /**
     * Render indexed documents list
     */
    renderIndexedDocuments(data) {
        if (!this.elements.indexedList) return;

        if (!data.connected) {
            this.elements.indexedList.innerHTML = `
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div class="flex items-center text-yellow-800">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        <div>
                            <strong>Vector database not connected</strong>
                            <p class="text-sm mt-1">${data.note || 'Unable to connect to the vector database.'}</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        const documents = data.documents || [];

        if (documents.length === 0) {
            this.elements.indexedList.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-database text-4xl mb-2"></i>
                    <p>No documents indexed in vector database yet</p>
                </div>
            `;
            return;
        }

        // Add summary info
        const documentsWithSources = documents.filter(doc => doc.metadata && doc.metadata.source_url).length;
        let summaryHtml = `
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 class="font-medium text-blue-900 mb-2">Collection: ${data.collectionName || 'Default'}</h4>
                <p class="text-sm text-blue-700">
                    Available chunks: <strong>${documents.length}</strong> •
                    With source URLs: <strong>${documentsWithSources}</strong>
                </p>
            </div>
        `;

        if (documents.length >= 100) {
            summaryHtml += `
                <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <div class="flex items-center text-amber-800">
                        <i class="fas fa-info-circle mr-2"></i>
                        <div class="text-sm">
                            <strong>Showing first 100 of ${data.count || 'many'} documents</strong>
                            <br><span class="text-xs text-amber-700">Vector database limits queries to 100 documents per request</span>
                        </div>
                    </div>
                </div>
            `;
        }

        const documentsHtml = documents.map((doc, index) => {
            const contentPreview = doc.content && doc.content.length > 150
                ? doc.content.substring(0, 150) + '...'
                : doc.content || 'No content available';

            const metadata = doc.metadata || {};
            const title = metadata.source_document_name || `Document ${index + 1}`;
            const sourceUrl = metadata.source_url;
            const uploadTime = metadata.upload_time ? new Date(metadata.upload_time).toLocaleDateString() : '';
            const uploadSource = metadata.upload_source || 'unknown';

            const sourceLink = sourceUrl
                ? `<a href="${sourceUrl.startsWith('http') ? sourceUrl : 'https://' + sourceUrl}" target="_blank" class="text-blue-600 hover:text-blue-800 ml-2" title="Open source in new tab">
                     <i class="fas fa-external-link-alt text-xs"></i>
                   </a>`
                : '';

            return `
                <div class="bg-white rounded-lg border border-gray-200 p-4 mb-3">
                    <div class="cursor-pointer" onclick="window.settingsManager?.knowledgeManagementModule?.toggleIndexedDocDetails('${doc.id}')">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <h4 class="font-medium text-gray-900 mb-1">${this.escapeHtml(title)}${sourceLink}</h4>
                                <p class="text-sm text-gray-600 mb-2">${this.escapeHtml(contentPreview)}</p>
                                ${uploadTime ? `<p class="text-xs text-gray-500">Indexed: ${uploadTime} (${uploadSource})</p>` : ''}
                            </div>
                            <div class="ml-4">
                                <i class="fas fa-chevron-down text-gray-400" id="chevron-${doc.id}"></i>
                            </div>
                        </div>
                    </div>
                    <div class="indexed-doc-details mt-4 pt-4 border-t border-gray-100" id="details-${doc.id}" style="display: none;">
                        <h5 class="font-medium text-gray-900 mb-2">Full Content:</h5>
                        <div class="bg-gray-50 p-3 rounded border text-sm font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
${this.escapeHtml(doc.content || 'No content available')}
                        </div>
                        ${sourceUrl ? `
                            <div class="mt-3">
                                <h5 class="font-medium text-gray-900 mb-1">Source Link:</h5>
                                <a href="${sourceUrl.startsWith('http') ? sourceUrl : 'https://' + sourceUrl}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm">
                                    <i class="fas fa-external-link-alt mr-1"></i>
                                    ${this.escapeHtml(sourceUrl)}
                                </a>
                            </div>
                        ` : ''}
                        <div class="mt-3">
                            <h5 class="font-medium text-gray-900 mb-1">Metadata:</h5>
                            <div class="text-sm text-gray-600">
                                Upload source: <strong>${uploadSource}</strong> •
                                Chunk ${metadata.chunk_index || 0} •
                                ${metadata.language || 'unknown'} language •
                                ${doc.content ? doc.content.length + ' characters' : 'No content'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.elements.indexedList.innerHTML = summaryHtml + documentsHtml;
    }

    /**
     * Toggle indexed document details
     */
    toggleIndexedDocDetails(docId) {
        const detailsDiv = document.getElementById(`details-${docId}`);
        const chevron = document.getElementById(`chevron-${docId}`);

        if (detailsDiv && chevron) {
            if (detailsDiv.style.display === 'none') {
                detailsDiv.style.display = 'block';
                chevron.className = 'fas fa-chevron-up text-gray-400';
            } else {
                detailsDiv.style.display = 'none';
                chevron.className = 'fas fa-chevron-down text-gray-400';
            }
        }
    }

    /**
     * Handle drag over event
     */
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        if (this.elements.fileUploadArea) {
            this.elements.fileUploadArea.classList.add('border-green-500', 'bg-green-50');
        }
    }

    /**
     * Handle drag leave event
     */
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        if (this.elements.fileUploadArea) {
            this.elements.fileUploadArea.classList.remove('border-green-500', 'bg-green-50');
        }
    }

    /**
     * Handle drop event
     */
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();

        if (this.elements.fileUploadArea) {
            this.elements.fileUploadArea.classList.remove('border-green-500', 'bg-green-50');
        }

        const files = Array.from(e.dataTransfer.files);
        this.uploadFiles(files);
    }

    /**
     * Handle file select event
     */
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.uploadFiles(files);
    }

    /**
     * Upload multiple files
     */
    async uploadFiles(files) {
        if (!files || files.length === 0) return;

        // Validate files
        const validFiles = files.filter(file => {
            const validTypes = ['.txt', '.docx', '.pdf'];
            const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
            const isValidType = validTypes.includes(fileExtension);
            const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB

            if (!isValidType) {
                this.showMessage(`Invalid file type: ${file.name}. Only .txt, .docx, and .pdf files are allowed.`, 'error');
                return false;
            }
            if (!isValidSize) {
                this.showMessage(`File too large: ${file.name}. Maximum size is 50MB.`, 'error');
                return false;
            }
            return true;
        });

        if (validFiles.length === 0) return;

        // Show upload progress
        this.showUploadProgress(true);

        try {
            for (let i = 0; i < validFiles.length; i++) {
                const file = validFiles[i];
                await this.uploadFile(file);

                // Update progress
                const progress = ((i + 1) / validFiles.length) * 100;
                this.updateUploadProgress(progress);
            }

            this.showMessage(`Successfully uploaded ${validFiles.length} file(s)`, 'success');

            // Refresh the documents and stats
            await this.loadDocuments();
            await this.loadIndexedDocuments();
            await this.refreshVectorStats();

        } catch (error) {
            console.error('❌ Upload process failed:', error);
            this.showMessage('Upload process failed', 'error');
        } finally {
            // Hide upload progress
            setTimeout(() => this.showUploadProgress(false), 1000);

            // Clear file input
            if (this.elements.fileInput) {
                this.elements.fileInput.value = '';
            }
        }
    }

    /**
     * Upload a single file
     */
    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            // Get auth headers but remove Content-Type to let browser set it for FormData
            const headers = this.getAuthHeaders();
            delete headers['Content-Type'];

            const result = await fetch('/api/knowledge/documents/upload', {
                method: 'POST',
                headers,
                body: formData
            });

            if (!result.ok) {
                const error = await result.text();
                throw new Error(error || 'Upload failed');
            }

            const data = await result.json();
            if (!data.success) {
                throw new Error(data.message || data.error || 'Upload failed');
            }

            console.log('✅ File uploaded successfully:', file.name);
            return data;

        } catch (error) {
            console.error('❌ Failed to upload file:', file.name, error);
            this.showMessage(`Failed to upload ${file.name}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Show/hide upload progress
     */
    showUploadProgress(show) {
        if (this.elements.uploadProgress) {
            this.elements.uploadProgress.style.display = show ? 'block' : 'none';
        }
        if (!show && this.elements.progressBar) {
            this.elements.progressBar.style.width = '0%';
        }
    }

    /**
     * Update upload progress
     */
    updateUploadProgress(percent) {
        if (this.elements.progressBar) {
            this.elements.progressBar.style.width = `${percent}%`;
        }
    }

    /**
     * Delete a document
     */
    async deleteDocument(documentId) {
        if (!confirm('Are you sure you want to delete this document?')) {
            return;
        }

        try {
            const response = await this.apiManager.delete(`/api/knowledge/documents/${documentId}`);

            if (response.success) {
                this.showMessage('Document deleted successfully', 'success');
                await this.loadDocuments();
                await this.loadIndexedDocuments();
                await this.refreshVectorStats();
            } else {
                throw new Error(response.error || 'Failed to delete document');
            }
        } catch (error) {
            console.error('❌ Failed to delete document:', error);
            this.showMessage(`Failed to delete document: ${error.message}`, 'error');
        }
    }

    /**
     * Refresh documents list
     */
    async refreshDocuments() {
        if (this.elements.refreshDocumentsButton) {
            const button = this.elements.refreshDocumentsButton;
            const originalContent = button.innerHTML;
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Refreshing...';

            try {
                await this.loadDocuments();
            } finally {
                button.disabled = false;
                button.innerHTML = originalContent;
            }
        } else {
            await this.loadDocuments();
        }
    }

    /**
     * Clear all documents
     */
    async clearAllDocuments() {
        if (!confirm('Are you sure you want to delete ALL documents? This action cannot be undone.')) {
            return;
        }

        try {
            if (this.elements.clearAllDocumentsButton) {
                const button = this.elements.clearAllDocumentsButton;
                const originalContent = button.innerHTML;
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Clearing...';

                const response = await this.apiManager.post('/api/knowledge/documents/clear');

                if (response.success) {
                    this.showMessage('All documents cleared successfully', 'success');
                    await this.loadDocuments();
                    await this.loadIndexedDocuments();
                    await this.refreshVectorStats();
                } else {
                    throw new Error(response.error || 'Failed to clear documents');
                }

                button.disabled = false;
                button.innerHTML = originalContent;
            }
        } catch (error) {
            console.error('❌ Failed to clear documents:', error);
            this.showMessage(`Failed to clear documents: ${error.message}`, 'error');

            if (this.elements.clearAllDocumentsButton) {
                this.elements.clearAllDocumentsButton.disabled = false;
                this.elements.clearAllDocumentsButton.innerHTML = '<i class="fas fa-trash mr-2"></i>Clear All';
            }
        }
    }

    /**
     * Refresh indexed documents
     */
    async refreshIndexedDocuments() {
        if (this.elements.refreshIndexedButton) {
            const button = this.elements.refreshIndexedButton;
            const originalContent = button.innerHTML;
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Refreshing...';

            try {
                await this.loadIndexedDocuments();
            } finally {
                button.disabled = false;
                button.innerHTML = originalContent;
            }
        } else {
            await this.loadIndexedDocuments();
        }
    }

    /**
     * Perform vector search
     */
    async performVectorSearch() {
        const query = this.elements.vectorSearchInput?.value.trim();

        if (!query) {
            this.showMessage('Please enter a search query', 'warning');
            return;
        }

        if (this.elements.vectorSearchButton) {
            const button = this.elements.vectorSearchButton;
            const originalContent = button.innerHTML;
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Searching...';

            try {
                const response = await this.apiManager.get(`/api/knowledge/documents/search?query=${encodeURIComponent(query)}`);

                if (response.success) {
                    this.displayVectorSearchResults(response.data, query);
                    if (this.elements.clearVectorSearchButton) {
                        this.elements.clearVectorSearchButton.style.display = 'block';
                    }
                } else {
                    throw new Error(response.error || 'Search failed');
                }
            } catch (error) {
                console.error('❌ Vector search failed:', error);
                this.showMessage(`Search failed: ${error.message}`, 'error');
            } finally {
                button.disabled = false;
                button.innerHTML = originalContent;
            }
        }
    }

    /**
     * Display vector search results
     */
    displayVectorSearchResults(results, query) {
        if (!this.elements.vectorSearchResults) return;

        if (!results || results.length === 0) {
            this.elements.vectorSearchResults.innerHTML = `
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div class="flex items-center text-yellow-800">
                        <i class="fas fa-info-circle mr-2"></i>
                        <div>
                            <strong>No results found</strong>
                            <p class="text-sm mt-1">No documents match your search query: "${this.escapeHtml(query)}"</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            const resultsHtml = `
                <div class="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                    <div class="flex items-center text-green-800">
                        <i class="fas fa-check-circle mr-2"></i>
                        <div>
                            <strong>Found ${results.length} result${results.length > 1 ? 's' : ''}</strong>
                            <span class="text-sm text-green-700 ml-2">for "${this.escapeHtml(query)}"</span>
                        </div>
                    </div>
                </div>
                ${results.map((doc, index) => {
                    const contentPreview = doc.content && doc.content.length > 200
                        ? doc.content.substring(0, 200) + '...'
                        : doc.content || 'No content available';

                    const metadata = doc.metadata || {};
                    const title = metadata.source_document_name || `Search Result ${index + 1}`;
                    const sourceUrl = metadata.source_url;

                    const sourceLink = sourceUrl
                        ? `<a href="${sourceUrl.startsWith('http') ? sourceUrl : 'https://' + sourceUrl}" target="_blank" class="text-green-600 hover:text-green-800 ml-2" title="Open source in new tab">
                             <i class="fas fa-external-link-alt text-xs"></i>
                           </a>`
                        : '';

                    return `
                        <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-3">
                            <div class="cursor-pointer" onclick="window.settingsManager?.knowledgeManagementModule?.toggleSearchResultDetails('search-${index}')">
                                <div class="flex items-center justify-between">
                                    <div class="flex-1">
                                        <h4 class="font-medium text-green-800 mb-1">${this.escapeHtml(title)}${sourceLink}</h4>
                                        <p class="text-sm text-green-700">${this.escapeHtml(contentPreview)}</p>
                                    </div>
                                    <div class="ml-4">
                                        <i class="fas fa-chevron-down text-green-600" id="chevron-search-${index}"></i>
                                    </div>
                                </div>
                            </div>
                            <div class="search-result-details mt-4 pt-4 border-t border-green-200" id="details-search-${index}" style="display: none;">
                                <h5 class="font-medium text-green-800 mb-2">Full Content:</h5>
                                <div class="bg-white p-3 rounded border border-green-200 text-sm font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
${this.escapeHtml(doc.content || 'No content available')}
                                </div>
                                ${sourceUrl ? `
                                    <div class="mt-3">
                                        <h5 class="font-medium text-green-800 mb-1">Source Link:</h5>
                                        <a href="${sourceUrl.startsWith('http') ? sourceUrl : 'https://' + sourceUrl}" target="_blank" class="text-green-600 hover:text-green-800 text-sm">
                                            <i class="fas fa-external-link-alt mr-1"></i>
                                            ${this.escapeHtml(sourceUrl)}
                                        </a>
                                    </div>
                                ` : ''}
                                <div class="mt-3">
                                    <h5 class="font-medium text-green-800 mb-1">Metadata:</h5>
                                    <div class="text-sm text-green-700">
                                        ${metadata.upload_source || 'unknown'} upload •
                                        ${metadata.language || 'unknown'} language •
                                        ${doc.content ? doc.content.length + ' characters' : 'No content'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            `;
            this.elements.vectorSearchResults.innerHTML = resultsHtml;
        }

        this.elements.vectorSearchResults.style.display = 'block';
        if (this.elements.indexedList) {
            this.elements.indexedList.style.display = 'none';
        }
    }

    /**
     * Toggle search result details
     */
    toggleSearchResultDetails(resultId) {
        const detailsDiv = document.getElementById(`details-${resultId}`);
        const chevron = document.getElementById(`chevron-${resultId}`);

        if (detailsDiv && chevron) {
            if (detailsDiv.style.display === 'none') {
                detailsDiv.style.display = 'block';
                chevron.className = 'fas fa-chevron-up text-green-600';
            } else {
                detailsDiv.style.display = 'none';
                chevron.className = 'fas fa-chevron-down text-green-600';
            }
        }
    }

    /**
     * Clear vector search
     */
    clearVectorSearch() {
        if (this.elements.vectorSearchInput) {
            this.elements.vectorSearchInput.value = '';
        }
        if (this.elements.vectorSearchResults) {
            this.elements.vectorSearchResults.style.display = 'none';
            this.elements.vectorSearchResults.innerHTML = '';
        }
        if (this.elements.clearVectorSearchButton) {
            this.elements.clearVectorSearchButton.style.display = 'none';
        }
        if (this.elements.indexedList) {
            this.elements.indexedList.style.display = 'block';
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format bytes to human readable format
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // =========================================================================
    // API DOCUMENTATION METHODS
    // =========================================================================

    /**
     * Attach event listeners for API documentation functionality
     */
    attachApiDocumentationListeners() {
        console.log('📚 KnowledgeManagementModule: Initializing API documentation listeners');

        // Toggle collapsible sections
        this.elements.apiDocumentationToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleApiSection(toggle);
            });
        });

        // Copy code buttons
        this.elements.copyCodeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const copyType = button.getAttribute('data-copy');
                this.copyToClipboard(copyType, button);
            });
        });

        // Initialize API base URLs
        this.updateApiBaseUrls();

        // Check current session status
        this.updateSessionStatus();

        console.log('📚 KnowledgeManagementModule: API documentation listeners attached');
    }

    /**
     * Toggle API documentation section visibility
     */
    toggleApiSection(toggle) {
        const sectionName = toggle.getAttribute('data-toggle');
        const section = document.getElementById(sectionName);
        const chevron = document.getElementById(sectionName.replace('-section', '-chevron'));

        if (section) {
            const isHidden = section.classList.contains('hidden');

            if (isHidden) {
                section.classList.remove('hidden');
                if (chevron) {
                    chevron.classList.add('rotate-180');
                }
            } else {
                section.classList.add('hidden');
                if (chevron) {
                    chevron.classList.remove('rotate-180');
                }
            }
        }
    }

    /**
     * Copy code examples to clipboard
     */
    async copyToClipboard(copyType, button) {
        try {
            let textToCopy = '';

            // Get the text content from the corresponding code element
            const codeElement = document.getElementById(`${copyType}-code`);
            if (codeElement) {
                textToCopy = codeElement.textContent;
            }

            if (textToCopy) {
                await navigator.clipboard.writeText(textToCopy);

                // Provide visual feedback
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check mr-1"></i>Copied!';
                button.classList.remove('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
                button.classList.add('bg-green-100', 'text-green-700');

                // Restore original state after 2 seconds
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.classList.remove('bg-green-100', 'text-green-700');
                    button.classList.add('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
                }, 2000);

                console.log('📋 KnowledgeManagementModule: Code copied to clipboard:', copyType);
            }
        } catch (error) {
            console.error('❌ KnowledgeManagementModule: Failed to copy to clipboard:', error);

            // Show fallback message
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-exclamation-triangle mr-1"></i>Copy failed';
            button.classList.remove('bg-gray-100', 'text-gray-700');
            button.classList.add('bg-red-100', 'text-red-700');

            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('bg-red-100', 'text-red-700');
                button.classList.add('bg-gray-100', 'text-gray-700');
            }, 2000);
        }
    }

    /**
     * Update API base URLs dynamically
     */
    updateApiBaseUrls() {
        const baseUrl = window.location.origin;

        this.elements.apiBaseBurlElements.forEach(element => {
            element.textContent = baseUrl;
        });

        console.log(`📚 KnowledgeManagementModule: Updated API base URLs to: ${baseUrl}`);
    }

    /**
     * Check and update current session status
     */
    async updateSessionStatus() {
        const statusElement = this.elements.currentSessionStatus;
        if (!statusElement) return;

        try {
            const token = localStorage.getItem('agent_token');

            if (!token) {
                statusElement.textContent = 'No active session';
                statusElement.className = 'font-medium text-red-600';
                return;
            }

            // Test token validity with a simple API call
            const response = await fetch('/api/settings/ai_providers', {
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                statusElement.textContent = 'Active session (token valid)';
                statusElement.className = 'font-medium text-green-600';
            } else {
                statusElement.textContent = 'Session expired';
                statusElement.className = 'font-medium text-red-600';
            }
        } catch (error) {
            console.error('❌ KnowledgeManagementModule: Failed to check session status:', error);
            statusElement.textContent = 'Session check failed';
            statusElement.className = 'font-medium text-red-600';
        }
    }

    /**
     * Initialize API documentation when knowledge management tab is opened
     */
    async initializeApiDocumentation() {
        try {
            console.log('📚 KnowledgeManagementModule: Initializing API documentation');

            // Update base URLs in case they changed
            this.updateApiBaseUrls();

            // Check current session
            await this.updateSessionStatus();

            console.log('✅ KnowledgeManagementModule: API documentation initialized');
        } catch (error) {
            console.error('❌ KnowledgeManagementModule: Failed to initialize API documentation:', error);
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