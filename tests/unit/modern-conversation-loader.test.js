/**
 * Tests for ModernConversationLoader and related components
 */

const ModuleLoader = require('../utilities/module-loader');

const {
    ModernConversationLoader,
    ConversationApiClient,
    ConversationFilter,
    ConversationSorter,
    LoadingStateManager
} = ModuleLoader.loadModule('custom-widget/js/agent-dashboard/core/ConversationLoader.js');

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
};
global.localStorage = mockLocalStorage;

// Mock DOM
global.document = {
    querySelector: jest.fn()
};

describe('ConversationApiClient', () => {
    let apiClient;
    
    beforeEach(() => {
        jest.clearAllMocks();
        apiClient = new ConversationApiClient({
            apiUrl: 'http://test:3002',
            logger: {
                log: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            }
        });
    });

    describe('Authentication', () => {
        test('should include auth header when token exists', () => {
            mockLocalStorage.getItem.mockReturnValue('test-token');
            
            const headers = apiClient.getAuthHeaders();
            
            expect(headers['Authorization']).toBe('Bearer test-token');
            expect(headers['Content-Type']).toBe('application/json');
        });

        test('should not include auth header when token missing', () => {
            mockLocalStorage.getItem.mockReturnValue(null);
            
            const headers = apiClient.getAuthHeaders();
            
            expect(headers['Authorization']).toBeUndefined();
            expect(headers['Content-Type']).toBe('application/json');
        });
    });

    describe('API Fetching', () => {
        test('should fetch conversations successfully', async () => {
            const mockConversations = [
                { id: '1', content: 'Test 1' },
                { id: '2', content: 'Test 2' }
            ];
            
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ conversations: mockConversations })
            });
            
            const result = await apiClient.fetchConversations();
            
            expect(result).toEqual(mockConversations);
            expect(global.fetch).toHaveBeenCalledWith(
                'http://test:3002/api/admin/conversations',
                expect.objectContaining({ headers: expect.any(Object) })
            );
        });

        test('should handle API errors', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });
            
            await expect(apiClient.fetchConversations()).rejects.toThrow('API Error: 500 Internal Server Error');
        });

        test('should use cached data when valid', async () => {
            const mockConversations = [{ id: '1', content: 'Cached' }];
            
            // Set up cache
            apiClient.cache.set('conversations', {
                data: mockConversations,
                timestamp: Date.now()
            });
            
            const result = await apiClient.fetchConversations();
            
            expect(result).toEqual(mockConversations);
            expect(global.fetch).not.toHaveBeenCalled();
        });

        test('should fetch fresh data when cache expired', async () => {
            const cachedData = [{ id: '1', content: 'Cached' }];
            const freshData = [{ id: '2', content: 'Fresh' }];
            
            // Set up expired cache
            apiClient.cache.set('conversations', {
                data: cachedData,
                timestamp: Date.now() - 60000 // 1 minute ago
            });
            
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ conversations: freshData })
            });
            
            const result = await apiClient.fetchConversations();
            
            expect(result).toEqual(freshData);
            expect(global.fetch).toHaveBeenCalled();
        });

        test('should use expired cache when API fails', async () => {
            const cachedData = [{ id: '1', content: 'Cached' }];
            
            // Set up expired cache
            apiClient.cache.set('conversations', {
                data: cachedData,
                timestamp: Date.now() - 60000
            });
            
            global.fetch.mockRejectedValue(new Error('Network error'));
            
            const result = await apiClient.fetchConversations();
            
            expect(result).toEqual(cachedData);
        });
    });

    describe('Cache Management', () => {
        test('should clear cache', () => {
            apiClient.cache.set('test', 'data');
            apiClient.clearCache();
            expect(apiClient.cache.size).toBe(0);
        });
    });
});

