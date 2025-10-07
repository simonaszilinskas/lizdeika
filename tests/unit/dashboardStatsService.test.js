jest.mock('@prisma/client', () => {
  const prismaStub = {
    tickets: { count: jest.fn() },
    messages: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
    users: { findMany: jest.fn() },
    agent_status: { count: jest.fn() }
  };

  const PrismaClient = jest.fn(() => prismaStub);

  return { PrismaClient };
}, { virtual: true });

const { DashboardStatsService } = require('../../custom-widget/backend/src/services/dashboardStatsService');

describe('DashboardStatsService', () => {
  let prismaMock;
  let service;

  beforeEach(() => {
    prismaMock = {
      tickets: { count: jest.fn() },
      messages: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
      users: { findMany: jest.fn() },
      agent_status: { count: jest.fn() }
    };

    service = new DashboardStatsService(prismaMock);
  });

  it('aggregates statistics from Prisma responses', async () => {
    prismaMock.tickets.count
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(45)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(30);

    prismaMock.messages.count
      .mockResolvedValueOnce(600)
      .mockResolvedValueOnce(90)
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(200)
      .mockResolvedValueOnce(80)
      .mockResolvedValueOnce(60)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(150)
      .mockResolvedValueOnce(70)
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(10);

    prismaMock.messages.groupBy.mockResolvedValue([
      {
        sender_id: 'agent-1',
        _count: { _all: 120 },
        _max: { created_at: new Date('2025-01-02T10:00:00Z') }
      },
      {
        sender_id: 'agent-2',
        _count: { _all: 80 },
        _max: { created_at: new Date('2025-01-03T12:00:00Z') }
      }
    ]);

    prismaMock.messages.findMany.mockResolvedValue([
      { metadata: { templateId: 'welcome', templateName: 'Sveikinimo šablonas' } },
      { metadata: { responseAttribution: { templateId: 'followup', templateName: 'Sekimo šablonas' } } }
    ]);

    prismaMock.users.findMany.mockResolvedValue([
      { id: 'agent-1', first_name: 'Agent', last_name: 'One', email: 'one@example.com' },
      { id: 'agent-2', first_name: 'Agent', last_name: 'Two', email: 'two@example.com' }
    ]);

    prismaMock.agent_status.count.mockResolvedValue(5);

    const stats = await service.getAgentDashboardStats({ rangeDays: 30 });

    expect(stats.totals.conversations).toBe(120);
    expect(stats.totals.openConversations).toBe(45);
    expect(stats.totals.messages).toBe(600);
    expect(stats.totals.agentResponsesInRange).toBe(200);
    expect(stats.totals.activeAgents).toBe(5);

    expect(stats.agentLeaderboard).toHaveLength(2);
    expect(stats.agentLeaderboard[0].name).toBe('Agent One');
    expect(stats.agentLeaderboard[0].percentage).toBeCloseTo(60, 1);

    expect(stats.suggestionUsage.totals.recorded).toBe(180);
    expect(stats.suggestionUsage.percentages.asIs).toBeCloseTo(44.4, 1);
    expect(stats.suggestionUsage.adoptionRate).toBeCloseTo(77.8, 1);
    expect(stats.suggestionUsage.aiSuggestions.range).toBe(70);
    expect(stats.suggestionUsage.aiSuggestions.allTime).toBe(150);

    expect(stats.templateUsage.totalMessagesUsingTemplates).toBe(2);
    expect(stats.templateUsage.rate).toBeCloseTo(1.0, 1);
    expect(stats.templateUsage.breakdown[0].templateName).toBe('Sveikinimo šablonas');

    expect(stats.activity.agentResponsesLast24Hours).toBe(40);
    expect(stats.activity.aiSuggestionsGeneratedLast24Hours).toBe(10);
    expect(stats.range.days).toBe(30);
  });

  it('handles empty datasets gracefully', async () => {
    prismaMock.tickets.count.mockResolvedValue(0);
    prismaMock.messages.count.mockResolvedValue(0);
    prismaMock.messages.groupBy.mockResolvedValue([]);
    prismaMock.messages.findMany.mockResolvedValue([]);
    prismaMock.users.findMany.mockResolvedValue([]);
    prismaMock.agent_status.count.mockResolvedValue(0);

    const stats = await service.getAgentDashboardStats();

    expect(stats.totals.conversations).toBe(0);
    expect(stats.agentLeaderboard).toHaveLength(0);
    expect(stats.suggestionUsage.totals.recorded).toBe(0);
    expect(stats.templateUsage.totalMessagesUsingTemplates).toBe(0);
    expect(stats.activity.agentResponsesLast24Hours).toBe(0);
  });

  it('excludes autopilot agent messages from manual effort metrics', async () => {
    prismaMock.tickets.count.mockResolvedValue(0);
    prismaMock.messages.count.mockImplementation(async () => 0);
    prismaMock.messages.groupBy.mockResolvedValue([]);
    prismaMock.messages.findMany.mockResolvedValue([]);
    prismaMock.users.findMany.mockResolvedValue([]);
    prismaMock.agent_status.count.mockResolvedValue(0);

    await service.getAgentDashboardStats();

    const autopilotFilters = prismaMock.messages.count.mock.calls
      .map(([args]) => args?.where?.NOT)
      .filter(Boolean);

    expect(autopilotFilters.length).toBeGreaterThan(0);

    for (const notClauses of autopilotFilters) {
      expect(Array.isArray(notClauses)).toBe(true);
      expect(notClauses).toEqual(expect.arrayContaining([
        expect.objectContaining({
          metadata: expect.objectContaining({
            path: ['responseAttribution', 'responseType'],
            equals: 'autopilot',
          }),
        }),
        expect.objectContaining({
          metadata: expect.objectContaining({
            path: ['isAutopilotResponse'],
            equals: true,
          }),
        }),
      ]));
    }
  });
});
