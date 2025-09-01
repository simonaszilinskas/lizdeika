/**
 * AGENT AUTHENTICATION MANAGER
 * Simple authentication service for agent dashboard
 * 
 * Extracted from monolithic agent-dashboard.js for better maintainability
 * Handles agent ID resolution, token management, and admin status checking
 * 
 * @fileoverview Simple authentication manager with minimal dependencies
 */

import { STORAGE_KEYS, DEFAULTS, API_ENDPOINTS } from '../ui/constants.js';

/**
 * AgentAuthManager - Simple authentication service
 * 
 * Responsibilities:
 * - Agent ID resolution from multiple sources
 * - Token management and validation  
 * - Admin status checking
 * - Simple, focused interface
 */
export class AgentAuthManager {
    /**
     * Create authentication manager
     * @param {Object} config - Configuration object
     * @param {string} config.apiUrl - Base API URL
     */
    constructor(config = {}) {
        this.apiUrl = config.apiUrl;
        this.agentId = null;
        this.isAdmin = false;
        this.token = null;
        
        // Initialize agent ID immediately
        this.agentId = this.getAuthenticatedAgentId();
        this.token = this.getStoredToken();
        
        console.log(`🔐 AgentAuthManager initialized for agent: ${this.agentId}`);
    }

    /**
     * Get authenticated agent ID from various sources
     * Maintains exact same logic as original implementation
     * @returns {string} Agent ID
     */
    getAuthenticatedAgentId() {
        try {
            // First try the new user_data format
            const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
            if (userData) {
                const user = JSON.parse(userData);
                if (user.email) {
                    console.log(`Using agent ID from user_data: ${user.email}`);
                    return user.email; // Use full email as agent ID
                }
            }
            
            // Try to get authenticated user from localStorage (old format)
            const agentUser = localStorage.getItem(STORAGE_KEYS.AGENT_USER);
            if (agentUser) {
                const user = JSON.parse(agentUser);
                // Use full email as agent ID
                if (user.email) {
                    console.log(`Using agent ID from agentUser: ${user.email}`);
                    return user.email;
                }
            }
        } catch (error) {
            console.warn('Could not get authenticated agent ID:', error);
        }
        
        // Fallback: check if running in iframe and try to communicate with parent
        try {
            if (window.parent && window.parent !== window) {
                // We're in an iframe, try to get user from parent
                const parentAgentUser = window.parent.localStorage?.getItem(STORAGE_KEYS.AGENT_USER);
                if (parentAgentUser) {
                    const user = JSON.parse(parentAgentUser);
                    if (user.email) {
                        console.log(`Using agent ID from parent: ${user.email.split('@')[0]}`);
                        return user.email.split('@')[0];
                    }
                }
            }
        } catch (error) {
            console.warn('Could not access parent window for agent ID:', error);
        }
        
        // Final fallback: generate random ID (for development/standalone use)
        console.warn('No authenticated user found, generating random agent ID');
        return DEFAULTS.AGENT_ID_PREFIX + Math.random().toString(36).substring(2, DEFAULTS.RANDOM_ID_LENGTH);
    }

    /**
     * Get stored authentication token
     * @returns {string|null} Authentication token
     */
    getStoredToken() {
        return localStorage.getItem(STORAGE_KEYS.AGENT_TOKEN);
    }

    /**
     * Check if current user is admin and show admin bar
     * Maintains exact same logic as original implementation
     * @returns {Promise<boolean>} Whether user is admin
     */
    async checkAdminStatus() {
        try {
            const token = this.getStoredToken();
            if (!token) {
                console.log('❌ No token available for admin check');
                return false;
            }

            console.log('🔍 Checking admin status...');
            const response = await fetch(`${this.apiUrl}${API_ENDPOINTS.AUTH_PROFILE}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                const user = data.data;
                console.log('👤 User profile:', user);
                
                if (user && user.role === 'admin') {
                    console.log('✅ User is admin, showing admin bar');
                    this.isAdmin = true;
                    
                    // Show admin bar if it exists
                    const adminBar = document.getElementById('adminBar');
                    if (adminBar) {
                        adminBar.classList.remove('hidden');
                    }
                    
                    return true;
                } else {
                    console.log('❌ User is not admin, role:', user?.role);
                    this.isAdmin = false;
                    return false;
                }
            } else {
                console.log('❌ Failed to get user profile:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
    }

    /**
     * Get current agent ID
     * @returns {string} Current agent ID
     */
    getAgentId() {
        return this.agentId;
    }

    /**
     * Get current token
     * @returns {string|null} Current token
     */
    getToken() {
        return this.token;
    }

    /**
     * Check if current user is admin
     * @returns {boolean} Whether user is admin
     */
    getIsAdmin() {
        return this.isAdmin;
    }

    /**
     * Refresh authentication state
     * Re-reads agent ID and token from storage
     */
    refresh() {
        this.agentId = this.getAuthenticatedAgentId();
        this.token = this.getStoredToken();
        console.log(`🔄 Auth refreshed - Agent: ${this.agentId}, Has token: ${!!this.token}`);
    }
}