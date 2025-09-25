const { execSync } = require('child_process');
const databaseClient = require('./database');

function parseMigrationStatus(output) {
    const lines = output.split('\n').map(line => line.trim()).filter(Boolean);
    const result = { migrations: [] };

    let foundUnapplied = false;
    for (const line of lines) {
        if (line.includes('Following migrations have not yet been applied:')) {
            foundUnapplied = true;
            continue;
        }

        if (foundUnapplied && line.match(/^\d{14}/)) {
            result.migrations.push({ name: line, applied: false });
        }

        if (line.includes('Database schema is up to date')) {
            return { migrations: [] }; // No pending migrations
        }

        if (line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')) {
            result.databaseError = line;
        }
    }

    return result;
}

function execPrismaCommand(command, options = {}) {
    return execSync(command, {
        stdio: 'pipe',
        cwd: options.cwd || process.cwd(),
        env: process.env,
        encoding: 'utf8',
        ...options,
    }).toString();
}

function validateDeploymentEnvironment() {
    const criticalVars = ['DATABASE_URL'];
    const missing = criticalVars.filter((key) => !process.env[key]);

    if (missing.length) {
        throw new Error(`Missing critical environment variables: ${missing.join(', ')}`);
    }

    const optionalVars = ['PRISMA_MIGRATE_SHADOW_DB_URL', 'SHADOW_DATABASE_URL'];
    const missingOptional = optionalVars.filter((key) => !process.env[key]);

    if (missingOptional.length) {
        console.warn(`⚠️ Optional env vars not set: ${missingOptional.join(', ')}. Ensure pipeline handles shadow databases as needed.`);
    }
}

async function ensureMigrations(options = {}) {
    const cwd = options.cwd || process.cwd();

    console.log('🔄 Validating Prisma migration state...');

    let statusSnapshot;
    try {
        const rawStatus = execPrismaCommand('npx prisma migrate status --schema prisma/schema.prisma', { cwd });
        // Parse the human-readable output since --json flag isn't available in this version
        statusSnapshot = parseMigrationStatus(rawStatus);
    } catch (statusError) {
        // Prisma migrate status returns exit code 1 when there are pending migrations
        // This is expected behavior, so we should parse the output instead of failing
        if (statusError.stdout) {
            statusSnapshot = parseMigrationStatus(statusError.stdout);
        } else {
            console.error('❌ Unable to read migration status:', statusError.message);
            throw statusError;
        }
    }

    if (statusSnapshot?.databaseError) {
        console.error('❌ Migration status reports database error:', statusSnapshot.databaseError);
        throw new Error(statusSnapshot.databaseError);
    }

    const pendingMigrations = statusSnapshot?.migrations?.filter((migration) => migration.applied === false).map((m) => m.name) || [];

    if (pendingMigrations.length === 0) {
        console.log('✅ No pending migrations detected. Skipping deploy.');
        return;
    }

    console.log(`📦 Pending migrations detected: ${pendingMigrations.join(', ')}`);

    try {
        execPrismaCommand('npx prisma migrate deploy --schema prisma/schema.prisma', { cwd });
        console.log('✅ Prisma migrations applied successfully');
    } catch (migrationError) {
        console.error('💥 Prisma migrate deploy failed:', migrationError.message);
        await attemptMigrationRollback(pendingMigrations, cwd);
        throw migrationError;
    }

    try {
        execPrismaCommand('npx prisma migrate status --schema prisma/schema.prisma', { cwd });
        console.log('🩺 Migration health check passed');
    } catch (healthError) {
        console.error('❌ Migration health check failed:', healthError.message);
        await attemptMigrationRollback(pendingMigrations, cwd);
        throw healthError;
    }

    const databaseHealth = await databaseClient.healthCheck();
    if (databaseHealth.status !== 'healthy') {
        console.error('❌ Database health check failed after migrations:', databaseHealth.error || 'Unknown error');
        await attemptMigrationRollback(pendingMigrations, cwd);
        throw new Error('Database health check failed after migrations');
    }

    console.log('🧪 Database health verified after migrations');
}

async function attemptMigrationRollback(pendingMigrations, cwd) {
    if (!pendingMigrations?.length) {
        console.warn('⚠️ No migrations to rollback. Manual intervention required.');
        return;
    }

    const rollbackTarget = pendingMigrations[pendingMigrations.length - 1];
    try {
        console.log(`🛑 Attempting rollback for migration: ${rollbackTarget}`);
        execPrismaCommand(`npx prisma migrate resolve --rolled-back ${rollbackTarget} --schema prisma/schema.prisma`, { cwd });
        console.log(`↩️  Migration ${rollbackTarget} marked as rolled back`);
    } catch (rollbackError) {
        console.error('❌ Failed to mark migration as rolled back:', rollbackError.message);
    }
}

module.exports = {
    ensureMigrations,
    validateDeploymentEnvironment,
    attemptMigrationRollback,
    execPrismaCommand,
};
