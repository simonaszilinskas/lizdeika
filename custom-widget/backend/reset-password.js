/**
 * Password Reset Script
 * Resets user passwords directly in the database
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function resetPassword(email, newPassword) {
  try {
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update the user's password
    const user = await prisma.users.update({
      where: { email },
      data: { 
        password_hash: hashedPassword,
        updated_at: new Date()
      }
    });
    
    console.log(`✅ Password reset for ${user.email}`);
    console.log(`   Name: ${user.first_name} ${user.last_name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   New password: ${newPassword}`);
    
  } catch (error) {
    if (error.code === 'P2025') {
      console.error(`❌ User with email ${email} not found`);
    } else {
      console.error(`❌ Error resetting password:`, error.message);
    }
  }
}

async function main() {
  console.log('🔐 Resetting user passwords...\n');
  
  // Reset admin password
  await resetPassword('admin@vilnius.lt', 'admin123');
  
  // Reset agent passwords
  await resetPassword('agent1@vilnius.lt', 'agent123');
  await resetPassword('agent2@vilnius.lt', 'agent123');
  
  // Reset regular user password
  await resetPassword('user@example.com', 'user123');
  
  console.log('\n✅ Password reset complete!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });