# Integration Tests Explained

This document explains what happens when integration tests run and how they work.

## What Are Integration Tests?

Integration tests are **real end-to-end tests** that verify the complete flow of your API endpoints with actual database operations. Unlike unit tests that use mocks, integration tests:

- Use a real PostgreSQL test database
- Make actual HTTP requests to your Express app
- Create real data in the database
- Test the complete stack from HTTP request → controller → service → database

## Test Database Setup

### Database Configuration
- **Development database**: `vilnius_support` (for your app)
- **Test database**: `vilnius_support_test` (for tests only)
- **Environment**: Loaded from `.env.test` file

### Setup Commands
```bash
# One-time setup: Create test database
createdb vilnius_support_test

# Push Prisma schema to test database
npm run db:test:setup

# Run integration tests
npm run test:integration
```

## What Happens When Tests Run?

### 1. Test Environment Initialization

**File**: `tests/integration/jest.setup.js`

```javascript
// FIRST: Load test environment variables
dotenv.config({ path: '.env.test' });
// This sets DATABASE_URL to vilnius_support_test
// This sets NODE_ENV=test
// This disables logging and auto-categorization
```

**Why this matters**: Environment variables MUST be loaded before any application code runs, otherwise the app will connect to the wrong database.

### 2. Test File Execution Order

Jest runs test files in this order (with `--runInBand` flag for sequential execution):
1. `statistics-templates.integration.test.js` (4 tests)
2. `statistics-conversations.integration.test.js` (6 tests)
3. `statistics-ai-suggestions.integration.test.js` (7 tests)
4. `statistics-dashboard.integration.test.js` (4 tests)

**Why sequential**: Multiple tests accessing the same database concurrently can cause:
- Foreign key constraint violations
- Race conditions during cleanup
- Unpredictable test data

### 3. Test Lifecycle (Each Test File)

#### Before All Tests (`beforeAll`)
```javascript
beforeAll(async () => {
  // 1. Initialize test database connection
  prisma = await initializeTestDatabase();

  // 2. Create Express app (full app, not minimal mock)
  app = createTestApp();

  // 3. Create admin user (needed for creating categories/templates)
  adminUser = await createTestAgent(prisma, {
    email: `admin-${Date.now()}@test.com`,
    role: 'admin'
  });
});
```

#### Before Each Test (`beforeEach`)
```javascript
beforeEach(async () => {
  // 1. Clean ALL data from database
  await resetTestDatabase();
  // This deletes: messages, tickets, users, templates, categories, etc.

  // 2. Re-create admin user for this test
  adminUser = await createTestAgent(prisma, { role: 'admin' });

  // 3. Create agent user and login
  agentUser = await createTestAgent(prisma);
  agentToken = await authenticateAsAgent(app, agentUser.email, agentUser.plainPassword);
  // agentToken is used for authenticated API requests
});
```

**Why clean before each test**: Tests must be isolated - each test starts with a clean database state.

#### After All Tests (`afterAll`)
```javascript
afterAll(async () => {
  // 1. Close Prisma connection
  await prisma.$disconnect();

  // 2. Clean up database one final time
  await cleanTestDatabase();
});
```

### 4. Individual Test Execution

Let's trace a complete test example: **"tracks template usage"** from `statistics-templates.integration.test.js`

#### Step 1: Setup Test Data
```javascript
test('tracks template usage', async () => {
  // Create a response template
  const template = await createTestTemplate(prisma, {
    title: 'Welcome Message',
    content: 'Welcome to our support!',
    created_by: adminUser.id
  });

  // What happens in database:
  // INSERT INTO response_templates (id, title, content, created_by, created_at)
  // VALUES ('uuid', 'Welcome Message', 'Welcome to our support!', 'admin-id', NOW())
});
```

#### Step 2: Create Test Conversation & Message
```javascript
  // Create a ticket (conversation)
  const ticket = await createTestTicket(prisma, {
    assigned_agent_id: agentUser.id,
    status: 'active'
  });

  // Database:
  // INSERT INTO tickets (id, ticket_number, assigned_agent_id, status, created_at)

  // Create a message from the agent using the template
  const message = await createTestMessage(prisma, {
    ticket_id: ticket.id,
    user_id: agentUser.id,
    sender_type: 'agent',
    content: 'Welcome to our support!'
  });

  // Database:
  // INSERT INTO messages (id, ticket_id, user_id, sender_type, content, created_at)
```

