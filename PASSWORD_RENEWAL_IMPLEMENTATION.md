# Password Renewal Implementation (180 Days)

## Overview

This feature enforces a 180-day password renewal policy for all agents and admins. Regular users are exempt from this policy.

## Key Features

1. **Automatic Expiry Tracking**: Passwords expire 180 days after they are set or changed
2. **Progressive Warnings**: Users receive warnings at 30, 14, 7, 3, and 1 day(s) before expiry
3. **Access Blocking**: When password expires, access to the system is blocked except for password change endpoints
4. **Admin Reset**: Only administrators can unlock accounts with expired passwords by regenerating passwords

## Database Schema

Three new fields added to the `users` table:

```sql
password_changed_at   DateTime?  -- When password was last changed
password_expires_at   DateTime?  -- When password will expire (180 days from password_changed_at)
password_blocked      Boolean    -- Whether user is blocked due to expired password (default: false)
```

**Migration**: `prisma/migrations/20251115_add_password_renewal_fields/migration.sql`

## Backend Architecture

### 1. Password Expiry Service
**File**: `src/services/passwordExpiryService.js`

**Key Functions**:
- `calculateExpiryDate(passwordChangedAt)` - Calculates expiry date (180 days from date)
- `getDaysRemaining(passwordExpiresAt)` - Returns days until expiry
- `requiresRenewal(user)` - Checks if password expired (agents/admins only)
- `getWarningLevel(daysRemaining)` - Returns: 'critical', 'warning', 'info', 'notice', or 'none'
- `getWarningMessage(daysRemaining)` - Returns user-facing warning text
- `getPasswordStatus(user)` - Complete status object for UI display
- `updatePasswordTimestamp(userId)` - Updates timestamps when password changes
- `blockUser(userId)` / `unblockUser(userId)` - Manual blocking controls

**Warning Levels**:
- **CRITICAL** (1-3 days): Red alert, immediate action required
- **WARNING** (4-7 days): Orange warning, change soon
- **INFO** (8-14 days): Yellow notice
- **NOTICE** (15-30 days): Blue reminder
- **NONE** (30+ days): No warning needed

### 2. Password Expiry Middleware
**File**: `src/middleware/passwordExpiryMiddleware.js`

**Behavior**:
- Runs on ALL `/api` routes after authentication
- Checks if user's password has expired or is blocked
- Blocks access to all endpoints EXCEPT:
  - `/api/auth/change-password` (to allow password changes)
  - `/api/auth/profile` (to get user info)
  - `/api/auth/password-status` (to check password status)
  - `/api/auth/logout` (to allow logout)
- Returns HTTP 403 with clear error message if password expired

### 3. Updated Endpoints

#### Password Status
```
GET /api/auth/password-status
Authorization: Bearer {token}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "requiresRenewal": false,
    "isBlocked": false,
    "daysRemaining": 145,
    "warningLevel": "none",
    "warningMessage": null,
    "expiresAt": "2025-05-15T10:30:00.000Z"
  }
}
```

#### Password Change (existing, now updates expiry)
```
POST /api/auth/change-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!"
}
```

**Behavior**: Now automatically updates `password_changed_at` and `password_expires_at` for agents/admins

#### Admin Password Reset (existing, now resets expiry)
```
POST /api/users/:id/regenerate-password
Authorization: Bearer {admin-token}
```

**Behavior**:
- Generates new secure password
- Resets password expiry timestamps
- Unblocks user if blocked
- Returns new password to admin (one-time only)

## Password Lifecycle

### New User Creation
When agents or admins are created:
```javascript
password_changed_at = NOW()
password_expires_at = NOW() + 180 days
password_blocked = false
```

### Password Change
When user changes password:
```javascript
password_changed_at = NOW()
password_expires_at = NOW() + 180 days
password_blocked = false  // Unblocks if was blocked
```

### Password Expiration
When `password_expires_at` < NOW():
1. Middleware blocks access to all endpoints except allowed paths
2. User receives HTTP 403 with message: "Your password has expired. Please change your password to continue."
3. User must change password OR admin must regenerate it

### Admin Reset
When admin regenerates password:
1. New secure password generated
2. Password expiry reset (180 days from now)
3. User unblocked
4. All refresh tokens invalidated (forces re-login)

## Updated Code

### Files Modified
1. `prisma/schema.prisma` - Added password expiry fields
2. `src/services/authService.js` - Added password timestamp updates
3. `src/controllers/userController.js` - Added password expiry initialization
4. `src/middleware/authMiddleware.js` - Added password fields to user query
5. `src/routes/authRoutes.js` - Added password status endpoint
6. `src/controllers/authController.js` - Added password status handler
7. `src/app.js` - Added password expiry middleware

### Files Created
1. `src/services/passwordExpiryService.js` - Core password expiry logic
2. `src/middleware/passwordExpiryMiddleware.js` - Access blocking middleware
3. `prisma/migrations/20251115_add_password_renewal_fields/migration.sql` - Database migration

