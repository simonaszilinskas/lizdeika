/**
 * AuthController Unit Tests
 * Tests for authentication endpoints with activity logging integration
 */

const authController = require('../../src/controllers/authController');
const authService = require('../../src/services/authService');
const activityService = require('../../src/services/activityService');

// Mock dependencies
jest.mock('../../src/services/authService');
jest.mock('../../src/services/activityService');

describe('AuthController', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = testUtils.mockRequest();
    mockRes = testUtils.mockResponse();
    mockNext = jest.fn();

    // Mock ActivityService getRequestMetadata
    activityService.constructor.getRequestMetadata = jest.fn().mockReturnValue({
      ipAddress: '192.168.1.1',
      userAgent: 'Jest Test Agent',
    });

    // Mock activity logging methods
    activityService.logAuth = jest.fn().mockResolvedValue({});
    activityService.logSecurity = jest.fn().mockResolvedValue({});
  });

  describe('register', () => {
    it('should register user successfully and log activity', async () => {
      const mockUser = { ...testUtils.testUser };
      const mockTokens = {
        accessToken: testUtils.mockJwtToken,
        refreshToken: 'refresh-token',
      };
      
      mockReq.body = {
        email: 'new@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
      };

      authService.registerUser.mockResolvedValue({
        user: mockUser,
        tokens: mockTokens,
        emailVerificationRequired: false,
      });

      await authController.register(mockReq, mockRes);

      expect(authService.registerUser).toHaveBeenCalledWith(mockReq.body);
      expect(activityService.logAuth).toHaveBeenCalledWith(
        mockUser.id,
        'registration_success',
        true,
        '192.168.1.1',
        'Jest Test Agent',
        { role: mockUser.role, email: mockUser.email }
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully',
        data: {
          user: mockUser,
          tokens: mockTokens,
          emailVerificationRequired: false,
        },
      });
    });

    it('should handle registration failure and log activity', async () => {
      const error = new Error('Email already exists');
      mockReq.body = {
        email: 'existing@example.com',
        password: 'Password123!',
      };

      authService.registerUser.mockRejectedValue(error);

      await authController.register(mockReq, mockRes);

      expect(activityService.logAuth).toHaveBeenCalledWith(
        null,
        'registration_failed',
        false,
        '192.168.1.1',
        'Jest Test Agent',
        { email: 'existing@example.com', error: 'Email already exists' }
      );
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Email already exists',
        code: 'REGISTRATION_FAILED',
      });
    });
  });

  describe('login', () => {
    it('should login successfully and log activity', async () => {
      const mockUser = { ...testUtils.testUser };
      const mockTokens = {
        accessToken: testUtils.mockJwtToken,
        refreshToken: 'refresh-token',
      };
      
      mockReq.body = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      authService.loginUser.mockResolvedValue({
        user: mockUser,
        tokens: mockTokens,
      });

      await authController.login(mockReq, mockRes);

      expect(authService.loginUser).toHaveBeenCalledWith(mockReq.body);
      expect(activityService.logAuth).toHaveBeenCalledWith(
        mockUser.id,
        'login_success',
        true,
        '192.168.1.1',
        'Jest Test Agent',
        { role: mockUser.role }
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Login successful',
        data: {
          user: mockUser,
          tokens: mockTokens,
        },
      });
    });

    it('should handle login failure and log activity', async () => {
      const error = new Error('Invalid email or password');
      mockReq.body = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      authService.loginUser.mockRejectedValue(error);

      await authController.login(mockReq, mockRes);

      expect(activityService.logAuth).toHaveBeenCalledWith(
        null,
        'login_failed',
        false,
        '192.168.1.1',
        'Jest Test Agent',
        { email: 'test@example.com', error: 'Invalid email or password' }
      );
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid email or password',
        code: 'LOGIN_FAILED',
      });
    });
  });

  describe('logout', () => {
    it('should logout successfully and log activity', async () => {
      mockReq.body = { refreshToken: 'refresh-token' };
      mockReq.user = testUtils.testUser;

      authService.logoutUser.mockResolvedValue();

      await authController.logout(mockReq, mockRes);

      expect(authService.logoutUser).toHaveBeenCalledWith('refresh-token');
      expect(activityService.logAuth).toHaveBeenCalledWith(
        testUtils.testUser.id,
        'logout_success',
        true,
        '192.168.1.1',
        'Jest Test Agent'
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logout successful',
      });
    });

    it('should handle logout failure gracefully and log activity', async () => {
      const error = new Error('Token not found');
      mockReq.body = { refreshToken: 'invalid-token' };
      mockReq.user = testUtils.testUser;

      authService.logoutUser.mockRejectedValue(error);

      await authController.logout(mockReq, mockRes);

      expect(activityService.logAuth).toHaveBeenCalledWith(
        testUtils.testUser.id,
        'logout_completed',
        true,
        '192.168.1.1',
        'Jest Test Agent',
        { note: 'Logout completed despite technical error' }
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logout completed',
      });
    });

    it('should handle logout without authenticated user', async () => {
      mockReq.body = { refreshToken: 'refresh-token' };
      mockReq.user = null;

      authService.logoutUser.mockResolvedValue();

      await authController.logout(mockReq, mockRes);

      expect(activityService.logAuth).toHaveBeenCalledWith(
        null,
        'logout_success',
        true,
        '192.168.1.1',
        'Jest Test Agent'
      );
    });
  });

  describe('changePassword', () => {
    it('should change password successfully and log activity', async () => {
      mockReq.body = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
      };
      mockReq.user = testUtils.testUser;

      authService.changePassword.mockResolvedValue({
        message: 'Password changed successfully',
      });

      await authController.changePassword(mockReq, mockRes);

      expect(authService.changePassword).toHaveBeenCalledWith(
        testUtils.testUser.id,
        'oldpassword',
        'newpassword123'
      );
      expect(activityService.logSecurity).toHaveBeenCalledWith(
        testUtils.testUser.id,
        'password_changed',
        true,
        '192.168.1.1',
        'Jest Test Agent'
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully',
      });
    });

    it('should handle password change failure and log activity', async () => {
      const error = new Error('Current password is incorrect');
      mockReq.body = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123',
      };
      mockReq.user = testUtils.testUser;

      authService.changePassword.mockRejectedValue(error);

      await authController.changePassword(mockReq, mockRes);

      expect(activityService.logSecurity).toHaveBeenCalledWith(
        testUtils.testUser.id,
        'password_change_failed',
        false,
        '192.168.1.1',
        'Jest Test Agent',
        { error: 'Current password is incorrect' }
      );
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Current password is incorrect',
        code: 'PASSWORD_CHANGE_FAILED',
      });
    });
  });

  describe('forgotPassword', () => {
    it('should request password reset and log activity', async () => {
      mockReq.body = { email: 'test@example.com' };

      authService.requestPasswordReset.mockResolvedValue({
        message: 'Password reset link sent',
        resetToken: 'reset-token',
      });

      process.env.NODE_ENV = 'development';

      await authController.forgotPassword(mockReq, mockRes);

      expect(authService.requestPasswordReset).toHaveBeenCalledWith('test@example.com');
      expect(activityService.logSecurity).toHaveBeenCalledWith(
        null,
        'password_reset_requested',
        true,
        '192.168.1.1',
        'Jest Test Agent',
        { email: 'test@example.com' }
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset link sent',
        resetToken: 'reset-token',
      });
    });

    it('should handle password reset request failure and log activity', async () => {
      const error = new Error('User not found');
      mockReq.body = { email: 'nonexistent@example.com' };

      authService.requestPasswordReset.mockRejectedValue(error);

      await authController.forgotPassword(mockReq, mockRes);

      expect(activityService.logSecurity).toHaveBeenCalledWith(
        null,
        'password_reset_request_failed',
        false,
        '192.168.1.1',
        'Jest Test Agent',
        { email: 'nonexistent@example.com', error: 'User not found' }
      );
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
        code: 'PASSWORD_RESET_REQUEST_FAILED',
      });
    });

    it('should not expose reset token in production', async () => {
      mockReq.body = { email: 'test@example.com' };

      authService.requestPasswordReset.mockResolvedValue({
        message: 'Password reset link sent',
        resetToken: 'reset-token',
      });

      process.env.NODE_ENV = 'production';

      await authController.forgotPassword(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully and log activity', async () => {
      mockReq.body = {
        token: 'reset-token',
        newPassword: 'newpassword123',
      };

      authService.resetPassword.mockResolvedValue({
        message: 'Password reset successfully',
        userId: testUtils.testUser.id,
      });

      await authController.resetPassword(mockReq, mockRes);

      expect(authService.resetPassword).toHaveBeenCalledWith('reset-token', 'newpassword123');
      expect(activityService.logSecurity).toHaveBeenCalledWith(
        testUtils.testUser.id,
        'password_reset_completed',
        true,
        '192.168.1.1',
        'Jest Test Agent'
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset successfully',
      });
    });

    it('should handle password reset failure and log activity', async () => {
      const error = new Error('Invalid or expired token');
      mockReq.body = {
        token: 'invalid-token',
        newPassword: 'newpassword123',
      };

      authService.resetPassword.mockRejectedValue(error);

      await authController.resetPassword(mockReq, mockRes);

      expect(activityService.logSecurity).toHaveBeenCalledWith(
        null,
        'password_reset_failed',
        false,
        '192.168.1.1',
        'Jest Test Agent',
        { error: 'Invalid or expired token' }
      );
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired token',
        code: 'PASSWORD_RESET_FAILED',
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockTokens = {
        accessToken: testUtils.mockJwtToken,
        refreshToken: 'new-refresh-token',
      };
      mockReq.body = { refreshToken: 'old-refresh-token' };

      authService.refreshAccessToken.mockResolvedValue(mockTokens);

      await authController.refreshToken(mockReq, mockRes);

      expect(authService.refreshAccessToken).toHaveBeenCalledWith('old-refresh-token');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Token refreshed successfully',
        data: mockTokens,
      });
    });

    it('should handle token refresh failure', async () => {
      const error = new Error('Invalid refresh token');
      mockReq.body = { refreshToken: 'invalid-token' };

      authService.refreshAccessToken.mockRejectedValue(error);

      await authController.refreshToken(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid refresh token',
        code: 'TOKEN_REFRESH_FAILED',
      });
    });
  });

  describe('getProfile', () => {
    it('should get user profile successfully', async () => {
      mockReq.user = testUtils.testUser;

      authService.getUserProfile.mockResolvedValue(testUtils.testUser);

      await authController.getProfile(mockReq, mockRes);

      expect(authService.getUserProfile).toHaveBeenCalledWith(testUtils.testUser.id);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: testUtils.testUser,
      });
    });

    it('should handle profile not found', async () => {
      const error = new Error('User not found');
      mockReq.user = testUtils.testUser;

      authService.getUserProfile.mockRejectedValue(error);

      await authController.getProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
        code: 'PROFILE_NOT_FOUND',
      });
    });
  });

  describe('verifyToken', () => {
    it('should verify token successfully', async () => {
      mockReq.user = testUtils.testUser;

      await authController.verifyToken(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Token is valid',
        data: {
          user: {
            id: testUtils.testUser.id,
            email: testUtils.testUser.email,
            role: testUtils.testUser.role,
            emailVerified: testUtils.testUser.email_verified,
          },
        },
      });
    });
  });

  describe('getAuthStatus', () => {
    it('should return authentication status for authenticated user', async () => {
      mockReq.user = testUtils.testUser;

      await authController.getAuthStatus(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          isAuthenticated: true,
          user: expect.objectContaining({
            id: testUtils.testUser.id,
            email: testUtils.testUser.email,
            role: testUtils.testUser.role,
          }),
        },
      });
    });

    it('should return authentication status for unauthenticated user', async () => {
      mockReq.user = null;

      await authController.getAuthStatus(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          isAuthenticated: false,
          user: null,
        },
      });
    });
  });

  describe('emergency endpoints', () => {
    it('should handle emergency admin recovery', async () => {
      mockReq.body = {
        recoveryKey: 'emergency-key',
        adminEmail: 'admin@example.com',
        newPassword: 'newpassword123',
      };

      authService.emergencyAdminRecovery.mockResolvedValue({
        message: 'Admin password reset successfully',
        adminId: testUtils.testAdmin.id,
        adminEmail: 'admin@example.com',
      });

      await authController.emergencyAdminRecovery(mockReq, mockRes);

      expect(authService.emergencyAdminRecovery).toHaveBeenCalledWith(
        'emergency-key',
        'admin@example.com',
        'newpassword123'
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Admin password reset successfully',
        data: {
          adminId: testUtils.testAdmin.id,
          adminEmail: 'admin@example.com',
        },
      });
    });

    it('should handle emergency admin creation', async () => {
      mockReq.body = {
        recoveryKey: 'emergency-key',
        email: 'admin@example.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
      };

      authService.createEmergencyAdmin.mockResolvedValue({
        message: 'Emergency admin created successfully',
        admin: testUtils.testAdmin,
      });

      await authController.emergencyCreateAdmin(mockReq, mockRes);

      expect(authService.createEmergencyAdmin).toHaveBeenCalledWith(
        'emergency-key',
        {
          email: 'admin@example.com',
          password: 'password123',
          firstName: 'Admin',
          lastName: 'User',
        }
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Emergency admin created successfully',
        data: testUtils.testAdmin,
      });
    });
  });
});