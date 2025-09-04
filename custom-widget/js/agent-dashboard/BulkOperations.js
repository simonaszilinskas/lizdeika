/**
 * Bulk Operations Manager for Agent Dashboard
 * Handles bulk archive, unarchive, and assignment operations
 * Extracted from agent-dashboard.js for better modularity
 */
export class BulkOperations {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.apiUrl = dashboard.apiUrl;
        this.agentId = dashboard.agentId;
        this.stateManager = dashboard.stateManager;
        this.connectedAgents = dashboard.connectedAgents;
        this.modernConversationLoader = dashboard.modernConversationLoader;
    }

    /**
     * Clear all conversation selections
     */
    clearAllSelections() {
        this.stateManager.clearSelection();
        
        // Also uncheck the Select All checkbox if it exists
        const selectAllCheckbox = document.getElementById('select-all');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
        }
        
        this.updateBulkActionsPanel();
        this.updateSelectionUI();
    }

    /**
     * Update the bulk actions panel visibility and content
     */
    updateBulkActionsPanel() {
        const panel = document.getElementById('bulk-actions-panel');
        const selectedCount = this.stateManager.getSelectedConversations().size;
        
        if (selectedCount > 0) {
            panel.classList.remove('hidden');
            document.getElementById('selected-count').textContent = selectedCount;
            // Update buttons when panel becomes visible
            this.updateBulkActionButtons();
        } else {
            panel.classList.add('hidden');
        }
    }
    
    /**
     * Update bulk action buttons based on archive filter
     */
    updateBulkActionButtons() {
        const archiveBtn = document.getElementById('bulk-archive');
        const unarchiveBtn = document.getElementById('bulk-unarchive');
        const assignMeBtn = document.getElementById('bulk-assign-me');
        const assignAgentDropdown = document.getElementById('bulk-assign-agent');
        
        if (this.stateManager.getArchiveFilter() === 'archived') {
            // In archive view - only show unarchive button
            if (archiveBtn) archiveBtn.style.display = 'none';
            if (unarchiveBtn) unarchiveBtn.style.display = 'block';
            if (assignMeBtn) assignMeBtn.style.display = 'none';
            if (assignAgentDropdown) assignAgentDropdown.style.display = 'none';
        } else {
            // In active view - show archive and assign buttons
            if (archiveBtn) archiveBtn.style.display = 'block';
            if (unarchiveBtn) unarchiveBtn.style.display = 'none';
            if (assignMeBtn) assignMeBtn.style.display = 'block';
            if (assignAgentDropdown) {
                assignAgentDropdown.style.display = 'block';
                // Populate agents dropdown if not already populated
                this.populateAgentsDropdown();
            }
        }
    }
    
    /**
     * Populate the agents dropdown with available agents
     */
    populateAgentsDropdown() {
        const dropdown = document.getElementById('bulk-assign-agent');
        if (!dropdown || dropdown.options.length > 1) return; // Already populated
        
        // Clear and add default option
        dropdown.innerHTML = '<option value="">Assign to...</option>';
        
        // Add connected agents from our tracking
        this.connectedAgents.forEach((status, agentEmail) => {
            if (agentEmail !== this.agentId) { // Don't include self
                const option = document.createElement('option');
                option.value = agentEmail;
                option.textContent = agentEmail.split('@')[0]; // Show just the username part
                dropdown.appendChild(option);
            }
        });
        
        // If no other agents, add a disabled message
        if (dropdown.options.length === 1) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No other agents online';
            option.disabled = true;
            dropdown.appendChild(option);
        }
    }

    /**
     * Update selection UI (checkboxes)
     */
    updateSelectionUI() {
        document.querySelectorAll('.conversation-checkbox').forEach(checkbox => {
            const conversationId = checkbox.dataset.conversationId;
            checkbox.checked = this.stateManager.getSelectedConversations().has(conversationId);
        });
    }

    /**
     * Bulk archive selected conversations
     */
    async bulkArchiveConversations() {
        const selectedIds = Array.from(this.stateManager.getSelectedConversations());
        if (selectedIds.length === 0) return;

        try {
            const response = await fetch(`${this.apiUrl}/api/admin/conversations/bulk-archive`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('agent_token')}`
                },
                body: JSON.stringify({ conversationIds: selectedIds })
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Archived ${result.data.archivedCount} conversations`);
                this.clearAllSelections();
                console.log('✅ Archive operation successful, refreshing conversation list...');
                this.modernConversationLoader.refresh();
                await this.dashboard.loadConversations();
                console.log('✅ Conversation list refreshed after archive operation');
            } else {
                const errorText = await response.text();
                console.error('Failed to archive conversations:', response.status, errorText);
                this.dashboard.showToast(`Failed to archive conversations: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            this.handleBulkOperationError(error, 'archive');
        }
    }

    /**
     * Bulk unarchive selected conversations
     */
    async bulkUnarchiveConversations() {
        const selectedIds = Array.from(this.stateManager.getSelectedConversations());
        if (selectedIds.length === 0) return;

        try {
            const response = await fetch(`${this.apiUrl}/api/admin/conversations/bulk-unarchive`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('agent_token')}`
                },
                body: JSON.stringify({ conversationIds: selectedIds })
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Unarchived ${result.data.unarchivedCount} conversations`);
                this.clearAllSelections();
                console.log('✅ Unarchive operation successful, refreshing conversation list...');
                this.modernConversationLoader.refresh();
                await this.dashboard.loadConversations();
                console.log('✅ Conversation list refreshed after unarchive operation');
            } else {
                const errorText = await response.text();
                console.error('Failed to unarchive conversations:', response.status, errorText);
                this.dashboard.showToast(`Failed to unarchive conversations: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            this.handleBulkOperationError(error, 'unarchive');
        }
    }

    /**
     * Bulk assign selected conversations to current agent
     */
    async bulkAssignToMe() {
        await this.bulkAssignToAgent(this.agentId);
    }
    
    /**
     * Bulk assign selected conversations to specific agent
     */
    async bulkAssignToAgent(agentId) {
        const selectedIds = Array.from(this.stateManager.getSelectedConversations());
        if (selectedIds.length === 0) return;

        try {
            const response = await fetch(`${this.apiUrl}/api/admin/conversations/bulk-assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('agent_token')}`
                },
                body: JSON.stringify({ 
                    conversationIds: selectedIds,
                    agentId: agentId
                })
            });

            if (response.ok) {
                const result = await response.json();
                const assignedTo = agentId === this.agentId ? 'me' : agentId.split('@')[0];
                console.log(`✅ Assigned ${result.data.assignedCount} conversations to ${assignedTo}`);
                this.clearAllSelections();
                console.log('✅ Bulk assign operation successful, refreshing conversation list...');
                this.modernConversationLoader.refresh();
                await this.dashboard.loadConversations();
                console.log('✅ Conversation list refreshed after bulk assign operation');
            } else {
                const errorText = await response.text();
                console.error('Failed to assign conversations:', response.status, errorText);
                this.dashboard.showToast(`Failed to assign conversations: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            this.handleBulkOperationError(error, 'assign');
        }
    }

    /**
     * Handle errors in bulk operations
     * @param {Error} error - The error that occurred
     * @param {string} operation - The operation that failed ('archive', 'unarchive', 'assign')
     */
    handleBulkOperationError(error, operation = 'process') {
        console.error(`Error ${operation}ing conversations:`, error);
        
        // Show user-friendly error message
        let errorMessage = `Failed to ${operation} conversations. Please try again.`;
        
        if (error.message.includes('403')) {
            errorMessage = `You are not authorized to ${operation} these conversations.`;
        } else if (error.message.includes('404')) {
            errorMessage = 'Some conversations no longer exist.';
        } else if (error.message.includes('500')) {
            errorMessage = 'Server error. Please try again in a moment.';
        } else if (error.name === 'TypeError') {
            errorMessage = 'Network error. Please check your connection and try again.';
        }
        
        this.dashboard.showToast(errorMessage, 'error');
    }
}