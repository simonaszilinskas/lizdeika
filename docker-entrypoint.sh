#!/bin/bash

# Docker Entrypoint Script
# Ensures proper permissions and initialization before starting the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 1. Root-level setup: Ensure /var/uploads directory exists and has correct permissions
# This step must run as root because we need to change ownership and permissions
# on potentially volume-mounted directories that may have incorrect ownership
log_info "Checking upload directory permissions (running as root)..."

UPLOADS_DIR="${UPLOADS_DIR:-/var/uploads}"

if [ ! -d "$UPLOADS_DIR" ]; then
    log_info "Creating $UPLOADS_DIR directory..."
    mkdir -p "$UPLOADS_DIR"
fi

# Critical: Ensure nodejs user (uid 1001) owns the directory
# Docker volume mounts often override ownership, so we must fix it at runtime
# This must be done as root; the application will run as the nodejs user
if ! chown -R 1001:1001 "$UPLOADS_DIR" 2>/dev/null; then
    log_error "Failed to change ownership of $UPLOADS_DIR to nodejs:nodejs"
    log_error "This usually means insufficient permissions. Check container user and volume mount."
    exit 1
fi

# Set secure permissions: owner read/write/execute, others none (700)
chmod 700 "$UPLOADS_DIR"

# Validate write access before starting app
if ! touch "$UPLOADS_DIR/.write-test" 2>/dev/null; then
    log_error "Failed to write to $UPLOADS_DIR - directory is not writable"
    log_error "Check Docker volume mount permissions and container user"
    exit 1
fi

# Clean up test file
rm -f "$UPLOADS_DIR/.write-test"

log_info "Upload directory permissions verified: $UPLOADS_DIR (owned by nodejs user 1001:1001)"

# 2. Run Prisma migrations (database setup - root operation)
log_info "Running database migrations..."
npx prisma migrate deploy || {
    log_error "Database migrations failed"
    exit 1
}

# 3. Generate Prisma client (root operation)
log_info "Generating Prisma client..."
npx prisma generate || {
    log_error "Prisma client generation failed"
    exit 1
}

log_info "All root-level initialization complete"
log_info "Ready to drop privileges and start Node.js application as non-root user"

# 4. Drop privileges and start application as non-root nodejs user
# Permissions are now properly set, so we can safely switch to non-root user
# gosu is a lightweight sudo alternative for containers
log_info "Dropping privileges to nodejs user..."

# Verify gosu exists
if ! command -v gosu &> /dev/null; then
    log_error "gosu not found - cannot drop privileges safely"
    exit 1
fi

# Switch to nodejs user (uid 1001) and execute the Node.js application
# This ensures the app runs with minimal privileges while allowing
# the entrypoint script to perform necessary root-level initialization
exec gosu 1001 "$@"