describe('ConversationFilter', () => {
    let filter;
    let conversations;
    
    beforeEach(() => {
        filter = new ConversationFilter();
        conversations = [
            { id: '1', assignedAgent: 'agent1', archived: false },
            { id: '2', assignedAgent: 'agent2', archived: false },
            { id: '3', assignedAgent: null, archived: false },
            { id: '4', assignedAgent: 'agent1', archived: true },
            { id: '5', assignedAgent: null, archived: true }
        ];
    });

    describe('Archive Filtering', () => {
        test('should filter active conversations', () => {
            const result = filter.applyArchiveFilter(conversations, 'active');
            expect(result).toHaveLength(3);
            expect(result.every(conv => !conv.archived)).toBe(true);
        });

        test('should filter archived conversations', () => {
            const result = filter.applyArchiveFilter(conversations, 'archived');
            expect(result).toHaveLength(2);
            expect(result.every(conv => conv.archived)).toBe(true);
        });

        test('should return all conversations for "all" filter', () => {
            const result = filter.applyArchiveFilter(conversations, 'all');
            expect(result).toHaveLength(5);
        });
    });

    describe('Assignment Filtering', () => {
        test('should filter conversations assigned to specific agent', () => {
            const result = filter.applyAssignmentFilter(conversations, 'mine', 'agent1');
            expect(result).toHaveLength(2);
            expect(result.every(conv => conv.assignedAgent === 'agent1')).toBe(true);
        });

        test('should filter unassigned conversations', () => {
            const result = filter.applyAssignmentFilter(conversations, 'unassigned', 'agent1');
            expect(result).toHaveLength(2);
            expect(result.every(conv => !conv.assignedAgent)).toBe(true);
        });

        test('should filter conversations assigned to others', () => {
            const result = filter.applyAssignmentFilter(conversations, 'others', 'agent1');
            expect(result).toHaveLength(1);
            expect(result[0].assignedAgent).toBe('agent2');
        });

        test('should return all conversations for "all" filter', () => {
            const result = filter.applyAssignmentFilter(conversations, 'all', 'agent1');
            expect(result).toHaveLength(5);
        });
    });

    describe('Search Filtering', () => {
        test('should filter by conversation number', () => {
            const testConversations = [
                { id: '1', userNumber: 123, categoryData: null, lastMessage: null },
                { id: '2', userNumber: 456, categoryData: null, lastMessage: null },
                { id: '3', userNumber: 789, categoryData: null, lastMessage: null }
            ];

            const result = filter.applySearchFilter(testConversations, '45');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('2');
        });

        test('should filter by category name', () => {
            const testConversations = [
                { id: '1', userNumber: 1, categoryData: { name: 'Technical Support' }, lastMessage: null },
                { id: '2', userNumber: 2, categoryData: { name: 'Billing' }, lastMessage: null },
                { id: '3', userNumber: 3, categoryData: { name: 'General Inquiry' }, lastMessage: null }
            ];

            const result = filter.applySearchFilter(testConversations, 'billing');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('2');
        });

        test('should filter by last message content', () => {
            const testConversations = [
                { id: '1', userNumber: 1, categoryData: null, lastMessage: { content: 'Hello world' } },
                { id: '2', userNumber: 2, categoryData: null, lastMessage: { content: 'Testing message' } },
                { id: '3', userNumber: 3, categoryData: null, lastMessage: { content: 'Another test' } }
            ];

            const result = filter.applySearchFilter(testConversations, 'test');
            expect(result).toHaveLength(2);
            expect(result.map(c => c.id)).toEqual(['2', '3']);
        });

        test('should filter by all messages content', () => {
            const testConversations = [
                { id: '1', userNumber: 1, categoryData: null, lastMessage: null, messages: [
                    { content: 'First message' },
                    { content: 'Second message' }
                ]},
                { id: '2', userNumber: 2, categoryData: null, lastMessage: null, messages: [
                    { content: 'Hello' },
                    { content: 'Important issue here' }
                ]},
                { id: '3', userNumber: 3, categoryData: null, lastMessage: null, messages: [] }
            ];

            const result = filter.applySearchFilter(testConversations, 'important');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('2');
        });

        test('should return all conversations for empty search query', () => {
            const testConversations = [
                { id: '1', userNumber: 1, categoryData: null, lastMessage: null },
                { id: '2', userNumber: 2, categoryData: null, lastMessage: null }
            ];

            const result = filter.applySearchFilter(testConversations, '');
            expect(result).toHaveLength(2);
        });

        test('should be case insensitive', () => {
            const testConversations = [
                { id: '1', userNumber: 1, categoryData: { name: 'Technical Support' }, lastMessage: null }
            ];

            const result = filter.applySearchFilter(testConversations, 'TECHNICAL');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('1');
        });
    });

    describe('Combined Filtering', () => {
        test('should apply both archive and assignment filters', () => {
            const filters = {
                archiveFilter: 'active',
                assignmentFilter: 'mine',
                agentId: 'agent1'
            };

            const result = filter.filterConversations(conversations, filters);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('1');
        });

        test('should skip assignment filter for archived conversations', () => {
            const filters = {
                archiveFilter: 'archived',
                assignmentFilter: 'mine',
                agentId: 'agent1'
            };

            const result = filter.filterConversations(conversations, filters);
            expect(result).toHaveLength(2);
            expect(result.every(conv => conv.archived)).toBe(true);
        });

        test('should apply search filter with other filters', () => {
            const testConversations = [
                { id: '1', assignedAgent: 'agent1', archived: false, userNumber: 123, lastMessage: { content: 'hello' } },
                { id: '2', assignedAgent: 'agent1', archived: false, userNumber: 456, lastMessage: { content: 'world' } },
                { id: '3', assignedAgent: 'agent2', archived: false, userNumber: 789, lastMessage: { content: 'hello' } }
            ];

            const filters = {
                archiveFilter: 'active',
                assignmentFilter: 'mine',
                agentId: 'agent1',
                searchQuery: 'hello'
            };

            const result = filter.filterConversations(testConversations, filters);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('1');
        });
    });
});

