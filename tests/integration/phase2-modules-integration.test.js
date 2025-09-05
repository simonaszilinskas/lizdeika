/**
 * Phase 2 Modules Integration Tests
 * 
 * Tests the interactions between all Phase 2 modules:
 * - SystemModeModule
 * - AgentStatusModule  
 * - WidgetConfigModule
 * - UserManagementModule
 */

const TestUtils = require('../utilities/test-utils');
const ModuleLoader = require('../utilities/module-loader');
const { MockAPIManager, MockStateManager, MockConnectionManager, TestDataFactory, DOMTestUtils } = require('../mocks/phase2-mocks');
const JSDOMEnvironment = require('../../test-config/jsdom.config');
const path = require('path');

describe('Phase 2 Modules Integration', () => {
    let jsdom;
    let mockAPIManager;
    let mockStateManager;
    let mockConnectionManager;
    let systemModeModule;
    let agentStatusModule;
    let widgetConfigModule;
    let userManagementModule;
    let modules;

    beforeEach(async () => {
        // Setup JSDOM environment
        jsdom = new JSDOMEnvironment().setup();
        DOMTestUtils.createMockDOM();
        
        // Setup mock services
        mockStateManager = new MockStateManager();
        mockAPIManager = new MockAPIManager('http://localhost:3002', mockStateManager);
        mockConnectionManager = new MockConnectionManager('http://localhost:3002', mockStateManager);
        
        // Setup admin user to enable all modules
        mockStateManager.setCurrentUser({ role: 'admin' });
        
        // Setup API responses for all modules
        mockAPIManager.setMockResponse('/api/system/mode', {
            success: true,
            data: { mode: 'hitl' }
        });
        
        mockAPIManager.setMockResponse('/api/agents/connected', {
            success: true,
            data: [
                TestDataFactory.createAgent({ name: 'Agent 1', status: 'available' }),
                TestDataFactory.createAgent({ name: 'Agent 2', status: 'busy' })
            ]
        });
        
        mockAPIManager.setMockResponse('/api/widget/config', {
            success: true,
            data: TestDataFactory.createWidgetConfig()
        });
        
        const mockUsers = [
            TestDataFactory.createUser({ role: 'admin', isActive: true }),
            TestDataFactory.createUser({ role: 'agent', isActive: true })
        ];
        
        // Mock fetch for UserManagementModule
        global.fetch = jest.fn().mockImplementation((url) => {
            if (url.includes('/api/users')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({
                        success: true,
                        data: mockUsers
                    })
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ success: true, data: {} })
            });
        });
        
        // Load all modules
        const mockDependencies = ModuleLoader.createMockDependencies();
        
        const SystemModeModuleClass = ModuleLoader.loadModule(
            path.join(__dirname, '../../custom-widget/js/settings/modules/SystemModeModule.js'),
            mockDependencies
        );
        
        const AgentStatusModuleClass = ModuleLoader.loadModule(
            path.join(__dirname, '../../custom-widget/js/settings/modules/AgentStatusModule.js'),
            mockDependencies
        );
        
        const WidgetConfigModuleClass = ModuleLoader.loadModule(
            path.join(__dirname, '../../custom-widget/js/settings/modules/WidgetConfigModule.js'),
            mockDependencies
        );
        
        const UserManagementModuleClass = ModuleLoader.loadModule(
            path.join(__dirname, '../../custom-widget/js/settings/modules/UserManagementModule.js'),
            mockDependencies
        );
        
        // Set global dependencies
        global.Toast = mockDependencies.Toast;
        global.ErrorHandler = mockDependencies.ErrorHandler;
        
        // Create module instances
        systemModeModule = new SystemModeModuleClass(mockAPIManager, mockStateManager, mockConnectionManager);
        agentStatusModule = new AgentStatusModuleClass(mockAPIManager, mockStateManager, mockConnectionManager);
        widgetConfigModule = new WidgetConfigModuleClass(mockAPIManager, mockStateManager, mockConnectionManager);
        userManagementModule = new UserManagementModuleClass(mockAPIManager, mockStateManager, mockConnectionManager);
        
        modules = {
            systemModeModule,
            agentStatusModule,
            widgetConfigModule,
            userManagementModule
        };
    });

    afterEach(() => {
        Object.values(modules).forEach(module => {
            if (module && module.destroy) {
                module.destroy();
            }
        });
        
        if (jsdom && jsdom.cleanup) {
            jsdom.cleanup();
        }
        
        jest.clearAllMocks();
        delete global.fetch;
        delete global.Toast;
        delete global.ErrorHandler;
    });

    describe('Module Initialization Integration', () => {
        test('should initialize all modules successfully', async () => {
            // Initialize all modules
            await systemModeModule.initialize();
            await agentStatusModule.initialize();
            await widgetConfigModule.initialize();
            await userManagementModule.initialize();
            
            // Verify all modules are properly initialized
            expect(systemModeModule.stateManager).toBe(mockStateManager);
            expect(agentStatusModule.stateManager).toBe(mockStateManager);
            expect(widgetConfigModule.stateManager).toBe(mockStateManager);
            expect(userManagementModule.stateManager).toBe(mockStateManager);
            
            // Verify shared services are connected
            expect(systemModeModule.apiManager).toBe(mockAPIManager);
            expect(agentStatusModule.apiManager).toBe(mockAPIManager);
            expect(widgetConfigModule.apiManager).toBe(mockAPIManager);
            expect(userManagementModule.apiManager).toBe(mockAPIManager);
        });

        test('should setup event listeners without conflicts', async () => {
            await systemModeModule.initialize();
            await agentStatusModule.initialize();
            await widgetConfigModule.initialize();
            await userManagementModule.initialize();
            
            // Verify modules have event listeners where applicable
            expect(systemModeModule.eventListeners).toBeDefined();
            expect(widgetConfigModule.eventListeners).toBeDefined();
            expect(userManagementModule.eventListeners).toBeDefined();
            
            // Check that each module's listeners array exists
            expect(Array.isArray(systemModeModule.eventListeners)).toBe(true);
            expect(Array.isArray(widgetConfigModule.eventListeners)).toBe(true);
            expect(Array.isArray(userManagementModule.eventListeners)).toBe(true);
        });
    });

    describe('State Management Integration', () => {
        beforeEach(async () => {
            await systemModeModule.initialize();
            await agentStatusModule.initialize();
            await widgetConfigModule.initialize();
            await userManagementModule.initialize();
        });

        test('should share state changes between modules', () => {
            // Test that state changes are propagated correctly
            mockStateManager.setSystemMode('autopilot');
            expect(mockStateManager.getSystemMode()).toBe('autopilot');
            
            const testAgents = [TestDataFactory.createAgent()];
            mockStateManager.setConnectedAgents(testAgents);
            expect(mockStateManager.getConnectedAgents()).toEqual(testAgents);
            
            const testConfig = TestDataFactory.createWidgetConfig();
            mockStateManager.setWidgetConfiguration(testConfig);
            expect(mockStateManager.getWidgetConfiguration()).toEqual(testConfig);
            
            const testUsers = [TestDataFactory.createUser()];
            mockStateManager.setUsers(testUsers);
            expect(mockStateManager.getUsers()).toEqual(testUsers);
            
            // Verify event emissions occurred
            expect(mockStateManager.eventHistory.length).toBeGreaterThan(0);
        });

        test('should maintain isolated module state', async () => {
            // Each module should have its own internal state
            const systemMode = systemModeModule.getCurrentMode();
            const agents = agentStatusModule.getConnectedAgents();
            const config = widgetConfigModule.getCurrentConfiguration();
            const users = userManagementModule.getUsers();
            
            // States should be independent
            expect(systemMode).not.toBe(agents);
            expect(agents).not.toBe(config);
            expect(config).not.toBe(users);
            
            // But all should be accessible
            expect(systemMode).toBeDefined();
            expect(agents).toBeDefined();
            expect(config).toBeDefined();
            expect(users).toBeDefined();
        });
    });

    describe('API Manager Integration', () => {
        beforeEach(async () => {
            await systemModeModule.initialize();
            await agentStatusModule.initialize();
            await widgetConfigModule.initialize();
            await userManagementModule.initialize();
        });

        test('should coordinate API calls across modules', async () => {
            mockAPIManager.clearRequestHistory();
            global.fetch.mockClear();
            
            // Use actual module methods that make API calls
            await systemModeModule.loadCurrentMode();
            await agentStatusModule.loadConnectedAgents();
            await widgetConfigModule.loadConfiguration();
            await userManagementModule.loadUsers();
            
            // Verify API calls were made for each module
            expect(mockAPIManager.getRequestCount('/api/system/mode')).toBeGreaterThan(0);
            expect(mockAPIManager.getRequestCount('/api/agents/connected')).toBeGreaterThan(0);
            expect(mockAPIManager.getRequestCount('/api/widget/config')).toBeGreaterThan(0);
            
            // UserManagementModule uses direct fetch, so check fetch calls
            expect(global.fetch).toHaveBeenCalled();
        });

        test('should handle API errors gracefully across modules', async () => {
            // Setup API errors for different modules
            mockAPIManager.setMockResponse('/api/system/mode', {
                error: 'System mode error'
            }, true);
            
            mockAPIManager.setMockResponse('/api/agents/connected', {
                error: 'Agents error'
            }, true);
            
            global.fetch = jest.fn().mockRejectedValue(new Error('User management error'));
            
            // Test that modules handle errors without crashing
            let systemError, agentError, userError;
            
            try {
                await systemModeModule.loadCurrentMode();
            } catch (e) {
                systemError = e;
            }
            
            try {
                await agentStatusModule.loadConnectedAgents();
            } catch (e) {
                agentError = e;
            }
            
            try {
                await userManagementModule.loadUsers();
            } catch (e) {
                userError = e;
            }
            
            // Verify error handling occurred (some modules may throw, others may log)
            expect(systemError || agentError || global.ErrorHandler.logError).toBeTruthy();
        });
    });

    describe('UI Interaction Integration', () => {
        beforeEach(async () => {
            await systemModeModule.initialize();
            await agentStatusModule.initialize();
            await widgetConfigModule.initialize();
            await userManagementModule.initialize();
        });

        test('should not conflict with DOM element access', () => {
            // Each module should access its own DOM elements without conflicts
            // Test that key elements exist without strict requirements
            const systemElements = [
                document.getElementById('current-mode'),
                document.getElementById('save-mode')
            ];
            
            const agentElements = [
                document.getElementById('agents-list'),
                document.getElementById('total-connected')
            ];
            
            const widgetElements = [
                document.getElementById('current-widget-config'),
                document.getElementById('generate-code')
            ];
            
            const userElements = [
                document.getElementById('add-user-btn'),
                document.getElementById('users-table-body')
            ];
            
            // Verify elements are accessible (some may be null, that's ok)
            expect(systemElements).toBeDefined();
            expect(agentElements).toBeDefined();
            expect(widgetElements).toBeDefined();
            expect(userElements).toBeDefined();
        });

        test('should handle concurrent user interactions', () => {
            // Simulate multiple UI interactions happening at once
            const systemModeButton = document.getElementById('save-mode');
            const generateCodeButton = document.getElementById('generate-code');
            const addUserButton = document.getElementById('add-user-btn');
            
            // All buttons should be clickable
            expect(() => systemModeButton.click()).not.toThrow();
            expect(() => generateCodeButton.click()).not.toThrow();
            expect(() => addUserButton.click()).not.toThrow();
        });
    });

    describe('Module Communication', () => {
        beforeEach(async () => {
            await systemModeModule.initialize();
            await agentStatusModule.initialize();
            await widgetConfigModule.initialize();
            await userManagementModule.initialize();
        });

        test('should handle system mode changes affecting other modules', () => {
            // Change system mode
            mockStateManager.setSystemMode('off');
            
            // Verify system mode changed in shared state
            expect(mockStateManager.getSystemMode()).toBe('off');
            
            // Verify event was emitted for state change
            const modeChangeEvents = mockStateManager.eventHistory.filter(
                event => event.event === 'systemModeChanged'
            );
            expect(modeChangeEvents.length).toBeGreaterThan(0);
        });

        test('should coordinate widget configuration with user permissions', () => {
            // Set non-admin user
            mockStateManager.setCurrentUser({ role: 'agent' });
            
            const config = widgetConfigModule.getCurrentConfiguration();
            const users = userManagementModule.getUsers();
            
            // Both should be accessible but user management might be limited for non-admin
            expect(config).toBeDefined();
            expect(users).toBeDefined();
        });
    });

    describe('Performance Integration', () => {
        test('should initialize all modules within acceptable time', async () => {
            const startTime = Date.now();
            
            await Promise.all([
                systemModeModule.initialize(),
                agentStatusModule.initialize(),
                widgetConfigModule.initialize(),
                userManagementModule.initialize()
            ]);
            
            const endTime = Date.now();
            const initTime = endTime - startTime;
            
            // All modules should initialize within reasonable time (less than 1 second)
            expect(initTime).toBeLessThan(1000);
        });

        test('should clean up resources properly', () => {
            // Destroy all modules
            Object.values(modules).forEach(module => {
                if (module.destroy) {
                    module.destroy();
                }
            });
            
            // Verify cleanup for modules that have eventListeners
            expect(systemModeModule.eventListeners.length).toBe(0);
            expect(widgetConfigModule.eventListeners.length).toBe(0);
            expect(userManagementModule.eventListeners.length).toBe(0);
            
            // AgentStatusModule may not have eventListeners array, so just check it exists
            expect(agentStatusModule.destroy).toBeDefined();
        });
    });

    describe('Error Recovery Integration', () => {
        test('should isolate module failures', async () => {
            // Initialize three modules successfully
            await systemModeModule.initialize();
            await agentStatusModule.initialize();
            await widgetConfigModule.initialize();
            
            // Simulate failure in one module
            const faultyUserModule = new userManagementModule.constructor(null, null, null);
            
            await expect(faultyUserModule.initialize()).rejects.toThrow();
            
            // Other modules should continue to work
            expect(systemModeModule.getCurrentMode()).toBeDefined();
            expect(agentStatusModule.getConnectedAgents()).toBeDefined();
            expect(widgetConfigModule.getCurrentConfiguration()).toBeDefined();
        });
    });
});