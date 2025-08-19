# Phase 3: User Management & Ticketing System

## 📋 Overview

Phase 3 transforms the Vilnius Assistant from a conversational AI system into a comprehensive customer support platform with user management, ticket tracking, and automated agent assignment.

## 🎯 Objectives

### Primary Goals
1. **Database Migration**: Move from in-memory/file storage to PostgreSQL
2. **User Authentication**: Complete user management system with roles
3. **Ticket System**: Automated ticket creation and assignment
4. **Message Tracking**: 6-month retention with automated cleanup
5. **Agent Management**: Support for up to 20 concurrent agents

### Success Metrics
- **Scale**: Support 16,000 conversations/year (44/day average)
- **Performance**: <50ms query response times
- **Reliability**: 99.9% uptime with proper error handling
- **Security**: Industry-standard authentication and data protection

## 🏗️ Technical Architecture

### Database Strategy: PostgreSQL
```yaml
Choice Rationale:
- Scale: 20 concurrent agents, 16k conversations/year
- Performance: Sub-50ms queries at expected load
- Features: JSON support, full-text search, ACID compliance
- Deployment: Docker-based for easy on-premise setup
- Growth: Can handle 10x scale without architecture changes
```

### Technology Stack
```javascript
Database: PostgreSQL 15 (Docker)
ORM: Prisma (type-safe, migration support)
Authentication: JWT + Refresh Tokens (stateless)
File Storage: Local filesystem + UUID naming
Email: Nodemailer with SMTP
Validation: Zod for runtime type safety
Scheduling: node-cron for cleanup jobs
Testing: Jest + Supertest
Documentation: OpenAPI/Swagger
```

## 📊 Database Schema Design

### Core Tables

#### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Role enum: 'admin', 'agent', 'user'
CREATE TYPE user_role AS ENUM ('admin', 'agent', 'user');
```

#### Tickets Table
```sql
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(50) UNIQUE NOT NULL, -- VIL-2024-001
  user_id UUID REFERENCES users(id), -- nullable for anonymous
  assigned_agent_id UUID REFERENCES users(id), -- nullable
  status ticket_status NOT NULL DEFAULT 'open',
  priority ticket_priority NOT NULL DEFAULT 'medium',
  category VARCHAR(100),
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  source ticket_source NOT NULL DEFAULT 'widget',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Enums
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'waiting_user', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE ticket_source AS ENUM ('widget', 'admin_panel', 'email');
```

#### Messages Table
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id), -- nullable for anonymous
  sender_type sender_type NOT NULL,
  content TEXT NOT NULL,
  message_type message_type NOT NULL DEFAULT 'text',
  metadata JSONB, -- file info, AI metadata, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enums
CREATE TYPE sender_type AS ENUM ('user', 'agent', 'system', 'ai');
CREATE TYPE message_type AS ENUM ('text', 'file', 'system_action', 'ai_response');
```

#### Actions Table (Audit Trail)
```sql
CREATE TABLE ticket_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  performed_by UUID NOT NULL REFERENCES users(id),
  action action_type NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Action enum
CREATE TYPE action_type AS ENUM (
  'created', 'assigned', 'status_changed', 'priority_changed', 
  'resolved', 'closed', 'reopened', 'message_added'
);
```

