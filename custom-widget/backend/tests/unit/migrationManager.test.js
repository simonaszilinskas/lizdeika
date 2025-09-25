jest.mock('child_process', () => ({
    execSync: jest.fn(),
}));

jest.mock('../../src/utils/database', () => ({
    healthCheck: jest.fn(),
}));

const childProcess = require('child_process');
const databaseClient = require('../../src/utils/database');
const {
    ensureMigrations,
    validateDeploymentEnvironment,
} = require('../../src/utils/migrationManager');

const resetExecMock = () => {
    childProcess.execSync.mockReset();
    databaseClient.healthCheck.mockReset();
};

describe('validateDeploymentEnvironment', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
        jest.clearAllMocks();
    });

    test('throws when DATABASE_URL is missing', () => {
        delete process.env.DATABASE_URL;
        expect(() => validateDeploymentEnvironment()).toThrow('Missing critical environment variables');
    });

    test('warns but does not throw when optional vars missing', () => {
        process.env.DATABASE_URL = 'postgres://example:5432/db';
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        expect(() => validateDeploymentEnvironment()).not.toThrow();
        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
    });
});

describe('ensureMigrations', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        resetExecMock();
        databaseClient.healthCheck.mockResolvedValue({ status: 'healthy' });
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        jest.clearAllMocks();
    });

    test('skips deploy when no pending migrations', async () => {
        childProcess.execSync.mockReturnValueOnce(JSON.stringify({ migrations: [{ name: '202401', applied: true }] }));

        await expect(ensureMigrations({ cwd: '/tmp/project' })).resolves.toBeUndefined();
        expect(childProcess.execSync).toHaveBeenCalledTimes(1);
        expect(databaseClient.healthCheck).not.toHaveBeenCalled();
    });

    test('applies pending migrations and checks health', async () => {
        childProcess.execSync
            .mockReturnValueOnce(JSON.stringify({ migrations: [{ name: '202401', applied: false }] }))
            .mockReturnValueOnce('') // deploy
            .mockReturnValueOnce(''); // status human-readable

        await expect(ensureMigrations({ cwd: '/tmp/project' })).resolves.toBeUndefined();

        expect(childProcess.execSync).toHaveBeenNthCalledWith(1, 'npx prisma migrate status --json', expect.objectContaining({ cwd: '/tmp/project' }));
        expect(childProcess.execSync).toHaveBeenNthCalledWith(2, 'npx prisma migrate deploy --force', expect.objectContaining({ cwd: '/tmp/project' }));
        expect(childProcess.execSync).toHaveBeenNthCalledWith(3, 'npx prisma migrate status --human-readable', expect.objectContaining({ cwd: '/tmp/project' }));
        expect(databaseClient.healthCheck).toHaveBeenCalledTimes(1);
    });

    test('rolls back when migration deploy fails', async () => {
        const error = new Error('deploy failed');

        childProcess.execSync
            .mockReturnValueOnce(JSON.stringify({ migrations: [{ name: '202401', applied: false }] }))
            .mockImplementationOnce(() => { throw error; })
            .mockReturnValueOnce('');

        await expect(ensureMigrations({ cwd: '/tmp/project' })).rejects.toThrow('deploy failed');

        expect(childProcess.execSync).toHaveBeenNthCalledWith(3, 'npx prisma migrate resolve --rolled-back 202401', expect.objectContaining({ cwd: '/tmp/project' }));
        expect(databaseClient.healthCheck).not.toHaveBeenCalled();
    });

    test('rolls back when health check fails after deploy', async () => {
        childProcess.execSync
            .mockReturnValueOnce(JSON.stringify({ migrations: [{ name: '202401', applied: false }] }))
            .mockReturnValueOnce('')
            .mockReturnValueOnce('')
            .mockReturnValueOnce('');

        databaseClient.healthCheck.mockResolvedValue({ status: 'unhealthy', error: 'DB not reachable' });

        await expect(ensureMigrations({ cwd: '/tmp/project' })).rejects.toThrow('Database health check failed after migrations');

        expect(childProcess.execSync).toHaveBeenLastCalledWith('npx prisma migrate resolve --rolled-back 202401', expect.objectContaining({ cwd: '/tmp/project' }));
    });
});
