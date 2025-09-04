/**
 * Debug Manager for Agent Dashboard
 * Handles debug modal display and debug information rendering
 * Extracted from agent-dashboard.js for better modularity
 */
export class DebugManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.apiUrl = dashboard.apiUrl;
        this.stateManager = dashboard.stateManager;
    }

    /**
     * Toggle debug modal visibility
     */
    async toggleDebugPanel() {
        const modal = document.getElementById('debug-modal');
        if (!modal) return;
        
        if (modal.classList.contains('hidden')) {
            await this.showDebugModal();
        } else {
            this.hideDebugModal();
        }
    }

    /**
     * Show debug modal and load debug information
     */
    async showDebugModal() {
        if (!this.stateManager.getCurrentChatId()) return;
        
        const modal = document.getElementById('debug-modal');
        if (!modal) return;
        
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        await this.loadDebugInfo();
    }

    /**
     * Hide debug modal
     */
    hideDebugModal() {
        const modal = document.getElementById('debug-modal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = ''; // Restore scrolling
        }
    }

    /**
     * Load debug information from backend
     */
    async loadDebugInfo() {
        if (!this.stateManager.getCurrentChatId()) return;
        
        try {
            const response = await fetch(`${this.apiUrl}/api/conversations/${this.stateManager.getCurrentChatId()}/debug-info`);
            
            if (response.ok) {
                const debugInfo = await response.json();
                this.renderDebugInfo(debugInfo);
            } else if (response.status === 404) {
                this.renderDebugError('No debug information available for this conversation.');
            } else {
                this.renderDebugError('Failed to load debug information.');
            }
        } catch (error) {
            console.error('Error loading debug info:', error);
            this.renderDebugError('Error loading debug information.');
        }
    }

    /**
     * Render debug information in the panel
     */
    renderDebugInfo(debugInfo) {
        const content = document.getElementById('debug-content');
        if (!content) return;
        
        let sections = [];
        
        // Check if we have LangChain RAG debug info (new comprehensive format)
        if (debugInfo.step4_langchainRAG) {
            const langchainDebug = debugInfo.step4_langchainRAG;
            sections = [
                {
                    id: 'original-request',
                    title: '1. Original Request & Context',
                    data: {
                        ...debugInfo.step1_originalRequest,
                        langchainInput: langchainDebug.step1_input
                    }
                },
                {
                    id: 'query-rephrasing',
                    title: '2. Query Rephrasing (LLM Call #1)',
                    data: langchainDebug.step2_queryRephrasing
                },
                {
                    id: 'document-retrieval',
                    title: '3. Document Retrieval',
                    data: langchainDebug.step3_documentRetrieval
                },
                {
                    id: 'context-formatting',
                    title: '4. Context Formatting',
                    data: langchainDebug.step4_contextFormatting
                },
                {
                    id: 'response-generation',
                    title: '5. AI Model Response (LLM Call #2)',
                    data: langchainDebug.step5_responseGeneration
                },
                {
                    id: 'source-attribution',
                    title: '6. Source Attribution',
                    data: langchainDebug.step6_sourceAttribution
                },
                {
                    id: 'final-result',
                    title: '7. Final Result',
                    data: {
                        ...langchainDebug.step7_finalResult,
                        totalProcessingTime: langchainDebug.totalProcessingTime,
                        chainType: langchainDebug.chainType,
                        aiServiceFinalResponse: debugInfo.finalResponse
                    }
                }
            ];
        } else {
            // Fallback to old format for backwards compatibility
            sections = [
                {
                    id: 'original-request',
                    title: '1. Original Request',
                    data: debugInfo.step1_originalRequest
                },
                {
                    id: 'provider-check',
                    title: '2. Provider Status',
                    data: debugInfo.step2_providerCheck
                },
                {
                    id: 'rag-processing',
                    title: '3. RAG Processing',
                    data: debugInfo.step3_ragProcessing
                },
                {
                    id: 'rag-results',
                    title: '4. Retrieved Documents',
                    data: debugInfo.step4_ragResults || debugInfo.step4_modelRequest
                },
                {
                    id: 'model-response',
                    title: '5. AI Model Response',
                    data: debugInfo.step5_modelResponse
                },
                {
                    id: 'final-response',
                    title: '6. Final Response',
                    data: { response: debugInfo.finalResponse }
                }
            ];
        }
        
        content.innerHTML = sections.map(section => this.renderDebugSection(section)).join('');
        
        // Add event listeners for toggles
        this.setupDebugToggleListeners();
    }

    /**
     * Render individual debug section
     */
    renderDebugSection(section) {
        const hasData = section.data && Object.keys(section.data).length > 0;
        const previewData = hasData ? this.formatDebugPreview(section.data) : 'No data available';
        const fullData = hasData ? JSON.stringify(section.data, null, 2) : 'No data available';
        
        return `
            <div class="debug-section mb-4 border border-yellow-200 rounded-lg">
                <div class="debug-section-header bg-yellow-50 p-3 cursor-pointer flex justify-between items-center" 
                     onclick="this.parentElement.querySelector('.debug-section-content').classList.toggle('hidden')">
                    <h4 class="font-medium text-yellow-800">${section.title}</h4>
                    <i class="fas fa-chevron-down text-yellow-600 transform transition-transform"></i>
                </div>
                <div class="debug-section-content hidden p-3 bg-white">
                    <div class="debug-preview mb-3 p-2 bg-gray-50 rounded text-sm text-gray-700">
                        ${previewData}
                    </div>
                    <div class="debug-toggle-container">
                        <button class="debug-toggle-btn text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-2 py-1 rounded" 
                                onclick="this.nextElementSibling.classList.toggle('hidden')">
                            <i class="fas fa-code mr-1"></i> Show Full Data
                        </button>
                        <pre class="debug-full-data hidden mt-2 p-2 bg-gray-900 text-green-400 text-xs rounded overflow-auto max-h-64">${this.escapeHtml(fullData)}</pre>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Format debug data for preview
     */
    formatDebugPreview(data) {
        if (!data) return 'No data';
        
        if (typeof data === 'string') {
            return data.length > 100 ? data.substring(0, 100) + '...' : data;
        }
        
        if (typeof data === 'object') {
            const keys = Object.keys(data);
            const keyCount = keys.length;
            
            if (keyCount === 0) return 'Empty object';
            
            // Show key highlights based on the data structure
            const highlights = [];
            
            // General fields
            if (data.provider) highlights.push(`Provider: ${data.provider}`);
            if (data.status) highlights.push(`Status: ${data.status}`);
            if (data.enabled !== undefined) highlights.push(`Enabled: ${data.enabled}`);
            if (data.successful !== undefined) highlights.push(`Success: ${data.successful}`);
            if (data.error) highlights.push(`Error: ${data.error}`);
            
            // LLM-specific fields
            if (data.model) highlights.push(`Model: ${data.model}`);
            if (data.temperature !== undefined) highlights.push(`Temp: ${data.temperature}`);
            if (data.formattedPrompt) highlights.push(`Prompt: ${data.formattedPrompt.substring(0, 50)}...`);
            if (data.finalPrompt) highlights.push(`Final Prompt: ${data.finalPrompt.substring(0, 50)}...`);
            if (data.rephrasedQuery) highlights.push(`Rephrased: "${data.rephrasedQuery}"`);
            if (data.extractedContent) highlights.push(`Response: ${data.extractedContent.substring(0, 50)}...`);
            
            // Prompt management fields (Langfuse integration)
            if (data.promptSource) highlights.push(`Prompt Source: ${data.promptSource}`);
            if (data.promptVersion) highlights.push(`Version: v${data.promptVersion}`);
            if (data.originalQuery) highlights.push(`Original: "${data.originalQuery}"`);
            if (data.improvement !== undefined) highlights.push(`Improved: ${data.improvement ? 'Yes' : 'No'}`);
            if (data.action) highlights.push(`Action: ${data.action}`);
            if (data.hasHistory !== undefined) highlights.push(`Has History: ${data.hasHistory}`);
            if (data.promptType) highlights.push(`Type: ${data.promptType}`);
            
            // RAG-specific fields
            if (data.contextsUsed) highlights.push(`Contexts: ${data.contextsUsed}`);
            if (data.sources && Array.isArray(data.sources)) highlights.push(`Sources: ${data.sources.length}`);
            if (data.retrievedDocuments !== undefined) highlights.push(`Documents: ${data.retrievedDocuments}`);
            if (data.requestedDocuments !== undefined) highlights.push(`Requested: ${data.requestedDocuments}`);
            if (data.searchQuery) highlights.push(`Search: "${data.searchQuery}"`);
            if (data.documentsMetadata && Array.isArray(data.documentsMetadata)) {
                highlights.push(`Metadata: ${data.documentsMetadata.length} entries`);
            }
            if (data.documentsUsed) highlights.push(`Used: ${data.documentsUsed}`);
            
            // Content length fields
            if (data.contextLength) highlights.push(`Context: ${data.contextLength} chars`);
            if (data.responseLength) highlights.push(`Response: ${data.responseLength} chars`);
            if (data.totalPromptLength) highlights.push(`Total Prompt: ${data.totalPromptLength} chars`);
            
            // Config fields
            if (data.k) highlights.push(`K: ${data.k}`);
            if (data.used !== undefined) highlights.push(`Used: ${data.used}`);
            if (data.skipped) highlights.push('Skipped');
            if (data.historyExchanges !== undefined) highlights.push(`History: ${data.historyExchanges} exchanges`);
            if (data.validExchanges !== undefined) highlights.push(`Valid: ${data.validExchanges}`);
            
            // Fallback response preview
            if (data.response && !data.extractedContent) highlights.push(`Response: ${data.response.substring(0, 50)}...`);
            if (data.answer) highlights.push(`Answer: ${data.answer.substring(0, 50)}...`);
            
            return highlights.length > 0 ? highlights.join(' • ') : `${keyCount} properties`;
        }
        
        return String(data);
    }

    /**
     * Setup event listeners for debug toggles
     */
    setupDebugToggleListeners() {
        const headers = document.querySelectorAll('.debug-section-header');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const icon = header.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-chevron-down');
                    icon.classList.toggle('fa-chevron-up');
                }
            });
        });
    }

    /**
     * Render debug error message
     */
    renderDebugError(message) {
        const content = document.getElementById('debug-content');
        if (!content) return;
        
        content.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <i class="fas fa-exclamation-triangle text-red-500 mb-2"></i>
                <p class="text-red-700">${message}</p>
            </div>
        `;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}