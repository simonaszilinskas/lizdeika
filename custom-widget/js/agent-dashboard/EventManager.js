/**
 * Event Manager for Agent Dashboard
 * Handles all event listeners and their setup
 * Extracted from agent-dashboard.js for better modularity
 */
export class EventManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.bulkOperations = dashboard.bulkOperations;
        this.debugManager = dashboard.debugManager;
    }

    /**
     * Initialize all event listeners
     */
    initializeAllEventListeners() {
        this.setupPersonalStatusListener();
        this.setupFilterButtonListeners();
        this.setupMessageFormListener();
        this.setupAIAssistanceListener();
        this.setupAISuggestionListeners();
        this.setupTextareaAutoResize();
        this.setupGlobalClickListener();
        this.setupArchiveToggleListener();
        this.setupBulkActionListeners();
    }

    /**
     * Setup personal status change listener
     */
    setupPersonalStatusListener() {
        const personalStatusSelect = document.getElementById('personal-status');
        if (personalStatusSelect) {
            personalStatusSelect.addEventListener('change', (e) => {
                this.dashboard.updatePersonalStatus(e.target.value);
            });
        }
    }

    /**
     * Setup filter button listeners
     */
    setupFilterButtonListeners() {
        const filterButtons = document.querySelectorAll('[data-filter]');
        console.log(`🔘 Found ${filterButtons.length} filter buttons`);
        filterButtons.forEach((button, index) => {
            const filter = button.getAttribute('data-filter');
            console.log(`🔘 Adding event listener to button ${index} with filter: ${filter}`);
            button.addEventListener('click', (e) => {
                const clickedFilter = e.target.getAttribute('data-filter');
                console.log(`🔘 Filter button clicked: ${clickedFilter}`);
                this.dashboard.setFilter(clickedFilter);
            });
        });
    }

    /**
     * Setup message form submission listener
     */
    setupMessageFormListener() {
        const messageForm = document.getElementById('message-form');
        if (messageForm) {
            messageForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.dashboard.sendMessage();
            });
        }
    }

    /**
     * Setup AI assistance button listener
     */
    setupAIAssistanceListener() {
        const aiAssistBtn = document.getElementById('ai-assist-btn');
        if (aiAssistBtn) {
            aiAssistBtn.addEventListener('click', () => {
                this.dashboard.getAIAssistance();
            });
        }
    }

    /**
     * Setup AI suggestion panel event listeners
     */
    setupAISuggestionListeners() {
        const sendAsIsBtn = document.getElementById('send-as-is-btn');
        const editSuggestionBtn = document.getElementById('edit-suggestion-btn');
        const writeFromScratchBtn = document.getElementById('write-from-scratch-btn');
        const debugToggleBtn = document.getElementById('debug-toggle-btn');
        const debugCloseBtn = document.getElementById('debug-modal-close');

        if (sendAsIsBtn) {
            sendAsIsBtn.addEventListener('click', () => this.dashboard.sendAsIs());
        }

        if (editSuggestionBtn) {
            editSuggestionBtn.addEventListener('click', () => this.dashboard.editSuggestion());
        }

        if (writeFromScratchBtn) {
            writeFromScratchBtn.addEventListener('click', () => this.dashboard.writeFromScratch());
        }

        if (debugToggleBtn) {
            debugToggleBtn.addEventListener('click', () => this.debugManager.toggleDebugPanel());
        }

        if (debugCloseBtn) {
            debugCloseBtn.addEventListener('click', () => this.debugManager.hideDebugModal());
        }
        
        // Close debug modal on escape key or click outside
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.debugManager.hideDebugModal();
            }
        });
        
        const debugModal = document.getElementById('debug-modal');
        if (debugModal) {
            debugModal.addEventListener('click', (e) => {
                if (e.target === debugModal) {
                    this.debugManager.hideDebugModal();
                }
            });
        }
    }

    /**
     * Setup auto-resize functionality for textarea
     */
    setupTextareaAutoResize() {
        const textarea = document.getElementById('message-input');
        if (textarea) {
            let typingTimer;
            
            // Auto-resize textarea that expands upward
            textarea.addEventListener('input', () => {
                this.dashboard.resizeTextarea();
            });
            
            // Send typing status
            textarea.addEventListener('input', () => {
                this.dashboard.sendTypingStatus(true);
                
                // Clear existing timer
                clearTimeout(typingTimer);
                
                // Set timer to stop typing after 1 second of inactivity
                typingTimer = setTimeout(() => {
                    this.dashboard.sendTypingStatus(false);
                }, 1000);
            });
            
            textarea.addEventListener('blur', () => {
                this.dashboard.sendTypingStatus(false);
                clearTimeout(typingTimer);
            });
            
            // Initialize with proper height
            this.dashboard.resizeTextarea();
        }
    }

    /**
     * Setup global click listener for closing dropdowns
     */
    setupGlobalClickListener() {
        // Close assignment dropdowns when clicking elsewhere
        document.addEventListener('click', (e) => {
            if (!e.target.closest('[id^="assign-dropdown-"]') && !e.target.closest('button[onclick*="toggleAssignDropdown"]')) {
                document.querySelectorAll('[id^="assign-dropdown-"]').forEach(dropdown => {
                    dropdown.classList.add('hidden');
                });
            }
        });
    }

    /**
     * Setup archive toggle listener
     */
    setupArchiveToggleListener() {
        const archiveToggle = document.getElementById('archive-toggle');
        if (archiveToggle) {
            archiveToggle.addEventListener('click', () => this.dashboard.toggleArchiveFilter());
        }
    }

    /**
     * Setup bulk action listeners
     */
    setupBulkActionListeners() {
        const selectAllCheckbox = document.getElementById('select-all');
        const clearSelectionBtn = document.getElementById('clear-selection');
        const bulkArchiveBtn = document.getElementById('bulk-archive');
        const bulkUnarchiveBtn = document.getElementById('bulk-unarchive');
        const bulkAssignMeBtn = document.getElementById('bulk-assign-me');
        const bulkAssignAgentDropdown = document.getElementById('bulk-assign-agent');

        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => this.dashboard.toggleSelectAll(e.target.checked));
        }

        if (clearSelectionBtn) {
            clearSelectionBtn.addEventListener('click', () => this.bulkOperations.clearAllSelections());
        }
        
        if (bulkArchiveBtn) {
            bulkArchiveBtn.addEventListener('click', () => this.bulkOperations.bulkArchiveConversations());
        }
        
        if (bulkUnarchiveBtn) {
            bulkUnarchiveBtn.addEventListener('click', () => this.bulkOperations.bulkUnarchiveConversations());
        }
        
        if (bulkAssignMeBtn) {
            bulkAssignMeBtn.addEventListener('click', () => this.bulkOperations.bulkAssignToMe());
        }
        
        if (bulkAssignAgentDropdown) {
            bulkAssignAgentDropdown.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.bulkOperations.bulkAssignToAgent(e.target.value);
                    e.target.value = ''; // Reset dropdown
                }
            });
        }
    }
}