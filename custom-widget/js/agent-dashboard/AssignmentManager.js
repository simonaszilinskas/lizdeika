/**
 * Assignment Manager for Agent Dashboard
 * Handles all conversation assignment, unassignment, and archiving operations
 * Extracted from agent-dashboard.js for better modularity
 */

export class AssignmentManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.stateManager = dashboard.stateManager;
        this.apiManager = dashboard.apiManager;
        this.uiHelpers = dashboard.uiHelpers;
        this.modernConversationLoader = dashboard.modernConversationLoader;
    }

    /**
     * Toggle assignment dropdown visibility
     * @param {string} conversationId - Conversation ID
     * @param {Event} event - Click event
     */
    async toggleAssignDropdown(conversationId, event) {
        await this.uiHelpers.toggleAssignDropdown(conversationId, event);
    }

    /**
     * Assign conversation to specific agent
     * @param {string} conversationId - ID of conversation to assign
     * @param {string} agentId - ID of agent to assign to
     * @param {Event} event - Click event to prevent propagation
     */
    async assignToAgent(conversationId, agentId, event) {
        if (event) {
            event.stopPropagation();
        }
        
        // Close dropdown
        const dropdown = document.getElementById(`assign-dropdown-${conversationId}`);
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
        
        try {
            console.log('🔄 Assigning conversation:', conversationId, 'to agent:', agentId);
            await this.apiManager.assignConversation(conversationId, agentId, false);
            console.log('✅ Assignment to agent successful, refreshing conversation list...');
            
            // Clear modern loader cache to force fresh data
            this.modernConversationLoader.refresh();
            await this.dashboard.loadConversations();
            console.log('✅ Conversation list refreshed after assignment to agent');
        } catch (error) {
            this.handleAssignmentError(error, 'assign');
        }
    }

    /**
     * Unassign conversation (assign to nobody) via dropdown
     * @param {string} conversationId - ID of conversation to unassign
     * @param {Event} event - Click event to prevent propagation
     */
    async unassignFromDropdown(conversationId, event) {
        if (event) {
            event.stopPropagation();
        }
        
        // Close dropdown
        const dropdown = document.getElementById(`assign-dropdown-${conversationId}`);
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
        
        try {
            console.log('🔄 Unassigning conversation:', conversationId);
            await this.apiManager.unassignConversation(conversationId);
            console.log('✅ Unassignment successful, refreshing conversation list...');
            
            // Clear modern loader cache to force fresh data
            this.modernConversationLoader.refresh();
            await this.dashboard.loadConversations();
            console.log('✅ Conversation list refreshed after unassignment');
        } catch (error) {
            this.handleAssignmentError(error, 'unassign');
        }
    }

    /**
     * Assign conversation to current agent
     * @param {string} conversationId - ID of conversation to assign
     * @param {Event} event - Click event to prevent propagation
     */
    async assignConversation(conversationId, event) {
        if (event) {
            event.stopPropagation(); // Prevent selecting the chat
        }
        
        try {
            console.log('🔄 Assigning conversation:', conversationId, 'to agent:', this.dashboard.agentId);
            await this.apiManager.assignConversation(conversationId, this.dashboard.agentId, true);
            console.log('✅ Assignment successful, refreshing conversation list...');
            
            // Clear modern loader cache to force fresh data
            this.modernConversationLoader.refresh();
            await this.dashboard.loadConversations();
            console.log('✅ Conversation list refreshed after assignment');
        } catch (error) {
            this.handleAssignmentError(error, 'assign');
        }
    }

    /**
     * Unassign conversation from current agent
     * @param {string} conversationId - ID of conversation to unassign
     * @param {Event} event - Click event to prevent propagation
     */
    async unassignConversation(conversationId, event) {
        if (event) {
            event.stopPropagation(); // Prevent selecting the chat
        }
        
        try {
            console.log('🔄 Unassigning conversation:', conversationId, 'from agent:', this.dashboard.agentId);
            await this.apiManager.unassignConversation(conversationId);
            console.log('✅ Unassignment successful, refreshing conversation list...');
            
            // If we're unassigning the current chat, reset the view
            if (conversationId === this.stateManager.getCurrentChatId()) {
                this.resetChatView();
            }
            
            // Clear modern loader cache to force fresh data
            this.modernConversationLoader.refresh();
            await this.dashboard.loadConversations();
            console.log('✅ Conversation list refreshed after unassignment');
        } catch (error) {
            this.handleAssignmentError(error, 'unassign');
        }
    }

    /**
     * Archive conversation
     * @param {string} conversationId - ID of conversation to archive
     * @param {Event} event - Click event to prevent propagation
     */
    async archiveConversation(conversationId, event) {
        if (event) {
            event.stopPropagation(); // Prevent selecting the chat
        }
        
        try {
            console.log('📁 Archiving conversation:', conversationId);
            await this.apiManager.bulkArchiveConversations([conversationId]);
            console.log(`✅ Archived conversation successfully`);
            console.log('✅ Archive operation successful, refreshing conversation list...');
            
            // Refresh the modern conversation loader cache before loading
            this.modernConversationLoader.refresh();
            await this.dashboard.loadConversations();
            console.log('✅ Conversation list refreshed after archive operation');
        } catch (error) {
            console.error('Error archiving conversation:', error);
            this.dashboard.showToast('Error archiving conversation', 'error');
        }
    }

    /**
     * Unarchive conversation
     * @param {string} conversationId - ID of conversation to unarchive
     * @param {Event} event - Click event to prevent propagation
     */
    async unarchiveConversation(conversationId, event) {
        if (event) {
            event.stopPropagation(); // Prevent selecting the chat
        }
        
        try {
            console.log('📂 Unarchiving conversation:', conversationId);
            await this.apiManager.bulkUnarchiveConversations([conversationId]);
            console.log(`✅ Unarchived conversation successfully`);
            console.log('✅ Unarchive operation successful, refreshing conversation list...');
            this.modernConversationLoader.refresh();
            await this.dashboard.loadConversations();
            console.log('✅ Conversation list refreshed after unarchive operation');
        } catch (error) {
            this.dashboard.bulkOperations.handleBulkOperationError(error, 'unarchive');
        }
    }

    /**
     * Refresh a single conversation data from server
     * @param {string} conversationId - Conversation ID to refresh
     */
    async refreshConversation(conversationId) {
        try {
            const data = await this.apiManager.loadConversationsData();
            const updatedConv = data.conversations.find(c => c.id === conversationId);
            
            if (updatedConv) {
                // Update the conversation in our local Map
                this.stateManager.setConversation(conversationId, updatedConv);
                
                // Update UI if this is the current conversation
                if (this.stateManager.getCurrentChatId() === conversationId) {
                    // UI updates would go here if needed
                }
            }
        } catch (error) {
            console.error('Error refreshing conversation:', error);
        }
    }

    /**
     * Handle assignment errors with consistent error messaging
     * @param {Error} error - Error object
     * @param {string} action - Action being performed ('assign', 'unassign')
     */
    handleAssignmentError(error, action) {
        console.error(`Error ${action}ing conversation:`, error);
        
        let message;
        if (error.message && error.message.includes('404')) {
            message = 'Conversation not found. It may have been deleted.';
        } else if (error.message && error.message.includes('403')) {
            message = 'Permission denied. You may not have access to this conversation.';
        } else if (error.message && error.message.includes('already assigned')) {
            message = 'Conversation is already assigned to another agent.';
        } else {
            message = `Failed to ${action} conversation. Please try again.`;
        }
        
        this.dashboard.showToast(message, 'error');
    }

    /**
     * Assign category to conversation
     * @param {string} conversationId - Conversation ID
     * @param {string} categoryId - Category ID (null to remove category)
     * @param {Event} event - Click event to prevent propagation
     */
    async assignCategory(conversationId, categoryId, event) {
        if (event) {
            event.stopPropagation();
        }

        // Close category dropdown
        const dropdown = document.getElementById(`category-dropdown-${conversationId}`);
        if (dropdown) {
            dropdown.classList.add('hidden');
        }

        try {
            console.log('🏷️ Assigning category:', categoryId, 'to conversation:', conversationId);
            await this.apiManager.assignCategory(conversationId, categoryId);
            console.log('✅ Category assignment successful, refreshing conversation list...');

            // Clear modern loader cache to force fresh data
            this.modernConversationLoader.refresh();
            await this.dashboard.loadConversations();
            console.log('✅ Conversation list refreshed after category assignment');
        } catch (error) {
            this.handleAssignmentError(error, 'assign category to');
        }
    }

    /**
     * Toggle category dropdown visibility
     * @param {string} conversationId - Conversation ID
     * @param {Event} event - Click event
     */
    async toggleCategoryDropdown(conversationId, event) {
        if (event) {
            event.stopPropagation();
        }

        const dropdown = document.getElementById(`category-dropdown-${conversationId}`);
        if (!dropdown) {
            console.error('Category dropdown not found for conversation:', conversationId);
            return;
        }

        // Toggle visibility
        const isHidden = dropdown.classList.contains('hidden');

        // Hide all other dropdowns first
        document.querySelectorAll('[id^="category-dropdown-"]').forEach(d => {
            if (d.id !== `category-dropdown-${conversationId}`) {
                d.classList.add('hidden');
            }
        });

        if (isHidden) {
            // Load categories and populate dropdown
            try {
                const categories = await this.apiManager.loadCategories();
                dropdown.innerHTML = this.renderCategoryOptions(conversationId, categories);

                // Position dropdown using fixed positioning
                const button = event.target.closest('button');
                if (button) {
                    const rect = button.getBoundingClientRect();
                    dropdown.style.position = 'fixed';
                    dropdown.style.top = `${rect.bottom + 4}px`;
                    dropdown.style.left = `${rect.left}px`;
                    dropdown.style.width = 'auto';
                    dropdown.style.minWidth = '160px';
                }

                dropdown.classList.remove('hidden');
            } catch (error) {
                console.error('Failed to load categories:', error);
                dropdown.innerHTML = '<div class="px-3 py-2 text-xs text-gray-500">Error loading categories</div>';
                dropdown.classList.remove('hidden');
            }
        } else {
            dropdown.classList.add('hidden');
        }
    }

    /**
     * Render category dropdown options
     * @param {string} conversationId - Conversation ID
     * @param {Array} categories - Array of category objects
     * @returns {string} HTML string for category options
     */
    renderCategoryOptions(conversationId, categories) {
        if (!categories || categories.length === 0) {
            return '<div class="px-3 py-2 text-xs text-gray-500">No categories available</div>';
        }

        let html = `
            <div onclick="dashboard.assignmentManager.assignCategory('${conversationId}', null, event)"
                 class="px-3 py-2 text-xs hover:bg-gray-100 cursor-pointer border-b border-gray-100">
                <span class="text-gray-500">No Category</span>
            </div>
        `;

        categories.forEach(category => {
            const colorStyle = category.color ? `style="color: ${category.color};"` : '';
            html += `
                <div onclick="dashboard.assignmentManager.assignCategory('${conversationId}', '${category.id}', event)"
                     class="px-3 py-2 text-xs hover:bg-gray-100 cursor-pointer flex items-center gap-2">
                    <div class="w-3 h-3 rounded-full" style="background-color: ${category.color || '#6B7280'};"></div>
                    <span ${colorStyle}>${category.name}</span>
                </div>
            `;
        });

        return html;
    }

    /**
     * Reset chat view - delegate to state manager
     */
    resetChatView() {
        this.stateManager.resetChatView();
    }
}