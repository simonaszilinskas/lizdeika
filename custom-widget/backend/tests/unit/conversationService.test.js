/**
 * Unit tests for Conversation Service
 * Tests the PostgreSQL-backed conversation service implementation
 */
const conversationService = require('../../src/services/conversationService');
const databaseClient = require('../../src/utils/database');
const { v4: uuidv4 } = require('uuid');

describe('ConversationService', () => {
    let mockPrisma;
    let createdTickets; // Track created tickets in memory for mock findUnique

    beforeEach(async () => {
        // Get mock Prisma instance
        mockPrisma = databaseClient.getClient();
        createdTickets = new Map();

        // Configure mock return values for database operations
        mockPrisma.tickets.create.mockImplementation(({ data }) => {
            const ticket = {
                ...data,
                created_at: new Date(),
                updated_at: new Date(),
                users_tickets_user_idTousers: null,
                users_tickets_assigned_agent_idTousers: null,
                ticket_category: null,
                messages: [],
                _count: { messages: 0 }
            };
            createdTickets.set(data.id, ticket);
            return Promise.resolve(ticket);
        });

        mockPrisma.tickets.findUnique.mockImplementation(({ where }) => {
            const ticket = createdTickets.get(where.id);
            if (!ticket) return Promise.resolve(null);
            return Promise.resolve({
                ...ticket,
                _count: { messages: 0 }
            });
        });

        mockPrisma.tickets.update.mockImplementation(({ where, data }) => {
            const existing = createdTickets.get(where.id);
            if (!existing) return Promise.resolve(null);
            const updated = {
                ...existing,
                ...data,
                updated_at: new Date(),
                users_tickets_user_idTousers: null,
                users_tickets_assigned_agent_idTousers: null,
                ticket_category: null,
                messages: [],
                _count: { messages: 0 }
            };
            createdTickets.set(where.id, updated);
            return Promise.resolve(updated);
        });

        mockPrisma.tickets.findMany.mockImplementation(({ where }) => {
            if (!where) return Promise.resolve(Array.from(createdTickets.values()));
            // Simple filtering for tests
            const tickets = Array.from(createdTickets.values()).filter(t => {
                if (where.status && t.status !== where.status) return false;
                if (where.assigned_agent_id && t.assigned_agent_id !== where.assigned_agent_id) return false;
                return true;
            });
            return Promise.resolve(tickets);
        });

        mockPrisma.tickets.count.mockImplementation(({ where }) => {
            if (!where) return Promise.resolve(createdTickets.size);

            let count = 0;
            for (const ticket of createdTickets.values()) {
                let matches = true;

                if (where.id && ticket.id !== where.id) matches = false;
                if (where.status && ticket.status !== where.status) matches = false;
                if (where.assigned_agent_id && ticket.assigned_agent_id !== where.assigned_agent_id) matches = false;
                if (where.user_id && ticket.user_id !== where.user_id) matches = false;

                if (matches) count++;
            }

            return Promise.resolve(count);
        });

        mockPrisma.messages.create.mockImplementation(({ data }) => Promise.resolve({
            ...data,
            created_at: new Date(),
            updated_at: new Date(),
            users: null
        }));
        mockPrisma.messages.findMany.mockResolvedValue([]);
        mockPrisma.messages.createMany.mockResolvedValue({ count: 0 });
        mockPrisma.messages.count.mockResolvedValue(0);

        // Mock ticket number generation
        jest.spyOn(conversationService, 'generateTicketNumber').mockResolvedValue('T-12345');
        jest.spyOn(conversationService, 'generateUserNumber').mockResolvedValue(1);

        // Clear all data before each test
        await conversationService.clearAllData();
        createdTickets.clear();
    });

    afterEach(() => {
        // Restore all mocks
        jest.restoreAllMocks();
    });

    describe('Conversation Management', () => {
        it('should create a new conversation', async () => {
            const conversationId = uuidv4();
            const conversationData = {
                id: conversationId,
                visitorId: uuidv4(),
                subject: 'Test Subject',
                status: 'active'
            };

            const result = await conversationService.createConversation(conversationId, conversationData);

            expect(result).toMatchObject({
                id: conversationId,
                visitorId: conversationData.visitorId
            });
            expect(await conversationService.conversationExists(conversationId)).toBe(true);
        });

        it('should check if conversation exists', async () => {
            const conversationId = uuidv4();
            expect(await conversationService.conversationExists(conversationId)).toBe(false);

            await conversationService.createConversation(conversationId, { id: conversationId });
            expect(await conversationService.conversationExists(conversationId)).toBe(true);
        });

        it('should get conversation by ID', async () => {
            const conversationId = uuidv4();
            const conversationData = { id: conversationId, subject: 'Test' };

            await conversationService.createConversation(conversationId, conversationData);
            const result = await conversationService.getConversation(conversationId);

            expect(result).toBeDefined();
            expect(result.id).toBe(conversationId);
        });

        it('should update conversation', async () => {
            const conversationId = uuidv4();
            const originalData = { id: conversationId, subject: 'Original' };
            const updateData = { subject: 'Updated Subject', category: 'test-category' };

            await conversationService.createConversation(conversationId, originalData);
            const result = await conversationService.updateConversation(conversationId, updateData);

            expect(result).toBeDefined();
            expect(result.subject).toBe('Updated Subject');
            expect(result.category).toBe('test-category');
        });
    });

    describe('Message Management', () => {
        it('should get messages for conversation', async () => {
            const conversationId = uuidv4();
            await conversationService.createConversation(conversationId, { id: conversationId });

            const messages = await conversationService.getMessages(conversationId);

            expect(Array.isArray(messages)).toBe(true);
        });

        it('should add message to conversation', async () => {
            const conversationId = uuidv4();
            await conversationService.createConversation(conversationId, { id: conversationId });

            const message = {
                id: uuidv4(),
                content: 'Hello',
                sender: 'visitor'
            };

            const result = await conversationService.addMessage(conversationId, message);

            expect(result).toBeDefined();
            expect(result.content).toBe('Hello');
        });
    });

    describe('Data Management', () => {
        it('should clear all data', async () => {
            const conversationId = uuidv4();
            await conversationService.createConversation(conversationId, { id: conversationId });

            const cleared = await conversationService.clearAllData();

            expect(cleared).toBe(true);
        });
    });

    describe('Agent ID Mapping (Regression Tests for UUID Migration)', () => {
        it('should return user UUID directly from mapUserIdToAgentId', () => {
            const userUUID = uuidv4();
            const user = {
                id: userUUID,
                email: 'agent@test.com',
                role: 'agent'
            };

            const agentId = conversationService.mapUserIdToAgentId(user);

            expect(agentId).toBe(userUUID);
            expect(agentId).not.toBe('agent@test.com');
        });

        it('should return null when user is null', () => {
            const agentId = conversationService.mapUserIdToAgentId(null);
            expect(agentId).toBeNull();
        });

        it('should return null when user has no id', () => {
            const user = {
                email: 'agent@test.com',
                role: 'agent'
            };

            const agentId = conversationService.mapUserIdToAgentId(user);
            expect(agentId).toBeNull();
        });

        it('should maintain consistency between different agent roles', () => {
            const adminUUID = uuidv4();
            const agentUUID = uuidv4();

            const admin = { id: adminUUID, email: 'admin@test.com', role: 'admin' };
            const agent = { id: agentUUID, email: 'agent@test.com', role: 'agent' };

            expect(conversationService.mapUserIdToAgentId(admin)).toBe(adminUUID);
            expect(conversationService.mapUserIdToAgentId(agent)).toBe(agentUUID);
        });
    });
});
