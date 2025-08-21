# Admin Recovery Guide

This guide explains how to recover admin access when administrators lose their passwords or when emergency admin access is needed.

## Overview

The Vilnius Assistant system provides multiple methods for admin password recovery:

1. **Web-based Emergency Recovery** - API endpoints for programmatic recovery
2. **Command Line Tool** - Direct database access recovery
3. **Manual Database Recovery** - Direct SQL commands (last resort)

## Prerequisites

All recovery methods require:
- Access to the server/environment where the system is deployed
- `ADMIN_RECOVERY_KEY` environment variable set
- Database access (direct or via application)

## Setting Up Recovery

### 1. Set Recovery Key

Add this to your `.env` file:
```bash
ADMIN_RECOVERY_KEY=your-super-secret-recovery-key-here-make-it-long-and-random
```

**Security Note**: Keep this key secret and store it securely. Anyone with this key can reset admin passwords.

### 2. Verify Setup

Test that recovery is properly configured:
```bash
node admin-recovery.js check-recovery
```

## Recovery Methods

### Method 1: Command Line Tool (Recommended)

The CLI tool is the easiest and safest method for admin recovery.

#### Check Current Admins
```bash
node admin-recovery.js list-admins
```

#### Reset Existing Admin Password
```bash
node admin-recovery.js recover \
  --email admin@yourdomain.com \
  --password NewSecurePassword123!
```

#### Create Emergency Admin (only if no admin exists)
```bash
node admin-recovery.js create \
  --email admin@yourdomain.com \
  --password AdminPassword123! \
  --first-name Admin \
  --last-name User
```

### Method 2: Web API Recovery

Use these endpoints when you have programmatic access but not CLI access.

#### Reset Admin Password
```bash
curl -X POST http://localhost:3002/api/auth/emergency-admin-recovery \
  -H "Content-Type: application/json" \
  -d '{
    "recoveryKey": "your-recovery-key-here",
    "adminEmail": "admin@yourdomain.com",
    "newPassword": "NewSecurePassword123!"
  }'
```

#### Create Emergency Admin
```bash
curl -X POST http://localhost:3002/api/auth/emergency-create-admin \
  -H "Content-Type: application/json" \
  -d '{
    "recoveryKey": "your-recovery-key-here",
    "email": "admin@yourdomain.com",
    "password": "AdminPassword123!",
    "firstName": "Admin",
    "lastName": "User"
  }'
```

### Method 3: Direct Database Access (Last Resort)

If other methods fail, you can directly access the database.

#### 1. Connect to PostgreSQL
```bash
psql -h localhost -U your_db_user -d your_database_name
```

#### 2. Find Admin Users
```sql
SELECT id, email, first_name, last_name, is_active 
FROM users 
WHERE role = 'admin';
```

#### 3. Generate Password Hash
You'll need to generate a bcrypt hash for the new password. Use Node.js:

```javascript
const bcrypt = require('bcrypt');
const password = 'NewAdminPassword123!';
const hash = bcrypt.hashSync(password, 12);
console.log('Hash:', hash);
```

#### 4. Update Admin Password
```sql
UPDATE users 
SET password_hash = '$2b$12$your_bcrypt_hash_here',
    is_active = true,
    updated_at = NOW()
WHERE email = 'admin@yourdomain.com' AND role = 'admin';
```

#### 5. Revoke Existing Sessions
```sql
DELETE FROM refresh_tokens 
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'admin@yourdomain.com' AND role = 'admin'
);
```

## Security Considerations

### Recovery Key Security
- **Never commit the recovery key to version control**
- Store it in a secure password manager or encrypted vault
- Rotate it periodically
- Limit access to authorized personnel only
- Consider using different keys for different environments

### Access Logging
All recovery actions are logged in the `system_logs` table:
```sql
SELECT * FROM system_logs 
WHERE action LIKE '%recovery%' OR action LIKE '%emergency%'
ORDER BY created_at DESC;
```

### Rate Limiting
- Web API recovery endpoints are heavily rate-limited (5 requests per 15 minutes)
- CLI tool has no rate limiting but requires direct server access
- Failed recovery attempts are logged

### Post-Recovery Actions
After any recovery action:
1. **Verify the admin can log in** with the new password
2. **Check system logs** for any suspicious activity
3. **Consider rotating the recovery key** if it may have been compromised
4. **Update documentation** if contact information changed
5. **Review user management** to prevent future lockouts

## Troubleshooting

### "Invalid recovery key" Error
- Verify `ADMIN_RECOVERY_KEY` is set in `.env`
- Check for typos in the recovery key
- Ensure `.env` file is being loaded properly

### "Database connection failed" Error
- Check `DATABASE_URL` environment variable
- Verify PostgreSQL service is running
- Test database connectivity

### "Admin user not found" Error
- Use `list-admins` command to see existing admins
- Check email address spelling
- Verify the user has `admin` role in database

### "Password requirements not met" Error
Password must meet these requirements:
- At least 8 characters long
- Contains uppercase letters
- Contains lowercase letters
- Contains numbers
- Contains special characters
- Avoids common patterns

### "Admin already exists" Error (when creating)
- Use `recover` command instead of `create`
- Use `list-admins` to see existing admin accounts

## Prevention Best Practices

### Multiple Admins
- Always have at least 2 admin accounts
- Use different email providers for admin accounts
- Document admin contact information securely

### Backup Authentication
- Set up proper email-based password reset (when email service is configured)
- Consider integrating with SSO/LDAP for larger organizations
- Maintain a service account with admin privileges

### Monitoring
- Set up alerts for admin login failures
- Monitor recovery endpoint usage
- Regular access audits

### Documentation
- Keep recovery documentation up to date
- Test recovery procedures regularly
- Train multiple team members on recovery process

## Emergency Contacts

In case of total system lockout:
1. Check this documentation first
2. Contact system administrator
3. Contact database administrator
4. Contact infrastructure team

## Example Recovery Scenarios

### Scenario 1: Admin Forgets Password
```bash
# List current admins
node admin-recovery.js list-admins

# Reset the admin's password
node admin-recovery.js recover \
  --email admin@company.com \
  --password TempPassword123!

# Admin logs in and changes password through UI
```

### Scenario 2: No Admin Exists (New System)
```bash
# Create first admin account
node admin-recovery.js create \
  --email admin@company.com \
  --password InitialPassword123! \
  --first-name System \
  --last-name Administrator
```

### Scenario 3: Recovery Key Compromised
1. Immediately change `ADMIN_RECOVERY_KEY` in environment
2. Restart the application
3. Review system logs for unauthorized recovery attempts
4. Consider resetting all admin passwords as a precaution

### Scenario 4: Database Access Only
When you can't run the application but have database access:
1. Use Method 3 (Direct Database Access)
2. Generate password hash externally
3. Update database directly
4. Clear refresh tokens

---

**Important**: This guide contains sensitive security information. Store it securely and limit access to authorized personnel only.