#### Refresh Tokens Table
```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes for Performance
```sql
-- Frequently queried fields
CREATE INDEX idx_tickets_assigned_agent ON tickets(assigned_agent_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_messages_ticket_id ON messages(ticket_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- Composite indexes for common queries
CREATE INDEX idx_tickets_status_agent ON tickets(status, assigned_agent_id);
CREATE INDEX idx_messages_cleanup ON messages(created_at) WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '6 months';
```

## 🔐 Authentication System

### JWT Strategy
```javascript
// Token Structure
{
  accessToken: {
    sub: userId,
    email: userEmail,
    role: userRole,
    exp: 15min,
    iat: timestamp
  },
  refreshToken: {
    jti: tokenId,
    sub: userId,
    exp: 7days,
    iat: timestamp
  }
}

// Security Features
- bcrypt password hashing (12 rounds)
- Refresh token rotation
- Token blacklisting on logout
- Rate limiting on auth endpoints
- Email verification required
```

### Authentication Flow
```
1. Registration: POST /auth/register
   → Email verification link sent
   → Account activated on email confirmation

2. Login: POST /auth/login
   → Validate credentials
   → Return access + refresh tokens

3. Token Refresh: POST /auth/refresh
   → Validate refresh token
   → Return new access token
   → Rotate refresh token

4. Logout: POST /auth/logout
   → Revoke refresh token
   → Add access token to blacklist

5. Password Reset: POST /auth/forgot-password
   → Send reset link via email
   → Validate reset token + update password
```

## 🎫 Ticket Assignment Logic

### Smart Assignment Algorithm
```javascript
Priority Order:
1. Agent Availability (status = 'online')
2. Workload Balance (active ticket count)
3. Skill Match (category expertise - future enhancement)
4. Round Robin (fallback)

Implementation:
async function assignTicket(ticket) {
  // 1. Get available agents
  const availableAgents = await getAgentsByStatus('online');
  
  // 2. Calculate workload for each agent
  const agentWorkloads = await Promise.all(
    availableAgents.map(async (agent) => ({
      agent,
      activeTickets: await countActiveTickets(agent.id)
    }))
  );
  
  // 3. Sort by workload (ascending)
  agentWorkloads.sort((a, b) => a.activeTickets - b.activeTickets);
  
  // 4. Assign to agent with lowest workload
  const selectedAgent = agentWorkloads[0]?.agent;
  
  if (selectedAgent) {
    await assignTicketToAgent(ticket.id, selectedAgent.id);
    await createTicketAction(ticket.id, 'system', 'assigned', null, selectedAgent.id);
  }
  
  return selectedAgent;
}
```

### Agent Status Management
```javascript
Agent States:
- 'online': Available for new assignments
- 'busy': Online but not accepting new tickets
- 'offline': Not available

// Agent can change their own status
// Admin can override any agent status
// System automatically sets to 'offline' after inactivity
```

## 📝 Message & Data Retention

### 6-Month Retention Strategy
```sql
-- Automated cleanup (daily at 2 AM)
CREATE OR REPLACE FUNCTION cleanup_old_data() RETURNS void AS $$
BEGIN
  -- Delete messages older than 6 months
  DELETE FROM messages 
  WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '6 months';
  
  -- Delete actions older than 6 months
  DELETE FROM ticket_actions 
  WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '6 months';
  
  -- Update ticket status if all messages are deleted
  UPDATE tickets 
  SET status = 'archived' 
  WHERE id NOT IN (SELECT DISTINCT ticket_id FROM messages)
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '6 months';
    
  -- Log cleanup results
  INSERT INTO system_logs (action, details, created_at)
  VALUES ('data_cleanup', json_build_object(
    'messages_deleted', (SELECT count(*) FROM messages WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '6 months'),
    'actions_deleted', (SELECT count(*) FROM ticket_actions WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '6 months')
  ), CURRENT_TIMESTAMP);
END;
$$ LANGUAGE plpgsql;

-- Schedule daily execution
SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_data();');
```

### Application-Level Cleanup
```javascript
// Backup before cleanup (optional)
const cron = require('node-cron');

cron.schedule('0 2 * * *', async () => {
  try {
    console.log('Starting daily cleanup...');
    
    // Optional: Create backup before cleanup
    await createDataBackup();
    
    // Cleanup old data
    const result = await db.query(`SELECT cleanup_old_data()`);
    
    console.log('Cleanup completed:', result);
  } catch (error) {
    console.error('Cleanup failed:', error);
    // Send alert to admins
  }
});
```

## 🔄 Integration with Existing System

### Widget to Ticket Conversion
```javascript
// When user starts conversation in widget
1. Create anonymous ticket immediately
2. Store conversation in messages table
3. If user provides email → convert to registered user
4. Assign to available agent when human intervention needed

// Existing conversation flow
Widget → Anonymous Ticket → Messages → Agent Assignment
```

### Backward Compatibility
```javascript
// Maintain existing endpoints
- /api/chat → now creates ticket + messages
- /api/conversations → maps to ticket queries
- /api/agents → enhanced with ticket assignment

// Migration strategy
1. Keep current websocket system
2. Add ticket creation hooks
3. Gradually migrate admin interfaces
4. Maintain chat widget API
```

## 🚀 Implementation Phases

### Phase 3.1: Database Foundation (Week 1)
```
Tasks:
✅ Set up PostgreSQL with Docker Compose
✅ Design and implement Prisma schema
✅ Create database migrations
✅ Set up development environment
✅ Implement basic user authentication

Deliverables:
- docker-compose.yml for PostgreSQL
- Prisma schema with all tables
- JWT authentication system
- User registration/login endpoints
```

### Phase 3.2: Core Ticketing (Week 2)
```
Tasks:
✅ Implement ticket CRUD operations
✅ Build smart assignment algorithm
✅ Create message persistence system
✅ Integrate with existing websocket
✅ Agent dashboard enhancements

Deliverables:
- Ticket management API
- Assignment logic implementation
- Enhanced agent dashboard
- Message tracking system
```

### Phase 3.3: Integration & Polish (Week 3)
```
Tasks:
✅ Widget-to-ticket integration
✅ Data retention automation
✅ Admin user management interface
✅ Performance optimization
✅ Testing and documentation

Deliverables:
- Complete ticket system
- Automated cleanup jobs
- Admin interfaces
- Performance benchmarks
- Updated documentation
```

## 📁 File Structure Changes

### New Files to Create
```
/backend/
  /prisma/
    schema.prisma
    migrations/
  /src/
    /controllers/
      authController.js
      ticketController.js
      userController.js
    /middleware/
      authMiddleware.js
      roleMiddleware.js
    /routes/
      authRoutes.js
      ticketRoutes.js
      userRoutes.js
    /services/
      authService.js
      ticketService.js
      userService.js
      assignmentService.js
      emailService.js
    /utils/
      tokenUtils.js
      passwordUtils.js
      validators.js
  docker-compose.yml
  .env.example

/admin/
  user-management.html
  ticket-dashboard.html
  /js/
    user-management.js
    ticket-dashboard.js
```

### Files to Update
```
backend/package.json - Add new dependencies
backend/src/app.js - Add new routes and middleware
agent-dashboard.html - Integrate ticket system
backend/.env - Add database and JWT config
README.md - Update with Phase 3 information
```

### Files to Remove/Archive
```
test-dashboard.html - No longer needed
test-document-api.js - Outdated testing file
backend/server-old.js - Legacy server file
admin.html - Will be replaced by new admin interfaces
```

## 🔧 Development Environment

### Required Environment Variables
```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/vilnius_support"
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vilnius_support
DB_USER=vilnius_user
DB_PASSWORD=secure_password

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-refresh-token-secret-here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Email (for password reset, verification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@vilnius.lt

# Application
NODE_ENV=development
PORT=3002
FRONTEND_URL=http://localhost:3000

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_DIR=./uploads
```

## 📊 Performance Expectations

### Scale Targets
- **Users**: 20 concurrent agents + 100 concurrent end users
- **Throughput**: 44 tickets/day average, 200 tickets/day peak
- **Storage**: ~2GB/year growth estimate
- **Response Time**: <50ms for API calls, <100ms for complex queries

### Monitoring Points
```javascript
Key Metrics:
- Database connection pool usage
- Query execution times
- Authentication token validation speed
- Ticket assignment algorithm performance
- Message cleanup job execution time
- File upload/download speeds
```

## 🛡️ Security Considerations

### Data Protection
- **Passwords**: bcrypt with 12 rounds
- **JWT**: Short-lived access tokens (15min)
- **Database**: Parameterized queries (Prisma ORM)
- **File Upload**: Type validation + virus scanning
- **Rate Limiting**: Auth endpoints, API calls

### Compliance
- **GDPR**: User data deletion on request
- **Audit Trail**: All ticket actions logged
- **Data Retention**: Automatic 6-month cleanup
- **Access Control**: Role-based permissions

## 🧪 Testing Strategy

### Test Coverage
```javascript
Unit Tests:
- Authentication services
- Ticket assignment logic
- Database operations
- Utility functions

Integration Tests:
- API endpoint workflows
- Database migrations
- Email service integration
- File upload/download

Load Tests:
- 20 concurrent agents
- Peak ticket creation
- Database query performance
- WebSocket connections
```

## 📋 Success Criteria

### Functional Requirements
- ✅ User registration, login, password reset
- ✅ Ticket creation from widget conversations
- ✅ Automatic agent assignment
- ✅ Real-time message persistence
- ✅ Admin user management
- ✅ 6-month data retention

### Non-Functional Requirements
- ✅ Support 20 concurrent agents
- ✅ Handle 16,000 tickets/year
- ✅ <50ms API response times
- ✅ 99.9% uptime
- ✅ Easy on-premise deployment

### Deliverables
- ✅ Complete ticketing system
- ✅ User authentication
- ✅ Enhanced admin interfaces
- ✅ Database migration tools
- ✅ Updated documentation
- ✅ Docker deployment setup

---

**This specification provides the complete blueprint for Phase 3 implementation, ensuring a robust, scalable, and maintainable customer support platform.**