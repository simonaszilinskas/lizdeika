#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const passwordUtils = require('./src/utils/passwordUtils');
require('dotenv').config();

const prisma = new PrismaClient();

async function updateAgentPassword() {
    console.log('🔧 Updating agent user password...');
    
    try {
        // Hash the new password
        const newPasswordHash = await passwordUtils.hashPassword('Agent123!');
        
        // Update the agent user
        const agentUser = await prisma.users.upsert({
            where: { email: 'agent@vilnius.lt' },
            update: {
                password_hash: newPasswordHash,
                is_active: true,
                email_verified: true,
                updated_at: new Date()
            },
            create: {
                id: require('crypto').randomUUID(),
                email: 'agent@vilnius.lt',
                password_hash: newPasswordHash,
                first_name: 'Agent',
                last_name: 'User',
                role: 'user',
                is_active: true,
                email_verified: true,
                created_at: new Date(),
                updated_at: new Date()
            }
        });
        
        console.log('✅ Agent user updated:', agentUser.email);
        console.log('📝 Agent credentials: agent@vilnius.lt / Agent123!');
        
    } catch (error) {
        console.error('❌ Error updating agent user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateAgentPassword();