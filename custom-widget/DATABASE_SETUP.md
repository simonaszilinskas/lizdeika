# Database Setup Guide - Phase 3

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Node.js 18+ installed

### 1. Start PostgreSQL Database

```bash
# Start PostgreSQL with Docker Compose
docker-compose up postgres -d

# Optional: Start with pgAdmin for database management
docker-compose --profile development up -d
```

### 2. Set Environment Variables

Copy and configure your environment:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your actual values
```

### 3. Install Dependencies

```bash
cd backend
npm install
```

### 4. Generate Prisma Client

```bash
npm run db:generate
```

### 5. Create and Run Migrations

```bash
# Create initial migration
npm run db:migrate

# Or push schema directly (development)
npm run db:push
```

### 6. Seed Database with Sample Data

```bash
npm run db:seed
```

## 📊 Database Access

### Using pgAdmin (Development)
- URL: http://localhost:5050
- Email: admin@vilnius.lt
- Password: admin123

### Direct PostgreSQL Connection
- Host: localhost
- Port: 5432
- Database: vilnius_support
- Username: vilnius_user
- Password: secure_password

### Prisma Studio (Development)
```bash
npm run db:studio
```
Access at: http://localhost:5555

## 🔧 Database Commands

### Development Commands
```bash
# Generate Prisma client after schema changes
npm run db:generate

# Push schema changes to database (development)
npm run db:push

# Create new migration
npm run db:migrate

# Reset database and run all migrations
npm run db:reset

# Seed database with sample data
npm run db:seed

# Open Prisma Studio
npm run db:studio
```

### Production Commands
```bash
# Deploy migrations in production
npx prisma migrate deploy

# Generate client for production
npx prisma generate
```

## 📋 Sample Data

After seeding, you'll have:

### Default Users
- **Admin**: admin@vilnius.lt / admin123
- **Agent 1**: agent1@vilnius.lt / agent123 (online)
- **Agent 2**: agent2@vilnius.lt / agent123 (offline)
- **User**: user@example.com / user123

### Sample Ticket
- **Ticket**: VIL-2024-001
- **Subject**: Klausimas dėl gyvenamosios vietos deklaravimo
- **Status**: Open
- **Assigned to**: Agent 1

## 🗄️ Database Schema

### Core Tables
- **users** - User accounts (admin, agent, user)
- **refresh_tokens** - JWT refresh token storage
- **agent_status** - Agent availability tracking
- **tickets** - Support tickets
- **messages** - Ticket messages and conversations
- **ticket_actions** - Audit trail for ticket changes
- **system_settings** - Application configuration
- **system_logs** - System activity logs

### Key Features
- **UUID primary keys** for all entities
- **Automatic timestamps** (createdAt, updatedAt)
- **Soft deletes** and data retention
- **Audit trails** for all ticket actions
- **Optimized indexes** for query performance

## 🔍 Troubleshooting

### Docker Issues
```bash
# Check if Docker is running
docker --version

# View container logs
docker-compose logs postgres

# Restart containers
docker-compose restart
```

### Database Connection Issues
```bash
# Test database connection
npx prisma db pull

# Check environment variables
echo $DATABASE_URL
```

### Migration Issues
```bash
# Force reset database (development only)
npm run db:reset

# Check migration status
npx prisma migrate status

# Manual migration
npx prisma migrate deploy
```

### Permission Issues
```bash
# Fix PostgreSQL permissions
docker-compose exec postgres psql -U vilnius_user -d vilnius_support -c "SELECT version();"
```

## 📈 Performance Optimization

### Indexes
The schema includes optimized indexes for:
- Ticket queries by status and agent
- Message queries by ticket and timestamp
- User queries by email
- Action logs for audit trails

### Connection Pooling
Prisma handles connection pooling automatically. For production:
- Configure `connection_limit` in DATABASE_URL
- Monitor active connections
- Use read replicas for heavy read operations

## 🛡️ Security Notes

### Production Checklist
- [ ] Change default passwords in .env
- [ ] Use strong JWT secrets
- [ ] Configure proper database user permissions
- [ ] Enable SSL for database connections
- [ ] Set up database backups
- [ ] Configure proper CORS settings

### Backup Strategy
```bash
# Create database backup
docker-compose exec postgres pg_dump -U vilnius_user vilnius_support > backup.sql

# Restore from backup
docker-compose exec -T postgres psql -U vilnius_user vilnius_support < backup.sql
```

---

**The database setup is now complete and ready for Phase 3 development!** 🎉