#### Step 3: Track Template Usage in Statistics
```javascript
  // Create message statistics record
  await createTestMessageStats(prisma, message.id, agentUser.id, ticket.id, {
    template_used: true,
    template_id: template.id,
    system_mode: 'hitl'
  });

  // Database:
  // INSERT INTO message_statistics (
  //   message_id, agent_id, ticket_id,
  //   template_used, template_id, system_mode
  // ) VALUES (
  //   'msg-uuid', 'agent-uuid', 'ticket-uuid',
  //   true, 'template-uuid', 'hitl'
  // )
```

#### Step 4: Make API Request
```javascript
  // Make authenticated GET request to API
  const response = await authenticatedGet(
    app,
    agentToken,
    '/api/statistics/templates'
  );

  // What happens:
  // 1. supertest creates HTTP request: GET /api/statistics/templates
  // 2. Includes Authorization header: Bearer <agentToken>
  // 3. Express app processes request:
  //    - Auth middleware validates JWT token
  //    - Extracts agent user from token
  //    - Routes to statisticsController.getTemplateStatistics()
  // 4. Controller calls statisticsService.getTemplateStatistics()
  // 5. Service queries database:
  //    SELECT COUNT(*), template_id, title
  //    FROM message_statistics ms
  //    JOIN response_templates rt ON ms.template_id = rt.id
  //    WHERE template_used = true
  //    GROUP BY template_id
  // 6. Service formats response
  // 7. Controller sends JSON response
```

#### Step 5: Assert Results
```javascript
  // Verify API response structure
  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);

  // Verify statistics data
  expect(response.body.data.overview.totalMessages).toBe(1);
  expect(response.body.data.overview.templatedMessages).toBe(1);
  expect(response.body.data.overview.templateUsagePercentage).toBe(100);

  // Verify template details
  const topTemplate = response.body.data.topTemplates[0];
  expect(topTemplate.templateId).toBe(template.id);
  expect(topTemplate.title).toBe('Welcome Message');
  expect(topTemplate.usageCount).toBe(1);
  expect(topTemplate.percentage).toBe(100);

  // If any assertion fails, test fails with detailed error message
});
```

## Common Test Patterns

### Pattern 1: Template Usage Test
```javascript
// Create template → Create ticket → Create message → Create stats → Query API
1. createTestTemplate() - Makes template available
2. createTestTicket() - Creates conversation
3. createTestMessage() - Agent sends message
4. createTestMessageStats({ template_used: true, template_id }) - Track usage
5. GET /api/statistics/templates - Verify statistics
```

### Pattern 2: Conversation Count Test
```javascript
// Create multiple tickets → Query API
1. createTestTicket() x 5 - Create 5 conversations
2. Some with status='active', some with status='archived'
3. GET /api/statistics/conversations - Verify counts
```

### Pattern 3: AI Suggestion Test
```javascript
// Create message with AI suggestion tracking
1. createTestTicket()
2. createTestMessage()
3. createTestMessageStats({
     ai_suggestion_used: true,
     suggestion_action: 'sent_as_is' | 'edited' | 'from_scratch'
   })
4. GET /api/statistics/ai-suggestions - Verify breakdown
```

### Pattern 4: Dashboard Test (Combined)
```javascript
// Create comprehensive test data across all categories
1. Create 5 conversations with mixed status
2. Create messages with AI suggestions
3. Create messages with templates
4. Create messages with categories
5. GET /api/statistics/dashboard - Verify all metrics together
```

## Database Cleanup Process

### Why Cleanup Order Matters

Foreign key constraints require deleting in specific order:

```javascript
// CORRECT ORDER (child → parent):
await prisma.message_statistics.deleteMany({});  // References messages
await prisma.messages.deleteMany({});            // References tickets
await prisma.ticket_actions.deleteMany({});      // References tickets
await prisma.tickets.deleteMany({});             // References users, categories
await prisma.user_activities.deleteMany({});     // References users
await prisma.agent_status.deleteMany({});        // References users
await prisma.refresh_tokens.deleteMany({});      // References users
await prisma.response_templates.deleteMany({});  // References users
await prisma.ticket_categories.deleteMany({});   // References users
await prisma.system_logs.deleteMany({});         // Standalone
await prisma.users.deleteMany({});               // Parent table

// WRONG ORDER (would fail):
await prisma.users.deleteMany({});  // ❌ Foreign key constraint violation!
// Can't delete users when messages still reference them
```

### Cleanup Verification

```javascript
// After cleanup, verify database is empty
const userCount = await prisma.users.count();
const tokenCount = await prisma.refresh_tokens.count();
if (userCount > 0 || tokenCount > 0) {
  console.warn(`Database not fully cleaned: ${userCount} users, ${tokenCount} tokens`);
}
```

