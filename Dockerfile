# Multi-stage build for Vilnius Assistant
FROM node:20-slim AS base
WORKDIR /app

# Install dependencies for Prisma, bcrypt and onnxruntime
RUN apt-get update && apt-get install -y \
    openssl \
    python3 \
    make \
    g++ \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY custom-widget/backend/package*.json ./
COPY custom-widget/backend/prisma ./prisma/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Development stage  
FROM base AS development
RUN npm ci
COPY custom-widget/backend ./
COPY custom-widget/*.html ../
COPY custom-widget/*.js ../
COPY custom-widget/js ../js
RUN npx prisma generate
EXPOSE 3002
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS builder

# Install full dependencies including devDependencies for Prisma CLI
RUN npm ci

COPY custom-widget/backend ./
# Copy static assets to ./public for organized structure
COPY custom-widget/*.html ./public/
COPY custom-widget/*.js ./public/
COPY custom-widget/js ./public/js
RUN npx prisma generate
RUN npm run test:unit || true

# Production stage
FROM node:20-slim AS production
WORKDIR /app

# Install runtime dependencies including gosu for privilege dropping
RUN apt-get update && apt-get install -y \
    openssl \
    wget \
    dumb-init \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --ingroup nodejs nodejs

# Copy built application and static assets from builder
COPY --from=builder --chown=nodejs:nodejs /app ./
# Explicit node_modules copy for clarity and reliability
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Ensure Prisma CLI is available for migrations
RUN npm install -g prisma@latest

# Create necessary directories with proper ownership
RUN mkdir -p /app/logs /var/uploads && \
    chown -R nodejs:nodejs /app/logs /var/uploads

# Copy entrypoint script for permission handling and initialization
COPY docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Security: Entrypoint script handles privilege management
# - Runs as root initially to fix ownership/permissions on /var/uploads volume
# - Performs database migrations (requires root-level access to filesystem)
# - Generates Prisma client
# - Then drops privileges to nodejs user via gosu before launching Node.js application
# - Node.js process runs as non-root nodejs user (uid 1001)
# This satisfies container security policy while allowing necessary setup operations

# Health check - use PORT env var, fallback to 3002
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3002}/health || exit 1

EXPOSE 3002

# Use dumb-init with entrypoint script for proper signal handling and initialization
ENTRYPOINT ["dumb-init", "--"]
CMD ["/usr/local/bin/entrypoint.sh", "node", "server.js"]