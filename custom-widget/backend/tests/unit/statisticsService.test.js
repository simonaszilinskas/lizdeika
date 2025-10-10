/**
 * STATISTICS SERVICE TESTS
 *
 * Tests for statistics calculation and recording
 */

const statisticsService = require('../../src/services/statisticsService');
const databaseClient = require('../../src/utils/database');

let prisma;

beforeAll(() => {
    prisma = databaseClient.getClient();

    // Initialize message_statistics model if it doesn't exist
    if (!prisma.message_statistics) {
        prisma.message_statistics = {
            create: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn()
        };
    }
});

afterAll(async () => {
    await databaseClient.disconnect();
});

describe('StatisticsService', () => {
    describe('recordMessageStatistics', () => {
        it('should record message statistics successfully', async () => {
            const mockData = {
                messageId: 'test-message-id',
                agentId: 'test-agent-id',
                ticketId: 'test-ticket-id',
                aiSuggestionUsed: true,
                suggestionAction: 'sent_as_is',
                suggestionEditRatio: null,
                originalSuggestion: 'Test suggestion',
                templateUsed: false,
                templateId: null,
                systemMode: 'hitl'
            };

            // Mock Prisma create
            const mockCreate = jest.fn().mockResolvedValue({
                id: 'test-stat-id',
                ...mockData,
                created_at: new Date()
            });

            const originalCreate = prisma.message_statistics.create;
            prisma.message_statistics.create = mockCreate;

            try {
                const result = await statisticsService.recordMessageStatistics(mockData);

                expect(mockCreate).toHaveBeenCalledWith({
                    data: {
                        message_id: mockData.messageId,
                        agent_id: mockData.agentId,
                        ticket_id: mockData.ticketId,
                        ai_suggestion_used: mockData.aiSuggestionUsed,
                        suggestion_action: mockData.suggestionAction,
                        suggestion_edit_ratio: mockData.suggestionEditRatio,
                        original_suggestion: mockData.originalSuggestion,
                        template_used: mockData.templateUsed,
                        template_id: mockData.templateId,
                        system_mode: mockData.systemMode
                    }
                });
                expect(result).toHaveProperty('id');
            } finally {
                prisma.message_statistics.create = originalCreate;
            }
        });
    });

    describe('getCurrentSystemMode', () => {
        it('should return system mode from agentService', async () => {
            const mode = await statisticsService.getCurrentSystemMode();
            expect(['hitl', 'autopilot', 'off']).toContain(mode);
        });

        it('should default to hitl on error', async () => {
            const agentService = require('../../src/services/agentService');
            const originalGetSystemMode = agentService.getSystemMode;

            agentService.getSystemMode = jest.fn().mockRejectedValue(new Error('Test error'));

            try {
                const mode = await statisticsService.getCurrentSystemMode();
                expect(mode).toBe('hitl');
            } finally {
                agentService.getSystemMode = originalGetSystemMode;
            }
        });
    });

    describe('getAISuggestionUsage', () => {
        it('should calculate AI suggestion percentages correctly', async () => {
            const startDate = new Date('2025-01-01');
            const endDate = new Date('2025-01-31');

            // Mock data: 60% sent as-is, 30% edited, 10% from scratch
            const mockStats = [
                { suggestion_action: 'sent_as_is' },
                { suggestion_action: 'sent_as_is' },
                { suggestion_action: 'sent_as_is' },
                { suggestion_action: 'sent_as_is' },
                { suggestion_action: 'sent_as_is' },
                { suggestion_action: 'sent_as_is' },
                { suggestion_action: 'edited' },
                { suggestion_action: 'edited' },
                { suggestion_action: 'edited' },
                { suggestion_action: 'from_scratch' }
            ];

            const mockFindMany = jest.fn().mockResolvedValue(mockStats);
            const originalFindMany = prisma.message_statistics.findMany;
            prisma.message_statistics.findMany = mockFindMany;

            try {
                const result = await statisticsService.getAISuggestionUsage(startDate, endDate);

                expect(result).toHaveProperty('totalSuggestions', 10);
                expect(result).toHaveProperty('sentAsIs', 6);
                expect(result).toHaveProperty('sentAsIsPercentage', 60);
                expect(result).toHaveProperty('edited', 3);
                expect(result).toHaveProperty('editedPercentage', 30);
                expect(result).toHaveProperty('fromScratch', 1);
                expect(result).toHaveProperty('fromScratchPercentage', 10);

                // Verify HITL-only filtering
                expect(mockFindMany).toHaveBeenCalledWith({
                    where: {
                        created_at: { gte: startDate, lte: endDate },
                        system_mode: 'hitl',
                        ai_suggestion_used: true
                    },
                    select: { suggestion_action: true }
                });
            } finally {
                prisma.message_statistics.findMany = originalFindMany;
            }
        });

        it('should handle zero suggestions correctly', async () => {
            const startDate = new Date('2025-01-01');
            const endDate = new Date('2025-01-31');

            const mockFindMany = jest.fn().mockResolvedValue([]);
            const originalFindMany = prisma.message_statistics.findMany;
            prisma.message_statistics.findMany = mockFindMany;

            try {
                const result = await statisticsService.getAISuggestionUsage(startDate, endDate);

                expect(result).toHaveProperty('totalSuggestions', 0);
                expect(result).toHaveProperty('sentAsIsPercentage', 0);
                expect(result).toHaveProperty('editedPercentage', 0);
                expect(result).toHaveProperty('fromScratchPercentage', 0);
            } finally {
                prisma.message_statistics.findMany = originalFindMany;
            }
        });
    });

    describe('getTotalConversations', () => {
        it('should count conversations in date range', async () => {
            const startDate = new Date('2025-01-01');
            const endDate = new Date('2025-01-31');

            const mockCount = jest.fn().mockResolvedValue(42);
            const originalCount = prisma.tickets.count;
            prisma.tickets.count = mockCount;

            try {
                const result = await statisticsService.getTotalConversations(startDate, endDate);

                expect(result).toBe(42);
                expect(mockCount).toHaveBeenCalledWith({
                    where: {
                        created_at: {
                            gte: startDate,
                            lte: endDate
                        }
                    }
                });
            } finally {
                prisma.tickets.count = originalCount;
            }
        });

        it('should apply category filter when provided', async () => {
            const startDate = new Date('2025-01-01');
            const endDate = new Date('2025-01-31');
            const filters = { category_id: 'test-category' };

            const mockCount = jest.fn().mockResolvedValue(15);
            const originalCount = prisma.tickets.count;
            prisma.tickets.count = mockCount;

            try {
                const result = await statisticsService.getTotalConversations(startDate, endDate, filters);

                expect(result).toBe(15);
                expect(mockCount).toHaveBeenCalledWith({
                    where: {
                        created_at: {
                            gte: startDate,
                            lte: endDate
                        },
                        category_id: 'test-category'
                    }
                });
            } finally {
                prisma.tickets.count = originalCount;
            }
        });
    });
});
