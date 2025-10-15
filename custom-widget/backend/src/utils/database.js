/**
 * Database Client Initialization
 * Manages Prisma client connection and lifecycle
 */

const { PrismaClient } = require('@prisma/client');

class DatabaseClient {
  constructor() {
    this.prisma = null;
  }

  /**
   * Initialize database connection
   */
  async connect() {
    if (this.prisma) {
      return this.prisma;
    }

    try {
      this.prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
        errorFormat: 'pretty',
      });

      // Test the connection
      await this.prisma.$connect();
      logger.info('✅ Database connected successfully');
      
      return this.prisma;
    } catch (error) {
      logger.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Get database client instance
   */
  getClient() {
    if (!this.prisma) {
      throw new Error('Database not initialized. Call connect() first.');
    }
    return this.prisma;
  }

  /**
   * Check database health
   */
  async healthCheck() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message, 
        timestamp: new Date() 
      };
    }
  }

  /**
   * Gracefully disconnect from database
   */
  async disconnect() {
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
      logger.info('🔌 Database disconnected');
    }
  }

  /**
   * Execute database migrations (development)
   */
  async migrate() {
    if (process.env.NODE_ENV !== 'production') {
      try {
        const { execSync } = require('child_process');
        // Use db push for development to avoid migration state issues
        execSync('npx prisma db push', { stdio: 'inherit' });
        logger.info('✅ Database schema push completed');
      } catch (error) {
        logger.error('❌ Schema push failed:', error);
        throw error;
      }
    }
  }

  /**
   * Reset database (development only)
   */
  async reset() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database reset not allowed in production');
    }

    try {
      const { execSync } = require('child_process');
const { createLogger } = require('./logger');
const logger = createLogger('database');
      execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
      logger.info('🔄 Database reset completed');
    } catch (error) {
      logger.error('❌ Database reset failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
const databaseClient = new DatabaseClient();

module.exports = databaseClient;