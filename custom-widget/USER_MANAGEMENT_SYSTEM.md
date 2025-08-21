# User Management & Authentication System

> Comprehensive user management system with role-based access control, secure authentication, and admin functionality for the Vilnius Assistant platform.

## 🏗️ System Overview

The Vilnius Assistant includes a robust user management system built on PostgreSQL with JWT authentication, supporting multiple user roles and comprehensive admin features.

### ✨ Key Features

- **🔐 Secure Authentication** - JWT-based with refresh tokens
- **👥 Role-Based Access Control** - Admin, Agent, and Customer roles
- **🛡️ Password Security** - Bcrypt hashing with salt rounds
- **📊 Activity Logging** - Complete audit trail of user actions
- **🔧 Admin Management** - User creation, editing, and role management
- **📱 Session Management** - Secure login/logout with token refresh

---

## 🗄️ Database Architecture

### Core Tables

#### **users**
```sql
- id: UUID (primary key)
- email: String (unique)
- password_hash: String (bcrypt)
- first_name: String
- last_name: String
- role: Enum ('admin', 'agent', 'customer')
- is_active: Boolean
- email_verified: Boolean
- created_at: DateTime
- updated_at: DateTime
```

#### **refresh_tokens**
```sql
- id: UUID (primary key)
- user_id: UUID (foreign key)
- token: String (encrypted)
- expires_at: DateTime
- created_at: DateTime
```

#### **user_activities**
```sql
- id: UUID (primary key)
- user_id: UUID (foreign key)
- action_type: String ('login', 'logout', 'password_change', etc.)
- action: String (detailed description)
- ip_address: String
- success: Boolean
- created_at: DateTime
```

#### **agent_status**
```sql
- id: String (primary key)
- user_id: UUID (foreign key)
- status: Enum ('online', 'offline')
- updated_at: DateTime
```

---

## 🎯 User Roles & Permissions

### **Admin Role**
- ✅ Full system access
- ✅ User management (create, edit, delete)
- ✅ System settings configuration
- ✅ Knowledge base management
- ✅ Activity monitoring and reporting
- ✅ Agent assignment and oversight

### **Agent Role**
- ✅ Agent dashboard access
- ✅ Conversation management
- ✅ Customer interaction
- ✅ AI suggestion tools
- ✅ Status management (online/offline)
- ❌ User management
- ❌ System configuration

### **Customer Role** (Future)
- ✅ Chat widget access
- ✅ Conversation history
- ❌ Agent features
- ❌ Admin functions

---

## 🔐 Authentication Flow

### Login Process
```mermaid
sequenceDiagram
    participant U as User
    participant L as Login Page
    participant S as Server
    participant DB as Database
    
    U->>L: Enter credentials
    L->>S: POST /api/auth/login
    S->>DB: Verify user & password
    DB-->>S: User data
    S->>S: Generate JWT + Refresh tokens
    S->>DB: Store refresh token
    S-->>L: Return tokens + user data
    L->>L: Store in localStorage
    L->>U: Redirect to dashboard
```

### Token Refresh
```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant DB as Database
    
    C->>S: Request with expired JWT
    S-->>C: 401 Unauthorized
    C->>S: POST /api/auth/refresh
    S->>DB: Verify refresh token
    DB-->>S: Token valid
    S->>S: Generate new JWT
    S-->>C: New access token
    C->>S: Retry original request
```

---

## 🛠️ Admin Interface Features

### User Management (`settings.html#users`)

#### **User Creation**
- Email validation and uniqueness check
- Automatic password generation with copy-to-clipboard
- Role assignment (admin/agent)
- Activation status control

#### **User Editing**
- Profile information updates
- Role changes with permission checks
- Account activation/deactivation
- Password reset functionality

#### **Bulk Operations**
- Export user lists
- Bulk role changes
- Activity reports

### Activity Monitoring

#### **Real-time Tracking**
- Login/logout events
- Failed authentication attempts
- Password changes
- Role modifications
- System actions

#### **Audit Reports**
- User activity summaries
- Security event logging
- Performance metrics
- Access pattern analysis

---

## 🔧 API Endpoints