## Common Issues and Solutions

### Issue 1: "Foreign key constraint violated"

**Symptom**: Test fails with Prisma error about foreign keys

**Cause**: Trying to create record that references non-existent parent record

**Solution**: Ensure parent records exist before creating child records
```javascript
// ✅ CORRECT:
const user = await createTestAgent(prisma);
const ticket = await createTestTicket(prisma, { assigned_agent_id: user.id });

// ❌ WRONG:
const ticket = await createTestTicket(prisma, { assigned_agent_id: 'nonexistent-id' });
```

### Issue 2: "Login failed: Invalid email or password"

**Symptom**: Authentication fails in test

**Cause**: Password hashing mismatch or user not created

**Solution**: Use `plainPassword` from createTestAgent
```javascript
const user = await createTestAgent(prisma, { password: 'Agent123!' });
const token = await login(app, user.email, user.plainPassword); // ✅
// NOT: user.password_hash ❌
```

### Issue 3: "Cannot read properties of undefined"

**Symptom**: Assertion fails with undefined value

**Cause**: API response structure doesn't match expectations

**Solution**: Add logging to see actual response
```javascript
console.log('[TEST] API response:', JSON.stringify(response.body, null, 2));
// Then update assertions to match actual structure
```

### Issue 4: "Cannot log after tests are done"

**Symptom**: Warning about async operations after test completion

**Cause**: Background timers (WebSocket broadcasts, cron jobs) still running

**Solution**:
- Use `--forceExit` flag to force Jest to exit
- Disable background services in test environment (via .env.test)
- Clear timers in `afterAll` hook

### Issue 5: Tests pass individually but fail together

**Symptom**: Each test file passes alone, but some fail when running all tests

**Cause**: Database state pollution between test files OR async operations interfering

**Solution**: Use `--runInBand` flag for sequential execution
```bash
npx jest --runInBand  # Runs test files one at a time
```

## Authentication Flow in Tests

### 1. Create User with Password
```javascript
const user = await prisma.users.create({
  data: {
    email: 'agent@test.com',
    password_hash: await bcrypt.hash('Agent123!', 10), // Hash password
    role: 'agent'
  }
});
return { ...user, plainPassword: 'Agent123!' }; // Return plain for login
```

### 2. Login to Get JWT Token
```javascript
const response = await request(app)
  .post('/api/auth/login')
  .send({
    email: 'agent@test.com',
    password: 'Agent123!' // Plain password
  });

// Extract token from nested response
const token = response.body.data.tokens.accessToken;
```

### 3. Use Token for Authenticated Requests
```javascript
const response = await request(app)
  .get('/api/statistics/dashboard')
  .set('Authorization', `Bearer ${token}`) // Include token
  .send();
```

## Test Data Factories

Test data factories create consistent test data with realistic values:

### createTestAgent
```javascript
const agent = await createTestAgent(prisma, {
  email: 'agent@test.com',      // Optional override
  password: 'Agent123!',         // Optional override
  first_name: 'John',            // Optional override
  role: 'agent'                  // 'agent' or 'admin'
});

// Returns: { id, email, password_hash, role, ...user fields, plainPassword }
```

### createTestTicket
```javascript
const ticket = await createTestTicket(prisma, {
  assigned_agent_id: agent.id,  // Required: FK to users
  category_id: category.id,     // Optional: FK to ticket_categories
  status: 'active',             // 'active' or 'archived'
  customer_email: 'cust@test.com'
});
```

### createTestMessage
```javascript
const message = await createTestMessage(prisma, {
  ticket_id: ticket.id,         // Required: FK to tickets
  user_id: agent.id,            // Required: FK to users
  sender_type: 'agent',         // 'agent' or 'customer'
  content: 'Hello!'
});
```

### createTestMessageStats
```javascript
const stats = await createTestMessageStats(prisma, message.id, agent.id, ticket.id, {
  ai_suggestion_used: true,
  suggestion_action: 'sent_as_is', // 'sent_as_is', 'edited', null
  template_used: true,
  template_id: template.id,
  system_mode: 'hitl' // 'hitl', 'autopilot', 'off'
});
```

## API Response Structures

Each endpoint returns different response structures:

