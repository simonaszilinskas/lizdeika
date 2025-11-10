/**
 * Conversation Cleanup Integration Tests
 *
 * Tests automated archived conversation cleanup functionality with real database.
 *
 * Coverage:
 * 1. Dry-run Mode - Preview deletions without executing
 * 2. Cleanup Execution - Delete archived conversations older than retention period
 * 3. Statistics Tracking - Job execution history and metrics
 * 4. Batch Processing - Handle large numbers of conversations
 * 5. Cascade Deletes - Verify related records are cleaned up
 * 6. Safety Checks - Only delete archived conversations
 */

const {
  initializeTestDatabase,
  closeTestDatabase,
  resetTestDatabase,
} = require('./setup/testDatabase');
const {
  createTestAgent,
  createTestTicket,
  createTestMessage,
  createTestMessageStats,
} = require('./helpers/testData');
const { createTestApp, authenticateAsAgent, cleanupWebSocketService } = require('./helpers/apiHelpers');
const request = require('supertest');

// Load test environment
require('dotenv').config({ path: __dirname + '/../../.env.test' });

describe('Conversation Cleanup Integration Tests', () => {
  let prisma;
  let app;
  let websocketService;
  let agent;
  let token;

  beforeAll(async () => {
    prisma = await initializeTestDatabase();
    const result = createTestApp();
    app = result.app;
    websocketService = result.websocketService;
  });

  afterAll(async () => {
    cleanupWebSocketService(websocketService);
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await resetTestDatabase();
    agent = await createTestAgent(prisma);
    const auth = await authenticateAsAgent(app, prisma, agent.email, agent.plainPassword);
    token = auth.token;
  });

  describe('GET /api/admin/cleanup/stats', () => {
    test('returns cleanup job statistics', async () => {
      const response = await request(app)
        .get('/api/admin/cleanup/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalRuns');
      expect(response.body.data).toHaveProperty('totalDeleted');
      expect(response.body.data).toHaveProperty('isEnabled');
      expect(response.body.data).toHaveProperty('retentionDays');
      expect(response.body.data).toHaveProperty('schedule');
      expect(response.body.data).toHaveProperty('batchSize');
    });

    test('requires authentication', async () => {
      const response = await request(app)
        .get('/api/admin/cleanup/stats');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/admin/cleanup/dry-run', () => {
    test('previews deletions without executing when retention is 0', async () => {
      // Set retention to 0 days for testing
      process.env.CONVERSATION_RETENTION_DAYS = '0';

      // Create some old archived tickets
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const archivedTicket1 = await createTestTicket(prisma, {
        archived: true,
        created_at: oldDate,
        subject: 'Old archived ticket 1',
      });

      const archivedTicket2 = await createTestTicket(prisma, {
        archived: true,
        created_at: oldDate,
        subject: 'Old archived ticket 2',
      });

      // Create a message for one ticket
      await createTestMessage(prisma, archivedTicket1.id, {
        content: 'Test message',
      });

      const response = await request(app)
        .post('/api/admin/cleanup/dry-run')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('no data was deleted');
      expect(response.body.data.dryRun).toBe(true);
      expect(response.body.data.wouldDelete).toBeGreaterThanOrEqual(2);
      expect(response.body.data.deleted).toBe(0);

      // Verify tickets still exist in database
      const ticket1 = await prisma.tickets.findUnique({
        where: { id: archivedTicket1.id },
      });
      const ticket2 = await prisma.tickets.findUnique({
        where: { id: archivedTicket2.id },
      });

      expect(ticket1).not.toBeNull();
      expect(ticket2).not.toBeNull();
    });

    test('returns empty result when retention is not set', async () => {
      delete process.env.CONVERSATION_RETENTION_DAYS;

      const response = await request(app)
        .post('/api/admin/cleanup/dry-run')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.disabled).toBe(true);
    });

    test('requires authentication', async () => {
      const response = await request(app)
        .post('/api/admin/cleanup/dry-run');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/admin/cleanup/trigger', () => {
    test('deletes archived conversations older than retention period', async () => {
      // Set retention to 30 days
      process.env.CONVERSATION_RETENTION_DAYS = '30';

      // Create old archived ticket (should be deleted)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const oldArchivedTicket = await createTestTicket(prisma, {
        archived: true,
        created_at: oldDate,
        subject: 'Old archived ticket',
      });

      // Create recent archived ticket (should NOT be deleted)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);

      const recentArchivedTicket = await createTestTicket(prisma, {
        archived: true,
        created_at: recentDate,
        subject: 'Recent archived ticket',
      });

      // Create old non-archived ticket (should NOT be deleted)
      const oldActiveTicket = await createTestTicket(prisma, {
        archived: false,
        created_at: oldDate,
        subject: 'Old active ticket',
      });

      const response = await request(app)
        .post('/api/admin/cleanup/trigger')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBeGreaterThanOrEqual(1);

      // Verify old archived ticket is deleted
      const deletedTicket = await prisma.tickets.findUnique({
        where: { id: oldArchivedTicket.id },
      });
      expect(deletedTicket).toBeNull();

      // Verify recent archived ticket still exists
      const recentTicket = await prisma.tickets.findUnique({
        where: { id: recentArchivedTicket.id },
      });
      expect(recentTicket).not.toBeNull();

      // Verify old active ticket still exists
      const activeTicket = await prisma.tickets.findUnique({
        where: { id: oldActiveTicket.id },
      });
      expect(activeTicket).not.toBeNull();
    });

    test('performs cascade deletes on related records', async () => {
      process.env.CONVERSATION_RETENTION_DAYS = '0';

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const archivedTicket = await createTestTicket(prisma, {
        archived: true,
        created_at: oldDate,
        subject: 'Ticket with related records',
      });

      // Create message
      const message = await createTestMessage(prisma, archivedTicket.id, {
        sender_id: agent.id,
        content: 'Test message',
      });

      // Create message statistics
      await createTestMessageStats(prisma, message.id, agent.id, archivedTicket.id, {
        ai_suggestion_used: true,
        system_mode: 'hitl',
      });

      // Verify related records exist before deletion
      const messagesBefore = await prisma.messages.findMany({
        where: { ticket_id: archivedTicket.id },
      });
      const statsBefore = await prisma.message_statistics.findMany({
        where: { ticket_id: archivedTicket.id },
      });

      expect(messagesBefore.length).toBe(1);
      expect(statsBefore.length).toBe(1);

      // Execute cleanup
      const response = await request(app)
        .post('/api/admin/cleanup/trigger')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify ticket is deleted
      const deletedTicket = await prisma.tickets.findUnique({
        where: { id: archivedTicket.id },
      });
      expect(deletedTicket).toBeNull();

      // Verify related records are cascade deleted
      const messagesAfter = await prisma.messages.findMany({
        where: { ticket_id: archivedTicket.id },
      });
      const statsAfter = await prisma.message_statistics.findMany({
        where: { ticket_id: archivedTicket.id },
      });

      expect(messagesAfter.length).toBe(0);
      expect(statsAfter.length).toBe(0);
    });

    test('handles large batch processing', async () => {
      process.env.CONVERSATION_RETENTION_DAYS = '0';

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      // Create 150 archived tickets (more than batch size of 100)
      const tickets = [];
      for (let i = 0; i < 150; i++) {
        const ticket = await createTestTicket(prisma, {
          archived: true,
          created_at: oldDate,
          subject: `Batch test ticket ${i}`,
        });
        tickets.push(ticket);
      }

      const response = await request(app)
        .post('/api/admin/cleanup/trigger')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(150);
      expect(response.body.data.batches).toBe(2); // 150 tickets / 100 batch size = 2 batches

      // Verify all tickets are deleted
      const remainingTickets = await prisma.tickets.findMany({
        where: {
          id: { in: tickets.map(t => t.id) },
        },
      });
      expect(remainingTickets.length).toBe(0);
    });

    test('returns empty result when no eligible conversations', async () => {
      process.env.CONVERSATION_RETENTION_DAYS = '90';

      // Create only recent tickets
      const recentDate = new Date();
      await createTestTicket(prisma, {
        archived: true,
        created_at: recentDate,
        subject: 'Recent ticket',
      });

      const response = await request(app)
        .post('/api/admin/cleanup/trigger')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(0);
      expect(response.body.data.batches).toBe(0);
    });

    test('requires authentication', async () => {
      const response = await request(app)
        .post('/api/admin/cleanup/trigger');

      expect(response.status).toBe(401);
    });
  });

  describe('Job Statistics Tracking', () => {
    test('updates statistics after execution', async () => {
      process.env.CONVERSATION_RETENTION_DAYS = '0';

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      // Create some old archived tickets
      await createTestTicket(prisma, {
        archived: true,
        created_at: oldDate,
        subject: 'Stats test ticket 1',
      });
      await createTestTicket(prisma, {
        archived: true,
        created_at: oldDate,
        subject: 'Stats test ticket 2',
      });

      // Get stats before execution
      const statsBefore = await request(app)
        .get('/api/admin/cleanup/stats')
        .set('Authorization', `Bearer ${token}`);

      const totalRunsBefore = statsBefore.body.data.totalRuns;
      const totalDeletedBefore = statsBefore.body.data.totalDeleted;

      // Execute cleanup
      await request(app)
        .post('/api/admin/cleanup/trigger')
        .set('Authorization', `Bearer ${token}`);

      // Get stats after execution
      const statsAfter = await request(app)
        .get('/api/admin/cleanup/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(statsAfter.body.data.totalRuns).toBe(totalRunsBefore + 1);
      expect(statsAfter.body.data.totalDeleted).toBeGreaterThan(totalDeletedBefore);
      expect(statsAfter.body.data.lastRunDeleted).toBeGreaterThanOrEqual(2);
      expect(statsAfter.body.data.lastRun).toBeTruthy();
      expect(statsAfter.body.data.lastRunDuration).toBeGreaterThan(0);
    });
  });
});
