/**
 * CONTEXT ENGINEERING MODULE
 * 
 * Main Purpose: Manage AI context engineering settings for RAG optimization
 * 
 * Key Responsibilities:
 * - RAG parameter configuration (top-k, similarity threshold, max tokens)
 * - System prompt management
 * - Source attribution settings
 * - Real-time preview updates
 * - Settings validation and persistence
 * 
 * Features:
 * - Slider/input synchronization for numeric parameters
 * - Live preview of current configuration
 * - Form change detection for save button state
 * - Admin-only access control
 * - Real-time updates via WebSocket integration
 */

class ContextEngineeringModule {
    constructor(apiManager, stateManager, connectionManager) {
        this.apiManager = apiManager;
        this.stateManager = stateManager;
        this.connectionManager = connectionManager;
        
        this.elements = {};
        this.currentSettings = {
            rag_k: 100,
            rag_similarity_threshold: 0.7,
            rag_max_tokens: 2000,
            system_prompt: '',
            use_langfuse_prompts: false
        };
        this.langfuseStatus = {
            available: false,
            publicKey: null,
            baseUrl: null,
            enabled: false
        };
        this.originalSettings = {};
        
        console.log('ContextEngineeringModule initialized');
    }

    /**
     * Initialize the module
     */
    async initialize() {
        try {
            this.initializeElements();
            this.attachEventListeners();
            await this.loadSettings();
            this.updatePreview();
            
            console.log('ContextEngineeringModule initialized successfully');
            console.log('Langfuse status:', this.langfuseStatus);
        } catch (error) {
            console.error('Failed to initialize ContextEngineeringModule:', error);
            throw error;
        }
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.elements = {
            // Form elements
            form: document.getElementById('context-engineering-form'),
            saveButton: document.getElementById('save-context-engineering'),
            
            // RAG K elements
            ragKSlider: document.getElementById('rag-k'),
            ragKValue: document.getElementById('rag-k-value'),
            
            // Similarity threshold elements
            similaritySlider: document.getElementById('rag-similarity-threshold'),
            similarityValue: document.getElementById('rag-similarity-threshold-value'),
            
            // Max tokens elements
            maxTokensSlider: document.getElementById('rag-max-tokens'),
            maxTokensValue: document.getElementById('rag-max-tokens-value'),
            
            // Other elements
            systemPromptTextarea: document.getElementById('system-prompt'),
            
            // Langfuse elements
            langfuseToggleSection: document.getElementById('langfuse-toggle-section'),
            langfuseToggle: document.getElementById('use-langfuse-prompts'),
            langfusePublicKey: document.getElementById('langfuse-public-key'),
            
            // Langfuse Prompt Management elements
            langfusePromptsSection: document.getElementById('langfuse-prompts-section'),
            refreshPrompts: document.getElementById('refresh-prompts'),
            createNewPrompt: document.getElementById('create-new-prompt'),
            langfuseConnectionStatus: document.getElementById('langfuse-connection-status'),
            langfuseConnectionKey: document.getElementById('langfuse-connection-key'),
            promptCount: document.getElementById('prompt-count'),
            promptsLoading: document.getElementById('prompts-loading'),
            promptsTableContainer: document.getElementById('prompts-table-container'),
            promptsTableBody: document.getElementById('prompts-table-body'),
            noPromptsMessage: document.getElementById('no-prompts-message'),
            initializeDefaultPrompts: document.getElementById('initialize-default-prompts'),
            
            // Modal elements
            promptViewModal: document.getElementById('prompt-view-modal'),
            promptEditModal: document.getElementById('prompt-edit-modal'),
            promptTestModal: document.getElementById('prompt-test-modal'),
            
            // Preview elements
            previewRagK: document.getElementById('preview-rag-k'),
            previewSimilarity: document.getElementById('preview-similarity'),
            previewMaxTokens: document.getElementById('preview-max-tokens')
        };

        // Validate all elements exist
        for (const [key, element] of Object.entries(this.elements)) {
            if (!element) {
                console.warn(`Element not found: ${key}`);
            }
        }
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Form submission
        if (this.elements.form) {
            this.elements.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveSettings();
            });
        }

        // Slider/input synchronization for RAG K
        if (this.elements.ragKSlider && this.elements.ragKValue) {
            this.elements.ragKSlider.addEventListener('input', (e) => {
                this.elements.ragKValue.value = e.target.value;
                this.updateSettingsFromForm();
                this.updatePreview();
            });
            
            this.elements.ragKValue.addEventListener('input', (e) => {
                const value = Math.max(1, Math.min(200, parseInt(e.target.value) || 1));
                this.elements.ragKSlider.value = value;
                this.elements.ragKValue.value = value;
                this.updateSettingsFromForm();
                this.updatePreview();
            });
        }

        // Slider/input synchronization for similarity threshold
        if (this.elements.similaritySlider && this.elements.similarityValue) {
            this.elements.similaritySlider.addEventListener('input', (e) => {
                this.elements.similarityValue.value = parseFloat(e.target.value).toFixed(1);
                this.updateSettingsFromForm();
                this.updatePreview();
            });
            
            this.elements.similarityValue.addEventListener('input', (e) => {
                const value = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0));
                this.elements.similaritySlider.value = value;
                this.elements.similarityValue.value = value.toFixed(1);
                this.updateSettingsFromForm();
                this.updatePreview();
            });
        }

        // Slider/input synchronization for max tokens
        if (this.elements.maxTokensSlider && this.elements.maxTokensValue) {
            this.elements.maxTokensSlider.addEventListener('input', (e) => {
                this.elements.maxTokensValue.value = e.target.value;
                this.updateSettingsFromForm();
                this.updatePreview();
            });
            
            this.elements.maxTokensValue.addEventListener('input', (e) => {
                const value = Math.max(500, Math.min(4000, parseInt(e.target.value) || 500));
                this.elements.maxTokensSlider.value = value;
                this.elements.maxTokensValue.value = value;
                this.updateSettingsFromForm();
                this.updatePreview();
            });
        }


        // System prompt textarea
        if (this.elements.systemPromptTextarea) {
            this.elements.systemPromptTextarea.addEventListener('input', () => {
                this.updateSettingsFromForm();
            });
        }

        // Langfuse toggle
        if (this.elements.langfuseToggle) {
            this.elements.langfuseToggle.addEventListener('change', () => {
                this.updateSettingsFromForm();
            });
        }

        // Langfuse prompt management event listeners
        if (this.elements.refreshPrompts) {
            this.elements.refreshPrompts.addEventListener('click', () => {
                this.loadPrompts();
            });
        }

        if (this.elements.createNewPrompt) {
            this.elements.createNewPrompt.addEventListener('click', () => {
                this.showCreatePromptModal();
            });
        }

        if (this.elements.initializeDefaultPrompts) {
            this.elements.initializeDefaultPrompts.addEventListener('click', () => {
                this.initializeDefaultPrompts();
            });
        }

        // WebSocket updates
        if (this.connectionManager && this.connectionManager.socket) {
            this.connectionManager.socket.on('settingsUpdated', (data) => {
                if (data.category === 'ai') {
                    this.loadSettings();
                }
            });
        }
    }

    /**
     * Load settings from server
     */
    async loadSettings() {
        try {
            const response = await fetch(`${this.apiManager.apiUrl}/api/config/ai`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('agent_token')}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Transform settings from backend format to current format
                const settings = data.settings;
                this.currentSettings = {
                    rag_k: settings.rag_k?.value || 100,
                    rag_similarity_threshold: settings.rag_similarity_threshold?.value || 0.7,
                    rag_max_tokens: settings.rag_max_tokens?.value || 2000,
                    system_prompt: settings.system_prompt?.value || '',
                    use_langfuse_prompts: settings.use_langfuse_prompts?.value || false
                };
                
                // Update Langfuse status
                this.langfuseStatus = data.langfuse || {
                    available: false,
                    publicKey: null,
                    baseUrl: null,
                    enabled: false
                };
                
                // Store original settings for change detection
                this.originalSettings = { ...this.currentSettings };
                
                // Populate form with loaded settings
                this.populateFormFromSettings();
                this.updateLangfuseUI();
                this.updatePreview();
                this.updateSaveButtonState();
                
                console.log('Context engineering settings loaded:', this.currentSettings);
            } else {
                throw new Error(data.error || 'Failed to load settings');
            }
        } catch (error) {
            console.error('Error loading context engineering settings:', error);
            // Use default values on error
            this.populateFormFromSettings();
            this.updateLangfuseUI(); // Ensure UI update even on error
            this.updatePreview();
        }
    }

    /**
     * Save settings to server
     */
    async saveSettings() {
        try {
            if (this.elements.saveButton) {
                this.elements.saveButton.disabled = true;
                this.elements.saveButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';
            }

            const response = await fetch(`${this.apiManager.apiUrl}/api/config/ai`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('agent_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.currentSettings)
            });
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Update original settings to new saved state
                this.originalSettings = { ...this.currentSettings };
                this.updateSaveButtonState();
                
                // Emit state change event
                this.stateManager.emit('contextEngineeringUpdated', this.currentSettings);
                
                // Show success message
                this.showNotification('Context engineering settings saved successfully!', 'success');
                
                console.log('Context engineering settings saved successfully');
            } else {
                throw new Error(data.error || 'Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving context engineering settings:', error);
            this.showNotification('Failed to save settings: ' + error.message, 'error');
        } finally {
            if (this.elements.saveButton) {
                this.elements.saveButton.disabled = false;
                this.elements.saveButton.innerHTML = '<i class="fas fa-save mr-2"></i>Save Context Settings';
            }
        }
    }

    /**
     * Update current settings from form values
     */
    updateSettingsFromForm() {
        if (this.elements.ragKValue) {
            this.currentSettings.rag_k = parseInt(this.elements.ragKValue.value) || 100;
        }
        
        if (this.elements.similarityValue) {
            this.currentSettings.rag_similarity_threshold = parseFloat(this.elements.similarityValue.value) || 0.7;
        }
        
        if (this.elements.maxTokensValue) {
            this.currentSettings.rag_max_tokens = parseInt(this.elements.maxTokensValue.value) || 2000;
        }
        
        
        if (this.elements.systemPromptTextarea) {
            this.currentSettings.system_prompt = this.elements.systemPromptTextarea.value;
        }
        
        if (this.elements.langfuseToggle) {
            this.currentSettings.use_langfuse_prompts = this.elements.langfuseToggle.checked;
        }
        
        this.updateSaveButtonState();
    }

    /**
     * Populate form from current settings
     */
    populateFormFromSettings() {
        if (this.elements.ragKSlider && this.elements.ragKValue) {
            const ragK = this.currentSettings.rag_k || 100;
            this.elements.ragKSlider.value = ragK;
            this.elements.ragKValue.value = ragK;
        }
        
        if (this.elements.similaritySlider && this.elements.similarityValue) {
            const similarity = this.currentSettings.rag_similarity_threshold || 0.7;
            this.elements.similaritySlider.value = similarity;
            this.elements.similarityValue.value = similarity.toFixed(1);
        }
        
        if (this.elements.maxTokensSlider && this.elements.maxTokensValue) {
            const maxTokens = this.currentSettings.rag_max_tokens || 2000;
            this.elements.maxTokensSlider.value = maxTokens;
            this.elements.maxTokensValue.value = maxTokens;
        }
        
        
        if (this.elements.systemPromptTextarea) {
            this.elements.systemPromptTextarea.value = this.currentSettings.system_prompt || '';
        }
        
        if (this.elements.langfuseToggle) {
            this.elements.langfuseToggle.checked = this.currentSettings.use_langfuse_prompts || false;
        }
    }

    /**
     * Update Langfuse UI based on availability
     */
    updateLangfuseUI() {
        console.log('updateLangfuseUI called with status:', this.langfuseStatus);
        console.log('langfuseToggleSection element:', this.elements.langfuseToggleSection);
        
        if (this.elements.langfuseToggleSection) {
            if (this.langfuseStatus.available) {
                console.log('Langfuse available - showing toggle section');
                // Show the Langfuse toggle section
                this.elements.langfuseToggleSection.classList.remove('hidden');
                
                // Update the public key display
                if (this.elements.langfusePublicKey && this.langfuseStatus.publicKey) {
                    this.elements.langfusePublicKey.textContent = this.langfuseStatus.publicKey;
                }
                
                // Show the prompt management section
                if (this.elements.langfusePromptsSection) {
                    this.elements.langfusePromptsSection.classList.remove('hidden');
                }
                
                // Update connection status in prompt management section
                if (this.elements.langfuseConnectionStatus) {
                    this.elements.langfuseConnectionStatus.textContent = '✓ Connected';
                    this.elements.langfuseConnectionStatus.className = 'text-green-600 text-sm';
                }
                
                if (this.elements.langfuseConnectionKey && this.langfuseStatus.publicKey) {
                    this.elements.langfuseConnectionKey.textContent = this.langfuseStatus.publicKey;
                }
                
                // Load prompts
                this.loadPrompts();
                
            } else {
                console.log('Langfuse not available - hiding toggle section');
                // Hide the Langfuse toggle section
                this.elements.langfuseToggleSection.classList.add('hidden');
                
                // Hide the prompt management section
                if (this.elements.langfusePromptsSection) {
                    this.elements.langfusePromptsSection.classList.add('hidden');
                }
            }
        } else {
            console.warn('langfuseToggleSection element not found');
        }
    }

    /**
     * Update live preview display
     */
    updatePreview() {
        if (this.elements.previewRagK) {
            this.elements.previewRagK.textContent = this.currentSettings.rag_k || 100;
        }
        
        if (this.elements.previewSimilarity) {
            this.elements.previewSimilarity.textContent = (this.currentSettings.rag_similarity_threshold || 0.7).toFixed(1);
        }
        
        if (this.elements.previewMaxTokens) {
            this.elements.previewMaxTokens.textContent = this.currentSettings.rag_max_tokens || 2000;
        }
        
    }

    /**
     * Update save button state based on changes
     */
    updateSaveButtonState() {
        if (!this.elements.saveButton) return;
        
        const hasChanges = this.hasUnsavedChanges();
        this.elements.saveButton.disabled = !hasChanges;
    }

    /**
     * Check if there are unsaved changes
     */
    hasUnsavedChanges() {
        return JSON.stringify(this.currentSettings) !== JSON.stringify(this.originalSettings);
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // Create notification element if it doesn't exist
        let notification = document.getElementById('context-engineering-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'context-engineering-notification';
            notification.className = 'fixed top-4 right-4 z-50 max-w-md';
            document.body.appendChild(notification);
        }
        
        const colorClass = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
        
        notification.innerHTML = `
            <div class="${colorClass} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification) {
                notification.remove();
            }
        }, 3000);
    }

    /**
     * Get current settings
     */
    getCurrentSettings() {
        return { ...this.currentSettings };
    }

    // =========================
    // LANGFUSE PROMPT MANAGEMENT METHODS
    // =========================

    /**
     * Load prompts from Langfuse
     */
    async loadPrompts() {
        if (!this.langfuseStatus.available) return;

        try {
            this.showLoadingState();

            const response = await fetch(`${this.apiManager.apiUrl}/api/prompts/list`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('agent_token')}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();

            if (response.ok && data.success) {
                this.renderPromptsTable(data.prompts);
                this.updatePromptCount(data.prompts.length);
            } else {
                throw new Error(data.error || 'Failed to load prompts');
            }
        } catch (error) {
            console.error('Error loading prompts:', error);
            this.showNoPromptsState();
            this.showNotification('Failed to load prompts: ' + error.message, 'error');
        }
    }

    /**
     * Render prompts table
     */
    renderPromptsTable(prompts) {
        if (prompts.length === 0) {
            this.showNoPromptsState();
            return;
        }

        this.hideLoadingState();
        this.elements.promptsTableContainer.classList.remove('hidden');
        this.elements.noPromptsMessage.classList.add('hidden');

        const tbody = this.elements.promptsTableBody;
        tbody.innerHTML = '';

        prompts.forEach(prompt => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${prompt.name}</td>
                <td class="px-6 py-4 text-sm text-gray-500">${prompt.description || 'No description'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        ${prompt.category}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${prompt.language}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div class="flex justify-end gap-2">
                        <button 
                            class="text-indigo-600 hover:text-indigo-900 text-sm view-prompt-btn" 
                            data-prompt-name="${prompt.name}"
                        >
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button 
                            class="text-purple-600 hover:text-purple-900 text-sm test-prompt-btn" 
                            data-prompt-name="${prompt.name}"
                        >
                            <i class="fas fa-play"></i> Test
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Add event listeners for action buttons
        tbody.querySelectorAll('.view-prompt-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const promptName = e.currentTarget.dataset.promptName;
                this.viewPrompt(promptName);
            });
        });

        tbody.querySelectorAll('.test-prompt-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const promptName = e.currentTarget.dataset.promptName;
                this.testPrompt(promptName);
            });
        });
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        this.elements.promptsLoading.classList.remove('hidden');
        this.elements.promptsTableContainer.classList.add('hidden');
        this.elements.noPromptsMessage.classList.add('hidden');
    }

    /**
     * Hide loading state
     */
    hideLoadingState() {
        this.elements.promptsLoading.classList.add('hidden');
    }

    /**
     * Show no prompts state
     */
    showNoPromptsState() {
        this.hideLoadingState();
        this.elements.promptsTableContainer.classList.add('hidden');
        this.elements.noPromptsMessage.classList.remove('hidden');
    }

    /**
     * Update prompt count display
     */
    updatePromptCount(count) {
        if (this.elements.promptCount) {
            this.elements.promptCount.textContent = count;
        }
    }

    /**
     * View prompt details
     */
    async viewPrompt(promptName) {
        try {
            const response = await fetch(`${this.apiManager.apiUrl}/api/prompts/${promptName}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('agent_token')}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();

            if (response.ok && data.success) {
                this.showPromptViewModal(data.prompt);
            } else {
                throw new Error(data.error || 'Failed to load prompt');
            }
        } catch (error) {
            console.error('Error viewing prompt:', error);
            this.showNotification('Failed to load prompt: ' + error.message, 'error');
        }
    }

    /**
     * Show prompt view modal
     */
    showPromptViewModal(prompt) {
        // Populate modal with prompt data
        document.getElementById('prompt-view-name').textContent = prompt.name;
        document.getElementById('prompt-view-source').textContent = prompt.source || 'Unknown';
        document.getElementById('prompt-view-version').textContent = prompt.version || 'N/A';
        document.getElementById('prompt-view-langfuse').textContent = prompt.fromLangfuse ? 'Yes' : 'No';
        document.getElementById('prompt-view-content').textContent = prompt.content;

        // Extract and display variables
        this.displayPromptVariables(prompt.content);

        // Show modal
        this.elements.promptViewModal.classList.remove('hidden');

        // Add event listeners for modal actions
        this.setupPromptViewModalEvents(prompt);
    }

    /**
     * Display template variables found in prompt
     */
    displayPromptVariables(content) {
        const variableRegex = /\{\{([^}]+)\}\}/g;
        const variables = new Set();
        let match;
        
        while ((match = variableRegex.exec(content)) !== null) {
            variables.add(match[1].trim());
        }

        const container = document.getElementById('prompt-variables-list');
        container.innerHTML = '';

        if (variables.size === 0) {
            container.innerHTML = '<span class="text-gray-500 text-sm">No template variables found</span>';
        } else {
            variables.forEach(variable => {
                const badge = document.createElement('span');
                badge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800';
                badge.textContent = `{{${variable}}}`;
                container.appendChild(badge);
            });
        }
    }

    /**
     * Setup prompt view modal events
     */
    setupPromptViewModalEvents(prompt) {
        // Close modal events
        const closeButtons = [
            document.getElementById('close-prompt-view-modal'),
            document.getElementById('close-prompt-view')
        ];
        
        closeButtons.forEach(btn => {
            if (btn) {
                btn.onclick = () => this.hidePromptViewModal();
            }
        });

        // Copy content button
        const copyBtn = document.getElementById('copy-prompt-content');
        if (copyBtn) {
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(prompt.content).then(() => {
                    this.showNotification('Prompt content copied to clipboard', 'success');
                });
            };
        }

        // Test prompt button
        const testBtn = document.getElementById('test-prompt-btn');
        if (testBtn) {
            testBtn.onclick = () => {
                this.hidePromptViewModal();
                this.testPrompt(prompt.name);
            };
        }

        // Edit prompt button
        const editBtn = document.getElementById('edit-prompt-btn');
        if (editBtn) {
            editBtn.onclick = () => {
                this.hidePromptViewModal();
                this.editPrompt(prompt);
            };
        }
    }

    /**
     * Hide prompt view modal
     */
    hidePromptViewModal() {
        this.elements.promptViewModal.classList.add('hidden');
    }

    /**
     * Test prompt with sample data
     */
    async testPrompt(promptName) {
        try {
            const response = await fetch(`${this.apiManager.apiUrl}/api/prompts/${promptName}/test`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('agent_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    variables: {} // Use default test variables
                })
            });
            const data = await response.json();

            if (response.ok && data.success) {
                this.showPromptTestResults(data.test);
            } else {
                throw new Error(data.error || 'Failed to test prompt');
            }
        } catch (error) {
            console.error('Error testing prompt:', error);
            this.showNotification('Failed to test prompt: ' + error.message, 'error');
        }
    }

    /**
     * Show prompt test results modal
     */
    showPromptTestResults(testData) {
        // Populate test results
        document.getElementById('test-var-context').textContent = testData.variables.context;
        document.getElementById('test-var-question').textContent = testData.variables.question;
        document.getElementById('test-var-history').textContent = testData.variables.formatted_history;
        document.getElementById('test-compiled-content').textContent = testData.compiledContent;

        // Show modal
        this.elements.promptTestModal.classList.remove('hidden');

        // Add close event listeners
        const closeButtons = [
            document.getElementById('close-prompt-test-modal'),
            document.getElementById('close-test-results')
        ];
        
        closeButtons.forEach(btn => {
            if (btn) {
                btn.onclick = () => this.hidePromptTestModal();
            }
        });
    }

    /**
     * Hide prompt test modal
     */
    hidePromptTestModal() {
        this.elements.promptTestModal.classList.add('hidden');
    }

    /**
     * Initialize default prompts in Langfuse
     */
    async initializeDefaultPrompts() {
        try {
            const initBtn = this.elements.initializeDefaultPrompts;
            const originalText = initBtn.innerHTML;
            initBtn.disabled = true;
            initBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Initializing...';

            const response = await fetch(`${this.apiManager.apiUrl}/api/prompts/initialize`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('agent_token')}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();

            if (response.ok && data.success) {
                this.showNotification('Default prompts initialized successfully', 'success');
                this.loadPrompts(); // Reload the prompts list
            } else {
                throw new Error(data.error || 'Failed to initialize prompts');
            }
        } catch (error) {
            console.error('Error initializing prompts:', error);
            this.showNotification('Failed to initialize prompts: ' + error.message, 'error');
        } finally {
            const initBtn = this.elements.initializeDefaultPrompts;
            initBtn.disabled = false;
            initBtn.innerHTML = 'Initialize Default Prompts';
        }
    }

    /**
     * Show create prompt modal (placeholder for future implementation)
     */
    showCreatePromptModal() {
        this.showNotification('Create new prompt feature coming soon!', 'info');
    }

    /**
     * Edit prompt (placeholder for future implementation)
     */
    editPrompt(prompt) {
        this.showNotification('Edit prompt feature coming soon!', 'info');
    }

    /**
     * Cleanup method
     */
    destroy() {
        // Remove event listeners if needed
        // Clean up resources
        console.log('ContextEngineeringModule destroyed');
    }
}

export default ContextEngineeringModule;