### Templates Endpoint
```json
GET /api/statistics/templates

{
  "success": true,
  "data": {
    "overview": {
      "totalMessages": 10,
      "templatedMessages": 7,
      "templateUsagePercentage": 70
    },
    "topTemplates": [
      {
        "templateId": "uuid",
        "title": "Welcome Message",
        "usageCount": 5,
        "percentage": 71.4
      }
    ]
  }
}
```

### Conversations Endpoint
```json
GET /api/statistics/conversations

{
  "success": true,
  "data": {
    "total": 50,
    "status": {
      "active": 35,
      "archived": 15
    },
    "byCategory": [
      {
        "category": {
          "id": "uuid",
          "name": "Technical",
          "color": "#6B7280"
        },
        "count": 25
      }
    ]
  }
}
```

### AI Suggestions Endpoint
```json
GET /api/statistics/ai-suggestions

{
  "success": true,
  "data": {
    "totalSuggestions": 100,
    "sentAsIs": 60,
    "sentAsIsPercentage": 60,
    "edited": 30,
    "editedPercentage": 30,
    "fromScratch": 10,
    "fromScratchPercentage": 10
  }
}
```

### Dashboard Endpoint (Combined)
```json
GET /api/statistics/dashboard

{
  "success": true,
  "data": {
    "conversations": { /* same as conversations endpoint */ },
    "messages": {
      "total": 150,
      "averagePerConversation": 3.0
    },
    "agents": {
      "activeAgents": 5,
      "topAgent": {
        "agentId": "uuid",
        "name": "John Doe",
        "messageCount": 50,
        "percentage": 33.3
      }
    },
    "aiSuggestions": { /* same as AI suggestions endpoint */ },
    "templates": { /* same as templates endpoint */ }
  },
  "meta": {
    "startDate": "2025-09-16T00:00:00.000Z",
    "endDate": "2025-10-16T23:59:59.999Z",
    "generatedAt": "2025-10-16T14:21:15.023Z"
  }
}
```

## Performance Considerations

### Sequential vs Parallel Execution

**Sequential (`--runInBand`)**:
- ✅ Prevents database conflicts
- ✅ Predictable execution order
- ✅ Easier to debug
- ❌ Slower (test files run one at a time)

**Parallel (default)**:
- ✅ Faster execution
- ❌ Can cause race conditions
- ❌ Database conflicts possible
- ❌ Harder to debug

### Test Execution Times

With `--runInBand` on our test suite:
- Templates: ~1.0s (4 tests)
- Conversations: ~1.5s (6 tests)
- AI Suggestions: ~1.8s (7 tests)
- Dashboard: ~1.2s (4 tests)
- **Total: ~6-7 seconds**

## Debugging Integration Tests

### 1. Add Logging
```javascript
console.log('[TEST] Creating user:', user.email);
console.log('[TEST] API response:', JSON.stringify(response.body, null, 2));
console.log('[TEST] Database state:', await prisma.users.count());
```

### 2. Run Single Test
```bash
# Run specific test file
npx jest --testMatch='**/statistics-templates.integration.test.js'

# Run specific test by name
npx jest --testNamePattern="tracks template usage"

# Run with verbose output
npx jest --verbose
```

### 3. Check Database State
```bash
# Connect to test database
psql vilnius_support_test

# Check table contents
SELECT COUNT(*) FROM users;
SELECT * FROM message_statistics;
SELECT * FROM tickets WHERE assigned_agent_id IS NOT NULL;
```

### 4. Manual Cleanup
```bash
# Run cleanup script
node check-test-db.js

# Reset test database completely
npx prisma migrate reset --skip-seed
npm run db:test:setup
```

## Best Practices

1. **Always clean before each test**: Use `beforeEach` to reset database state
2. **Use factories for test data**: Don't create data manually, use helper functions
3. **Test realistic scenarios**: Create data that matches production use cases
4. **Verify complete flow**: Test from HTTP request through to database and back
5. **Assert specific values**: Don't use `.toBeGreaterThan(0)` when you know exact count
6. **Add descriptive comments**: Explain what each test step does
7. **Keep tests isolated**: Each test should work independently
8. **Use meaningful test names**: Describe what behavior is being tested
9. **Check both success and error cases**: Test happy path and edge cases
10. **Clean up after tests**: Use `afterAll` to disconnect and clean database

## Summary

Integration tests provide confidence that your API works end-to-end with real database operations. They are slower than unit tests but catch bugs that mocks would miss. The key to reliable integration tests is:

- Proper test isolation (clean database between tests)
- Sequential execution to avoid race conditions
- Realistic test data that matches production scenarios
- Clear assertions that verify expected behavior
- Proper cleanup of async operations (timers, connections)