### Authentication
```http
POST /api/auth/login          # User login
POST /api/auth/logout         # User logout
POST /api/auth/refresh        # Refresh JWT token
GET  /api/auth/verify         # Verify token validity
POST /api/auth/change-password # Change password
```

### User Management (Admin Only)
```http
GET    /api/users             # List all users
POST   /api/users             # Create new user
GET    /api/users/:id         # Get user details
PUT    /api/users/:id         # Update user
DELETE /api/users/:id         # Delete user
GET    /api/users/:id/activities # User activity log
```

### Agent Management
```http
GET    /api/agents/status     # Get all agent statuses
PUT    /api/agents/status     # Update agent status
GET    /api/agents/dashboard  # Dashboard data
POST   /api/agents/assign     # Assign conversations
```

---

## 🏃‍♂️ Getting Started

### Default Admin Account
When you first set up the system, create an admin account:

```bash
# Using the admin recovery script
ADMIN_RECOVERY_KEY="your-secret-key" node admin-recovery.js create \
  --email admin@vilnius.lt \
  --password "SecurePassword123!" \
  --first-name Admin \
  --last-name User
```

### First Login
1. Navigate to: `http://localhost:3002/login.html`
2. Login with your admin credentials
3. Access user management: Click red "Manage Users" button
4. Create agent accounts for your team

### Creating Agent Accounts
1. Go to Settings → Users tab
2. Click "Create User"
3. Fill in details:
   - Email (must be unique)
   - First/Last name
   - Role: "agent"
4. Copy the generated password
5. Share credentials securely with the agent

---

## 🔒 Security Features

### Password Security
- **Bcrypt hashing** with configurable salt rounds
- **Minimum complexity requirements** (length, characters)
- **Automatic password generation** for admin-created accounts
- **Secure password reset** functionality

### Token Security
- **JWT with expiration** (configurable timeout)
- **Refresh token rotation** to prevent replay attacks
- **Secure token storage** in httpOnly cookies (planned)
- **Token blacklisting** on logout

### Activity Monitoring
- **Failed login tracking** with automatic lockout
- **IP address logging** for all activities
- **Suspicious activity detection** (multiple failed logins)
- **Admin notification system** for security events

### Access Control
- **Role-based permissions** enforced server-side
- **Route protection** with middleware
- **Session timeout** with automatic logout
- **Multi-factor authentication** (planned)

---

## 🧪 Testing

### User Management Tests
```bash
# Run user management test suite
npm test -- --grep "user management"

# Test authentication flows
npm test -- --grep "authentication"

# Test role-based access
npm test -- --grep "authorization"
```

### Manual Testing Checklist
- [ ] Admin can create users
- [ ] Agent can access dashboard only
- [ ] Login/logout works correctly
- [ ] Token refresh functions
- [ ] Password reset works
- [ ] Activity logging captures events
- [ ] Role changes are enforced

---

## 🚀 Production Considerations

### Environment Variables
```bash
# JWT Configuration
JWT_SECRET=your-super-secure-secret-key
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/vilnius_support

# Admin Recovery
ADMIN_RECOVERY_KEY=your-admin-recovery-secret
```

### Security Hardening
- Use strong JWT secrets (256-bit minimum)
- Configure secure password policies
- Set up rate limiting on auth endpoints
- Enable HTTPS in production
- Regular security audits and updates
- Database connection encryption

### Monitoring & Alerts
- Failed login attempt notifications
- Unusual activity pattern alerts
- Token expiration monitoring
- Database connection health checks
- User session analytics

---

## 📈 Future Enhancements

### Planned Features
- **Multi-factor Authentication (MFA)**
- **OAuth integration** (Google, Microsoft)
- **Advanced role permissions** (fine-grained access)
- **User self-registration** with email verification
- **Password policies** with complexity enforcement
- **Session management dashboard**
- **API key management** for external integrations

### Scalability Improvements
- **Redis session store** for distributed sessions
- **Database read replicas** for user queries
- **Caching layer** for user permissions
- **Background job processing** for user operations

This user management system provides a secure, scalable foundation for the Vilnius Assistant platform with comprehensive admin tools and robust security features.