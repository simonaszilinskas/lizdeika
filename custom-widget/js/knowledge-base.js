/**
 * Knowledge Base JavaScript
 * Handles the knowledge base management interface
 */

class KnowledgeBase {
    constructor() {
        this.apiUrl = 'http://localhost:3002';
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadDocuments();
        this.loadIndexedDocuments();
    }

    initializeElements() {
        // Knowledge base elements
        this.fileUploadArea = document.getElementById('file-upload-area');
        this.fileInput = document.getElementById('file-input');
        this.documentsList = document.getElementById('documents-list');
        this.refreshButton = document.getElementById('refresh-documents');
        this.clearAllButton = document.getElementById('clear-all-documents');
        
        // Indexed documents elements
        this.indexedList = document.getElementById('indexed-list');
        this.refreshIndexedButton = document.getElementById('refresh-indexed');
    }

    attachEventListeners() {
        // File upload
        this.fileUploadArea.addEventListener('click', () => this.fileInput.click());
        this.fileUploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.fileUploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Knowledge management
        this.refreshButton.addEventListener('click', () => this.refreshDocuments());
        this.clearAllButton.addEventListener('click', () => this.clearAllDocuments());
        
        // Indexed documents management
        this.refreshIndexedButton.addEventListener('click', () => this.refreshIndexedDocuments());
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
                    <button class="button button-danger" onclick="knowledgeBase.deleteDocument('${doc.id}')">Delete</button>
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
        
        // Refresh the documents list
        this.loadDocuments();
        this.loadIndexedDocuments();
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

    async loadIndexedDocuments() {
        try {
            const response = await fetch(`${this.apiUrl}/api/knowledge/indexed?limit=100`); // Chroma Cloud limit is 100 documents
            const data = await response.json();

            if (response.ok) {
                this.renderIndexedDocuments(data.data);
            } else {
                throw new Error(data.error || 'Failed to load indexed documents');
            }
        } catch (error) {
            console.error('Failed to load indexed documents:', error);
            this.indexedList.innerHTML = '<p>Failed to load indexed documents</p>';
        }
    }

    renderIndexedDocuments(data) {
        if (!data.connected) {
            if (data.note) {
                this.indexedList.innerHTML = `<div class="provider-info"><p><strong>Note:</strong> ${data.note}</p></div>`;
            } else {
                this.indexedList.innerHTML = '<p>Vector database not connected</p>';
            }
            return;
        }

        const documents = data.documents || [];
        
        if (documents.length === 0) {
            this.indexedList.innerHTML = '<p>No documents indexed in Chroma vector database yet</p>';
            return;
        }
        
        // Add notice about Chroma Cloud 100-document limit
        let limitNotice = '';
        if (documents.length >= 100) {
            limitNotice = `
                <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <div class="flex items-center text-amber-800">
                        <i class="fas fa-info-circle mr-2"></i>
                        <div class="text-sm">
                            <strong>Showing first 100 of ${data.count || 'many'} documents</strong>
                            <br><span class="text-xs text-amber-700">Chroma Cloud limits queries to 100 documents per request</span>
                        </div>
                    </div>
                </div>
            `;
        }

        this.indexedList.innerHTML = limitNotice + documents.map((doc, index) => {
            const contentPreview = doc.content.length > 150 
                ? doc.content.substring(0, 150) + '...' 
                : doc.content;
            
            const metadata = doc.metadata || {};
            const title = metadata.source_document_name || `Document ${index + 1}`;
            const sourceUrl = metadata.source_url;
            const uploadTime = metadata.upload_time ? new Date(metadata.upload_time).toLocaleDateString() : '';
            const uploadSource = metadata.upload_source || 'unknown';

            // Create source link
            const sourceLink = sourceUrl 
                ? `<a href="${sourceUrl.startsWith('http') ? sourceUrl : 'https://' + sourceUrl}" target="_blank" style="color: #2c5530; text-decoration: none; margin-left: 8px;" onclick="event.stopPropagation();" title="Open source in new tab">
                     <i class="fas fa-external-link-alt" style="font-size: 12px;"></i>
                   </a>`
                : '';

            return `
                <div class="document-item indexed-doc-item" style="cursor: pointer;" onclick="knowledgeBase.toggleIndexedDocDetails('${doc.id}')">
                    <div class="document-info">
                        <h4>${title}${sourceLink}</h4>
                        <div class="document-details">
                            <small style="color: #666;">${contentPreview}</small>
                            ${uploadTime ? `<br><small style="color: #999;">Indexed: ${uploadTime} (${uploadSource})</small>` : ''}
                        </div>
                    </div>
                    <div class="document-actions">
                        <i class="fas fa-chevron-down" id="chevron-${doc.id}"></i>
                    </div>
                </div>
                <div class="indexed-doc-details" id="details-${doc.id}" style="display: none; background: #f8f9fa; padding: 15px; margin: 0 0 10px 0; border-radius: 6px;">
                    <div style="margin-bottom: 15px;">
                        <h5 style="margin: 0 0 10px 0; color: #2c5530;">Full Content:</h5>
                        <div style="background: white; padding: 12px; border-radius: 4px; border: 1px solid #e0e0e0; max-height: 300px; overflow-y: auto; white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 13px;">${doc.content}</div>
                    </div>
                    ${sourceUrl ? `
                        <div style="margin-bottom: 10px;">
                            <h5 style="margin: 0 0 5px 0; color: #2c5530;">Source Link:</h5>
                            <a href="${sourceUrl.startsWith('http') ? sourceUrl : 'https://' + sourceUrl}" target="_blank" style="color: #2c5530; text-decoration: underline; display: inline-flex; align-items: center; gap: 5px;">
                                <i class="fas fa-external-link-alt" style="font-size: 12px;"></i>
                                ${sourceUrl}
                            </a>
                        </div>
                    ` : ''}
                    <div style="margin-bottom: 10px;">
                        <h5 style="margin: 0 0 5px 0; color: #2c5530;">Metadata:</h5>
                        <small style="color: #666;">
                            Upload source: <strong>${uploadSource}</strong> • 
                            Chunk ${metadata.chunk_index || 0} • 
                            ${metadata.language || 'unknown'} language
                        </small>
                    </div>
                    <div>
                        <h5 style="margin: 0 0 5px 0; color: #2c5530;">Technical Details:</h5>
                        <small style="color: #666;">
                            ID: ${doc.id} • 
                            ${doc.hasEmbedding ? `${doc.embeddingDimensions}D embedding` : 'No embedding'} • 
                            ${doc.content.length} characters
                        </small>
                    </div>
                </div>
            `;
        }).join('');

        // Add summary info
        const documentsWithSources = documents.filter(doc => doc.metadata && doc.metadata.source_url).length;
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'provider-info';
        summaryDiv.style.marginBottom = '15px';
        summaryDiv.innerHTML = `
            <h4>Collection: ${data.collectionName}</h4>
            <p>Total indexed chunks: <strong>${documents.length}</strong> • With source URLs: <strong>${documentsWithSources}</strong></p>
        `;
        this.indexedList.insertBefore(summaryDiv, this.indexedList.firstChild);
    }

    toggleIndexedDocDetails(docId) {
        const detailsDiv = document.getElementById(`details-${docId}`);
        const chevron = document.getElementById(`chevron-${docId}`);
        
        if (detailsDiv.style.display === 'none') {
            detailsDiv.style.display = 'block';
            chevron.className = 'fas fa-chevron-up';
        } else {
            detailsDiv.style.display = 'none';
            chevron.className = 'fas fa-chevron-down';
        }
    }

    async refreshIndexedDocuments() {
        const button = this.refreshIndexedButton;
        const originalText = button.textContent;
        
        try {
            button.disabled = true;
            button.innerHTML = '<span class="loading"></span>Refreshing...';
            
            await this.loadIndexedDocuments();
            
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
let knowledgeBase;
document.addEventListener('DOMContentLoaded', () => {
    knowledgeBase = new KnowledgeBase();
});

// Remove dragover class when leaving the upload area
document.addEventListener('dragleave', (e) => {
    if (e.target === document) {
        document.querySelector('.file-upload-area')?.classList.remove('dragover');
    }
});