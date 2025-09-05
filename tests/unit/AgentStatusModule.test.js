/**
 * AgentStatusModule Unit Tests
 * 
 * Comprehensive tests for agent status management functionality
 * Tests module initialization, agent data loading, real-time updates, and UI rendering
 */

const TestUtils = require('../utilities/test-utils');
const ModuleLoader = require('../utilities/module-loader');
const { MockAPIManager, MockStateManager, MockConnectionManager, TestDataFactory, DOMTestUtils } = require('../mocks/phase2-mocks');
const JSDOMEnvironment = require('../../test-config/jsdom.config');
const path = require('path');

describe('AgentStatusModule', () => {
    let jsdom;
    let AgentStatusModule;
    let mockAPIManager;
    let mockStateManager;
    let mockConnectionManager;
    let agentStatusModule;

    beforeEach(async () => {
        // Setup JSDOM environment
        jsdom = new JSDOMEnvironment().setup();
        
        // Create DOM elements
        DOMTestUtils.createMockDOM();
        
        // Setup mock services
        mockStateManager = new MockStateManager();
        mockAPIManager = new MockAPIManager('http://localhost:3002', mockStateManager);
        mockConnectionManager = new MockConnectionManager('http://localhost:3002', mockStateManager);
        
        // Setup API mocks with default responses
        const mockAgents = [
            TestDataFactory.createAgent({ personalStatus: 'online' }),
            TestDataFactory.createAgent({ personalStatus: 'afk' }),
            TestDataFactory.createAgent({ personalStatus: 'offline' })
        ];
        mockAPIManager.setMockResponse('/api/agents/connected', {
            success: true,
            data: mockAgents
        });
        
        // Load AgentStatusModule using ModuleLoader
        const modulePath = path.join(__dirname, '../../custom-widget/js/settings/modules/AgentStatusModule.js');
        const mockDependencies = ModuleLoader.createMockDependencies();
        
        AgentStatusModule = ModuleLoader.loadModule(modulePath, mockDependencies);
        global.ErrorHandler = mockDependencies.ErrorHandler;
        
        // Create module instance
        agentStatusModule = new AgentStatusModule(mockAPIManager, mockStateManager, mockConnectionManager);
    });

    afterEach(() => {
        if (agentStatusModule && agentStatusModule.destroy) {
            agentStatusModule.destroy();
        }
        if (jsdom && jsdom.cleanup) {
            jsdom.cleanup();
        }
        jest.clearAllMocks();
    });

    describe('Initialization', () => {
        test('should initialize successfully with all dependencies', async () => {
            await agentStatusModule.initialize();
            
            expect(agentStatusModule.apiManager).toBe(mockAPIManager);
            expect(agentStatusModule.stateManager).toBe(mockStateManager);
            expect(agentStatusModule.connectionManager).toBe(mockConnectionManager);
        });

        test('should initialize DOM elements correctly', async () => {
            await agentStatusModule.initialize();
            
            expect(agentStatusModule.elements.agentsList).toBeTruthy();
            expect(agentStatusModule.elements.totalConnected).toBeTruthy();
            expect(agentStatusModule.elements.totalAvailable).toBeTruthy();
            expect(agentStatusModule.elements.totalAfk).toBeTruthy();
        });

        test('should load agents on initialization', async () => {
            await agentStatusModule.initialize();
            
            expect(mockAPIManager.getRequestCount('/api/agents/connected')).toBe(1);
            expect(mockStateManager.getConnectedAgents().length).toBeGreaterThan(0);
        });

        test('should setup state listeners on initialization', async () => {
            await agentStatusModule.initialize();
            
            expect(mockStateManager.listeners.has('connectedAgentsChanged')).toBe(true);
            expect(mockStateManager.listeners.get('connectedAgentsChanged').length).toBe(1);
        });

        test('should setup real-time updates on initialization', async () => {
            await agentStatusModule.initialize();
            
            expect(mockConnectionManager.listeners.has('agents-updated')).toBe(true);
        });

        test('should start periodic refresh on initialization', async () => {
            await agentStatusModule.initialize();
            
            expect(agentStatusModule.updateInterval).not.toBeNull();
        });
    });

    describe('Agent Data Loading', () => {
        beforeEach(async () => {
            await agentStatusModule.initialize();
        });

        test('should load connected agents successfully', async () => {
            mockAPIManager.clearRequestHistory();
            
            await agentStatusModule.loadConnectedAgents();
            
            expect(mockAPIManager.getRequestCount('/api/agents/connected')).toBe(1);
            expect(agentStatusModule.lastUpdateTime).toBeTruthy();
        });

        test('should handle API errors gracefully', async () => {
            mockAPIManager.setMockResponse('/api/agents/connected', {
                error: 'API Error'
            }, true);
            
            await agentStatusModule.loadConnectedAgents();
            
            expect(global.ErrorHandler.logError).toHaveBeenCalled();
        });

        test('should force refresh agents', async () => {
            mockAPIManager.clearRequestHistory();
            
            await agentStatusModule.refresh();
            
            expect(mockAPIManager.getRequestCount('/api/agents/connected')).toBe(1);
        });
    });

    describe('Agent Display', () => {
        beforeEach(async () => {
            await agentStatusModule.initialize();
        });

        test('should update agent display correctly', () => {
            const testAgents = [
                TestDataFactory.createAgent({ personalStatus: 'online', name: 'Agent 1' }),
                TestDataFactory.createAgent({ personalStatus: 'afk', name: 'Agent 2' })
            ];
            
            agentStatusModule.updateAgentDisplay(testAgents);
            
            const agentsList = document.getElementById('agents-list');
            expect(agentsList.innerHTML).toContain('Agent 1');
            expect(agentsList.innerHTML).toContain('Agent 2');
        });

        test('should display message for no agents', () => {
            agentStatusModule.updateAgentDisplay([]);
            
            const agentsList = document.getElementById('agents-list');
            expect(agentsList.innerHTML).toContain('No agents currently connected');
        });

        test('should render agent cards correctly', () => {
            const testAgent = TestDataFactory.createAgent({
                id: 'short-id',
                personalStatus: 'online',
                name: 'Test Agent',
                lastSeen: new Date().toISOString()
            });
            
            const cardHtml = agentStatusModule.renderAgentCard(testAgent);
            
            expect(cardHtml).toContain('short-id');
            expect(cardHtml).toContain('Test Agent');
            expect(cardHtml).toContain('Available');
            expect(cardHtml).toContain('bg-green-400');
        });

        test('should handle agent cards without names', () => {
            const testAgent = TestDataFactory.createAgent({
                id: 'agent-456',
                personalStatus: 'afk',
                name: null
            });
            
            const cardHtml = agentStatusModule.renderAgentCard(testAgent);
            
            expect(cardHtml).toContain('agent-456');
            expect(cardHtml).not.toContain('null');
            expect(cardHtml).toContain('AFK');
        });
    });

    describe('Agent Statistics', () => {
        beforeEach(async () => {
            await agentStatusModule.initialize();
        });

        test('should calculate agent statistics correctly', () => {
            const testAgents = [
                TestDataFactory.createAgent({ personalStatus: 'online' }),
                TestDataFactory.createAgent({ personalStatus: 'online' }),
                TestDataFactory.createAgent({ personalStatus: 'afk' }),
                TestDataFactory.createAgent({ personalStatus: 'offline' })
            ];
            
            const stats = agentStatusModule.calculateAgentStats(testAgents);
            
            expect(stats.total).toBe(4);
            expect(stats.available).toBe(2);
            expect(stats.afk).toBe(1);
            expect(stats.offline).toBe(1);
        });

        test('should handle away status as afk', () => {
            const testAgents = [
                TestDataFactory.createAgent({ personalStatus: 'away' }),
                TestDataFactory.createAgent({ personalStatus: 'afk' })
            ];
            
            const stats = agentStatusModule.calculateAgentStats(testAgents);
            
            expect(stats.afk).toBe(2);
        });

        test('should update statistics display', () => {
            const testAgents = [
                TestDataFactory.createAgent({ personalStatus: 'online' }),
                TestDataFactory.createAgent({ personalStatus: 'afk' })
            ];
            
            agentStatusModule.updateAgentStats(testAgents);
            
            expect(document.getElementById('total-connected').textContent).toBe('2');
            expect(document.getElementById('total-available').textContent).toBe('1');
            expect(document.getElementById('total-afk').textContent).toBe('1');
        });

        test('should get current agent stats via public API', () => {
            const testAgents = [
                TestDataFactory.createAgent({ personalStatus: 'online' }),
                TestDataFactory.createAgent({ personalStatus: 'online' }),
                TestDataFactory.createAgent({ personalStatus: 'afk' })
            ];
            mockStateManager.setConnectedAgents(testAgents);
            
            const stats = agentStatusModule.getAgentStats();
            
            expect(stats.total).toBe(3);
            expect(stats.available).toBe(2);
            expect(stats.afk).toBe(1);
        });
    });

    describe('Status Formatting', () => {
        test('should format status colors correctly', () => {
            expect(agentStatusModule.getStatusColor('online')).toBe('bg-green-400');
            expect(agentStatusModule.getStatusColor('afk')).toBe('bg-yellow-400');
            expect(agentStatusModule.getStatusColor('away')).toBe('bg-yellow-400');
            expect(agentStatusModule.getStatusColor('busy')).toBe('bg-red-400');
            expect(agentStatusModule.getStatusColor('offline')).toBe('bg-gray-400');
            expect(agentStatusModule.getStatusColor('unknown')).toBe('bg-gray-400');
        });

        test('should format status text correctly', () => {
            expect(agentStatusModule.getStatusText('online')).toBe('Available');
            expect(agentStatusModule.getStatusText('afk')).toBe('AFK');
            expect(agentStatusModule.getStatusText('away')).toBe('Away');
            expect(agentStatusModule.getStatusText('busy')).toBe('Busy');
            expect(agentStatusModule.getStatusText('offline')).toBe('Offline');
            expect(agentStatusModule.getStatusText('unknown')).toBe('Offline');
        });

        test('should format agent IDs correctly', () => {
            expect(agentStatusModule.formatAgentId('short-id')).toBe('short-id');
            expect(agentStatusModule.formatAgentId('very-long-agent-id-that-needs-truncation')).toBe('very-long-ag...');
            expect(agentStatusModule.formatAgentId('')).toBe('Unknown');
            expect(agentStatusModule.formatAgentId(null)).toBe('Unknown');
        });

        test('should format last seen timestamps correctly', () => {
            const now = Date.now();
            
            // Just now
            expect(agentStatusModule.formatLastSeen(new Date(now - 30000).toISOString())).toBe('Just now');
            
            // Minutes ago
            expect(agentStatusModule.formatLastSeen(new Date(now - 300000).toISOString())).toBe('5m ago');
            
            // Hours ago
            expect(agentStatusModule.formatLastSeen(new Date(now - 7200000).toISOString())).toBe('2h ago');
            
            // Null/empty
            expect(agentStatusModule.formatLastSeen(null)).toBe('Never');
            expect(agentStatusModule.formatLastSeen('')).toBe('Never');
        });

        test('should format time correctly', () => {
            const testTime = new Date('2023-01-01T12:30:45').getTime();
            const formatted = agentStatusModule.formatTime(testTime);
            
            expect(formatted).toMatch(/12:30:45/);
        });
    });

    describe('Real-time Updates', () => {
        beforeEach(async () => {
            await agentStatusModule.initialize();
        });

        test('should handle real-time agent updates', () => {
            const newAgents = [
                TestDataFactory.createAgent({ personalStatus: 'online' }),
                TestDataFactory.createAgent({ personalStatus: 'busy' })
            ];
            
            mockConnectionManager.simulateAgentUpdate(newAgents);
            
            expect(mockStateManager.getConnectedAgents()).toEqual(newAgents);
        });

        test('should update display on state changes', () => {
            const spy = jest.spyOn(agentStatusModule, 'updateAgentDisplay');
            const newAgents = [TestDataFactory.createAgent({ personalStatus: 'online' })];
            
            mockStateManager.emit('connectedAgentsChanged', newAgents);
            
            expect(spy).toHaveBeenCalledWith(newAgents);
        });
    });

    describe('Periodic Refresh', () => {
        beforeEach(async () => {
            await agentStatusModule.initialize();
        });

        test('should set update interval correctly', () => {
            const customInterval = 15000;
            
            agentStatusModule.setUpdateInterval(customInterval);
            
            expect(agentStatusModule.updateInterval).not.toBeNull();
        });

        test('should clear previous interval when setting new one', () => {
            // Save original interval ID
            const originalInterval = agentStatusModule.updateInterval;
            
            // Set a new interval
            agentStatusModule.setUpdateInterval(20000);
            const newInterval = agentStatusModule.updateInterval;
            
            // Should have different interval IDs
            expect(newInterval).not.toBeNull();
            expect(newInterval).not.toBe(originalInterval);
        });
    });

    describe('Data Staleness', () => {
        beforeEach(async () => {
            await agentStatusModule.initialize();
        });

        test('should detect stale data when no update time', () => {
            agentStatusModule.lastUpdateTime = null;
            
            expect(agentStatusModule.isDataStale()).toBe(true);
        });

        test('should detect stale data after threshold', () => {
            agentStatusModule.lastUpdateTime = Date.now() - 120000; // 2 minutes ago
            
            expect(agentStatusModule.isDataStale()).toBe(true);
        });

        test('should detect fresh data within threshold', () => {
            agentStatusModule.lastUpdateTime = Date.now() - 30000; // 30 seconds ago
            
            expect(agentStatusModule.isDataStale()).toBe(false);
        });

        test('should return last update time', () => {
            const testTime = Date.now();
            agentStatusModule.lastUpdateTime = testTime;
            
            expect(agentStatusModule.getLastUpdateTime()).toBe(testTime);
        });
    });

    describe('Public API', () => {
        beforeEach(async () => {
            await agentStatusModule.initialize();
        });

        test('should get connected agents', () => {
            const testAgents = [TestDataFactory.createAgent()];
            mockStateManager.setConnectedAgents(testAgents);
            
            expect(agentStatusModule.getConnectedAgents()).toEqual(testAgents);
        });

        test('should add agent change event listeners', () => {
            const callback = jest.fn();
            
            agentStatusModule.onAgentsChanged(callback);
            mockStateManager.emit('connectedAgentsChanged', []);
            
            expect(callback).toHaveBeenCalled();
        });

        test('should remove agent change event listeners', () => {
            const callback = jest.fn();
            
            agentStatusModule.onAgentsChanged(callback);
            agentStatusModule.offAgentsChanged(callback);
            mockStateManager.emit('connectedAgentsChanged', []);
            
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('Status and Debugging', () => {
        beforeEach(async () => {
            await agentStatusModule.initialize();
        });

        test('should provide module status', () => {
            const testAgents = [
                TestDataFactory.createAgent({ personalStatus: 'online' }),
                TestDataFactory.createAgent({ personalStatus: 'afk' })
            ];
            mockStateManager.setConnectedAgents(testAgents);
            
            const status = agentStatusModule.getStatus();
            
            expect(status.agentsCount).toBe(2);
            expect(status.stats.total).toBe(2);
            expect(status.stats.available).toBe(1);
            expect(status.stats.afk).toBe(1);
            expect(status.elements.agentsList).toBe(true);
            expect(status.elements.totalConnected).toBe(true);
            expect(status.hasUpdateInterval).toBe(true);
        });

        test('should provide detailed agent information', () => {
            const testAgent = TestDataFactory.createAgent({
                id: 'test-123',
                personalStatus: 'online',
                name: 'Test Agent',
                lastSeen: new Date().toISOString()
            });
            mockStateManager.setConnectedAgents([testAgent]);
            
            const details = agentStatusModule.getDetailedAgentInfo();
            
            expect(details).toHaveLength(1);
            expect(details[0].id).toBe('test-123');
            expect(details[0].status).toBe('online');
            expect(details[0].name).toBe('Test Agent');
            expect(details[0].statusColor).toBe('bg-green-400');
            expect(details[0].statusText).toBe('Available');
        });
    });

    describe('Error Handling', () => {
        test('should handle initialization errors gracefully', async () => {
            const faultyModule = new AgentStatusModule(null, null, null);
            
            await expect(faultyModule.initialize()).rejects.toThrow();
            expect(global.ErrorHandler.logError).toHaveBeenCalled();
        });

        test('should handle missing DOM elements gracefully', async () => {
            // Remove required DOM elements
            document.body.innerHTML = '';
            
            await agentStatusModule.initialize();
            
            // Should not crash when updating display
            expect(() => {
                agentStatusModule.updateAgentDisplay([TestDataFactory.createAgent()]);
            }).not.toThrow();
        });

        test('should handle API errors without showing toasts', async () => {
            await agentStatusModule.initialize();
            
            mockAPIManager.setMockResponse('/api/agents/connected', {
                error: 'Network error'
            }, true);
            
            await agentStatusModule.loadConnectedAgents();
            
            expect(global.ErrorHandler.logError).toHaveBeenCalled();
            // Should not show toast notifications for agent loading failures
        });
    });

    describe('Cleanup', () => {
        test('should cleanup intervals on destroy', async () => {
            await agentStatusModule.initialize();
            
            // Verify interval exists
            expect(agentStatusModule.updateInterval).not.toBeNull();
            const intervalId = agentStatusModule.updateInterval;
            
            agentStatusModule.destroy();
            
            // Verify interval is cleared
            expect(agentStatusModule.updateInterval).toBeNull();
        });
    });

    describe('Integration', () => {
        test('should integrate with APIManager correctly', async () => {
            await agentStatusModule.initialize();
            
            const spy = jest.spyOn(mockAPIManager, 'loadConnectedAgents');
            await agentStatusModule.loadConnectedAgents();
            
            expect(spy).toHaveBeenCalled();
        });

        test('should integrate with StateManager correctly', async () => {
            await agentStatusModule.initialize();
            
            const testAgents = [TestDataFactory.createAgent()];
            mockStateManager.setConnectedAgents(testAgents);
            
            expect(agentStatusModule.getConnectedAgents()).toEqual(testAgents);
        });

        test('should integrate with ConnectionManager for real-time updates', async () => {
            await agentStatusModule.initialize();
            
            const newAgents = [TestDataFactory.createAgent({ personalStatus: 'busy' })];
            mockConnectionManager.emit('agents-updated', { agents: newAgents });
            
            expect(mockStateManager.getConnectedAgents()).toEqual(newAgents);
        });
    });
});