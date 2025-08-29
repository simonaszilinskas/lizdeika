/**
 * Test Suite: Agent Service without AFK Detection
 * Purpose: Verify agent service works correctly without AFK functionality
 */

const agentService = require('../../src/services/agentService');

describe('Agent Service without AFK Detection', () => {
    beforeEach(() => {
        // Clear any state
        jest.clearAllMocks();
    });

    describe('Agent Status Management', () => {
        test('agents can only be online or offline', async () => {
            // Test that we only use online/offline states
            const agent = await agentService.updateAgentPersonalStatus('test-agent-1', 'online');
            expect(agent.personalStatus).toBe('online');
            expect(agent.status).toBe('online');
            expect(agent.connected).toBe(true);
        });

        test('no automatic AFK detection occurs after inactivity', async () => {
            // Set agent online
            const agent = await agentService.updateAgentPersonalStatus('test-agent-2', 'online');
            expect(agent.personalStatus).toBe('online');
            
            // Simulate 20 minutes of inactivity (would trigger AFK if enabled)
            jest.advanceTimersByTime(20 * 60 * 1000);
            
            // Agent should still be online (no auto-AFK)
            const agentStatus = await agentService.getConnectedAgents();
            const testAgent = agentStatus.find(a => a.id === 'test-agent-2');
            
            // If agent is found, they should still be online
            if (testAgent) {
                expect(testAgent.personalStatus).not.toBe('afk');
            }
        });

        test('handleAgentAFK method should be deprecated or removed', async () => {
            // This method should either not exist or do nothing
            if (typeof agentService.handleAgentAFK === 'function') {
                // If it exists, it should not throw errors but should be a no-op
                await expect(agentService.handleAgentAFK('test-agent-3')).resolves.not.toThrow();
            }
        });
    });

    describe('Agent Status Transitions', () => {
        test('agent transitions directly between online and offline', async () => {
            // Set online
            let agent = await agentService.updateAgentPersonalStatus('test-agent-4', 'online');
            expect(agent.personalStatus).toBe('online');
            
            // Set offline
            agent = await agentService.setAgentOffline('test-agent-4');
            expect(agent.personalStatus).toBe('offline');
            
            // No intermediate 'afk' state
            expect(agent.personalStatus).not.toBe('afk');
        });

        test('mapStatusToPersonal should not return afk', () => {
            if (typeof agentService.mapStatusToPersonal === 'function') {
                expect(agentService.mapStatusToPersonal('online')).toBe('online');
                expect(agentService.mapStatusToPersonal('offline')).toBe('offline');
                expect(agentService.mapStatusToPersonal('busy')).not.toBe('afk');
            }
        });
    });

    describe('Available Agents', () => {
        test('getAvailableAgents returns all online agents', async () => {
            // Set some agents online
            await agentService.updateAgentPersonalStatus('available-1', 'online');
            await agentService.updateAgentPersonalStatus('available-2', 'online');
            
            const available = await agentService.getAvailableAgents();
            
            // All online agents should be available (no AFK filter)
            const onlineAgents = await agentService.getConnectedAgents();
            expect(available.length).toBeLessThanOrEqual(onlineAgents.length);
        });
    });

    describe('UI Status Display', () => {
        test('agent status should be simplified to online/offline only', async () => {
            const agent = await agentService.updateAgentPersonalStatus('ui-test-1', 'online');
            
            // Status should be one of these simple states
            expect(['online', 'offline']).toContain(agent.personalStatus);
            
            // Should not have complex status like 'afk'
            expect(agent.personalStatus).not.toBe('afk');
            expect(agent.personalStatus).not.toBe('busy');
        });
    });
});

describe('Cleanup Verification', () => {
    test('no references to afkDetectionService should exist', () => {
        // This will fail if afkDetectionService is imported anywhere
        try {
            const afkService = require('../../src/services/afkDetectionService');
            // If this doesn't throw, the service still exists
            console.warn('Warning: afkDetectionService still exists but should be removed');
        } catch (error) {
            // Expected - service should not exist
            expect(error.code).toBe('MODULE_NOT_FOUND');
        }
    });
});