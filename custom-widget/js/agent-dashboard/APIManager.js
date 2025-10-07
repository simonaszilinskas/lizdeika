/**
 * API Manager for Agent Dashboard
 * Handles all HTTP requests and API communication
 * Extracted from agent-dashboard.js for better modularity
 */

// Import constants
import { API_ENDPOINTS, STORAGE_KEYS } from './ui/constants.js';

export class APIManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.apiUrl = dashboard.apiUrl;
    }

    /**
     * Get authorization headers for API requests
     * @returns {Object} Headers object with authorization
     */
    getAuthHeaders() {
        const token = localStorage.getItem('agent_token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    // ===== AGENT STATUS API METHODS =====

    /**
     * Fetch all agents data
     * @returns {Promise<Array>} Array of agent objects
     */
    async loadAgentsData() {
        try {
            const response = await fetch(`${this.apiUrl}/api/agents`, {
                headers: this.getAuthHeaders()
            });
            if (!response.ok) throw new Error('Failed to fetch agents');
            return await response.json();
        } catch (error) {
            console.error('Failed to load agents data:', error);
            throw error;
        }
    }

    /**
     * Update personal status (online/offline)
     * @param {string} status - 'online' or 'offline'
     * @param {boolean} forceUpdate - Force status update regardless of current state
     */
    async updatePersonalStatus(status, forceUpdate = false) {
        try {
            await fetch(`${this.apiUrl}/api/agent/personal-status`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ 
                    agentId: this.dashboard.agentId, 
                    personalStatus: status,
                    forceUpdate 
                })
            });
        } catch (error) {
            console.error('Failed to update personal status:', error);
            throw error;
        }
    }

    /**
     * Set agent as offline
     */
    async setOfflineStatus() {
        try {
            await fetch(`${this.apiUrl}/api/agent/personal-status`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ 
                    agentId: this.dashboard.agentId, 
                    personalStatus: 'offline' 
                })
            });
        } catch (error) {
            console.error('Failed to set offline status:', error);
            throw error;
        }
    }

    /**
     * Send heartbeat to update agent status with timestamp
     */
    async sendHeartbeat() {
        try {
            if (this.dashboard.personalStatus === 'online') {
                await fetch(`${this.apiUrl}/api/agent/personal-status`, {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({ 
                        agentId: this.dashboard.agentId, 
                        personalStatus: 'online',
                        timestamp: Date.now()
                    })
                });
            }
        } catch (error) {
            console.error('Heartbeat failed:', error);
        }
    }

    // ===== CONVERSATION MANAGEMENT API METHODS =====

    /**
     * Assign conversation to specific agent (consolidated method)
     * @param {string} conversationId - Conversation ID
     * @param {string} agentId - Agent ID to assign to
     * @param {boolean} isMe - Whether assigning to current user
     */
    async assignConversation(conversationId, agentId, isMe = false) {
        try {
            const response = await fetch(`${this.apiUrl}/api/conversations/${conversationId}/assign`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ 
                    agentId: agentId,
                    assignedBy: this.dashboard.agentId
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to assign conversation: ${response.statusText}`);
            }

            const result = await response.json();
            
            // Show success message
            const actionText = isMe ? 'assigned to you' : `assigned to agent ${agentId}`;
            this.dashboard.showToast(`Conversation ${actionText} successfully`, 'success');
            
            // Refresh conversations
            await this.dashboard.loadConversations();
            
            return result;
        } catch (error) {
            console.error('Failed to assign conversation:', error);
            this.dashboard.showToast('Failed to assign conversation', 'error');
            throw error;
        }
    }

    /**
     * Unassign conversation (consolidated method)
     * @param {string} conversationId - Conversation ID
     */
    async unassignConversation(conversationId) {
        try {
            const response = await fetch(`${this.apiUrl}/api/conversations/${conversationId}/unassign`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ agentId: this.dashboard.agentId })
            });

            if (!response.ok) {
                throw new Error(`Failed to unassign conversation: ${response.statusText}`);
            }

            const result = await response.json();
            this.dashboard.showToast('Conversation unassigned successfully', 'success');
            
            // Refresh conversations
            await this.dashboard.loadConversations();
            
            return result;
        } catch (error) {
            console.error('Failed to unassign conversation:', error);
            this.dashboard.showToast('Failed to unassign conversation', 'error');
            throw error;
        }
    }

    /**
     * Assign category to conversation
     * @param {string} conversationId - Conversation ID
     * @param {string} categoryId - Category ID (can be null to remove category)
     */
    async assignCategory(conversationId, categoryId) {
        try {
            const response = await fetch(`${this.apiUrl}/api/conversations/${conversationId}/category`, {
                method: 'PATCH',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    category_id: categoryId,
                    assignedBy: this.dashboard.agentId
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to assign category: ${response.statusText}`);
            }

            const result = await response.json();

            // Don't show toast or reload conversations here
            // AssignmentManager handles the in-place update and toast

            return result;
        } catch (error) {
            console.error('Failed to assign category:', error);
            this.dashboard.showToast('Failed to assign category', 'error');
            throw error;
        }
    }

    /**
     * Load available categories for assignment
     * @returns {Array} Array of category objects
     */
    async loadCategories() {
        try {
            const response = await fetch(`${this.apiUrl}/api/categories?scope=all&include_archived=false`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to load categories: ${response.statusText}`);
            }

            const result = await response.json();
            return result.categories || [];
        } catch (error) {
            console.error('Failed to load categories:', error);
            return [];
        }
    }

    /**
     * Archive conversations in bulk
     * @param {Array} conversationIds - Array of conversation IDs
     */
    async bulkArchiveConversations(conversationIds) {
        try {
            const response = await fetch(`${this.apiUrl}/api/admin/conversations/bulk-archive`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ 
                    conversationIds,
                    archivedBy: this.dashboard.agentId
                })
            });

            if (!response.ok) {
                throw new Error(`Bulk archive failed: ${response.statusText}`);
            }

            const result = await response.json();
            this.dashboard.showToast(`${conversationIds.length} conversations archived`, 'success');
            
            return result;
        } catch (error) {
            console.error('Bulk archive failed:', error);
            this.dashboard.showToast('Failed to archive conversations', 'error');
            throw error;
        }
    }

    /**
     * Unarchive conversations in bulk
     * @param {Array} conversationIds - Array of conversation IDs
     */
    async bulkUnarchiveConversations(conversationIds) {
        try {
            const response = await fetch(`${this.apiUrl}/api/admin/conversations/bulk-unarchive`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ 
                    conversationIds,
                    unarchivedBy: this.dashboard.agentId
                })
            });

            if (!response.ok) {
                throw new Error(`Bulk unarchive failed: ${response.statusText}`);
            }

            const result = await response.json();
            this.dashboard.showToast(`${conversationIds.length} conversations unarchived`, 'success');
            
            return result;
        } catch (error) {
            console.error('Bulk unarchive failed:', error);
            this.dashboard.showToast('Failed to unarchive conversations', 'error');
            throw error;
        }
    }

    /**
     * Load all conversations from dashboard API
     * @returns {Array} Array of conversations
     */
    async loadConversationsData() {
        try {
            const response = await fetch(`${this.apiUrl}/api/admin/conversations`);
            
            if (!response.ok) {
                throw new Error(`Failed to load conversations: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to load conversations:', error);
            this.dashboard.showToast('Failed to load conversations', 'error');
            throw error;
        }
    }

    // ===== MESSAGE/CHAT API METHODS =====

    /**
     * Load messages for a specific conversation
     * @param {string} conversationId - Conversation ID
     * @returns {Object} Messages data
     */
    async loadConversationMessages(conversationId) {
        try {
            const response = await fetch(`${this.apiUrl}/api/conversations/${conversationId}/messages`);
            
            if (!response.ok) {
                throw new Error(`Failed to load messages: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Update last seen time
            localStorage.setItem(`lastSeen_${conversationId}`, new Date().toISOString());
            
            return data;
        } catch (error) {
            console.error('Failed to load conversation messages:', error);
            this.dashboard.showToast('Failed to load messages', 'error');
            throw error;
        }
    }

    /**
     * Send message as agent
     * @param {string} conversationId - Conversation ID
     * @param {string} content - Message content
     * @param {string} suggestionAction - Response type ('as-is', 'edited', 'custom', 'from-scratch')
     * @param {Object} metadata - Additional message metadata
     * @returns {Object} Response data
     */
    async sendAgentMessage(conversationId, content, suggestionAction = 'custom', metadata = {}) {
        try {
            const response = await fetch(`${this.apiUrl}/api/agent/respond`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    conversationId,
                    message: content,
                    agentId: this.dashboard.agentId,
                    usedSuggestion: metadata.usedSuggestion,
                    suggestionAction: suggestionAction,
                    autoAssign: metadata.autoAssign || false,
                    messageType: metadata.messageType,
                    fileMetadata: metadata.file
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to send message: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to send agent message:', error);
            this.dashboard.showToast('Failed to send message', 'error');
            throw error;
        }
    }

    // ===== AI SUGGESTIONS API METHODS =====

    /**
     * Get AI suggestion for conversation (generate new one)
     * @param {string} conversationId - Conversation ID
     * @returns {Object} AI suggestion data
     */
    async getAISuggestion(conversationId) {
        const requestStartTime = performance.now();
        const timestamp = new Date().toISOString();

        // 🔍 BROWSER CONSOLE DEBUG: Request Details
        console.group(`🤖 AI Suggestion Request - ${timestamp}`);
        console.log('📍 Request Details:');
        console.log('  • Conversation ID:', conversationId);
        console.log('  • API Endpoint:', `${this.apiUrl}/api/conversations/${conversationId}/generate-suggestion`);
        console.log('  • Method:', 'POST');
        console.log('  • Headers:', this.getAuthHeaders());
        console.log('  • Start Time:', new Date(requestStartTime).toISOString());

        try {
            console.log('⚡ Sending request to backend...');

            const response = await fetch(`${this.apiUrl}/api/conversations/${conversationId}/generate-suggestion`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });

            const responseTime = performance.now();
            const duration = responseTime - requestStartTime;

            console.log('📡 Response received:');
            console.log('  • Status:', response.status, response.statusText);
            console.log('  • Response Time:', `${duration.toFixed(2)}ms`);
            console.log('  • Headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                console.error('❌ Request failed:', response.status, response.statusText);
                throw new Error(`Failed to get AI suggestion: ${response.statusText}`);
            }

            const data = await response.json();
            const parseTime = performance.now();
            const totalDuration = parseTime - requestStartTime;

            // 🔍 BROWSER CONSOLE DEBUG: Comprehensive RAG Pipeline Analysis
            console.log('✅ AI Suggestion Generated Successfully:');
            console.log('  • Suggestion Text:', data.suggestion ? `"${data.suggestion.substring(0, 100)}..."` : 'No suggestion');
            console.log('  • Confidence Score:', data.confidence || 'N/A');
            console.log('  • Response Size:', JSON.stringify(data).length, 'chars');
            console.log('  • Total Processing Time:', `${totalDuration.toFixed(2)}ms`);
            console.log('  • Backend Processing Time:', `${(totalDuration - duration).toFixed(2)}ms`);

            // Enhanced metadata display
            if (data.metadata) {
                console.group('🎯 AI System Configuration:');
                console.log('  • AI Provider:', data.metadata.provider || 'Unknown');
                console.log('  • RAG Enhancement:', data.metadata.ragUsed ? 'Yes' : 'No');
                console.log('  • Fallback Used:', data.metadata.fallbackUsed ? 'Yes' : 'No');
                console.log('  • Sources Used:', data.metadata.sourcesUsed || 0, 'files');
                console.log('  • Document Contexts:', data.metadata.contextsUsed || 0, 'chunks');
                console.log('  • Context Length:', data.metadata.contextLength || 0, 'chars');
                console.log('  • Processing Steps:', data.metadata.processingSteps || 0);
                console.groupEnd();

                // Comprehensive debug information display
                if (data.metadata.debugInfo && Object.keys(data.metadata.debugInfo).length > 0) {
                    this._logRAGPipelineDetails(data.metadata.debugInfo);
                }
            }

            console.groupEnd();
            return data;

        } catch (error) {
            const errorTime = performance.now();
            const duration = errorTime - requestStartTime;

            console.error('❌ AI Suggestion Request Failed:');
            console.error('  • Error Type:', error.name);
            console.error('  • Error Message:', error.message);
            console.error('  • Request Duration:', `${duration.toFixed(2)}ms`);
            console.error('  • Stack Trace:', error.stack);
            console.groupEnd();
            return null;
        }
    }

    /**
     * Check for pending AI suggestion
     * @param {string} conversationId - Conversation ID
     * @returns {Object|null} Pending suggestion data or null
     */
    async getPendingSuggestion(conversationId) {
        try {
            const response = await fetch(`${this.apiUrl}/api/conversations/${conversationId}/pending-suggestion`);

            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error('Failed to get pending suggestion:', error);
            return null;
        }
    }

    /**
     * Fetch aggregated dashboard statistics for agents/admins
     * @param {number} [rangeDays] - Optional number of days to include in analysis
     * @returns {Promise<Object>} Dashboard statistics payload
     */
    async fetchDashboardStats(rangeDays) {
        try {
            const url = new URL(`${this.apiUrl}/api/stats/dashboard`);
            if (Number.isFinite(rangeDays) && rangeDays > 0) {
                url.searchParams.set('rangeDays', rangeDays);
            }

            const response = await fetch(url.toString(), {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to load dashboard stats: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to fetch dashboard stats:', error);
            throw error;
        }
    }

    // ===== AGENT MANAGEMENT API METHODS =====

    /**
     * Load all agents data
     * @returns {Array} Array of agents
     */
    async loadAgentsData() {
        try {
            const response = await fetch(`${this.apiUrl}/api/agents/all`);
            
            if (!response.ok) {
                throw new Error(`Failed to load agents: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Cache the agents data
            this.dashboard.agentCache = data.agents;
            this.dashboard.agentCacheExpiry = Date.now() + this.dashboard.agentCacheDuration;
            
            return data.agents;
        } catch (error) {
            console.error('Failed to load agents:', error);
            return [];
        }
    }

    // ===== UTILITY METHODS =====

    /**
     * Handle API response errors consistently
     * @param {Response} response - Fetch response object
     * @param {string} operation - Description of the operation
     */
    async handleApiError(response, operation) {
        if (!response.ok) {
            const error = new Error(`${operation} failed: ${response.statusText}`);
            error.status = response.status;
            error.response = response;
            throw error;
        }
        return response;
    }

    /**
     * Make authenticated GET request
     * @param {string} endpoint - API endpoint
     * @returns {Promise} Response data
     */
    async authenticatedGet(endpoint) {
        try {
            const response = await fetch(`${this.apiUrl}${endpoint}`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });
            
            await this.handleApiError(response, `GET ${endpoint}`);
            return await response.json();
        } catch (error) {
            console.error(`GET ${endpoint} failed:`, error);
            throw error;
        }
    }

    /**
     * Make authenticated POST request
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request body data
     * @returns {Promise} Response data
     */
    async authenticatedPost(endpoint, data) {
        try {
            const response = await fetch(`${this.apiUrl}${endpoint}`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(data)
            });
            
            await this.handleApiError(response, `POST ${endpoint}`);
            return await response.json();
        } catch (error) {
            console.error(`POST ${endpoint} failed:`, error);
            throw error;
        }
    }

    /**
     * Log comprehensive RAG pipeline details to browser console
     * @param {Object} debugInfo - Debug information from aiService
     */
    _logRAGPipelineDetails(debugInfo) {
        console.group('🔍 RAG Pipeline Transparency - Detailed Breakdown:');

        // Step 1: Original Request
        if (debugInfo.step1_originalRequest) {
            console.group('📋 Step 1: Original Request');
            console.log('  • Provider:', debugInfo.step1_originalRequest.provider || 'Unknown');
            console.log('  • RAG Enabled:', debugInfo.step1_originalRequest.enableRAG ? 'Yes' : 'No');
            console.log('  • Context Length:', debugInfo.step1_originalRequest.conversationContext?.length || 0, 'chars');
            console.groupEnd();
        }

        // Step 2: Provider Check
        if (debugInfo.step2_providerCheck) {
            console.group('⚡ Step 2: AI Provider Status');
            console.log('  • Provider Status:', debugInfo.step2_providerCheck.status || 'Unknown');
            console.log('  • Provider Name:', debugInfo.step2_providerCheck.provider || 'Unknown');
            if (debugInfo.step2_providerCheck.fallbackUsed) {
                console.log('  • 🚨 Fallback Used: Provider unavailable/unhealthy');
            }
            console.groupEnd();
        }

        // Step 3: RAG Processing
        if (debugInfo.step3_ragProcessing) {
            console.group('🧠 Step 3: RAG Processing');
            console.log('  • RAG Enabled:', debugInfo.step3_ragProcessing.enabled ? 'Yes' : 'No');
            console.log('  • Should Use RAG:', debugInfo.step3_ragProcessing.shouldUseRAG ? 'Yes' : 'No');
            console.log('  • Extracted Message:', debugInfo.step3_ragProcessing.extractedMessage || 'N/A');
            console.log('  • Chat History Length:', debugInfo.step3_ragProcessing.chatHistoryLength || 0);
            if (debugInfo.step3_ragProcessing.error) {
                console.log('  • ❌ RAG Error:', debugInfo.step3_ragProcessing.error);
            }
            console.groupEnd();
        }

        // Step 4: LangChain RAG Details
        if (debugInfo.step4_langchainRAG) {
            this._logLangChainDetails(debugInfo.step4_langchainRAG);
        }

        // Step 5: RAG Results
        if (debugInfo.step5_ragResults) {
            console.group('📊 Step 5: RAG Results Summary');
            console.log('  • Final Answer Length:', debugInfo.step5_ragResults.answer?.length || 0, 'chars');
            console.log('  • Contexts Used:', debugInfo.step5_ragResults.contextsUsed || 0);
            console.log('  • Sources Used:', debugInfo.step5_ragResults.sources?.length || 0);
            if (debugInfo.step5_ragResults.sources?.length > 0) {
                console.log('  • Source Files:');
                debugInfo.step5_ragResults.sources.forEach((source, index) => {
                    console.log(`    ${index + 1}. ${source}`);
                });
            }
            console.groupEnd();
        }

        // Model Request and Response (for non-RAG paths)
        if (debugInfo.step4_modelRequest) {
            console.group('🤖 Step 4: Direct Model Request');
            console.log('  • Provider:', debugInfo.step4_modelRequest.provider || 'Unknown');
            console.log('  • Context Length:', debugInfo.step4_modelRequest.contextLength || 0, 'chars');
            console.groupEnd();
        }

        if (debugInfo.step5_modelResponse) {
            console.group('✅ Step 5: Model Response');
            console.log('  • Successful:', debugInfo.step5_modelResponse.successful ? 'Yes' : 'No');
            console.log('  • Response Length:', debugInfo.step5_modelResponse.responseLength || 0, 'chars');
            if (debugInfo.step5_modelResponse.error) {
                console.log('  • ❌ Error:', debugInfo.step5_modelResponse.error);
            }
            if (debugInfo.step5_modelResponse.fallbackUsed) {
                console.log('  • 🚨 Fallback Used: Model request failed');
            }
            console.groupEnd();
        }

        console.groupEnd();
    }

    /**
     * Log detailed LangChain RAG pipeline information
     * @param {Object} langchainDebug - LangChain debug information
     */
    _logLangChainDetails(langchainDebug) {
        console.group('🔗 Step 4: LangChain RAG Pipeline');

        // Query Rephrasing
        if (langchainDebug.step2_queryRephrasing) {
            console.group('🔄 Query Rephrasing');
            console.log('  • Original Query:', `"${langchainDebug.step2_queryRephrasing.originalQuery || 'N/A'}"`);
            console.log('  • Rephrased Query:', `"${langchainDebug.step2_queryRephrasing.rephrasedQuery || 'Same as original'}"`);
            console.log('  • Improvement Made:', langchainDebug.step2_queryRephrasing.improvement ? 'Yes' : 'No');
            console.groupEnd();
        }

        // Document Retrieval
        if (langchainDebug.step3_documentRetrieval) {
            console.group('📄 Document Retrieval (ChromaDB)');
            console.log('  • Search Query:', `"${langchainDebug.step3_documentRetrieval.searchQuery || 'N/A'}"`);
            console.log('  • Documents Requested:', langchainDebug.step3_documentRetrieval.requestedDocuments || 0);
            console.log('  • Documents Retrieved:', langchainDebug.step3_documentRetrieval.retrievedDocuments || 0);

            // Vector search details
            if (langchainDebug.step3_documentRetrieval.vectorSearchDetails) {
                const vsd = langchainDebug.step3_documentRetrieval.vectorSearchDetails;
                console.log('  • Vector Search Details:');
                console.log('    - Embedding Provider:', vsd.embeddingProvider || 'Default');
                console.log('    - Embedding Dimensions:', vsd.embeddingDimensions || 'N/A');
                console.log('    - Search Time:', vsd.searchTime || 'N/A');

                if (vsd.documents && vsd.documents.length > 0) {
                    console.log('    - Retrieved Documents:');
                    vsd.documents.forEach((doc, index) => {
                        console.log(`      ${index + 1}. ID: ${doc.id}`);
                        console.log(`         Similarity: ${(1 - doc.distance).toFixed(4)}`);
                        console.log(`         Content: "${doc.content?.substring(0, 80)}..."`);
                        if (doc.metadata?.source) {
                            console.log(`         Source: ${doc.metadata.source}`);
                        }
                    });
                }
            }
            console.groupEnd();
        }

        // Prompt Construction
        if (langchainDebug.step5_promptConstruction) {
            console.group('📝 Prompt Construction');
            const pc = langchainDebug.step5_promptConstruction;
            console.log('  • Prompt Source:', pc.promptSource || 'Unknown');
            console.log('  • Has Chat History:', pc.hasChatHistory ? 'Yes' : 'No');
            console.log('  • Context Length:', pc.contextLength || 0, 'chars');
            console.log('  • Final Prompt Length:', pc.finalPromptLength || 0, 'chars');

            if (pc.messages && pc.messages.length > 0) {
                console.log('  • Prompt Messages:');
                pc.messages.forEach((msg, index) => {
                    console.log(`    ${index + 1}. ${msg.role || 'unknown'}: ${msg.contentLength || 0} chars`);
                });
            }
            console.groupEnd();
        }

        // Response Generation
        if (langchainDebug.step6_llmResponse) {
            console.group('🤖 LLM Response Generation');
            const lr = langchainDebug.step6_llmResponse;
            console.log('  • Model:', lr.model || 'Unknown');
            console.log('  • Temperature:', lr.temperature || 'N/A');
            console.log('  • Max Tokens:', lr.maxTokens || 'N/A');
            console.log('  • Processing Time:', lr.processingTime || 'N/A');
            console.log('  • Response Length:', lr.responseLength || 0, 'chars');
            console.log('  • Token Usage:', lr.tokenUsage || 'N/A');
            console.groupEnd();
        }

        console.groupEnd();
    }
}