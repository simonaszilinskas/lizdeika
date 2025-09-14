/**
 * State Manager for Agent Dashboard
 * Centralized state management for all dashboard state
 * Extracted from agent-dashboard.js for better organization
 */

// Import constants
import { FILTERS, DEFAULTS } from './ui/constants.js';

export class StateManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        
        // Filter state
        this.currentFilter = FILTERS.DEFAULT_FILTER; // Current conversation filter (mine, unassigned, others, all)
        this.archiveFilter = DEFAULTS.ARCHIVE_FILTER; // Archive filter (active, archived)
        
        // Selection state
        this.selectedConversations = new Set(); // Track selected conversations for bulk operations
        
        // Conversation state
        this.conversations = new Map(); // Map of loaded conversation data
        this.allConversations = []; // Store all conversations for filtering
        
        // UI state
        this.currentChatId = null; // Currently selected conversation ID
        this.currentSuggestion = null; // Current AI suggestion being displayed
    }

    // ===== FILTER STATE MANAGEMENT =====

    /**
     * Set current conversation filter
     * @param {string} filter - Filter type (mine, unassigned, others, all)
     */
    setFilter(filter) {
        console.log(`🔽 StateManager.setFilter called with filter: ${filter}`);
        this.currentFilter = filter;
        
        // Persist filter to localStorage
        localStorage.setItem('agent_dashboard_filter', filter);
        
        this.updateFilterButtons();
        this.applyFilter();
    }

    /**
     * Get current conversation filter
     * @returns {string} Current filter
     */
    getCurrentFilter() {
        return this.currentFilter;
    }

    /**
     * Toggle between active and archived conversations
     */
    toggleArchiveFilter() {
        this.archiveFilter = this.archiveFilter === 'active' ? 'archived' : 'active';
        
        // Persist archive filter to localStorage
        localStorage.setItem('agent_dashboard_archive_filter', this.archiveFilter);
        
        // Update archive icon style
        const archiveToggle = document.getElementById('archive-toggle');
        if (archiveToggle) {
            if (this.archiveFilter === 'archived') {
                archiveToggle.className = 'text-orange-600 hover:text-orange-800 transition-colors';
                archiveToggle.title = 'Switch to Active View';
            } else {
                archiveToggle.className = 'text-gray-600 hover:text-gray-800 transition-colors';
                archiveToggle.title = 'Switch to Archived View';
            }
        }

        // Update filter button states - disable assignment filters in archived view
        const filterMap = FILTERS.FILTER_BUTTON_MAP;
        Object.entries(filterMap).forEach(([filterName, buttonId]) => {
            const button = document.getElementById(buttonId);
            if (button) {
                if (this.archiveFilter === 'archived') {
                    button.disabled = true;
                    button.className = button.className.replace(/bg-\w+-\d+/g, 'bg-gray-200').replace(/text-\w+-\d+/g, 'text-gray-500');
                } else {
                    button.disabled = false;
                    // Restore original styling
                    if (buttonId === filterMap[this.currentFilter]) {
                        button.className = 'flex-1 text-xs px-2 py-1.5 rounded bg-blue-100 text-blue-800 font-medium transition hover:bg-blue-200';
                    } else {
                        button.className = 'flex-1 text-xs px-2 py-1.5 rounded bg-gray-100 text-gray-700 transition hover:bg-gray-200';
                    }
                }
            }
        });
        
        // Update filter button styles if we're switching back to active
        if (this.archiveFilter === 'active') {
            this.updateFilterButtons();
        }

        // Apply the filter
        this.applyFilter();
    }

    /**
     * Get current archive filter
     * @returns {string} Archive filter (active/archived)
     */
    getArchiveFilter() {
        return this.archiveFilter;
    }

    /**
     * Update filter button styles based on current filter
     */
    updateFilterButtons() {
        const filterMap = FILTERS.FILTER_BUTTON_MAP;
        
        Object.entries(filterMap).forEach(([filterName, buttonId]) => {
            const button = document.getElementById(buttonId);
            if (button) {
                if (buttonId === filterMap[this.currentFilter]) {
                    // Active button styling
                    button.className = 'flex-1 text-xs px-2 py-1.5 rounded bg-blue-100 text-blue-800 font-medium transition hover:bg-blue-200';
                } else {
                    // Inactive button styling
                    button.className = 'flex-1 text-xs px-2 py-1.5 rounded bg-gray-100 text-gray-700 transition hover:bg-gray-200';
                }
            }
        });
    }

    /**
     * Apply current filter to conversations
     */
    applyFilter() {
        console.log(`🔍 StateManager.applyFilter called - current filter: ${this.currentFilter}, total conversations: ${this.allConversations.length}`);
        
        const filters = {
            archiveFilter: this.archiveFilter,
            assignmentFilter: this.currentFilter,
            agentId: this.dashboard.agentId
        };

        // Use modern conversation loader for filtering
        this.dashboard.modernConversationLoader.reapplyFilters(filters, (conversations) => {
            this.dashboard.conversationRenderer.renderQueue(conversations);
        });
    }

    // ===== SELECTION STATE MANAGEMENT =====

    /**
     * Toggle conversation selection for bulk operations
     * @param {string} conversationId - Conversation ID to toggle
     */
    toggleConversationSelection(conversationId) {
        if (this.selectedConversations.has(conversationId)) {
            this.selectedConversations.delete(conversationId);
        } else {
            this.selectedConversations.add(conversationId);
        }
        
        // Update select-all checkbox state
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            // Get all filtered conversations
            const filteredConversations = this.dashboard.filterConversations(this.allConversations, this.currentFilter);
            const filteredIds = new Set(filteredConversations.map(conv => conv.id));
            
            // Check if all filtered conversations are selected
            const allSelected = filteredConversations.length > 0 && 
                filteredConversations.every(conv => this.selectedConversations.has(conv.id));
            selectAllCheckbox.checked = allSelected;
            
            // Set indeterminate state if some but not all filtered conversations are selected
            const selectedFromFilter = Array.from(this.selectedConversations).filter(id => filteredIds.has(id));
            const someSelected = selectedFromFilter.length > 0 && selectedFromFilter.length < filteredConversations.length;
            selectAllCheckbox.indeterminate = someSelected;
        }
        
        this.updateSelectionUI();
    }

    /**
     * Select or deselect all conversations based on current filter
     * @param {boolean} selectAll - Whether to select all or deselect all
     */
    toggleSelectAll(selectAll) {
        if (selectAll) {
            // Get all conversations that match current filters
            const filteredConversations = this.dashboard.filterConversations(this.allConversations, this.currentFilter);
            
            // Select all filtered conversations (not just visible in DOM)
            filteredConversations.forEach(conv => {
                this.selectedConversations.add(conv.id);
            });
        } else {
            // Deselect all
            this.selectedConversations.clear();
        }
        
        // Re-render to update checkboxes
        this.applyFilter();
        this.updateSelectionUI();
    }

    /**
     * Get currently selected conversation IDs
     * @returns {Set} Set of selected conversation IDs
     */
    getSelectedConversations() {
        return new Set(this.selectedConversations); // Return copy to prevent external mutation
    }

    /**
     * Clear all selected conversations
     */
    clearSelection() {
        this.selectedConversations.clear();
        this.updateSelectionUI();
        this.applyFilter(); // Re-render to update checkboxes
    }

    /**
     * Update selection UI elements
     */
    updateSelectionUI() {
        // This could be expanded in the future to update selection counts, etc.
        // For now, it's a placeholder for selection-related UI updates
    }

    // ===== CONVERSATION STATE MANAGEMENT =====

    /**
     * Set all conversations data
     * @param {Array} conversations - Array of all conversations
     */
    setAllConversations(conversations) {
        this.allConversations = conversations;
    }

    /**
     * Get all conversations
     * @returns {Array} All conversations
     */
    getAllConversations() {
        return this.allConversations;
    }

    /**
     * Update conversation in the conversations Map
     * @param {string} conversationId - Conversation ID
     * @param {Object} conversationData - Conversation data
     */
    setConversation(conversationId, conversationData) {
        this.conversations.set(conversationId, conversationData);
    }

    /**
     * Get conversation from the conversations Map
     * @param {string} conversationId - Conversation ID
     * @returns {Object|undefined} Conversation data
     */
    getConversation(conversationId) {
        return this.conversations.get(conversationId);
    }

    // ===== UI STATE MANAGEMENT =====

    /**
     * Set current chat ID and handle related state changes
     * @param {string|null} conversationId - Conversation ID or null to clear
     */
    setCurrentChatId(conversationId) {
        const previousChatId = this.currentChatId;
        this.currentChatId = conversationId;

        // Refresh styling for previously selected conversation to remove active state
        if (previousChatId && previousChatId !== conversationId && this.dashboard.conversationRenderer) {
            this.dashboard.conversationRenderer.refreshConversationStyling(previousChatId);
        }

        // Persist to localStorage
        if (conversationId) {
            localStorage.setItem('agent_dashboard_current_chat', conversationId);
        } else {
            localStorage.removeItem('agent_dashboard_current_chat');
            // Clear related state when chat is deselected
            this.currentSuggestion = null;
        }
    }

    /**
     * Get current chat ID
     * @returns {string|null} Current chat ID
     */
    getCurrentChatId() {
        return this.currentChatId;
    }
    
    /**
     * Restore previously selected conversation from localStorage
     * @returns {string|null} Restored conversation ID
     */
    restoreCurrentChatId() {
        const savedChatId = localStorage.getItem('agent_dashboard_current_chat');
        if (savedChatId) {
            // Don't use setCurrentChatId here to avoid re-saving to localStorage
            this.currentChatId = savedChatId;
            return savedChatId;
        }
        return null;
    }
    
    /**
     * Restore filter states from localStorage
     */
    restoreFilterStates() {
        // Restore conversation filter
        const savedFilter = localStorage.getItem('agent_dashboard_filter');
        if (savedFilter) {
            this.currentFilter = savedFilter;
            console.log(`🔄 Restored filter: ${savedFilter}`);
        }
        
        // Restore archive filter
        const savedArchiveFilter = localStorage.getItem('agent_dashboard_archive_filter');
        if (savedArchiveFilter) {
            this.archiveFilter = savedArchiveFilter;
            console.log(`🔄 Restored archive filter: ${savedArchiveFilter}`);
        }
        
        // Update UI to reflect restored filters
        this.updateFilterButtons();
    }

    /**
     * Reset chat view - clear current chat and suggestions
     */
    resetChatView() {
        const previousChatId = this.currentChatId;
        this.currentChatId = null;
        this.currentSuggestion = null;

        // Refresh styling for previously selected conversation to remove active state
        if (previousChatId && this.dashboard.conversationRenderer) {
            this.dashboard.conversationRenderer.refreshConversationStyling(previousChatId);
        }

        this.dashboard.showElement('no-chat-selected');
        this.dashboard.hideElement('chat-header');
        this.dashboard.hideElement('chat-messages');
        this.dashboard.hideElement('message-input-container');
        this.dashboard.hideElement('ai-suggestion-panel');
    }

    /**
     * Set current AI suggestion
     * @param {string|null} suggestion - AI suggestion text or null to clear
     */
    setCurrentSuggestion(suggestion) {
        this.currentSuggestion = suggestion;
    }

    /**
     * Get current AI suggestion
     * @returns {string|null} Current AI suggestion
     */
    getCurrentSuggestion() {
        return this.currentSuggestion;
    }

    /**
     * Clear current AI suggestion
     */
    clearCurrentSuggestion() {
        this.currentSuggestion = null;
    }

    // ===== UTILITY METHODS =====

    /**
     * Get current state summary for debugging
     * @returns {Object} State summary
     */
    getStateDebugInfo() {
        return {
            currentFilter: this.currentFilter,
            archiveFilter: this.archiveFilter,
            selectedConversationsCount: this.selectedConversations.size,
            selectedConversationIds: Array.from(this.selectedConversations),
            allConversationsCount: this.allConversations.length,
            conversationsMapSize: this.conversations.size,
            currentChatId: this.currentChatId,
            hasSuggestion: !!this.currentSuggestion
        };
    }

    /**
     * Reset all state to defaults
     */
    resetState() {
        this.currentFilter = FILTERS.DEFAULT_FILTER;
        this.archiveFilter = DEFAULTS.ARCHIVE_FILTER;
        this.selectedConversations.clear();
        this.conversations.clear();
        this.allConversations = [];
        this.currentChatId = null;
        this.currentSuggestion = null;
    }
}