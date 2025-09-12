/**
 * CONTEXT ENGINEERING MODULE
 * 
 * Simplified Context Engineering and Prompt Management System
 * 
 * Features:
 * - RAG (Retrieval-Augmented Generation) configuration
 * - Toggle-based prompt management (Langfuse vs Local)
 * - Langfuse integration with prompt assignment
 * - Local prompt editing interface
 * 
 * Architecture:
 * - Master toggle between Langfuse and Local prompt modes
 * - Simplified prompt assignment for Langfuse mode
 * - Direct editing interface for Local mode
 * - Real-time Langfuse status detection
 * 
 * @version 3.0.0 - Simplified Toggle-Based Management
 */
export class ContextEngineeringModule {
    constructor(apiManager, stateManager) {
        this.apiManager = apiManager;
        this.stateManager = stateManager;
        
        // Module state
        this.ragSettings = {};
        this.promptMode = 'local'; // 'langfuse' or 'local'
        this.currentSettings = {};
        this.langfuseStatus = {
            available: false,
            connected: false,
            endpoint: null
        };
        this.availablePrompts = [];
        
        this.initializeEventListeners();
    }

    /**
     * Initialize all event listeners for the simplified interface
     */
    initializeEventListeners() {
        // RAG Settings Event Listeners
        this.initializeRAGListeners();
        
        // Toggle and Prompt Management Event Listeners
        this.initializeToggleListeners();
        
        // Save Button Event Listeners
        this.initializeSaveListeners();
    }

