# Scripts Directory

Utility scripts to simplify Lizdeika deployment and maintenance.

## generate-secrets.sh

Automated security secret generator for Lizdeika.

### Purpose

Eliminates manual `openssl` commands by automatically generating all required cryptographic secrets and injecting them into your `.env` file.

### What it generates

- `JWT_SECRET` - JSON Web Token signing key (64 chars, base64)
- `JWT_REFRESH_SECRET` - Refresh token signing key (64 chars, base64)
- `TOTP_ENCRYPTION_KEY` - Two-factor authentication encryption key (64 chars, base64)
- `ADMIN_RECOVERY_KEY` - Admin account recovery key (44 chars, base64)

### Usage

```bash
# Basic usage - generates and updates .env
./scripts/generate-secrets.sh

# First time (no .env exists)
# - Shows generated secrets
# - Prompts to create .env file manually

# When secrets already exist
# - Creates backup: .env.backup.YYYYMMDD_HHMMSS
# - Prompts for confirmation:
#   1) Keep existing (safe, recommended)
#   2) Replace (⚠️ invalidates all JWT tokens)
#   3) Show new secrets without saving
```

### Safety features

- **Backup creation** - Automatically backs up `.env` before changes
- **Overwrite protection** - Warns when secrets already exist
- **Non-destructive mode** - Option to preview secrets without saving
- **Validation** - Checks for `openssl` availability

### Example output

```
=========================================
Lizdeika Secret Generator
=========================================

Generating cryptographic secrets...

✓ Secrets generated successfully
✓ Created backup of .env
✓ Updated .env with generated secrets

Secret lengths:
  - JWT_SECRET: 64 chars
  - JWT_REFRESH_SECRET: 64 chars
  - TOTP_ENCRYPTION_KEY: 64 chars
  - ADMIN_RECOVERY_KEY: 44 chars

✓ All secrets configured successfully

Next steps:
  1. Add your API keys to .env (OpenRouter, Mistral, ChromaDB)
  2. Set SITE_URL in .env (REQUIRED for production)
  3. Run: docker compose -f docker-compose.prod.yml up -d
```

### Integration

This script is integrated into the deployment workflow:

- **PRODUCTION_DEPLOY.md** - Step 3 of Quick Deploy
- **README.md** - Step 2 of Initial Setup
- **Security Checklist** - First item in checklist

### Technical details

**Algorithm**: Uses `openssl rand -base64` for cryptographically secure random generation

**Secret lengths**:
- 48 bytes (base64) = 64 characters output (JWT secrets, TOTP key)
- 32 bytes (base64) = 44 characters output (Admin recovery)

**File operations**:
- Uses `sed -i` for in-place updates
- Handles both commented (`#JWT_SECRET=`) and active entries
- Appends if key doesn't exist in file

### When to regenerate

**Required**:
- Initial deployment (first time setup)
- Security breach or key compromise
- Migrating from development to production

**NOT recommended**:
- Routine maintenance (invalidates user sessions)
- After updates (existing secrets remain valid)

**Impact of regeneration**:
- ⚠️ All users logged out (JWT tokens invalidated)
- ⚠️ 2FA codes must be reconfigured (TOTP key changed)
- ⚠️ Admin recovery codes invalidated

### Troubleshooting

**"openssl is not installed"**
```bash
sudo apt-get install openssl
```

**".env file not found"**
```bash
cp .env.template .env
./scripts/generate-secrets.sh
```

**"Permission denied"**
```bash
chmod +x scripts/generate-secrets.sh
```

**Secrets too short/long**
- JWT secrets should be 64 characters
- Recovery key should be 44 characters
- If different, regenerate: `./scripts/generate-secrets.sh` (option 2)

### Security best practices

- ✅ Run this script on secure, trusted systems only
- ✅ Never commit generated `.env` files to git
- ✅ Use option 3 (preview) if copying to remote systems
- ✅ Keep backups in secure location (contain sensitive keys)
- ❌ Never run with `sudo` (unnecessary and risky)
- ❌ Never share generated secrets via insecure channels

## Future scripts

Planned utility scripts for this directory:

- `validate-env.sh` - Pre-flight checks before Docker build
- `backup-db.sh` - Automated database backup
- `health-check.sh` - System health verification
- `migrate-db.sh` - Database migration helper
