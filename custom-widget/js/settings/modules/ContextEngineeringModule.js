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
            rag_show_sources: true,
            system_prompt: ''
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
            showSourcesCheckbox: document.getElementById('rag-show-sources'),
            systemPromptTextarea: document.getElementById('system-prompt'),
            
            // Preview elements
            previewRagK: document.getElementById('preview-rag-k'),
            previewSimilarity: document.getElementById('preview-similarity'),
            previewMaxTokens: document.getElementById('preview-max-tokens'),
            previewShowSources: document.getElementById('preview-show-sources')
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

        // Show sources checkbox
        if (this.elements.showSourcesCheckbox) {
            this.elements.showSourcesCheckbox.addEventListener('change', () => {
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
                    rag_show_sources: settings.rag_show_sources?.value !== false,
                    system_prompt: settings.system_prompt?.value || ''
                };
                
                // Store original settings for change detection
                this.originalSettings = { ...this.currentSettings };
                
                // Populate form with loaded settings
                this.populateFormFromSettings();
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
        
        if (this.elements.showSourcesCheckbox) {
            this.currentSettings.rag_show_sources = this.elements.showSourcesCheckbox.checked;
        }
        
        if (this.elements.systemPromptTextarea) {
            this.currentSettings.system_prompt = this.elements.systemPromptTextarea.value;
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
        
        if (this.elements.showSourcesCheckbox) {
            this.elements.showSourcesCheckbox.checked = this.currentSettings.rag_show_sources !== false;
        }
        
        if (this.elements.systemPromptTextarea) {
            this.elements.systemPromptTextarea.value = this.currentSettings.system_prompt || '';
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
        
        if (this.elements.previewShowSources) {
            this.elements.previewShowSources.textContent = this.currentSettings.rag_show_sources ? 'Yes' : 'No';
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