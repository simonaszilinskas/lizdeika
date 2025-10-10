/**
 * Unit tests for Agent Service
 * Regression tests for UUID-based agent ID handling
 */
const agentService = require('../../src/services/agentService');
const databaseClient = require('../../src/utils/database');
const { v4: uuidv4 } = require('uuid');

describe('AgentService', () => {
    let mockPrisma;

    beforeEach(() => {
        mockPrisma = databaseClient.getClient();
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
});
