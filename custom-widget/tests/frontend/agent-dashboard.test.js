/**
 * Frontend tests for Agent Dashboard functionality
 * Tests the agent dropdown, assignment functionality, and real agent fetching
 */

// Mock global fetch function
global.fetch = jest.fn();

// Mock DOM elements and methods
const mockElement = {
    classList: {
        add: jest.fn(),
        remove: jest.fn(),
        toggle: jest.fn(),
        contains: jest.fn()
    },
    innerHTML: '',
    textContent: '',
    style: {},
    addEventListener: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    getAttribute: jest.fn(),
    setAttribute: jest.fn()
};

// Mock document
global.document = {
    getElementById: jest.fn(() => mockElement),
    createElement: jest.fn(() => mockElement),
    querySelectorAll: jest.fn(() => []),
    addEventListener: jest.fn(),
    body: { appendChild: jest.fn(), dataset: {} }
};

// Mock window
global.window = {
    location: {
        protocol: 'http:',
        hostname: 'localhost'
    },
    localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn()
    }
};

// Import the AgentDashboard class
const AgentDashboard = require('../../js/agent-dashboard.js');

describe('AgentDashboard', () => {
    let dashboard;
    const mockApiUrl = 'http://localhost:3002';

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        global.fetch.mockClear();
        
        // Setup localStorage mock for authenticated agent
        global.window.localStorage.getItem.mockImplementation((key) => {
            if (key === 'agentUser') {
                return JSON.stringify({ email: 'admin@vilnius.lt' });
            }
            return null;
        });

        // Create dashboard instance
        dashboard = new AgentDashboard({ apiUrl: mockApiUrl });
    });

    describe('Agent Authentication', () => {
        it('should get authenticated agent ID from localStorage', () => {
            const agentId = dashboard.getAuthenticatedAgentId();
            expect(agentId).toBe('admin');
        });

        it('should handle missing localStorage data', () => {
            global.window.localStorage.getItem.mockReturnValue(null);
            dashboard = new AgentDashboard({ apiUrl: mockApiUrl });
            
            const agentId = dashboard.getAuthenticatedAgentId();
            expect(agentId).toMatch(/^agent-[a-z0-9]+$/); // Fallback random ID
        });

        it('should handle malformed JSON in localStorage', () => {
            global.window.localStorage.getItem.mockReturnValue('invalid-json');
            dashboard = new AgentDashboard({ apiUrl: mockApiUrl });
            
            const agentId = dashboard.getAuthenticatedAgentId();
            expect(agentId).toMatch(/^agent-[a-z0-9]+$/); // Fallback random ID
        });
    });

    describe('Agent Dropdown Functionality', () => {
        const mockAgentsResponse = {
            agents: [
                {
                    id: 'agent1',
                    name: 'Agent User',
                    status: 'offline',
                    connected: false
                },
                {
                    id: 'admin',
                    name: 'Admin User', 
                    status: 'online',
                    connected: true
                }
            ]
        };

        beforeEach(() => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(mockAgentsResponse)
            });
        });

        it('should fetch agents from /api/agents/all endpoint', async () => {
            await dashboard.renderAgentOptions('conv123');

            expect(global.fetch).toHaveBeenCalledWith(`${mockApiUrl}/api/agents/all`);
        });

        it('should filter out current agent from dropdown options', async () => {
            // Set dashboard agent ID to 'admin'
            dashboard.agentId = 'admin';
            
            const result = await dashboard.renderAgentOptions('conv123');
            
            expect(result).toContain('agent1');
            expect(result).not.toContain('onclick="dashboard.assignToAgent(\'conv123\', \'admin\'');
        });

        it('should display online agents with green status dots', async () => {
            const result = await dashboard.renderAgentOptions('conv123');
            
            expect(result).toContain('bg-green-500'); // Online status dot
            expect(result).toContain('text-gray-900'); // Online agent text color
        });

        it('should display offline agents with gray status dots and (offline) label', async () => {
            const result = await dashboard.renderAgentOptions('conv123');
            
            expect(result).toContain('bg-gray-400'); // Offline status dot
            expect(result).toContain('text-gray-500'); // Offline agent text color
            expect(result).toContain('(offline)'); // Offline label
        });

        it('should sort online agents before offline agents', async () => {
            const result = await dashboard.renderAgentOptions('conv123');
            
            // Admin (online) should appear before agent1 (offline)
            const adminIndex = result.indexOf('Admin User');
            const agent1Index = result.indexOf('Agent User');
            expect(adminIndex).toBeLessThan(agent1Index);
        });

        it('should handle API errors gracefully', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                status: 500
            });

            const result = await dashboard.renderAgentOptions('conv123');
            
            expect(result).toContain('Error loading agents');
        });

        it('should handle network errors gracefully', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));

            const result = await dashboard.renderAgentOptions('conv123');
            
            expect(result).toContain('Error loading agents');
        });

        it('should handle empty agent list', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ agents: [] })
            });

            const result = await dashboard.renderAgentOptions('conv123');
            
            expect(result).toContain('No other agents available');
        });
    });

    describe('Dropdown Toggle Functionality', () => {
        beforeEach(() => {
            // Mock dropdown element
            const mockDropdown = {
                ...mockElement,
                classList: {
                    ...mockElement.classList,
                    contains: jest.fn().mockReturnValue(true) // Initially hidden
                }
            };
            document.getElementById.mockReturnValue(mockDropdown);

            // Mock fetch for agent options
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    agents: [{ id: 'agent1', name: 'Agent User', connected: false }]
                })
            });
        });

        it('should toggle dropdown visibility', async () => {
            const mockEvent = { stopPropagation: jest.fn() };
            
            await dashboard.toggleAssignDropdown('conv123', mockEvent);

            expect(mockEvent.stopPropagation).toHaveBeenCalled();
            expect(mockElement.classList.toggle).toHaveBeenCalledWith('hidden');
        });

        it('should show loading message while fetching agents', async () => {
            const mockEvent = { stopPropagation: jest.fn() };
            
            // Make fetch take some time
            let resolvePromise;
            const fetchPromise = new Promise(resolve => { resolvePromise = resolve; });
            global.fetch.mockReturnValue(fetchPromise);

            const togglePromise = dashboard.toggleAssignDropdown('conv123', mockEvent);
            
            expect(mockElement.innerHTML).toBe('<div class="px-3 py-2 text-xs text-gray-500">Loading...</div>');
            
            // Resolve the fetch
            resolvePromise({
                ok: true,
                json: jest.fn().mockResolvedValue({ agents: [] })
            });
            
            await togglePromise;
        });

        it('should close other dropdowns when opening new one', async () => {
            const otherDropdowns = [
                { ...mockElement, id: 'assign-dropdown-other1' },
                { ...mockElement, id: 'assign-dropdown-other2' }
            ];
            
            document.querySelectorAll.mockReturnValue(otherDropdowns);

            await dashboard.toggleAssignDropdown('conv123');

            otherDropdowns.forEach(dropdown => {
                expect(dropdown.classList.add).toHaveBeenCalledWith('hidden');
            });
        });
    });

    describe('Agent Assignment', () => {
        beforeEach(() => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ success: true })
            });
        });

        it('should assign conversation to specified agent', async () => {
            const mockEvent = { stopPropagation: jest.fn() };
            
            await dashboard.assignToAgent('conv123', 'agent1', mockEvent);

            expect(global.fetch).toHaveBeenCalledWith(
                `${mockApiUrl}/api/conversations/conv123/assign`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ agentId: 'agent1' })
                }
            );
        });

        it('should close dropdown after assignment', async () => {
            const mockEvent = { stopPropagation: jest.fn() };
            const mockDropdown = { ...mockElement };
            document.getElementById.mockReturnValue(mockDropdown);

            await dashboard.assignToAgent('conv123', 'agent1', mockEvent);

            expect(mockDropdown.classList.add).toHaveBeenCalledWith('hidden');
        });

        it('should reload conversations after successful assignment', async () => {
            const mockEvent = { stopPropagation: jest.fn() };
            dashboard.loadConversations = jest.fn();

            await dashboard.assignToAgent('conv123', 'agent1', mockEvent);

            expect(dashboard.loadConversations).toHaveBeenCalled();
        });

        it('should handle assignment errors', async () => {
            global.fetch.mockResolvedValue({
                ok: false,
                status: 500
            });

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            
            await dashboard.assignToAgent('conv123', 'agent1');

            expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to assign conversation:', 500);
            
            consoleErrorSpy.mockRestore();
        });
    });

    describe('Integration with Real API', () => {
        it('should handle legitimate agents filtering on frontend', async () => {
            // Mock API response with mix of legitimate and fake agents
            const mixedAgentsResponse = {
                agents: [
                    { id: 'agent1', name: 'Agent User', connected: false },
                    { id: 'admin', name: 'Admin User', connected: true },
                    { id: 'agent2', name: 'Agent User', connected: false }, // This should be filtered out by backend
                    { id: 'agent-random123', name: 'Agent User', connected: false } // This should be filtered out by backend
                ]
            };

            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(mixedAgentsResponse)
            });

            // Set current agent to admin
            dashboard.agentId = 'admin';

            const result = await dashboard.renderAgentOptions('conv123');
            
            // Should include all agents from API response except current agent
            expect(result).toContain('agent1');
            expect(result).toContain('agent2'); // Backend filtering should have removed this, but if present, frontend handles it
            expect(result).not.toContain('admin'); // Current agent excluded
        });

        it('should maintain backward compatibility with connection status', async () => {
            const agentsWithoutConnectedField = {
                agents: [
                    { id: 'agent1', name: 'Agent User', status: 'offline' }, // Missing 'connected' field
                    { id: 'admin', name: 'Admin User', status: 'online' }
                ]
            };

            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(agentsWithoutConnectedField)
            });

            const result = await dashboard.renderAgentOptions('conv123');
            
            // Should handle missing 'connected' field gracefully
            expect(result).toContain('Agent User');
            expect(result).toContain('Admin User');
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed API responses', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({ invalidStructure: true })
            });

            const result = await dashboard.renderAgentOptions('conv123');
            
            expect(result).toContain('No other agents available');
        });

        it('should handle API timeout', async () => {
            global.fetch.mockImplementation(() => 
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 100)
                )
            );

            const result = await dashboard.renderAgentOptions('conv123');
            
            expect(result).toContain('Error loading agents');
        });
    });
});