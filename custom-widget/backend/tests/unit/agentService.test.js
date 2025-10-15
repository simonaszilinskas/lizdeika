/**
 * Unit tests for Agent Service
 * Tests agent status, load balancing, statistics, and UUID handling
 */
const agentService = require('../../src/services/agentService');
const databaseClient = require('../../src/utils/database');
const { v4: uuidv4 } = require('uuid');

describe('AgentService', () => {
    let mockPrisma;
    let mockUsers;
    let mockAgentStatuses;

    beforeEach(() => {
        mockPrisma = databaseClient.getClient();
        mockUsers = new Map();
        mockAgentStatuses = new Map();

        // Mock database operations
        mockPrisma.users.findUnique = jest.fn((args) => {
            for (const user of mockUsers.values()) {
                if (args.where.email === user.email || args.where.id === user.id) {
                    return Promise.resolve(user);
                }
            }
            return Promise.resolve(null);
        });

        mockPrisma.users.findFirst = jest.fn((args) => {
            for (const user of mockUsers.values()) {
                const matchesId = args.where?.id === user.id;
                const matchesEmail = args.where?.OR?.some(cond =>
                    cond.email === user.email ||
                    (cond.email?.contains && user.email.includes(cond.email.contains))
                );
                const matchesRole = !args.where?.role?.in || args.where.role.in.includes(user.role);

                if ((matchesId || matchesEmail) && matchesRole) {
                    return Promise.resolve({
                        ...user,
                        agent_status: mockAgentStatuses.get(user.id)
                    });
                }
            }
            return Promise.resolve(null);
        });

        mockPrisma.users.findMany = jest.fn((args) => {
            let users = Array.from(mockUsers.values());

            if (args?.where?.role?.in) {
                users = users.filter(u => args.where.role.in.includes(u.role));
            }

            if (args?.where?.agent_status) {
                users = users.filter(u => {
                    const status = mockAgentStatuses.get(u.id);
                    if (!status) return false;

                    const statusMatch = !args.where.agent_status.status?.in ||
                        args.where.agent_status.status.in.includes(status.status);

                    const timeMatch = !args.where.agent_status.updated_at?.gte ||
                        new Date(status.updated_at) >= new Date(args.where.agent_status.updated_at.gte);

                    return statusMatch && timeMatch;
                });
            }

            return Promise.resolve(users.map(u => ({
                ...u,
                agent_status: mockAgentStatuses.get(u.id)
            })));
        });

        mockPrisma.users.count = jest.fn((args) => {
            let users = Array.from(mockUsers.values());
            if (args?.where?.role?.in) {
                users = users.filter(u => args.where.role.in.includes(u.role));
            }
            return Promise.resolve(users.length);
        });

        mockPrisma.users.upsert = jest.fn((args) => {
            const email = args.where.email;
            let user = Array.from(mockUsers.values()).find(u => u.email === email);

            if (user) {
                user = { ...user, ...args.update };
            } else {
                user = { id: uuidv4(), ...args.create };
            }

            mockUsers.set(user.id, user);
            return Promise.resolve(user);
        });

        mockPrisma.agent_status.upsert = jest.fn((args) => {
            const userId = args.where.user_id;
            let status = mockAgentStatuses.get(userId);

            if (status) {
                status = { ...status, ...args.update };
            } else {
                status = { id: uuidv4(), user_id: userId, ...args.create };
            }

            mockAgentStatuses.set(userId, status);
            return Promise.resolve(status);
        });

        mockPrisma.agent_status.count = jest.fn((args) => {
            let statuses = Array.from(mockAgentStatuses.values());

            if (args?.where?.status) {
                statuses = statuses.filter(s => s.status === args.where.status);
            }

            if (args?.where?.updated_at?.gte) {
                const cutoff = new Date(args.where.updated_at.gte);
                statuses = statuses.filter(s => new Date(s.updated_at) >= cutoff);
            }

            return Promise.resolve(statuses.length);
        });

        mockPrisma.agent_status.deleteMany = jest.fn(() => {
            mockAgentStatuses.clear();
            return Promise.resolve({ count: 0 });
        });

        jest.clearAllMocks();
    });

    describe('Agent ID Handling (Regression Tests for UUID Migration)', () => {
        it('should return user UUID directly from getUserAgentId', () => {
            const userUUID = uuidv4();
            const user = {
                id: userUUID,
                email: 'agent@test.com',
                role: 'agent'
            };

            const agentId = agentService.getUserAgentId(user);

            expect(agentId).toBe(userUUID);
            expect(agentId).not.toBe('agent@test.com');
            expect(typeof agentId).toBe('string');
            // Verify it's a valid UUID format
            expect(agentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        });

        it('should handle admin users with UUID', () => {
            const adminUUID = uuidv4();
            const admin = {
                id: adminUUID,
                email: 'admin@test.com',
                role: 'admin'
            };

            const agentId = agentService.getUserAgentId(admin);

            expect(agentId).toBe(adminUUID);
            expect(agentId).not.toBe('admin@test.com');
        });

        it('should handle agent users with UUID', () => {
            const agentUUID = uuidv4();
            const agent = {
                id: agentUUID,
                email: 'agent@vilnius.lt',
                role: 'agent'
            };

            const agentId = agentService.getUserAgentId(agent);

            expect(agentId).toBe(agentUUID);
            expect(agentId).not.toBe('agent@vilnius.lt');
        });

        it('should maintain consistency across multiple calls', () => {
            const userUUID = uuidv4();
            const user = {
                id: userUUID,
                email: 'consistent@test.com',
                role: 'agent'
            };

            const id1 = agentService.getUserAgentId(user);
            const id2 = agentService.getUserAgentId(user);
            const id3 = agentService.getUserAgentId(user);

            expect(id1).toBe(id2);
            expect(id2).toBe(id3);
            expect(id1).toBe(userUUID);
        });

        it('should return user.id even if it looks like an email', () => {
            // Edge case: what if someone has an email-like UUID (highly unlikely)
            const user = {
                id: 'test-uuid-12345',
                email: 'test@test.com',
                role: 'agent'
            };

            const agentId = agentService.getUserAgentId(user);

            expect(agentId).toBe('test-uuid-12345');
            expect(agentId).not.toBe('test@test.com');
        });
    });


    describe('Status Management', () => {
        it('should update agent personal status to online', async () => {
            const agentId = 'agent@test.com';
            const result = await agentService.updateAgentPersonalStatus(agentId, 'online');

            expect(result).toMatchObject({
                id: agentId,
                personalStatus: 'online',
                connected: true
            });
            expect(mockPrisma.agent_status.upsert).toHaveBeenCalled();
        });

        it('should update agent personal status to offline', async () => {
            const agentId = 'agent@test.com';
            const result = await agentService.updateAgentPersonalStatus(agentId, 'offline');

            expect(result).toMatchObject({
                id: agentId,
                personalStatus: 'offline',
                connected: false
            });
        });

        it('should set agent online with socket ID', async () => {
            const agentId = 'agent@test.com';
            const socketId = 'socket-123';
            const result = await agentService.setAgentOnline(agentId, socketId);

            expect(result).toMatchObject({
                id: agentId,
                status: 'online',
                socketId: socketId,
                connected: true
            });
        });

        it('should set agent offline', async () => {
            const agentId = 'agent@test.com';
            const result = await agentService.setAgentOffline(agentId);

            expect(result).toMatchObject({
                id: agentId,
                status: 'offline',
                connected: false
            });
        });

        it('should update agent activity timestamp', async () => {
            const agentId = 'agent@test.com';
            const result = await agentService.updateAgentActivity(agentId);

            expect(result).toBe(true);
            expect(mockPrisma.agent_status.upsert).toHaveBeenCalled();
        });
    });

    describe('Load Balancing', () => {
        it('should get best available agent', async () => {
            const userId = uuidv4();
            mockUsers.set(userId, {
                id: userId,
                email: 'agent@test.com',
                role: 'agent',
                first_name: 'Agent',
                last_name: 'User'
            });
            mockAgentStatuses.set(userId, {
                id: uuidv4(),
                user_id: userId,
                status: 'online',
                updated_at: new Date()
            });

            const agent = await agentService.getBestAvailableAgent();

            expect(agent).toBeDefined();
            expect(agent.status).toBe('online');
        });

        it('should return null when no agents available', async () => {
            const agent = await agentService.getBestAvailableAgent();
            expect(agent).toBeNull();
        });

        it('should prioritize most recently active agent for assignment', async () => {
            const staleAgentId = uuidv4();
            const activeAgentId = uuidv4();
            const now = new Date();
            const oneMinuteAgo = new Date(now.getTime() - 60000);

            mockUsers.set(staleAgentId, {
                id: staleAgentId,
                email: 'stale@test.com',
                role: 'agent',
                first_name: 'Stale',
                last_name: 'Agent'
            });
            mockUsers.set(activeAgentId, {
                id: activeAgentId,
                email: 'active@test.com',
                role: 'agent',
                first_name: 'Active',
                last_name: 'Agent'
            });

            mockAgentStatuses.set(staleAgentId, {
                id: uuidv4(),
                user_id: staleAgentId,
                status: 'online',
                updated_at: oneMinuteAgo
            });
            mockAgentStatuses.set(activeAgentId, {
                id: uuidv4(),
                user_id: activeAgentId,
                status: 'online',
                updated_at: now
            });

            const agent = await agentService.findBestAvailableAgent();

            expect(agent).toBeDefined();
            expect(agent.id).toBe(activeAgentId);
            expect(new Date(agent.lastSeen).getTime()).toBeGreaterThan(oneMinuteAgo.getTime());
        });

    });

    describe('Agent Discovery', () => {
        beforeEach(() => {
            const user1Id = uuidv4();
            const user2Id = uuidv4();
            const user3Id = uuidv4();

            mockUsers.set(user1Id, {
                id: user1Id,
                email: 'online@test.com',
                role: 'agent',
                first_name: 'Online',
                last_name: 'Agent'
            });
            mockUsers.set(user2Id, {
                id: user2Id,
                email: 'busy@test.com',
                role: 'agent',
                first_name: 'Busy',
                last_name: 'Agent'
            });
            mockUsers.set(user3Id, {
                id: user3Id,
                email: 'offline@test.com',
                role: 'agent',
                first_name: 'Offline',
                last_name: 'Agent'
            });

            mockAgentStatuses.set(user1Id, {
                id: uuidv4(),
                user_id: user1Id,
                status: 'online',
                updated_at: new Date()
            });
            mockAgentStatuses.set(user2Id, {
                id: uuidv4(),
                user_id: user2Id,
                status: 'busy',
                updated_at: new Date()
            });
            mockAgentStatuses.set(user3Id, {
                id: uuidv4(),
                user_id: user3Id,
                status: 'offline',
                updated_at: new Date()
            });
        });

        it('should get all agents', async () => {
            const agents = await agentService.getAllAgents();
            expect(agents.length).toBe(3);
        });

        it('should get available agents (online only)', async () => {
            const agents = await agentService.getAvailableAgents();
            expect(agents.length).toBe(1);
            expect(agents[0].status).toBe('online');
        });

        it('should get online agents (includes busy)', async () => {
            const agents = await agentService.getOnlineAgents();
            expect(agents.length).toBe(2);
        });

        it('should get connected agents', async () => {
            const agents = await agentService.getConnectedAgents();
            expect(agents.length).toBe(2);
        });
    });

    describe('Statistics & Performance', () => {
        it('should get agent stats with counts', async () => {
            const user1Id = uuidv4();
            const user2Id = uuidv4();

            mockUsers.set(user1Id, {
                id: user1Id,
                email: 'agent1@test.com',
                role: 'agent',
                first_name: 'Agent',
                last_name: 'One'
            });
            mockUsers.set(user2Id, {
                id: user2Id,
                email: 'agent2@test.com',
                role: 'agent',
                first_name: 'Agent',
                last_name: 'Two'
            });

            mockAgentStatuses.set(user1Id, {
                id: uuidv4(),
                user_id: user1Id,
                status: 'online',
                updated_at: new Date()
            });
            mockAgentStatuses.set(user2Id, {
                id: uuidv4(),
                user_id: user2Id,
                status: 'offline',
                updated_at: new Date()
            });

            const stats = await agentService.getAgentStats();

            expect(stats.total).toBe(2);
            expect(stats.online).toBe(1);
            expect(stats.offline).toBeGreaterThanOrEqual(0);
        });

        it('should get agent performance metrics', async () => {
            const performance = await agentService.getAgentPerformance('agent@test.com');

            expect(performance).toBeDefined();
            expect(performance).toHaveProperty('agentId');
            expect(performance).toHaveProperty('totalConversations');
        });

        it('should filter agents by activity timeout', async () => {
            const userId = uuidv4();

            mockUsers.set(userId, {
                id: userId,
                email: 'stale@test.com',
                role: 'agent',
                first_name: 'Stale',
                last_name: 'Agent'
            });

            mockAgentStatuses.set(userId, {
                id: uuidv4(),
                user_id: userId,
                status: 'online',
                updated_at: new Date(Date.now() - 10 * 60000)
            });

            const agents = await agentService.getAvailableAgents();
            expect(agents.length).toBe(0);
        });

        it('should count agents correctly', async () => {
            const user1Id = uuidv4();
            mockUsers.set(user1Id, {
                id: user1Id,
                email: 'agent@test.com',
                role: 'agent',
                first_name: 'Agent',
                last_name: 'User'
            });

            const count = await agentService.getAgentCount();
            expect(count).toBe(1);
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully when fetching agents', async () => {
            mockPrisma.users.findFirst.mockRejectedValue(new Error('Database connection lost'));
            const agent = await agentService.getAgent('agent@test.com');

            expect(agent).toBeNull();
        });

        it('should return empty array when getAllAgents fails', async () => {
            mockPrisma.users.findMany.mockRejectedValue(new Error('Database error'));
            const agents = await agentService.getAllAgents();

            expect(agents).toEqual([]);
        });

        it('should return null when no agents are available for assignment', async () => {
            const agent = await agentService.getBestAvailableAgent();
            expect(agent).toBeNull();
        });
    });
});
