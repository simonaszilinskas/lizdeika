/**
 * Modern Conversation Loader
 * Replaces monolithic conversation loading with modular, testable implementation
 */

/**
 * API Client for conversation data
 */
class ConversationApiClient {
    constructor(config = {}) {
        this.apiUrl = config.apiUrl || 'http://localhost:3002';
        this.cache = new Map();
        this.cacheTTL = config.cacheTTL || 30000; // 30 seconds
        this.logger = config.logger || console;
    }

    /**
     * Get authentication headers
     */
    getAuthHeaders() {
        const token = localStorage.getItem('agent_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    /**
     * Fetch conversations from API with caching
     */
    async fetchConversations() {
        const cacheKey = 'conversations';
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            this.logger.log('📦 Using cached conversation data');
            return cached.data;
        }

        try {
            this.logger.log('🌐 Fetching conversations from API...');
            const response = await fetch(`${this.apiUrl}/api/admin/conversations`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const conversations = data.conversations || [];

            // Cache the result
            this.cache.set(cacheKey, {
                data: conversations,
                timestamp: Date.now()
            });

            this.logger.log(`✅ Loaded ${conversations.length} conversations from API`);
            return conversations;

        } catch (error) {
            this.logger.error('💥 API Error:', error);
            
            // Return cached data if available, even if expired
            if (cached) {
                this.logger.warn('⚠️ Using expired cache due to API error');
                return cached.data;
            }
            
            throw error;
        }
    }

    /**
     * Clear conversation cache
     */
    clearCache() {
        this.cache.clear();
        this.logger.log('🗑️ Conversation cache cleared');
    }
}

/**
 * Conversation filtering engine
 */
class ConversationFilter {
    constructor(config = {}) {
        this.logger = config.logger || console;
    }

    /**
     * Apply archive filter
     */
    applyArchiveFilter(conversations, archiveFilter) {
        switch (archiveFilter) {
            case 'active':
                return conversations.filter(conv => !conv.archived);
            case 'archived':
                return conversations.filter(conv => conv.archived);
            case 'all':
            default:
                return conversations;
        }
    }

    /**
     * Apply assignment filter
     */
    applyAssignmentFilter(conversations, assignmentFilter, agentId) {
        switch (assignmentFilter) {
            case 'mine':
                return conversations.filter(conv => conv.assignedAgent === agentId);
            case 'unassigned':
                return conversations.filter(conv => !conv.assignedAgent);
            case 'others':
                return conversations.filter(conv => 
                    conv.assignedAgent && conv.assignedAgent !== agentId);
            case 'all':
            default:
                return conversations;
        }
    }

    /**
     * Apply all filters
     */
    filterConversations(conversations, filters) {
        const { archiveFilter, assignmentFilter, agentId } = filters;
        
        let filtered = this.applyArchiveFilter(conversations, archiveFilter);
        
        // Don't apply assignment filters to archived conversations
        if (archiveFilter !== 'archived') {
            filtered = this.applyAssignmentFilter(filtered, assignmentFilter, agentId);
        }

        this.logger.log(`🔍 Filtered ${conversations.length} → ${filtered.length} conversations`);
        return filtered;
    }
}

/**
 * Conversation sorting engine
 */
class ConversationSorter {
    constructor(config = {}) {
        this.logger = config.logger || console;
    }

    /**
     * Check if conversation needs agent response
     */
    needsResponse(conv) {
        return !!(conv.lastMessage && 
                  conv.lastMessage.metadata && 
                  conv.lastMessage.metadata.pendingAgent === true);
    }

    /**
     * Sort conversations by priority
     */
    sortByPriority(conversations, agentId) {
        return conversations.sort((a, b) => {
            const aNeedsResponse = this.needsResponse(a);
            const bNeedsResponse = this.needsResponse(b);
            const aIsMine = a.assignedAgent === agentId;
            const bIsMine = b.assignedAgent === agentId;
            
            // Priority 1: My tickets with responses needed
            if (aIsMine && aNeedsResponse && (!bIsMine || !bNeedsResponse)) return -1;
            if (bIsMine && bNeedsResponse && (!aIsMine || !aNeedsResponse)) return 1;
            
            // Priority 2: My tickets (even without response needed)
            if (aIsMine && !bIsMine) return -1;
            if (bIsMine && !aIsMine) return 1;
            
            // Priority 3: Other tickets needing response
            if (aNeedsResponse && !bNeedsResponse) return -1;
            if (bNeedsResponse && !aNeedsResponse) return 1;
            
            // Priority 4: Sort by most recent activity
            const aTime = new Date(a.updatedAt || a.startedAt);
            const bTime = new Date(b.updatedAt || b.startedAt);
            return bTime - aTime;
        });
    }
}

/**
 * Loading state manager
 */
class LoadingStateManager {
    constructor(config = {}) {
        this.containerSelector = config.containerSelector || '#chat-queue';
        this.logger = config.logger || console;
    }

    /**
     * Show loading state
     */
    showLoading() {
        const container = document.querySelector(this.containerSelector);
        if (container) {
            container.innerHTML = `
                <div class="flex items-center justify-center py-8">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                    <span class="ml-3 text-gray-600">Loading conversations...</span>
                </div>
            `;
        }
    }

    /**
     * Show error state
     */
    showError(error) {
        const container = document.querySelector(this.containerSelector);
        if (container) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-8 text-center">
                    <div class="text-red-500 mb-2">
                        <i class="fas fa-exclamation-triangle text-2xl"></i>
                    </div>
                    <div class="text-gray-700 font-medium mb-2">Failed to load conversations</div>
                    <div class="text-gray-500 text-sm mb-4">${error.message}</div>
                    <button onclick="dashboard.loadConversations()" 
                            class="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded">
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    /**
     * Show empty state
     */
    showEmpty(filterType) {
        const container = document.querySelector(this.containerSelector);
        if (container) {
            const message = this.getEmptyMessage(filterType);
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-8 text-center">
                    <div class="text-gray-400 mb-2">
                        <i class="fas fa-inbox text-3xl"></i>
                    </div>
                    <div class="text-gray-600 font-medium">${message}</div>
                </div>
            `;
        }
    }

    /**
     * Get appropriate empty message for filter type
     */
    getEmptyMessage(filterType) {
        const messages = {
            'mine': 'No conversations assigned to you',
            'unassigned': 'No unassigned conversations',
            'others': 'No conversations assigned to other agents',
            'archived': 'No archived conversations',
            'all': 'No conversations available'
        };
        return messages[filterType] || 'No conversations found';
    }
}

/**
 * Modern Conversation Loader - Main orchestrator
 */
class ConversationLoader {
    constructor(config = {}) {
        this.apiClient = new ConversationApiClient(config);
        this.filter = new ConversationFilter(config);
        this.sorter = new ConversationSorter(config);
        this.stateManager = new LoadingStateManager(config);
        this.logger = config.logger || console;
        
        // State
        this.allConversations = [];
        this.filteredConversations = [];
        
        console.log('🔧 ConversationLoader initialized');
    }

    /**
     * Load conversations with modern architecture
     */
    async load(filters, renderer) {
        try {
            // Show loading state
            this.stateManager.showLoading();
            
            // Fetch data
            const conversations = await this.apiClient.fetchConversations();
            this.allConversations = conversations;
            
            // Apply filters and sorting
            this.applyFiltersAndSort(filters);
            
            // Render results
            if (this.filteredConversations.length === 0) {
                this.stateManager.showEmpty(filters.assignmentFilter);
            } else {
                renderer(this.filteredConversations);
            }
            
            this.logger.log('✅ Modern conversation loader completed successfully');
            
        } catch (error) {
            this.logger.error('💥 Modern conversation loader failed:', error);
            this.stateManager.showError(error);
            throw error;
        }
    }

    /**
     * Apply filters and sorting to conversations
     */
    applyFiltersAndSort(filters) {
        // Filter conversations
        this.filteredConversations = this.filter.filterConversations(
            this.allConversations, 
            filters
        );
        
        // Sort by priority
        this.filteredConversations = this.sorter.sortByPriority(
            this.filteredConversations, 
            filters.agentId
        );
        
        this.logger.log(`📊 Processed: ${this.allConversations.length} → ${this.filteredConversations.length} conversations`);
    }

    /**
     * Re-apply filters without re-fetching data
     */
    reapplyFilters(filters, renderer) {
        try {
            this.applyFiltersAndSort(filters);
            
            if (this.filteredConversations.length === 0) {
                this.stateManager.showEmpty(filters.assignmentFilter);
            } else {
                renderer(this.filteredConversations);
            }
            
        } catch (error) {
            this.logger.error('💥 Filter reapplication failed:', error);
            this.stateManager.showError(error);
        }
    }

    /**
     * Clear cache and force refresh
     */
    refresh() {
        this.apiClient.clearCache();
        this.logger.log('🔄 Conversation loader cache cleared');
    }

    /**
     * Get current conversation data
     */
    getConversations() {
        return {
            all: this.allConversations,
            filtered: this.filteredConversations
        };
    }
}

// CommonJS exports for tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ModernConversationLoader: ConversationLoader,
        ConversationLoader,
        ConversationApiClient,
        ConversationFilter,
        ConversationSorter,
        LoadingStateManager
    };
}