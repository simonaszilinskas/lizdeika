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

# 1. Ensure /var/uploads directory exists and has correct permissions
log_info "Checking upload directory permissions..."

UPLOADS_DIR="${UPLOADS_DIR:-/var/uploads}"

if [ ! -d "$UPLOADS_DIR" ]; then
    log_info "Creating $UPLOADS_DIR directory..."
    mkdir -p "$UPLOADS_DIR"
fi

# Ensure nodejs user (uid 1001) owns the directory
# This handles the case where Docker volume mounts override ownership
if ! chown -R 1001:1001 "$UPLOADS_DIR" 2>/dev/null; then
    log_error "Failed to change ownership of $UPLOADS_DIR to nodejs:nodejs"
    log_error "This usually means insufficient permissions. Check container user and volume mount."
    exit 1
fi

# Ensure directory is readable and writable by owner
chmod 700 "$UPLOADS_DIR"

# Test write access
if ! touch "$UPLOADS_DIR/.write-test" 2>/dev/null; then
    log_error "Failed to write to $UPLOADS_DIR - directory is not writable"
    log_error "Check Docker volume mount permissions and container user"
    exit 1
fi

# Clean up test file
rm -f "$UPLOADS_DIR/.write-test"

log_info "Upload directory permissions verified: $UPLOADS_DIR"

# 2. Run Prisma migrations (database setup)
log_info "Running database migrations..."
npx prisma migrate deploy || {
    log_error "Database migrations failed"
    exit 1
}

# 3. Generate Prisma client
log_info "Generating Prisma client..."
npx prisma generate || {
    log_error "Prisma client generation failed"
    exit 1
}

log_info "Entrypoint initialization complete"

# 4. Start the application (runs as root, which is acceptable since we're in container)
# Node.js app has already ensured permissions on upload directory
log_info "Starting Node.js application..."
exec "$@"
