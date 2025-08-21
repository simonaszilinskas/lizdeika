
# Bash commands
- npm start : Start the project
- npm test : Run all tests
- npm test -- tests/unit/archiveService.test.js : Run archive functionality tests
- npm test -- tests/unit/conversationController.archive.test.js : Run archive controller tests

## Database Management
- Database: PostgreSQL (`vilnius_support`)
- User types: `agent` and `admin` (no "user" role - customers are tracked by user_number only)
- Key tables: `tickets` (conversations), `messages`, `users`, `agent_status`, `user_activities`

### Archive System
- Archived conversations have no assignments (all unassigned)
- Auto-unarchive on new messages:
  - User message → auto-assign to available agent or unassigned
  - Agent message → assign to that agent
- Bulk operations: archive, unarchive, assign to agent
- Activity logging for all archive operations

## Visual Development

### Quick Visual Check
IMMEDIATELY after implementing any front-end change:
1. **Identify what changed** - Review the modified components/pages
2. **Navigate to affected pages** - Use `mcp__playwright__browser_navigate` to visit each changed view
3. **Verify design compliance** - Compare against `/context/design-principles.md` and `/context/style-guide.md`
4. **Validate feature implementation** - Ensure the change fulfills the user's specific request
5. **Check acceptance criteria** - Review any provided context files or requirements
6. **Capture evidence** - Take full page screenshot at desktop viewport (1440px) of each changed view
7. **Check for errors** - Run `mcp__playwright__browser_console_messages`

This verification ensures changes meet design standards and user requirements.

### Comprehensive Design Review
Invoke the `@agent-design-review` subagent for thorough design validation when:
- Completing significant UI/UX features
- Before finalizing PRs with visual changes
- Needing comprehensive accessibility and responsiveness testing

## Testing Architecture

### Archive Functionality Tests
Location: `custom-widget/backend/tests/unit/`

#### Test Coverage:
1. **archiveService.test.js** (13 tests)
   - Bulk archive/unarchive operations
   - Auto-unarchive logic with proper assignment
   - Assignment clearing on archive
   - Error handling and edge cases
   - Message handling with archive state

2. **conversationController.archive.test.js** (6 tests)
   - Controller layer validation
   - Activity logging verification
   - Input validation and error responses
   - HTTP response formatting

#### Key Test Features:
- Mocked Prisma database operations
- Activity service logging verification
- Agent service integration testing
- Error scenario coverage
- Input validation testing

### Test Commands:
```bash
# Run all tests
npm test

# Run specific test suites
npm test -- tests/unit/archiveService.test.js
npm test -- tests/unit/conversationController.archive.test.js

# Run tests with coverage
npm test -- --coverage
```

## System Architecture

### User Management
- **Agents**: Support staff (`role: 'agent'`)
- **Admins**: Agents with admin powers (`role: 'admin'`)
- **Customers**: Not stored as users, tracked by `user_number` in tickets

### Conversation Lifecycle
1. **Active**: Default state, can be assigned to agents
2. **Archived**: Unassigned state, hidden from main view
3. **Auto-unarchive**: Triggered by new messages

### Assignment Rules
- Active conversations: Can be assigned to agents (MINE/SOMEBODY'S/NOBODY'S)
- Archived conversations: Always unassigned (no assignment filters)
- Auto-unarchive assignment:
  - User message → auto-assign or leave unassigned
  - Agent message → assign to sending agent

### Bulk Operations
- Archive: Clears assignments, logs activity
- Unarchive: Maintains unassigned state
- Assign: Works only on active conversations