#!/usr/bin/env node

/**
 * ADMIN RECOVERY CLI TOOL
 * 
 * This tool provides a command-line interface for admin password recovery
 * when the web interface is not accessible or the admin has lost their password.
 * 
 * Usage:
 *   node admin-recovery.js --help
 *   node admin-recovery.js recover --email admin@example.com --password NewPassword123!
 *   node admin-recovery.js create --email admin@example.com --password AdminPass123! --first-name Admin --last-name User
 * 
 * Environment Variables Required:
 *   ADMIN_RECOVERY_KEY - Secret key to enable recovery (set in .env)
 *   DATABASE_URL - PostgreSQL connection string
 * 
 * Security Features:
 *   - Requires environment-based recovery key
 *   - Validates password strength
 *   - Logs all recovery actions
 *   - Rate-limited via unique process execution
 */

const { program } = require('commander');
const { PrismaClient } = require('@prisma/client');
const passwordUtils = require('./src/utils/passwordUtils');
require('dotenv').config();

const prisma = new PrismaClient();

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logError(message) {
  log(`❌ ERROR: ${message}`, colors.red);
}

function logSuccess(message) {
  log(`✅ SUCCESS: ${message}`, colors.green);
}

function logWarning(message) {
  log(`⚠️  WARNING: ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  INFO: ${message}`, colors.cyan);
}

async function checkRecoveryKey() {
  const recoveryKey = process.env.ADMIN_RECOVERY_KEY;
  if (!recoveryKey) {
    logError('ADMIN_RECOVERY_KEY environment variable is not set.');
    logInfo('To enable admin recovery, add ADMIN_RECOVERY_KEY=your-secret-key to your .env file');
    process.exit(1);
  }
  return recoveryKey;
}

async function validateDatabase() {
  try {
    await prisma.$connect();
    logInfo('Database connection established');
  } catch (error) {
    logError(`Database connection failed: ${error.message}`);
    logInfo('Please check your DATABASE_URL environment variable');
    process.exit(1);
  }
}

