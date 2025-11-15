/**
 * PASSWORD EXPIRY SERVICE
 *
 * Handles password renewal enforcement with 180-day expiration policy.
 *
 * Key Features:
 * - Calculates password expiry dates (180 days from last change)
 * - Progressive warning system (30, 14, 7, 3, 1 day thresholds)
 * - Access blocking when password expires
 * - Admin-only password reset for blocked accounts
 *
 * Warning Levels:
 * - CRITICAL: 1-3 days remaining (red alert)
 * - WARNING: 4-7 days remaining (orange warning)
 * - INFO: 8-14 days remaining (yellow notice)
 * - NOTICE: 15-30 days remaining (blue reminder)
 * - NONE: 30+ days remaining (no warning)
 *
 * Access Rules:
 * - Agents and admins must renew password every 180 days
 * - Regular users are not affected by this policy
 * - Blocked users cannot access the system (login rejected)
 * - Only administrators can unlock blocked accounts
 */

const databaseClient = require('../utils/database');

const PASSWORD_EXPIRY_DAYS = 180;

class PasswordExpiryService {
    /**
     * Calculate password expiry date (UTC-aware)
     */
    calculateExpiryDate(passwordChangedAt) {
        if (!passwordChangedAt) return null;

        const date = new Date(passwordChangedAt);
        // Calculate expiry date in UTC to avoid timezone issues
        const expiryDate = new Date(Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate() + PASSWORD_EXPIRY_DAYS,
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds(),
            date.getUTCMilliseconds()
        ));
        return expiryDate;
    }

    /**
     * Calculate days remaining until password expires (UTC-aware)
     */
    getDaysRemaining(passwordExpiresAt) {
        if (!passwordExpiresAt) return null;

        const now = new Date();
        const expiryDate = new Date(passwordExpiresAt);

        // Calculate difference using UTC to avoid timezone issues
        const nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const expiryUTC = Date.UTC(expiryDate.getUTCFullYear(), expiryDate.getUTCMonth(), expiryDate.getUTCDate());

        const diffTime = expiryUTC - nowUTC;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    }

    /**
     * Check if password requires renewal (agents and admins only)
     */
    requiresRenewal(user) {
        // Only enforce for agents and admins
        if (user.role === 'user') return false;

        // If no password change date, require renewal
        if (!user.password_changed_at) return true;

        const daysRemaining = this.getDaysRemaining(user.password_expires_at);
        return daysRemaining !== null && daysRemaining <= 0;
    }

    /**
     * Get warning level based on days remaining
     * Returns: 'critical' | 'warning' | 'info' | 'notice' | 'none'
     */
    getWarningLevel(daysRemaining) {
        if (daysRemaining === null || daysRemaining < 0) return 'critical';
        if (daysRemaining <= 3) return 'critical';
        if (daysRemaining <= 7) return 'warning';
        if (daysRemaining <= 14) return 'info';
        if (daysRemaining <= 30) return 'notice';
        return 'none';
    }

    /**
     * Get warning message based on days remaining
     */
    getWarningMessage(daysRemaining) {
        if (daysRemaining === null || daysRemaining < 0) {
            return 'Your password has expired. Contact an administrator to reset it.';
        }
        if (daysRemaining === 0) {
            return 'Your password expires today. Change it now to avoid being locked out.';
        }
        if (daysRemaining === 1) {
            return 'Your password expires tomorrow. Change it now to avoid being locked out.';
        }
        if (daysRemaining <= 3) {
            return `Your password expires in ${daysRemaining} days. Change it now to avoid being locked out.';
        }
        if (daysRemaining <= 7) {
            return `Your password expires in ${daysRemaining} days. Please change it soon.`;
        }
        if (daysRemaining <= 14) {
            return `Your password expires in ${daysRemaining} days.`;
        }
        if (daysRemaining <= 30) {
            return `Your password expires in ${daysRemaining} days.`;
        }
        return null;
    }

    /**
     * Check if user should see a warning (agents and admins only)
     */
    shouldShowWarning(user) {
        // Only show warnings for agents and admins
        if (user.role === 'user') return false;

        const daysRemaining = this.getDaysRemaining(user.password_expires_at);
        if (daysRemaining === null) return false;

        return daysRemaining <= 30;
    }

    /**
     * Get password status for a user
     */
    getPasswordStatus(user) {
        // Regular users don't have password expiry
        if (user.role === 'user') {
            return {
                requiresRenewal: false,
                isBlocked: false,
                daysRemaining: null,
                warningLevel: 'none',
                warningMessage: null,
                expiresAt: null
            };
        }

        const daysRemaining = this.getDaysRemaining(user.password_expires_at);
        const requiresRenewal = this.requiresRenewal(user);
        const warningLevel = this.getWarningLevel(daysRemaining);
        const warningMessage = this.getWarningMessage(daysRemaining);

        return {
            requiresRenewal,
            isBlocked: user.password_blocked || false,
            daysRemaining,
            warningLevel,
            warningMessage,
            expiresAt: user.password_expires_at
        };
    }

    /**
     * Update password change timestamp and calculate new expiry
     */
    async updatePasswordTimestamp(userId) {
        const prisma = databaseClient.getClient();

        const now = new Date();
        const expiryDate = this.calculateExpiryDate(now);

        await prisma.users.update({
            where: { id: userId },
            data: {
                password_changed_at: now,
                password_expires_at: expiryDate,
                password_blocked: false, // Unblock if was blocked
                updated_at: now
            }
        });

        return { passwordChangedAt: now, passwordExpiresAt: expiryDate };
    }

    /**
     * Block user due to expired password
     */
    async blockUser(userId) {
        const prisma = databaseClient.getClient();

        await prisma.users.update({
            where: { id: userId },
            data: {
                password_blocked: true,
                updated_at: new Date()
            }
        });
    }

    /**
     * Unblock user (admin action when resetting password)
     */
    async unblockUser(userId) {
        const prisma = databaseClient.getClient();

        await prisma.users.update({
            where: { id: userId },
            data: {
                password_blocked: false,
                updated_at: new Date()
            }
        });
    }
}

module.exports = new PasswordExpiryService();
