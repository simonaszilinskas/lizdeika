/**
 * PASSWORD EXPIRY MIDDLEWARE
 *
 * Enforces 180-day password renewal policy for agents and admins.
 *
 * Behavior:
 * - Checks if user's password has expired
 * - Blocks access to all endpoints except:
 *   - /api/auth/change-password (to allow password changes)
 *   - /api/auth/profile (to get user info)
 *   - /api/auth/password-status (to check password status)
 * - Returns 403 Forbidden with clear instructions if password expired
 * - Adds password status to request object for use in controllers
 *
 * Applies to: Agents and admins only (users are exempt)
 */

const passwordExpiryService = require('../services/passwordExpiryService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('PasswordExpiryMiddleware');

/**
 * Middleware to check password expiry
 */
const checkPasswordExpiry = async (req, res, next) => {
    try {
        // Skip if no authenticated user
        if (!req.user) {
            return next();
        }

        const user = req.user;

        // Get password status
        const passwordStatus = passwordExpiryService.getPasswordStatus(user);

        // Attach to request for use in controllers
        req.passwordStatus = passwordStatus;

        // Regular users are exempt from password expiry
        if (user.role === 'user') {
            return next();
        }

        // Allow access to password change endpoint even if expired
        const allowedPaths = [
            '/api/auth/change-password',
            '/api/auth/profile',
            '/api/auth/password-status',
            '/api/auth/logout'
        ];

        const isAllowedPath = allowedPaths.some(path => req.path === path);

        // Check if password is blocked or expired
        if (passwordStatus.isBlocked || passwordStatus.requiresRenewal) {
            if (!isAllowedPath) {
                logger.warn(`Access blocked for user ${user.id} due to expired password`);

                return res.status(403).json({
                    success: false,
                    error: 'Your password has expired. Please change your password to continue.',
                    code: 'PASSWORD_EXPIRED',
                    passwordStatus: {
                        expired: true,
                        daysRemaining: passwordStatus.daysRemaining,
                        message: passwordStatus.warningMessage
                    }
                });
            }
        }

        next();
    } catch (error) {
        logger.error('Password expiry check error:', error);
        // Don't block access on middleware errors
        next();
    }
};

module.exports = {
    checkPasswordExpiry
};