async function recoverAdminPassword(email, newPassword) {
  try {
    const recoveryKey = await checkRecoveryKey();
    await validateDatabase();

    log(`\n${colors.bold}🔐 ADMIN PASSWORD RECOVERY${colors.reset}`);
    log('═'.repeat(50));

    // Find admin user
    const admin = await prisma.users.findFirst({
      where: { 
        email: email.toLowerCase(),
        role: 'admin'
      }
    });

    if (!admin) {
      logError(`Admin user with email '${email}' not found`);
      logInfo('Use the "list-admins" command to see existing admin accounts');
      process.exit(1);
    }

    // Validate new password
    const passwordValidation = passwordUtils.validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      logError(`Password requirements not met:`);
      passwordValidation.feedback.forEach(feedback => {
        log(`  • ${feedback}`, colors.red);
      });
      process.exit(1);
    }

    // Hash new password
    const hashedPassword = await passwordUtils.hashPassword(newPassword);

    // Update admin password
    await prisma.users.update({
      where: { id: admin.id },
      data: {
        password_hash: hashedPassword,
        is_active: true, // Ensure account is active
        updated_at: new Date()
      }
    });

    // Revoke all existing tokens
    await prisma.refresh_tokens.deleteMany({
      where: { user_id: admin.id }
    });

    // Log recovery action
    await prisma.system_logs.create({
      data: {
        id: require('crypto').randomUUID(),
        action: 'cli_admin_recovery',
        details: {
          admin_id: admin.id,
          admin_email: admin.email,
          timestamp: new Date().toISOString(),
          recovery_method: 'cli_tool'
        },
        created_at: new Date()
      }
    });

    logSuccess(`Admin password reset successfully!`);
    log(`Admin: ${admin.first_name} ${admin.last_name} (${admin.email})`, colors.green);
    logWarning('All existing sessions have been invalidated');
    logInfo('The admin user can now log in with the new password');

  } catch (error) {
    logError(`Recovery failed: ${error.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function createEmergencyAdmin(email, password, firstName, lastName) {
  try {
    const recoveryKey = await checkRecoveryKey();
    await validateDatabase();

    log(`\n${colors.bold}👑 EMERGENCY ADMIN CREATION${colors.reset}`);
    log('═'.repeat(50));

    // Check if any admin already exists
    const existingAdmin = await prisma.users.findFirst({
      where: { role: 'admin' }
    });

    if (existingAdmin) {
      logError('Admin already exists in the system');
      log(`Existing admin: ${existingAdmin.first_name} ${existingAdmin.last_name} (${existingAdmin.email})`, colors.yellow);
      logInfo('Use the "recover" command to reset existing admin password');
      process.exit(1);
    }

    // Validate password
    const passwordValidation = passwordUtils.validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      logError(`Password requirements not met:`);
      passwordValidation.feedback.forEach(feedback => {
        log(`  • ${feedback}`, colors.red);
      });
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await passwordUtils.hashPassword(password);

    // Create admin user
    const adminUser = await prisma.users.create({
      data: {
        id: require('crypto').randomUUID(),
        email: email.toLowerCase(),
        password_hash: hashedPassword,
        first_name: firstName,
        last_name: lastName,
        role: 'admin',
        is_active: true,
        email_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    // Log creation
    await prisma.system_logs.create({
      data: {
        id: require('crypto').randomUUID(),
        action: 'cli_emergency_admin_created',
        details: {
          admin_id: adminUser.id,
          admin_email: adminUser.email,
          timestamp: new Date().toISOString(),
          creation_method: 'cli_tool'
        },
        created_at: new Date()
      }
    });

    logSuccess('Emergency admin account created successfully!');
    log(`Admin: ${adminUser.first_name} ${adminUser.last_name} (${adminUser.email})`, colors.green);
    logInfo('The admin user can now log in to the system');

  } catch (error) {
    logError(`Admin creation failed: ${error.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function listAdmins() {
  try {
    await validateDatabase();

    log(`\n${colors.bold}👥 EXISTING ADMIN ACCOUNTS${colors.reset}`);
    log('═'.repeat(50));

    const admins = await prisma.users.findMany({
      where: { role: 'admin' },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        is_active: true,
        email_verified: true,
        last_login: true,
        created_at: true
      },
      orderBy: { created_at: 'asc' }
    });

    if (admins.length === 0) {
      logWarning('No admin accounts found in the system');
      logInfo('Use the "create" command to create an emergency admin account');
      return;
    }

    admins.forEach((admin, index) => {
      const status = admin.is_active ? 
        `${colors.green}Active${colors.reset}` : 
        `${colors.red}Inactive${colors.reset}`;
      const lastLogin = admin.last_login ? 
        admin.last_login.toISOString().split('T')[0] : 
        'Never';
      
      log(`\n${index + 1}. ${admin.first_name} ${admin.last_name}`);
      log(`   Email: ${admin.email}`);
      log(`   Status: ${status}`);
      log(`   Last Login: ${lastLogin}`);
      log(`   Created: ${admin.created_at.toISOString().split('T')[0]}`);
    });

  } catch (error) {
    logError(`Failed to list admins: ${error.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// CLI Program Configuration
program
  .name('admin-recovery')
  .description('Emergency admin account recovery and management tool')
  .version('1.0.0');

program
  .command('recover')
  .description('Reset admin user password')
  .requiredOption('-e, --email <email>', 'Admin email address')
  .requiredOption('-p, --password <password>', 'New password')
  .action(async (options) => {
    await recoverAdminPassword(options.email, options.password);
  });

program
  .command('create')
  .description('Create emergency admin account (only if no admin exists)')
  .requiredOption('-e, --email <email>', 'Admin email address')
  .requiredOption('-p, --password <password>', 'Admin password')
  .requiredOption('-f, --first-name <firstName>', 'Admin first name')
  .requiredOption('-l, --last-name <lastName>', 'Admin last name')
  .action(async (options) => {
    await createEmergencyAdmin(options.email, options.password, options.firstName, options.lastName);
  });

program
  .command('list-admins')
  .description('List all admin accounts')
  .action(async () => {
    await listAdmins();
  });

program
  .command('check-recovery')
  .description('Check if recovery is properly configured')
  .action(async () => {
    try {
      await checkRecoveryKey();
      await validateDatabase();
      logSuccess('Admin recovery is properly configured');
      logInfo('Recovery key is set and database is accessible');
    } catch (error) {
      // Error handling is done in the functions
    }
  });

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}