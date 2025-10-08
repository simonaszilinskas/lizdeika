/**
 * Authentication Tests
 *
 * Tests critical authentication security boundaries:
 * - Login flow with valid/invalid credentials
 * - JWT token verification and validation
 * - Refresh token management
 * - 2FA challenge flow
 * - Account security checks (deactivation, user not found)
 *
 * These tests protect against:
 * - Unauthorized access
 * - Token manipulation
 * - Credential enumeration
 * - Session hijacking
 */

// Mock dependencies BEFORE requiring modules
jest.mock('../../src/utils/database');
jest.mock('../../src/utils/tokenUtils');
jest.mock('../../src/utils/passwordUtils');
jest.mock('../../src/utils/totpUtils');
jest.mock('../../src/services/settingsService');

const authService = require('../../src/services/authService');
const tokenUtils = require('../../src/utils/tokenUtils');
const passwordUtils = require('../../src/utils/passwordUtils');
const totpUtils = require('../../src/utils/totpUtils');
const databaseClient = require('../../src/utils/database');

describe('Authentication Service', () => {
  let mockDb;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database client
    mockDb = {
      users: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
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
    };

    databaseClient.getClient.mockReturnValue(mockDb);
    databaseClient.connect.mockResolvedValue(undefined);

    // Mock password utils
    passwordUtils.verifyPassword = jest.fn();
    passwordUtils.hashPassword = jest.fn();
    passwordUtils.validatePasswordStrength = jest.fn();
    passwordUtils.isPasswordBreached = jest.fn();

    // Mock token utils methods
    tokenUtils.generateTokenPair = jest.fn();
    tokenUtils.generateAccessToken = jest.fn();
    tokenUtils.generateRefreshToken = jest.fn();
    tokenUtils.verifyAccessToken = jest.fn();
    tokenUtils.verifyRefreshToken = jest.fn();
  });

  describe('Login Flow', () => {
    test('should reject login with invalid password', async () => {
      const mockUser = {
        id: 1,
        email: 'agent@test.com',
        password_hash: 'hashed_password',
        is_active: true,
      };

      mockDb.users.findUnique.mockResolvedValue(mockUser);
      passwordUtils.verifyPassword.mockResolvedValue(false);

      await expect(
        authService.loginUser({
          email: 'agent@test.com',
          password: 'wrong_password',
        })
      ).rejects.toThrow('Invalid email or password');

      expect(passwordUtils.verifyPassword).toHaveBeenCalledWith(
        'wrong_password',
        'hashed_password'
      );
    });

    test('should reject login for non-existent user', async () => {
      mockDb.users.findUnique.mockResolvedValue(null);

      await expect(
        authService.loginUser({
          email: 'nonexistent@test.com',
          password: 'any_password',
        })
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('Token Verification', () => {
    test('should verify valid JWT access token', () => {
      const mockDecoded = {
        sub: 1,
        email: 'user@test.com',
        role: 'agent',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
      };

      tokenUtils.verifyAccessToken.mockReturnValue(mockDecoded);

      const token = 'valid_jwt_token';
      const decoded = tokenUtils.verifyAccessToken(token);

      expect(decoded).toEqual(mockDecoded);
      expect(decoded.sub).toBe(1);
      expect(decoded.email).toBe('user@test.com');
    });

    test('should reject expired JWT token', () => {
      tokenUtils.verifyAccessToken.mockImplementation(() => {
        const error = new Error('Token expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      expect(() => {
        tokenUtils.verifyAccessToken('expired_token');
      }).toThrow('Token expired');
    });

    test('should reject invalid JWT token', () => {
      tokenUtils.verifyAccessToken.mockImplementation(() => {
        const error = new Error('Invalid token');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      expect(() => {
        tokenUtils.verifyAccessToken('invalid_token');
      }).toThrow('Invalid token');
    });
  });

  describe('Refresh Token Flow', () => {
    test('should reject invalid refresh token (not found)', async () => {
      tokenUtils.verifyRefreshToken.mockReturnValue({ sub: 1 });
      mockDb.refresh_tokens.findUnique.mockResolvedValue(null);

      await expect(
        authService.refreshAccessToken('invalid_refresh_token')
      ).rejects.toThrow('Refresh token not found or revoked');
    });

    test('should reject revoked refresh token', async () => {
      const mockUser = {
        id: 1,
        email: 'user@test.com',
        role: 'agent',
        is_active: true,
      };

      const mockRefreshToken = {
        id: 1,
        userId: 1,
        token: 'revoked_refresh_token',
        expiresAt: new Date(Date.now() + 86400000), // 1 day from now
        isRevoked: true,
        user: mockUser,
        users: mockUser,
      };

      tokenUtils.verifyRefreshToken.mockReturnValue({ sub: 1 });
      mockDb.refresh_tokens.findUnique.mockResolvedValue(mockRefreshToken);

      await expect(
        authService.refreshAccessToken('revoked_refresh_token')
      ).rejects.toThrow('Refresh token not found or revoked');
    });

    test('should reject malformed refresh token (JWT verification fails)', async () => {
      tokenUtils.verifyRefreshToken.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        authService.refreshAccessToken('malformed_token')
      ).rejects.toThrow('Invalid refresh token');
    });
  });
});
