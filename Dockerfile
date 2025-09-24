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
COPY custom-widget/*.html ../
COPY custom-widget/*.js ../
COPY custom-widget/js ../js
RUN npx prisma generate
RUN npm run test:unit || true

# Production stage
FROM node:20-slim AS production
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    wget \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --ingroup nodejs nodejs

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app ./
COPY --from=builder /app/node_modules ./node_modules

# Ensure Prisma CLI is available for migrations
RUN npm install -g prisma@latest

# Create necessary directories
RUN mkdir -p /app/logs && chown nodejs:nodejs /app/logs

USER nodejs

# Health check - use PORT env var, fallback to 3002
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3002}/health || exit 1

EXPOSE 3002

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]