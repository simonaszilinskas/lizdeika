/**
 * Unit tests for Agent Controller
 * Tests HTTP endpoints for agent management, assignment, and status updates
 */
const AgentController = require('../../src/controllers/agentController');
const agentService = require('../../src/services/agentService');
const conversationService = require('../../src/services/conversationService');

// Mock dependencies
jest.mock('../../src/services/agentService');
jest.mock('../../src/services/conversationService');

describe('AgentController', () => {
    let agentController;
    let mockIo;
    let req, res;

    beforeEach(() => {
        // Mock Socket.io
        mockIo = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn()
        };

        // Create controller instance
        agentController = new AgentController(mockIo);

        // Mock request and response objects
        req = {
            body: {},
            params: {}
        };

        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('getAllAgents', () => {
        it('should return filtered list of legitimate agents with connection status', async () => {
            // Mock data - simulate database with many test agents and some real ones
            const mockAllAgents = [
                { id: 'agent-random123', name: 'Agent User', status: 'offline' },
                { id: 'agent-test456', name: 'Agent User', status: 'offline' },
                { id: 'agent1', name: 'Agent User', status: 'online' },
                { id: 'admin', name: 'Admin User', status: 'online' },
                { id: 'agent2', name: 'Agent User', status: 'offline' }, // Fake agent created by mistake
                { id: 'agent-another789', name: 'Agent User', status: 'offline' }
            ];

            const mockConnectedAgents = [
                { id: 'admin', name: 'Admin User', connected: true },
                { id: 'agent1', name: 'Agent User', connected: true }
            ];

            agentService.getAllAgents.mockResolvedValue(mockAllAgents);
            agentService.getConnectedAgents.mockResolvedValue(mockConnectedAgents);

            await agentController.getAllAgents(req, res);

            expect(agentService.getAllAgents).toHaveBeenCalled();
            expect(agentService.getConnectedAgents).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({
                agents: [
                    { id: 'agent1', name: 'Agent User', status: 'online', connected: true },
                    { id: 'admin', name: 'Admin User', status: 'online', connected: true }
                ]
            });
        });

        it('should only return admin and agent1 (filter out fake agents)', async () => {
            const mockAllAgents = [
                { id: 'agent1', name: 'Agent User', status: 'offline' },
                { id: 'admin', name: 'Admin User', status: 'online' },
                { id: 'agent2', name: 'Agent User', status: 'offline' }, // Should be filtered out
                { id: 'agent3', name: 'Agent User', status: 'offline' }, // Should be filtered out
                { id: 'agent-random', name: 'Agent User', status: 'offline' } // Should be filtered out
            ];

            const mockConnectedAgents = [{ id: 'admin', name: 'Admin User', connected: true }];

            agentService.getAllAgents.mockResolvedValue(mockAllAgents);
            agentService.getConnectedAgents.mockResolvedValue(mockConnectedAgents);

            await agentController.getAllAgents(req, res);

            const responseCall = res.json.mock.calls[0][0];
            expect(responseCall.agents).toHaveLength(2);
            expect(responseCall.agents.map(a => a.id)).toEqual(['agent1', 'admin']);
        });

        it('should mark agents as connected/disconnected correctly', async () => {
            const mockAllAgents = [
                { id: 'agent1', name: 'Agent User', status: 'offline' },
                { id: 'admin', name: 'Admin User', status: 'online' }
            ];

            const mockConnectedAgents = [
                { id: 'admin', name: 'Admin User' } // Only admin is connected
            ];

            agentService.getAllAgents.mockResolvedValue(mockAllAgents);
            agentService.getConnectedAgents.mockResolvedValue(mockConnectedAgents);

            await agentController.getAllAgents(req, res);

            const responseCall = res.json.mock.calls[0][0];
            const agent1 = responseCall.agents.find(a => a.id === 'agent1');
            const admin = responseCall.agents.find(a => a.id === 'admin');

            expect(agent1.connected).toBe(false);
            expect(admin.connected).toBe(true);
        });

        it('should handle empty agent list', async () => {
            agentService.getAllAgents.mockResolvedValue([]);
            agentService.getConnectedAgents.mockResolvedValue([]);

            await agentController.getAllAgents(req, res);

            expect(res.json).toHaveBeenCalledWith({ agents: [] });
        });

        it('should handle service errors gracefully', async () => {
            const error = new Error('Database connection failed');
            agentService.getAllAgents.mockRejectedValue(error);

            await agentController.getAllAgents(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Failed to get all agents' });
        });

        it('should handle connected agents service error gracefully', async () => {
            agentService.getAllAgents.mockResolvedValue([
                { id: 'agent1', name: 'Agent User' },
                { id: 'admin', name: 'Admin User' }
            ]);
            agentService.getConnectedAgents.mockRejectedValue(new Error('Connection service error'));

            await agentController.getAllAgents(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Failed to get all agents' });
        });
    });

    describe('getActiveAgents', () => {
        it('should return active agents from service', async () => {
            const mockActiveAgents = [
                { id: 'agent1', name: 'Agent User', status: 'online' },
                { id: 'admin', name: 'Admin User', status: 'online' }
            ];

            agentService.getActiveAgents.mockResolvedValue(mockActiveAgents);

            await agentController.getActiveAgents(req, res);

            expect(agentService.getActiveAgents).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({ agents: mockActiveAgents });
        });

        it('should handle service errors', async () => {
            agentService.getActiveAgents.mockRejectedValue(new Error('Service error'));

            await agentController.getActiveAgents(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Failed to get active agents' });
        });
    });

    describe('getConnectedAgents', () => {
        it('should return connected agents with system mode', async () => {
            const mockConnectedAgents = [{ id: 'admin', name: 'Admin User' }];
            const mockSystemMode = 'hitl';

            agentService.getConnectedAgents.mockResolvedValue(mockConnectedAgents);
            agentService.getSystemMode.mockResolvedValue(mockSystemMode);

            await agentController.getConnectedAgents(req, res);

            expect(agentService.getConnectedAgents).toHaveBeenCalled();
            expect(agentService.getSystemMode).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({
                agents: mockConnectedAgents,
                systemMode: mockSystemMode
            });
        });

        it('should handle service errors', async () => {
            agentService.getConnectedAgents.mockRejectedValue(new Error('Service error'));

            await agentController.getConnectedAgents(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Failed to get connected agents' });
        });
    });

    describe('updatePersonalStatus', () => {
        it('should update agent personal status and handle reassignments', async () => {
            req.body = {
                agentId: 'agent1',
                personalStatus: 'offline'
            };

            const mockPreviousAgent = { personalStatus: 'online' };
            const mockUpdatedAgent = { id: 'agent1', personalStatus: 'offline' };
            const mockReassignments = [
                { conversationId: 'conv1', fromAgent: 'agent1', toAgent: 'admin' }
            ];
            const mockConnectedAgents = [{ id: 'admin', name: 'Admin User' }];

            agentService.getAgent.mockResolvedValue(mockPreviousAgent);
            agentService.updateAgentPersonalStatus.mockResolvedValue(mockUpdatedAgent);
            // handleAgentAFK is deprecated after AFK removal
            agentService.getConnectedAgents.mockResolvedValue(mockConnectedAgents);

            await agentController.updatePersonalStatus(req, res);

            expect(agentService.getAgent).toHaveBeenCalledWith('agent1');
            expect(agentService.updateAgentPersonalStatus).toHaveBeenCalledWith('agent1', 'offline', conversationService);
            expect(mockIo.to).toHaveBeenCalledWith('agents');
            expect(mockIo.emit).toHaveBeenCalledWith('connected-agents-update', { agents: mockConnectedAgents });
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                agent: mockUpdatedAgent,
                reassignments: mockReassignments.length
            });
        });

        it('should validate required fields', async () => {
            req.body = { agentId: 'agent1' }; // Missing personalStatus

            await agentController.updatePersonalStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Agent ID and personal status are required' });
        });

        it('should validate personal status values', async () => {
            req.body = {
                agentId: 'agent1',
                personalStatus: 'invalid'
            };

            await agentController.updatePersonalStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Personal status must be online or offline' });
        });

        it('should handle agent coming back online', async () => {
            req.body = {
                agentId: 'agent1',
                personalStatus: 'online'
            };

            const mockPreviousAgent = { personalStatus: 'offline' };
            const mockUpdatedAgent = { id: 'agent1', personalStatus: 'online' };
            const mockReclaims = [{ conversationId: 'conv1', toAgent: 'agent1' }];
            const mockRedistributions = [{ conversationId: 'conv2', toAgent: 'agent1' }];

            agentService.getAgent.mockResolvedValue(mockPreviousAgent);
            agentService.updateAgentPersonalStatus.mockResolvedValue(mockUpdatedAgent);
            agentService.handleAgentBackOnline.mockResolvedValue(mockReclaims);
            agentService.redistributeOrphanedTickets.mockResolvedValue(mockRedistributions);
            agentService.getConnectedAgents.mockResolvedValue([]);

            await agentController.updatePersonalStatus(req, res);

            expect(agentService.handleAgentBackOnline).toHaveBeenCalledWith('agent1', conversationService);
            expect(agentService.redistributeOrphanedTickets).toHaveBeenCalledWith(conversationService, 2);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                agent: mockUpdatedAgent,
                reassignments: 2 // reclaims + redistributions
            });
        });
    });
});