    /**
     * Initialize RAG configuration event listeners
     */
    initializeRAGListeners() {
        // Range slider synchronization
        const ragKSlider = document.getElementById('rag-k');
        const ragKValue = document.getElementById('rag-k-value');
        const similaritySlider = document.getElementById('similarity-threshold');
        const similarityValue = document.getElementById('similarity-threshold-value');
        const tokensSlider = document.getElementById('max-tokens');
        const tokensValue = document.getElementById('max-tokens-value');

        // Sync sliders with number inputs
        if (ragKSlider && ragKValue) {
            ragKSlider.addEventListener('input', (e) => {
                ragKValue.value = e.target.value;
            });
            ragKValue.addEventListener('input', (e) => {
                ragKSlider.value = e.target.value;
            });
        }

        if (similaritySlider && similarityValue) {
            similaritySlider.addEventListener('input', (e) => {
                similarityValue.value = e.target.value;
            });
            similarityValue.addEventListener('input', (e) => {
                similaritySlider.value = e.target.value;
            });
        }

        if (tokensSlider && tokensValue) {
            tokensSlider.addEventListener('input', (e) => {
                tokensValue.value = e.target.value;
            });
            tokensValue.addEventListener('input', (e) => {
                tokensSlider.value = e.target.value;
            });
        }

        // RAG Settings form submission
        const ragForm = document.getElementById('context-engineering-form');
        const saveRAGBtn = document.getElementById('save-rag-settings');
        
        if (ragForm) {
            ragForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveRAGSettings();
            });
        }
        
        if (saveRAGBtn) {
            saveRAGBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.saveRAGSettings();
            });
        }
    }

    /**
     * Initialize toggle and prompt management event listeners
     */
    initializeToggleListeners() {
        // Master toggle between Langfuse and Local modes
        const langfuseRadio = document.getElementById('mode-langfuse');
        const localRadio = document.getElementById('mode-local');
        
        if (langfuseRadio) {
            langfuseRadio.addEventListener('change', () => {
                if (langfuseRadio.checked) {
                    this.switchToMode('langfuse');
                }
            });
        }
        
        if (localRadio) {
            localRadio.addEventListener('change', () => {
                if (localRadio.checked) {
                    this.switchToMode('local');
                }
            });
        }
        
        // Langfuse prompt selectors with preview
        ['system', 'processing', 'formatting'].forEach(type => {
            const select = document.getElementById(`${type}-langfuse-prompt`);
            if (select) {
                select.addEventListener('change', () => {
                    this.handleLangfusePromptSelect(type, select.value);
                });
            }
        });
    }

    /**
     * Initialize save button event listeners
     */
    initializeSaveListeners() {
        const saveBtn = document.getElementById('save-prompt-config');
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveConfiguration());
        }
    }

    /**
     * Initialize the module (required by SettingsManager)
     */
    async initialize() {
        await this.loadInitialData();
    }

    /**
     * Load initial data for the module
     */
    async loadInitialData() {
        try {
            // Load RAG settings
            await this.loadRAGSettings();
            
            // Check Langfuse status
            await this.checkLangfuseStatus();
            
            // Load current prompt settings
            await this.loadPromptSettings();
            
            // If Langfuse is available, load available prompts
            if (this.langfuseStatus.available) {
                await this.loadAvailablePrompts();
            }
            
            // Initialize UI based on current mode
            this.updateModeUI();
            
            console.log('Context Engineering module initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Context Engineering module:', error);
        }
    }

    /**
     * Load RAG settings from the backend
     */
    async loadRAGSettings() {
        try {
            const rawResponse = await this.apiManager.apiRequest('/api/config/ai');
            const response = await rawResponse.json();
            const aiSettings = response.data.settings;
            
            this.ragSettings = {
                rag_k: aiSettings.rag_k?.value || 100,
                rag_similarity_threshold: aiSettings.rag_similarity_threshold?.value || 0.7,
                rag_max_tokens: aiSettings.rag_max_tokens?.value || 2000
            };
            
            this.updateRAGUI();
            
        } catch (error) {
            console.error('Failed to load RAG settings:', error);
        }
    }

    /**
     * Update RAG UI elements with loaded values
     */
    updateRAGUI() {
        const ragKSlider = document.getElementById('rag-k');
        const ragKValue = document.getElementById('rag-k-value');
        const similaritySlider = document.getElementById('similarity-threshold');
        const similarityValue = document.getElementById('similarity-threshold-value');
        const tokensSlider = document.getElementById('max-tokens');
        const tokensValue = document.getElementById('max-tokens-value');

        if (ragKSlider && ragKValue) {
            ragKSlider.value = this.ragSettings.rag_k;
            ragKValue.value = this.ragSettings.rag_k;
        }

        if (similaritySlider && similarityValue) {
            similaritySlider.value = this.ragSettings.rag_similarity_threshold;
            similarityValue.value = this.ragSettings.rag_similarity_threshold;
        }

        if (tokensSlider && tokensValue) {
            tokensSlider.value = this.ragSettings.rag_max_tokens;
            tokensValue.value = this.ragSettings.rag_max_tokens;
        }
    }

    /**
     * Save RAG settings to the backend
     */
    async saveRAGSettings() {
        try {
            const statusElement = document.getElementById('rag-save-status');
            const saveButton = document.getElementById('save-rag-settings');
            
            if (statusElement) statusElement.textContent = 'Saving...';
            if (saveButton) saveButton.disabled = true;

            const ragKValue = document.getElementById('rag-k-value').value;
            const similarityValue = document.getElementById('similarity-threshold-value').value;
            const tokensValue = document.getElementById('max-tokens-value').value;

            const settings = {
                rag_k: parseInt(ragKValue),
                rag_similarity_threshold: parseFloat(similarityValue),
                rag_max_tokens: parseInt(tokensValue)
            };

            const rawResponse = await this.apiManager.apiRequest('/api/config/ai', {
                method: 'PUT',
                body: JSON.stringify(settings)
            });

            const response = await rawResponse.json();

            if (response.success) {
                this.ragSettings = settings;
                if (statusElement) {
                    statusElement.textContent = '✓ RAG settings saved successfully';
                    statusElement.className = 'text-sm text-green-600';
                }
                setTimeout(() => {
                    if (statusElement) {
                        statusElement.textContent = '';
                        statusElement.className = 'text-sm text-gray-500';
                    }
                }, 3000);
            } else {
                throw new Error('Failed to save RAG settings');
            }

        } catch (error) {
            console.error('Error saving RAG settings:', error);
            const statusElement = document.getElementById('rag-save-status');
            if (statusElement) {
                statusElement.textContent = '✗ Failed to save RAG settings';
                statusElement.className = 'text-sm text-red-600';
            }
        } finally {
            const saveButton = document.getElementById('save-rag-settings');
            if (saveButton) saveButton.disabled = false;
        }
    }

    /**
     * Check Langfuse connection status
     */
    async checkLangfuseStatus() {
        try {
            const response = await fetch(`${this.apiManager.apiUrl}/api/config/ai`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('agent_token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.langfuseStatus = data.langfuse || { available: false };
                this.updateLangfuseStatusUI();
            }

        } catch (error) {
            console.error('Failed to check Langfuse status:', error);
            this.langfuseStatus = { available: false };
        }
    }

    /**
     * Update Langfuse status in the UI
     */
    updateLangfuseStatusUI() {
        const statusBadge = document.getElementById('langfuse-status-badge');
        
        if (statusBadge) {
            if (this.langfuseStatus.available) {
                statusBadge.classList.remove('hidden');
                statusBadge.innerHTML = '<i class="fas fa-check-circle mr-1"></i>Langfuse Connected';
                statusBadge.className = 'ml-2 px-2 py-1 text-xs rounded-full bg-green-100 text-green-800';
            } else {
                statusBadge.classList.add('hidden');
            }
        }

        // Show/hide Langfuse selectors based on availability
        ['system', 'processing', 'formatting'].forEach(type => {
            const selector = document.getElementById(`${type}-langfuse-selector`);
            if (selector) {
                if (this.langfuseStatus.available) {
                    selector.classList.remove('hidden');
                } else {
                    selector.classList.add('hidden');
                }
            }
        });
    }

    /**
     * Load current prompt settings from backend
     */
    async loadPromptSettings() {
        try {
            const rawResponse = await this.apiManager.apiRequest('/api/config/prompts');
            const response = await rawResponse.json();
            if (response.success && response.data) {
                const settings = response.data.settings;
                
                // Determine current mode
                this.promptMode = settings.prompt_mode?.value || 'local';
                
                // Load current prompt assignments/content
                this.currentSettings = {
                    active_system_prompt: settings.active_system_prompt?.value || '',
                    active_processing_prompt: settings.active_processing_prompt?.value || '',
                    active_formatting_prompt: settings.active_formatting_prompt?.value || '',
                    custom_system_prompt_content: settings.custom_system_prompt_content?.value || '',
                    custom_processing_prompt_content: settings.custom_processing_prompt_content?.value || '',
                    custom_formatting_prompt_content: settings.custom_formatting_prompt_content?.value || ''
                };
            }
        } catch (error) {
            console.error('Failed to load prompt settings:', error);
        }
    }

    /**
     * Update mode UI based on current prompt mode
     */
    updateModeUI() {
        const langfuseRadio = document.getElementById('mode-langfuse');
        const localRadio = document.getElementById('mode-local');
        const langfuseConfig = document.getElementById('langfuse-config');
        const localConfig = document.getElementById('local-config');
        
        // Set radio button based on current mode
        if (langfuseRadio) langfuseRadio.checked = (this.promptMode === 'langfuse');
        if (localRadio) localRadio.checked = (this.promptMode === 'local');
        
        // Show/hide configuration sections
        if (langfuseConfig) {
            langfuseConfig.classList.toggle('hidden', this.promptMode !== 'langfuse');
        }
        if (localConfig) {
            localConfig.classList.toggle('hidden', this.promptMode !== 'local');
        }
        
        // Populate UI based on mode
        if (this.promptMode === 'langfuse') {
            this.updateLangfuseUI();
        } else {
            this.updateLocalUI();
        }
    }
    
    /**
     * Update Langfuse mode UI
     */
    updateLangfuseUI() {
        ['system', 'processing', 'formatting'].forEach(async (type) => {
            const select = document.getElementById(`${type}-langfuse-prompt`);
            if (select) {
                const activePrompt = this.currentSettings[`active_${type}_prompt`];
                if (activePrompt) {
                    select.value = activePrompt;
                    await this.showPromptPreview(type, activePrompt);
                }
            }
        });
    }
    
    /**
     * Update Local mode UI
     */
    updateLocalUI() {
        ['system', 'processing', 'formatting'].forEach(type => {
            const textarea = document.getElementById(`local-${type}-prompt`);
            if (textarea) {
                textarea.value = this.currentSettings[`custom_${type}_prompt_content`] || '';
            }
        });
    }

    /**
     * Switch between Langfuse and Local modes
     */
    switchToMode(mode) {
        this.promptMode = mode;
        this.updateModeUI();
    }


    /**
     * Handle Langfuse prompt selection with preview
     */
    handleLangfusePromptSelect(type, promptName) {
        if (promptName) {
            this.showPromptPreview(type, promptName);
        } else {
            this.hidePromptPreview(type);
        }
    }
    
    /**
     * Show prompt preview
     */
    async showPromptPreview(type, promptName) {
        const prompt = this.availablePrompts.find(p => p.name === promptName);
        if (!prompt) return;
        
        const previewDiv = document.getElementById(`${type}-prompt-preview`);
        const contentDiv = previewDiv?.querySelector('.text-sm.font-mono.text-gray-700');
        
        if (previewDiv && contentDiv) {
            // Show loading state
            contentDiv.textContent = 'Loading prompt content...';
            previewDiv.classList.remove('hidden');
            
            try {
                // Fetch full prompt content from the backend
                const response = await fetch(`${this.apiManager.apiUrl}/api/prompts/${promptName}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('agent_token')}`
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const content = data.prompt?.content || 'No content available';
                    contentDiv.textContent = content;
                } else {
                    contentDiv.textContent = 'Failed to load prompt content';
                }
            } catch (error) {
                console.error('Failed to fetch prompt content:', error);
                contentDiv.textContent = 'Error loading prompt content';
            }
        }
    }
    
    /**
     * Hide prompt preview
     */
    hidePromptPreview(type) {
        const previewDiv = document.getElementById(`${type}-prompt-preview`);
        if (previewDiv) {
            previewDiv.classList.add('hidden');
        }
    }


    /**
     * Load available Langfuse prompts
     */
    async loadAvailablePrompts() {
        if (!this.langfuseStatus.available) return;

        try {
            const response = await fetch(`${this.apiManager.apiUrl}/api/prompts/list`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('agent_token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.availablePrompts = data.prompts || [];
                this.updatePromptSelectors();
            }

        } catch (error) {
            console.error('Failed to load available prompts:', error);
        }
    }

    /**
     * Update prompt selectors with available prompts
     */
    updatePromptSelectors() {
        ['system', 'processing', 'formatting'].forEach(type => {
            const select = document.getElementById(`${type}-langfuse-prompt`);
            if (!select) return;

            select.innerHTML = `<option value="">Select a Langfuse ${type} prompt...</option>`;
            
            this.availablePrompts.forEach(prompt => {
                const option = document.createElement('option');
                option.value = prompt.name;
                option.textContent = `${prompt.name} (v${prompt.version || 'latest'})`;
                select.appendChild(option);
            });
        });
    }



    /**
     * Save current configuration
     */
    async saveConfiguration() {
        try {
            const statusElement = document.getElementById('prompt-save-status');
            const saveButton = document.getElementById('save-prompt-config');
            
            if (statusElement) statusElement.textContent = 'Saving configuration...';
            if (saveButton) saveButton.disabled = true;

            // Collect settings based on current mode
            const settings = {
                prompt_mode: this.promptMode
            };
            
            if (this.promptMode === 'langfuse') {
                // Save Langfuse prompt assignments (only include if there's a value)
                ['system', 'processing', 'formatting'].forEach(type => {
                    const select = document.getElementById(`${type}-langfuse-prompt`);
                    if (select && select.value) {
                        settings[`active_${type}_prompt`] = select.value;
                    }
                });
            } else {
                // Save local prompt content (only include if there's content)
                ['system', 'processing', 'formatting'].forEach(type => {
                    const textarea = document.getElementById(`local-${type}-prompt`);
                    if (textarea && textarea.value) {
                        settings[`custom_${type}_prompt_content`] = textarea.value;
                    }
                });
            }

            const rawResponse = await this.apiManager.apiRequest('/api/config/prompts', {
                method: 'PUT',
                body: JSON.stringify(settings)
            });

            const response = await rawResponse.json();

            if (response.success) {
                // Update current settings
                Object.assign(this.currentSettings, settings);
                
                if (statusElement) {
                    statusElement.textContent = '✓ Configuration saved successfully';
                    statusElement.className = 'text-sm text-green-600';
                    setTimeout(() => {
                        statusElement.textContent = '';
                        statusElement.className = 'text-sm text-gray-500';
                    }, 3000);
                }
            } else {
                const errorMessage = response.error || response.message || 'Unknown error';
                throw new Error(`Failed to save configuration: ${errorMessage}`);
            }

        } catch (error) {
            console.error('Failed to save configuration:', error);
            const statusElement = document.getElementById('prompt-save-status');
            if (statusElement) {
                let errorMsg = 'Failed to save configuration';
                
                // Add more specific error information
                if (error.message) {
                    errorMsg += `: ${error.message}`;
                }
                
                statusElement.textContent = `✗ ${errorMsg}`;
                statusElement.className = 'text-sm text-red-600';
            }
        } finally {
            const saveButton = document.getElementById('save-prompt-config');
            if (saveButton) saveButton.disabled = false;
        }
    }

    /**
     * Module cleanup
     */
    destroy() {
        // Remove event listeners if needed
        console.log('Context Engineering module destroyed');
    }
}