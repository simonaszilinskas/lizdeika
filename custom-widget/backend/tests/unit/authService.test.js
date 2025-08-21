/**
 * AuthService Unit Tests
 * Tests for authentication business logic and database operations
 */

const authService = require('../../src/services/authService');
const databaseClient = require('../../src/utils/database');
const tokenUtils = require('../../src/utils/tokenUtils');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Mock dependencies
jest.mock('../../src/utils/database');
jest.mock('../../src/utils/tokenUtils');
jest.mock('bcryptjs');
jest.mock('crypto');

describe('AuthService', () => {
  let mockPrisma;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Prisma client
    mockPrisma = {
      users: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      refresh_tokens: {
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      agent_status: {
        upsert: jest.fn(),
      },
      system_logs: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    
    databaseClient.getClient.mockReturnValue(mockPrisma);
  });

  describe('registerUser', () => {
    const validUserData = {
      email: 'new@example.com',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'User',
      role: 'user',
    };

    beforeEach(() => {
      bcrypt.hash.mockResolvedValue(testUtils.mockHashedPassword);
      tokenUtils.generateAccessToken.mockReturnValue('access-token');
      tokenUtils.generateRefreshToken.mockReturnValue('refresh-token');
      crypto.randomUUID.mockReturnValue(testUtils.generateUuid());
    });

    it('should register a new user successfully', async () => {
      const mockUser = { ...testUtils.testUser, email: validUserData.email };
      const mockRefreshToken = { id: 'token-id', token: 'refresh-token' };

      mockPrisma.users.findFirst.mockResolvedValue(null); // No existing user
      mockPrisma.users.create.mockResolvedValue(mockUser);
      mockPrisma.refresh_tokens.create.mockResolvedValue(mockRefreshToken);

      const result = await authService.registerUser(validUserData);

      expect(mockPrisma.users.findFirst).toHaveBeenCalledWith({
        where: { email: validUserData.email.toLowerCase() },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(validUserData.password, 12);
      expect(mockPrisma.users.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: validUserData.email.toLowerCase(),
          first_name: validUserData.firstName,
          last_name: validUserData.lastName,
          role: validUserData.role,
          password_hash: testUtils.mockHashedPassword,
        }),
      });
      expect(result).toEqual({
        user: expect.not.objectContaining({ password_hash: expect.anything() }),
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          tokenType: 'Bearer',
          expiresIn: 900,
        },
        emailVerificationRequired: true,
      });
    });

    it('should throw error for duplicate email', async () => {
      mockPrisma.users.findFirst.mockResolvedValue(testUtils.testUser);

      await expect(authService.registerUser(validUserData))
        .rejects.toThrow('User with this email already exists');

      expect(mockPrisma.users.create).not.toHaveBeenCalled();
    });

    it('should create agent status for agent role', async () => {
      const agentUserData = { ...validUserData, role: 'agent' };
      const mockUser = { ...testUtils.testUser, role: 'agent' };

      mockPrisma.users.findFirst.mockResolvedValue(null);
      mockPrisma.users.create.mockResolvedValue(mockUser);
      mockPrisma.refresh_tokens.create.mockResolvedValue({ id: 'token-id' });

      await authService.registerUser(agentUserData);

      expect(mockPrisma.agent_status.upsert).toHaveBeenCalledWith({
        where: { user_id: mockUser.id },
        create: {
          id: expect.any(String),
          user_id: mockUser.id,
          status: 'offline',
        },
        update: {
          status: 'offline',
          updated_at: expect.any(Date),
        },
      });
    });

    it('should validate required fields', async () => {
      const invalidData = { email: 'test@example.com' }; // Missing required fields

      await expect(authService.registerUser(invalidData))
        .rejects.toThrow();
    });

    it('should validate email format', async () => {
      const invalidData = { ...validUserData, email: 'invalid-email' };

      await expect(authService.registerUser(invalidData))
        .rejects.toThrow();
    });

    it('should validate password strength', async () => {
      const invalidData = { ...validUserData, password: 'weak' };

      await expect(authService.registerUser(invalidData))
        .rejects.toThrow();
    });
  });

  describe('loginUser', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    beforeEach(() => {
      bcrypt.compare.mockResolvedValue(true);
      tokenUtils.generateAccessToken.mockReturnValue('access-token');
      tokenUtils.generateRefreshToken.mockReturnValue('refresh-token');
      crypto.randomUUID.mockReturnValue(testUtils.generateUuid());
    });

    it('should login user successfully', async () => {
      const mockUser = { 
        ...testUtils.testUser, 
        agent_status: { status: 'offline' },
        last_login: new Date('2025-01-01T00:00:00Z'),
      };
      const mockUpdatedUser = { ...mockUser, last_login: new Date() };

      mockPrisma.users.findFirst.mockResolvedValue(mockUser);
      mockPrisma.refresh_tokens.create.mockResolvedValue({ id: 'token-id' });
      mockPrisma.users.update.mockResolvedValue(mockUpdatedUser);

      const result = await authService.loginUser(loginData);

      expect(mockPrisma.users.findFirst).toHaveBeenCalledWith({
        where: { email: loginData.email.toLowerCase() },
        include: expect.objectContaining({
          agent_status: expect.any(Object),
        }),
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(loginData.password, mockUser.password_hash);
      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { last_login: expect.any(Date) },
        include: expect.any(Object),
      });
      expect(result).toEqual({
        user: expect.not.objectContaining({ password_hash: expect.anything() }),
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          tokenType: 'Bearer',
          expiresIn: 900,
        },
      });
    });

    it('should throw error for invalid email', async () => {
      mockPrisma.users.findFirst.mockResolvedValue(null);

      await expect(authService.loginUser(loginData))
        .rejects.toThrow('Invalid email or password');

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw error for invalid password', async () => {
      mockPrisma.users.findFirst.mockResolvedValue(testUtils.testUser);
      bcrypt.compare.mockResolvedValue(false);

      await expect(authService.loginUser(loginData))
        .rejects.toThrow('Invalid email or password');
    });

    it('should throw error for inactive user', async () => {
      const inactiveUser = { ...testUtils.testUser, is_active: false };
      mockPrisma.users.findFirst.mockResolvedValue(inactiveUser);

      await expect(authService.loginUser(loginData))
        .rejects.toThrow('Account is deactivated. Please contact support.');

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should handle missing credentials', async () => {
      const invalidData = { email: 'test@example.com' }; // Missing password

      await expect(authService.loginUser(invalidData))
        .rejects.toThrow();
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockTokenRecord = {
        id: 'token-id',
        user_id: testUtils.testUser.id,
        expires_at: new Date(Date.now() + 86400000), // 1 day from now
        is_revoked: false,
        users: testUtils.testUser,
      };

      mockPrisma.refresh_tokens.findUnique.mockResolvedValue(mockTokenRecord);
      tokenUtils.generateAccessToken.mockReturnValue('new-access-token');

      const result = await authService.refreshAccessToken(refreshToken);

      expect(mockPrisma.refresh_tokens.findUnique).toHaveBeenCalledWith({
        where: { token: refreshToken },
        include: { users: true },
      });
      expect(result).toEqual({
        accessToken: 'new-access-token',
        tokenType: 'Bearer',
        expiresIn: 900,
      });
    });

    it('should throw error for invalid refresh token', async () => {
      mockPrisma.refresh_tokens.findUnique.mockResolvedValue(null);

      await expect(authService.refreshAccessToken('invalid-token'))
        .rejects.toThrow('Invalid refresh token');
    });

    it('should throw error for expired refresh token', async () => {
      const expiredTokenRecord = {
        id: 'token-id',
        expires_at: new Date(Date.now() - 86400000), // 1 day ago
        is_revoked: false,
      };

      mockPrisma.refresh_tokens.findUnique.mockResolvedValue(expiredTokenRecord);

      await expect(authService.refreshAccessToken('expired-token'))
        .rejects.toThrow('Refresh token expired');
    });

    it('should throw error for revoked refresh token', async () => {
      const revokedTokenRecord = {
        id: 'token-id',
        expires_at: new Date(Date.now() + 86400000),
        is_revoked: true,
      };

      mockPrisma.refresh_tokens.findUnique.mockResolvedValue(revokedTokenRecord);

      await expect(authService.refreshAccessToken('revoked-token'))
        .rejects.toThrow('Refresh token revoked');
    });
  });

  describe('logoutUser', () => {
    it('should logout user successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockTokenRecord = { id: 'token-id' };

      mockPrisma.refresh_tokens.findUnique.mockResolvedValue(mockTokenRecord);
      mockPrisma.refresh_tokens.delete.mockResolvedValue(mockTokenRecord);

      await authService.logoutUser(refreshToken);

      expect(mockPrisma.refresh_tokens.findUnique).toHaveBeenCalledWith({
        where: { token: refreshToken },
      });
      expect(mockPrisma.refresh_tokens.delete).toHaveBeenCalledWith({
        where: { id: 'token-id' },
      });
    });

    it('should handle non-existent refresh token gracefully', async () => {
      mockPrisma.refresh_tokens.findUnique.mockResolvedValue(null);

      await expect(authService.logoutUser('invalid-token')).resolves.not.toThrow();
      expect(mockPrisma.refresh_tokens.delete).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const userId = testUtils.testUser.id;
    const currentPassword = 'currentPassword123';
    const newPassword = 'newPassword456';

    beforeEach(() => {
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('new-hashed-password');
    });

    it('should change password successfully', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(testUtils.testUser);
      mockPrisma.users.update.mockResolvedValue({ ...testUtils.testUser });
      mockPrisma.refresh_tokens.deleteMany.mockResolvedValue({ count: 2 });

      const result = await authService.changePassword(userId, currentPassword, newPassword);

      expect(mockPrisma.users.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: { id: true, password_hash: true, is_active: true },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(currentPassword, testUtils.testUser.password_hash);
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          password_hash: 'new-hashed-password',
          updated_at: expect.any(Date),
        },
      });
      expect(mockPrisma.refresh_tokens.deleteMany).toHaveBeenCalledWith({
        where: { user_id: userId },
      });
      expect(result).toEqual({
        message: 'Password changed successfully. Please log in again.',
      });
    });

    it('should throw error for user not found', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);

      await expect(authService.changePassword(userId, currentPassword, newPassword))
        .rejects.toThrow('User not found');
    });

    it('should throw error for incorrect current password', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(testUtils.testUser);
      bcrypt.compare.mockResolvedValue(false);

      await expect(authService.changePassword(userId, 'wrongPassword', newPassword))
        .rejects.toThrow('Current password is incorrect');
    });

    it('should throw error for inactive user', async () => {
      const inactiveUser = { ...testUtils.testUser, is_active: false };
      mockPrisma.users.findUnique.mockResolvedValue(inactiveUser);

      await expect(authService.changePassword(userId, currentPassword, newPassword))
        .rejects.toThrow('Account is deactivated');
    });
  });

  describe('requestPasswordReset', () => {
    const email = 'test@example.com';

    beforeEach(() => {
      crypto.randomBytes.mockReturnValue(Buffer.from('random-bytes'));
      crypto.timingSafeEqual = jest.fn().mockReturnValue(true);
    });

    it('should create password reset token for existing user', async () => {
      mockPrisma.users.findFirst.mockResolvedValue(testUtils.testUser);
      mockPrisma.users.update.mockResolvedValue(testUtils.testUser);

      const result = await authService.requestPasswordReset(email);

      expect(mockPrisma.users.findFirst).toHaveBeenCalledWith({
        where: { email: email.toLowerCase() },
      });
      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { id: testUtils.testUser.id },
        data: {
          reset_token: expect.any(String),
          reset_token_expires: expect.any(Date),
        },
      });
      expect(result).toEqual({
        message: 'Password reset token generated',
        resetToken: expect.any(String),
      });
    });

    it('should throw error for non-existent user', async () => {
      mockPrisma.users.findFirst.mockResolvedValue(null);

      await expect(authService.requestPasswordReset(email))
        .rejects.toThrow('User not found');
    });

    it('should throw error for inactive user', async () => {
      const inactiveUser = { ...testUtils.testUser, is_active: false };
      mockPrisma.users.findFirst.mockResolvedValue(inactiveUser);

      await expect(authService.requestPasswordReset(email))
        .rejects.toThrow('Account is deactivated');
    });
  });

  describe('resetPassword', () => {
    const resetToken = 'valid-reset-token';
    const newPassword = 'newPassword123';

    beforeEach(() => {
      bcrypt.hash.mockResolvedValue('new-hashed-password');
      crypto.timingSafeEqual.mockReturnValue(true);
    });

    it('should reset password successfully', async () => {
      const userWithToken = {
        ...testUtils.testUser,
        reset_token: resetToken,
        reset_token_expires: new Date(Date.now() + 3600000), // 1 hour from now
      };

      mockPrisma.users.findFirst.mockResolvedValue(userWithToken);
      mockPrisma.users.update.mockResolvedValue(userWithToken);
      mockPrisma.refresh_tokens.deleteMany.mockResolvedValue({ count: 1 });

      const result = await authService.resetPassword(resetToken, newPassword);

      expect(mockPrisma.users.findFirst).toHaveBeenCalledWith({
        where: {
          reset_token: expect.any(String),
          reset_token_expires: { gt: expect.any(Date) },
          is_active: true,
        },
      });
      expect(mockPrisma.users.update).toHaveBeenCalledWith({
        where: { id: testUtils.testUser.id },
        data: {
          password_hash: 'new-hashed-password',
          reset_token: null,
          reset_token_expires: null,
          updated_at: expect.any(Date),
        },
      });
      expect(result).toEqual({
        message: 'Password reset successfully. Please log in with your new password.',
        userId: testUtils.testUser.id,
      });
    });

    it('should throw error for invalid or expired token', async () => {
      mockPrisma.users.findFirst.mockResolvedValue(null);

      await expect(authService.resetPassword('invalid-token', newPassword))
        .rejects.toThrow('Invalid or expired reset token');
    });
  });

  describe('getUserProfile', () => {
    it('should get user profile successfully', async () => {
      const userProfile = {
        ...testUtils.testUser,
        agent_status: { status: 'online' },
      };
      delete userProfile.password_hash;

      mockPrisma.users.findUnique.mockResolvedValue(userProfile);

      const result = await authService.getUserProfile(testUtils.testUser.id);

      expect(mockPrisma.users.findUnique).toHaveBeenCalledWith({
        where: { id: testUtils.testUser.id },
        select: expect.objectContaining({
          password_hash: false,
        }),
        include: expect.objectContaining({
          agent_status: expect.any(Object),
        }),
      });
      expect(result).toEqual(userProfile);
    });

    it('should throw error for user not found', async () => {
      mockPrisma.users.findUnique.mockResolvedValue(null);

      await expect(authService.getUserProfile('invalid-id'))
        .rejects.toThrow('User not found');
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should cleanup expired tokens', async () => {
      mockPrisma.refresh_tokens.deleteMany.mockResolvedValue({ count: 5 });

      const result = await authService.cleanupExpiredTokens();

      expect(mockPrisma.refresh_tokens.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expires_at: { lt: expect.any(Date) } },
            { is_revoked: true },
          ],
        },
      });
      expect(result).toBe(5);
    });
  });

  describe('emergency admin operations', () => {
    beforeEach(() => {
      process.env.ADMIN_RECOVERY_KEY = 'test-recovery-key';
      bcrypt.hash.mockResolvedValue('new-hashed-password');
    });

    describe('emergencyAdminRecovery', () => {
      it('should recover admin password with valid recovery key', async () => {
        const adminUser = { ...testUtils.testAdmin };
        mockPrisma.users.findFirst.mockResolvedValue(adminUser);
        mockPrisma.users.update.mockResolvedValue(adminUser);
        mockPrisma.refresh_tokens.deleteMany.mockResolvedValue({ count: 2 });

        const result = await authService.emergencyAdminRecovery(
          'test-recovery-key',
          'admin@example.com',
          'newPassword123'
        );

        expect(mockPrisma.users.findFirst).toHaveBeenCalledWith({
          where: { email: 'admin@example.com', role: 'admin' },
        });
        expect(result).toEqual({
          success: true,
          message: 'Admin password reset successfully via emergency recovery',
          adminId: adminUser.id,
          adminEmail: adminUser.email,
        });
      });

      it('should throw error for invalid recovery key', async () => {
        await expect(authService.emergencyAdminRecovery(
          'invalid-key',
          'admin@example.com',
          'newPassword123'
        )).rejects.toThrow('Invalid recovery key');
      });

      it('should throw error for non-existent admin', async () => {
        mockPrisma.users.findFirst.mockResolvedValue(null);

        await expect(authService.emergencyAdminRecovery(
          'test-recovery-key',
          'nonexistent@example.com',
          'newPassword123'
        )).rejects.toThrow('Admin user not found');
      });
    });

    describe('createEmergencyAdmin', () => {
      it('should create emergency admin when no admin exists', async () => {
        const adminData = {
          email: 'admin@example.com',
          password: 'AdminPassword123!',
          firstName: 'Admin',
          lastName: 'User',
        };
        const createdAdmin = { ...testUtils.testAdmin };

        mockPrisma.users.count.mockResolvedValue(0); // No existing admins
        mockPrisma.users.create.mockResolvedValue(createdAdmin);

        const result = await authService.createEmergencyAdmin('test-recovery-key', adminData);

        expect(mockPrisma.users.count).toHaveBeenCalledWith({
          where: { role: 'admin' },
        });
        expect(result).toEqual({
          success: true,
          message: 'Emergency admin created successfully',
          admin: expect.not.objectContaining({ password_hash: expect.anything() }),
        });
      });

      it('should throw error when admin already exists', async () => {
        mockPrisma.users.count.mockResolvedValue(1); // Admin exists

        await expect(authService.createEmergencyAdmin(
          'test-recovery-key',
          { email: 'admin@example.com' }
        )).rejects.toThrow('Admin user already exists');
      });
    });
  });
});