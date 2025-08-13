/**
 * Admin Settings JavaScript
 * Handles the admin interface for configuration and knowledge management
 */

class AdminSettings {
    constructor() {
        this.apiUrl = 'http://localhost:3002';
        this.currentProvider = 'flowise';
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadCurrentConfiguration();
        this.loadKnowledgeStats();
        this.loadDocuments();
    }

    initializeElements() {
        // Tab elements
        this.tabButtons = document.querySelectorAll('.tab-button');
        this.tabContents = document.querySelectorAll('.tab-content');
        
        // Configuration elements
        this.aiProviderSelect = document.getElementById('ai-provider');
        this.systemPromptTextarea = document.getElementById('system-prompt');
        this.saveConfigButton = document.getElementById('save-config');
        this.providerInfo = document.getElementById('provider-info');
        
        // Knowledge base elements
        this.fileUploadArea = document.getElementById('file-upload-area');
        this.fileInput = document.getElementById('file-input');
        this.statsGrid = document.getElementById('stats-grid');
        this.documentsList = document.getElementById('documents-list');
        this.refreshButton = document.getElementById('refresh-documents');
        this.clearAllButton = document.getElementById('clear-all-documents');
    }

    attachEventListeners() {
        // Tab switching
        this.tabButtons.forEach(button => {
            button.addEventListener('click', () => this.switchTab(button.dataset.tab));
        });

        // Configuration
        this.aiProviderSelect.addEventListener('change', () => this.updateProviderInfo());
        this.saveConfigButton.addEventListener('click', () => this.saveConfiguration());

        // File upload
        this.fileUploadArea.addEventListener('click', () => this.fileInput.click());
        this.fileUploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.fileUploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Knowledge management
        this.refreshButton.addEventListener('click', () => this.refreshDocuments());
        this.clearAllButton.addEventListener('click', () => this.clearAllDocuments());
    }

