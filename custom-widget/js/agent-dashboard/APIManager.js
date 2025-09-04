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
        this.agentToken = dashboard.agentToken;
    }

    /**
     * Get authorization headers for API requests
     * @returns {Object} Headers object with authorization
     */
    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${this.agentToken}`,
            'Content-Type': 'application/json'
        };
    }

    // ===== AGENT STATUS API METHODS =====

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
     * @param {Object} metadata - Additional message metadata
     * @returns {Object} Response data
     */
    async sendAgentMessage(conversationId, content, metadata = {}) {
        try {
            const response = await fetch(`${this.apiUrl}/api/agent/respond`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({
                    conversationId,
                    message: content,
                    agentId: this.dashboard.agentId,
                    usedSuggestion: metadata.usedSuggestion,
                    suggestionAction: metadata.responseType || 'custom',
                    autoAssign: metadata.autoAssign || false
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
     * Get AI suggestion for conversation
     * @param {string} conversationId - Conversation ID
     * @returns {Object} AI suggestion data
     */
    async getAISuggestion(conversationId) {
        try {
            const response = await fetch(`${this.apiUrl}/api/suggestions/${conversationId}`);
            
            if (!response.ok) {
                throw new Error(`Failed to get AI suggestion: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to get AI suggestion:', error);
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
}