describe('ConversationSorter', () => {
    let sorter;
    
    beforeEach(() => {
        sorter = new ConversationSorter();
    });

    // Response detection removed - no longer needed with simplified sorting

    describe('Timestamp Sorting', () => {
        test('should sort conversations by most recent activity', () => {
            const conversations = [
                { id: '1', updatedAt: '2023-01-01T10:00:00Z', startedAt: '2023-01-01T09:00:00Z' },
                { id: '2', updatedAt: '2023-01-03T10:00:00Z', startedAt: '2023-01-03T09:00:00Z' },
                { id: '3', updatedAt: '2023-01-02T10:00:00Z', startedAt: '2023-01-02T09:00:00Z' }
            ];

            const result = sorter.sortByPriority(conversations);
            expect(result.map(c => c.id)).toEqual(['2', '3', '1']); // Most recent first
        });

        test('should fallback to startedAt if updatedAt is missing', () => {
            const conversations = [
                { id: '1', startedAt: '2023-01-01T10:00:00Z' },
                { id: '2', startedAt: '2023-01-03T10:00:00Z' },
                { id: '3', startedAt: '2023-01-02T10:00:00Z' }
            ];

            const result = sorter.sortByPriority(conversations);
            expect(result.map(c => c.id)).toEqual(['2', '3', '1']); // Most recent first
        });

        test('should ignore assignment and priority metadata', () => {
            const conversations = [
                { id: '1', assignedAgent: 'agent1', lastMessage: { metadata: { pendingAgent: true } }, updatedAt: '2023-01-01T10:00:00Z' },
                { id: '2', assignedAgent: null, lastMessage: { metadata: { pendingAgent: false } }, updatedAt: '2023-01-03T10:00:00Z' },
                { id: '3', assignedAgent: 'other-agent', lastMessage: { metadata: { pendingAgent: true } }, updatedAt: '2023-01-02T10:00:00Z' }
            ];

            const result = sorter.sortByPriority(conversations);
            expect(result.map(c => c.id)).toEqual(['2', '3', '1']); // Pure timestamp sorting
        });
    });
});