    switchTab(tabName) {
        // Update tab buttons
        this.tabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabName);
        });

        // Update tab content
        this.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });

        // Load data for active tab
        if (tabName === 'knowledge') {
            this.loadKnowledgeStats();
            this.loadDocuments();
        }
    }

    async loadCurrentConfiguration() {
        try {
            // Get current system prompt
            const promptResponse = await fetch(`${this.apiUrl}/api/config/system-prompt`);
            const promptData = await promptResponse.json();
            
            if (promptData.systemPrompt) {
                this.systemPromptTextarea.value = promptData.systemPrompt;
            }

            // Get health info to determine current provider
            const healthResponse = await fetch(`${this.apiUrl}/health`);
            const healthData = await healthResponse.json();
            
            if (healthData.aiProvider && healthData.aiProvider.provider) {
                this.currentProvider = healthData.aiProvider.provider;
                this.aiProviderSelect.value = this.currentProvider;
            }


            this.updateProviderInfo();
        } catch (error) {
            console.error('Failed to load current configuration:', error);
            this.showAlert('Failed to load current configuration', 'error');
        }
    }

    updateProviderInfo() {
        const selectedProvider = this.aiProviderSelect.value;
        const info = this.providerInfo;

        if (selectedProvider === 'flowise') {
            info.innerHTML = `
                <h4>Flowise Provider</h4>
                <p>Uses built-in RAG capabilities. External knowledge base uploads will be stored but not indexed in the vector database.</p>
            `;
        } else {
            info.innerHTML = `
                <h4>OpenRouter Provider</h4>
                <p>Uses external RAG with Chroma DB and Mistral embeddings. Uploaded documents will be processed and indexed for enhanced responses.</p>
            `;
        }

        // Show/hide system prompt based on provider
        const systemPromptSection = this.systemPromptTextarea.closest('.section');
        systemPromptSection.style.display = selectedProvider === 'openrouter' ? 'block' : 'none';
    }

    async saveConfiguration() {
        const button = this.saveConfigButton;
        const originalText = button.textContent;
        
        try {
            button.disabled = true;
            button.innerHTML = '<span class="loading"></span>Saving...';

            const data = {
                aiProvider: this.aiProviderSelect.value
            };

            // Only include system prompt for OpenRouter
            if (this.aiProviderSelect.value === 'openrouter') {
                data.systemPrompt = this.systemPromptTextarea.value;
            }

            const response = await fetch(`${this.apiUrl}/api/config/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                this.showAlert('Configuration saved successfully!', 'success');
                this.currentProvider = this.aiProviderSelect.value;
                this.updateProviderInfo();
                
                // Refresh knowledge stats if provider changed
                setTimeout(() => {
                    this.loadKnowledgeStats();
                }, 1000);
            } else {
                throw new Error(result.error || 'Failed to save configuration');
            }

        } catch (error) {
            console.error('Failed to save configuration:', error);
            this.showAlert(`Failed to save configuration: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    async loadKnowledgeStats() {
        try {
            const response = await fetch(`${this.apiUrl}/api/knowledge/stats`);
            const data = await response.json();

            if (response.ok) {
                this.renderStats(data.data);
            } else {
                throw new Error(data.error || 'Failed to load stats');
            }
        } catch (error) {
            console.error('Failed to load knowledge stats:', error);
            this.statsGrid.innerHTML = '<p>Failed to load statistics</p>';
        }
    }

    renderStats(stats) {
        this.statsGrid.innerHTML = `
            <div class="stat-card">
                <span class="stat-number">${stats.totalDocuments}</span>
                <div class="stat-label">Documents</div>
            </div>
            <div class="stat-card">
                <span class="stat-number">${stats.totalChunks}</span>
                <div class="stat-label">Chunks</div>
            </div>
            <div class="stat-card">
                <span class="stat-number">${this.formatBytes(stats.totalTextLength)}</span>
                <div class="stat-label">Total Text</div>
            </div>
            <div class="stat-card">
                <span class="stat-number">${stats.byStatus.indexed || 0}</span>
                <div class="stat-label">Indexed</div>
            </div>
        `;
    }

    async loadDocuments() {
        try {
            const response = await fetch(`${this.apiUrl}/api/knowledge/documents`);
            const data = await response.json();

            if (response.ok) {
                this.renderDocuments(data.data);
            } else {
                throw new Error(data.error || 'Failed to load documents');
            }
        } catch (error) {
            console.error('Failed to load documents:', error);
            this.documentsList.innerHTML = '<p>Failed to load documents</p>';
        }
    }

    renderDocuments(documents) {
        if (documents.length === 0) {
            this.documentsList.innerHTML = '<p>No documents uploaded yet</p>';
            return;
        }

        this.documentsList.innerHTML = documents.map(doc => `
            <div class="document-item">
                <div class="document-info">
                    <h4>${doc.originalName}</h4>
                    <div class="document-details">
                        <span class="status-badge status-${doc.status}">${doc.status}</span>
                        ${this.formatBytes(doc.size)} • 
                        ${doc.chunksCount} chunks • 
                        ${doc.uploadSource} upload • 
                        ${new Date(doc.uploadTime).toLocaleDateString()}
                        ${doc.error ? `<br><small style="color: #dc3545;">Error: ${doc.error}</small>` : ''}
                    </div>
                </div>
                <div class="document-actions">
                    <button class="button button-danger" onclick="adminSettings.deleteDocument('${doc.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    }

    handleDragOver(e) {
        e.preventDefault();
        this.fileUploadArea.classList.add('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.fileUploadArea.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        this.uploadFiles(files);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.uploadFiles(files);
    }

    async uploadFiles(files) {
        for (const file of files) {
            await this.uploadFile(file);
        }
        
        // Refresh the documents list and stats
        this.loadDocuments();
        this.loadKnowledgeStats();
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source', 'manual');

        try {
            this.showAlert(`Uploading ${file.name}...`, 'info');

            const response = await fetch(`${this.apiUrl}/api/knowledge/documents/upload`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                this.showAlert(`${file.name} uploaded successfully!`, 'success');
            } else {
                throw new Error(result.message || result.error || 'Upload failed');
            }

        } catch (error) {
            console.error('Failed to upload file:', error);
            this.showAlert(`Failed to upload ${file.name}: ${error.message}`, 'error');
        }
    }

    async deleteDocument(documentId) {
        if (!confirm('Are you sure you want to delete this document?')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiUrl}/api/knowledge/documents/${documentId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (response.ok) {
                this.showAlert('Document deleted successfully!', 'success');
                this.loadDocuments();
                this.loadKnowledgeStats();
            } else {
                throw new Error(result.error || 'Failed to delete document');
            }

        } catch (error) {
            console.error('Failed to delete document:', error);
            this.showAlert(`Failed to delete document: ${error.message}`, 'error');
        }
    }

    async refreshDocuments() {
        const button = this.refreshButton;
        const originalText = button.textContent;
        
        try {
            button.disabled = true;
            button.innerHTML = '<span class="loading"></span>Refreshing...';
            
            await this.loadDocuments();
            await this.loadKnowledgeStats();
            
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    async clearAllDocuments() {
        if (!confirm('Are you sure you want to delete ALL documents? This action cannot be undone.')) {
            return;
        }

        const button = this.clearAllButton;
        const originalText = button.textContent;
        
        try {
            button.disabled = true;
            button.innerHTML = '<span class="loading"></span>Clearing...';

            const response = await fetch(`${this.apiUrl}/api/knowledge/documents/clear`, {
                method: 'POST'
            });

            const result = await response.json();

            if (response.ok) {
                this.showAlert('All documents cleared successfully!', 'success');
                this.loadDocuments();
                this.loadKnowledgeStats();
            } else {
                throw new Error(result.error || 'Failed to clear documents');
            }

        } catch (error) {
            console.error('Failed to clear documents:', error);
            this.showAlert(`Failed to clear documents: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    showAlert(message, type = 'info') {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.alert');
        existingAlerts.forEach(alert => alert.remove());

        // Create new alert
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;

        // Insert at the top of the container
        const container = document.querySelector('.container');
        container.insertBefore(alert, container.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            alert.remove();
        }, 5000);
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize when DOM is loaded
let adminSettings;
document.addEventListener('DOMContentLoaded', () => {
    adminSettings = new AdminSettings();
});

// Remove dragover class when leaving the upload area
document.addEventListener('dragleave', (e) => {
    if (e.target === document) {
        document.querySelector('.file-upload-area')?.classList.remove('dragover');
    }
});