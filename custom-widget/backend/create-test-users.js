#!/usr/bin/env node

/**
 * Create test users for development
 * This script creates admin and user accounts for testing the authentication system
 */

const { PrismaClient } = require('@prisma/client');
const passwordUtils = require('./src/utils/passwordUtils');
require('dotenv').config();

const prisma = new PrismaClient();

async function createTestUsers() {
    console.log('🔧 Creating test users...');
    
    try {
        // Create admin user
        const adminPasswordHash = await passwordUtils.hashPassword('admin123');
        const adminUser = await prisma.users.upsert({
            where: { email: 'admin@vilnius.lt' },
            update: {},
            create: {
                id: require('crypto').randomUUID(),
                email: 'admin@vilnius.lt',
                password_hash: adminPasswordHash,
                first_name: 'Admin',
                last_name: 'User',
                role: 'admin',
                is_active: true,
                email_verified: true,
                created_at: new Date(),
                updated_at: new Date()
            }
        });
        
        console.log('✅ Admin user created:', adminUser.email);
        
        // Create regular agent user
        const agentPasswordHash = await passwordUtils.hashPassword('agent123');
        const agentUser = await prisma.users.upsert({
            where: { email: 'agent@vilnius.lt' },
            update: {},
            create: {
                id: require('crypto').randomUUID(),
                email: 'agent@vilnius.lt',
                password_hash: agentPasswordHash,
                first_name: 'Agent',
                last_name: 'User',
                role: 'user',
                is_active: true,
                email_verified: true,
                created_at: new Date(),
                updated_at: new Date()
            }
        });
        
        console.log('✅ Agent user created:', agentUser.email);
        
        console.log('\n📝 Test credentials:');
        console.log('Admin: admin@vilnius.lt / admin123');
        console.log('Agent: agent@vilnius.lt / agent123');
        
    } catch (error) {
        console.error('❌ Error creating test users:', error);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    createTestUsers();
}

module.exports = { createTestUsers };