describe('LoadingStateManager', () => {
    let stateManager;
    let mockContainer;
    
    beforeEach(() => {
        mockContainer = { innerHTML: '' };
        global.document.querySelector.mockReturnValue(mockContainer);
        
        stateManager = new LoadingStateManager({
            containerSelector: '#test-container'
        });
    });

    test('should show loading state', () => {
        stateManager.showLoading();
        expect(mockContainer.innerHTML).toContain('Loading conversations');
        expect(mockContainer.innerHTML).toContain('animate-spin');
    });

    test('should show error state', () => {
        const error = new Error('Test error');
        stateManager.showError(error);
        expect(mockContainer.innerHTML).toContain('Failed to load conversations');
        expect(mockContainer.innerHTML).toContain('Test error');
        expect(mockContainer.innerHTML).toContain('Try Again');
    });

    test('should show empty state for different filters', () => {
        stateManager.showEmpty('mine');
        expect(mockContainer.innerHTML).toContain('No conversations assigned to you');
        
        stateManager.showEmpty('unassigned');
        expect(mockContainer.innerHTML).toContain('No unassigned conversations');
    });

    test('should handle missing container gracefully', () => {
        global.document.querySelector.mockReturnValue(null);
        expect(() => stateManager.showLoading()).not.toThrow();
    });
});

describe('ModernConversationLoader', () => {
    let loader;
    let mockRenderer;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        global.document.querySelector.mockReturnValue({ innerHTML: '' });
        
        loader = new ModernConversationLoader({
            apiUrl: 'http://test:3002',
            logger: {
                log: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            }
        });
        
        mockRenderer = jest.fn();
        
        // Mock successful API response
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                conversations: [
                    { id: '1', assignedAgent: 'agent1', archived: false, updatedAt: '2023-01-01' },
                    { id: '2', assignedAgent: null, archived: false, updatedAt: '2023-01-02' }
                ]
            })
        });
    });

    test('should load conversations successfully', async () => {
        const filters = {
            archiveFilter: 'active',
            assignmentFilter: 'all',
            agentId: 'agent1'
        };
        
        await loader.load(filters, mockRenderer);
        
        expect(mockRenderer).toHaveBeenCalled();
        expect(loader.allConversations).toHaveLength(2);
        expect(loader.filteredConversations).toHaveLength(2);
    });

    test('should apply filters correctly', async () => {
        const filters = {
            archiveFilter: 'active',
            assignmentFilter: 'mine',
            agentId: 'agent1'
        };
        
        await loader.load(filters, mockRenderer);
        
        expect(loader.filteredConversations).toHaveLength(1);
        expect(loader.filteredConversations[0].id).toBe('1');
    });

    test('should show empty state when no conversations match', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ conversations: [] })
        });
        
        const filters = {
            archiveFilter: 'active',
            assignmentFilter: 'mine',
            agentId: 'agent1'
        };
        
        await loader.load(filters, mockRenderer);
        
        expect(mockRenderer).not.toHaveBeenCalled();
        // Empty state is shown by LoadingStateManager
    });

    test('should handle API errors', async () => {
        global.fetch.mockRejectedValue(new Error('Network error'));
        
        const filters = {
            archiveFilter: 'active',
            assignmentFilter: 'all',
            agentId: 'agent1'
        };
        
        await expect(loader.load(filters, mockRenderer)).rejects.toThrow('Network error');
    });

    test('should reapply filters without fetching', () => {
        // Set up initial data
        loader.allConversations = [
            { id: '1', assignedAgent: 'agent1', archived: false },
            { id: '2', assignedAgent: null, archived: false }
        ];
        
        const filters = {
            archiveFilter: 'active',
            assignmentFilter: 'unassigned',
            agentId: 'agent1'
        };
        
        loader.reapplyFilters(filters, mockRenderer);
        
        expect(loader.filteredConversations).toHaveLength(1);
        expect(loader.filteredConversations[0].id).toBe('2');
        expect(mockRenderer).toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('should provide conversation data access', () => {
        loader.allConversations = [{ id: '1' }];
        loader.filteredConversations = [{ id: '1' }];
        
        const data = loader.getConversations();
        
        expect(data.all).toEqual([{ id: '1' }]);
        expect(data.filtered).toEqual([{ id: '1' }]);
    });
});