## Testing

### Manual Testing Flow

1. **Create test agent**:
```bash
POST /api/users
{
  "email": "test@example.com",
  "firstName": "Test",
  "lastName": "Agent",
  "role": "agent"
}
```

2. **Check password status**:
```bash
GET /api/auth/password-status
# Should show ~180 days remaining
```

3. **Simulate expiry** (database update):
```sql
UPDATE users
SET password_expires_at = NOW() - INTERVAL '1 day'
WHERE email = 'test@example.com';
```

4. **Try to access dashboard**:
```bash
GET /api/conversations
# Should return 403 Forbidden with password expiry message
```

5. **Change password**:
```bash
POST /api/auth/change-password
{
  "currentPassword": "...",
  "newPassword": "NewPassword123!"
}
# Should succeed and reset expiry
```

6. **Verify access restored**:
```bash
GET /api/conversations
# Should now work normally
```

### Admin Reset Flow

1. **Admin regenerates password**:
```bash
POST /api/users/{userId}/regenerate-password
# Returns new password for user
```

2. **User logs in with new password**:
```bash
POST /api/auth/login
{
  "email": "test@example.com",
  "password": "{admin-generated-password}"
}
```

3. **User is unblocked and expiry reset**

## UI Integration (Recommended)

### Warning Notifications

Display warnings in agent dashboard and settings pages based on `warningLevel`:

```javascript
// Fetch password status on page load
const response = await fetch('/api/auth/password-status', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data } = await response.json();

// Display warning based on level
if (data.warningLevel === 'critical') {
  showAlert('danger', data.warningMessage);
} else if (data.warningLevel === 'warning') {
  showAlert('warning', data.warningMessage);
} else if (data.warningLevel === 'info') {
  showAlert('info', data.warningMessage);
} else if (data.warningLevel === 'notice') {
  showAlert('info', data.warningMessage);
}
```

### Password Change UI

Add password change form to settings page:

```html
<section id="password-change-section">
  <h3>Change Password</h3>
  <form id="password-change-form">
    <input type="password" name="currentPassword" placeholder="Current Password" required />
    <input type="password" name="newPassword" placeholder="New Password" required />
    <input type="password" name="confirmPassword" placeholder="Confirm New Password" required />
    <button type="submit">Change Password</button>
  </form>
  <div id="password-status">
    <!-- Display days remaining and warning message -->
  </div>
</section>
```

```javascript
document.getElementById('password-change-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);

  const response = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      currentPassword: formData.get('currentPassword'),
      newPassword: formData.get('newPassword')
    })
  });

  if (response.ok) {
    alert('Password changed successfully!');
    // Reload password status
  }
});
```

### Blocked Access UI

When user's password is expired and they try to access the system:

```javascript
// Global error handler for API requests
async function apiRequest(url, options) {
  const response = await fetch(url, options);

  if (response.status === 403) {
    const error = await response.json();
    if (error.code === 'PASSWORD_EXPIRED') {
      // Redirect to password change page
      window.location.href = '/change-password.html';
    }
  }

  return response;
}
```

## Security Considerations

1. **Password expiry only applies to agents and admins** - Regular users are exempt
2. **Admin-only password reset** - Only admins can unlock expired accounts
3. **All refresh tokens invalidated** - On password change or admin reset
4. **Secure password generation** - Admin-regenerated passwords use cryptographically secure random generation
5. **Migration initializes existing users** - All existing agents/admins get 180 days from migration date

## Migration Notes

When deploying this feature:

1. **Database migration runs automatically** in Docker environment
2. **Existing users get 180 days from migration date** - They won't be immediately blocked
3. **New users get 180 days from creation** - Standard behavior
4. **No disruption to existing sessions** - Password expiry checked on next login

## Environment Variables

No new environment variables required. The 180-day policy is hardcoded in `passwordExpiryService.js`:

```javascript
const PASSWORD_EXPIRY_DAYS = 180;
```

To change the policy duration, modify this constant.

## Troubleshooting

### User is blocked but shouldn't be
1. Check password expiry date: `SELECT password_expires_at FROM users WHERE id = '...'`
2. Manually unblock: `UPDATE users SET password_blocked = false WHERE id = '...'`
3. Reset expiry: Admin regenerates password via `/api/users/:id/regenerate-password`

### Password expiry not working
1. Verify migration ran: `SELECT password_changed_at FROM users LIMIT 1` (should exist)
2. Check middleware is loaded: Look for "Password expiry middleware" in logs
3. Verify user role: Only agents/admins are affected

### Warnings not showing
1. Check password status endpoint: `GET /api/auth/password-status`
2. Verify user is authenticated
3. Check `warningLevel` in response

## Future Enhancements

1. **Email notifications** - Send emails at warning thresholds
2. **Configurable expiry period** - Environment variable for days
3. **Password history** - Prevent reuse of recent passwords
4. **Grace period** - Allow limited access after expiry
5. **Self-service unlock** - Allow users to unlock via email verification
