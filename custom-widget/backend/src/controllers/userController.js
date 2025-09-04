/**
 * USER MANAGEMENT CONTROLLER
 * 
 * Main Purpose: Handle user management operations for administrators
 * 
 * Key Responsibilities:
 * - User Account Management: CRUD operations for user accounts
 * - Profile Updates: Change names, emails, and other user details
 * - Password Management: Generate new passwords for users (admins cannot see current passwords)
 * - Admin Self-Management: Allow admins to update their own accounts
 * - Access Control: Ensure only admins can perform user management operations
 * 
 * Security Features:
 * - Password regeneration without exposing current passwords
 * - Admin-only access control via middleware
 * - Secure password hashing for generated passwords
 * - Input validation and sanitization
 * 
 * Endpoints:
 * - GET /users - List all users (admin only)
 * - GET /users/:id - Get specific user details (admin only)
 * - PUT /users/:id - Update user profile (admin only)
 * - POST /users/:id/regenerate-password - Generate new password (admin only)
 * - DELETE /users/:id - Deactivate user account (admin only)
 * 
 * Dependencies:
 * - Auth service for user management operations
 * - Password utilities for secure password generation
 * - Database access via Prisma client
 */

const { PrismaClient } = require('@prisma/client');
const { hashPassword, generateSecurePassword } = require('../utils/passwordUtils');
const { asyncHandler } = require('../utils/errors');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

class UserController {
    /**
     * Get all users (admin only)
     */
    getAllUsers = asyncHandler(async (req, res) => {
        const users = await prisma.users.findMany({
            select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
                role: true,
                is_active: true,
                email_verified: true,
                last_login: true,
                created_at: true,
                updated_at: true,
                user_number: true
            },
            orderBy: [
                { role: 'asc' }, // admins first, then agents, then users
                { created_at: 'desc' }
            ]
        });

        // Convert snake_case fields to camelCase for frontend compatibility
        const formattedUsers = users.map(user => ({
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            isActive: user.is_active,
            emailVerified: user.email_verified,
            lastLogin: user.last_login,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
            userNumber: user.user_number
        }));

        res.json({
            success: true,
            data: formattedUsers
        });
    });

    /**
     * Create a new user (admin only)
     */
    createUser = asyncHandler(async (req, res) => {
        const { email, firstName, lastName, role = 'user' } = req.body;

        // Validate required fields
        if (!email || !firstName || !lastName) {
            return res.status(400).json({
                success: false,
                error: 'Email, first name, and last name are required'
            });
        }

        // Validate role
        const validRoles = ['user', 'agent', 'admin'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid role. Must be user, agent, or admin'
            });
        }

        // Check if user already exists
        const existingUser = await prisma.users.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'User with this email already exists'
            });
        }

        // Generate a random password
        const password = generateSecurePassword();
        const passwordHash = await bcrypt.hash(password, 12);

        // Create the user
        const user = await prisma.users.create({
            data: {
                id: uuidv4(),
                email: email.toLowerCase(),
                first_name: firstName,
                last_name: lastName,
                role,
                password_hash: passwordHash,
                is_active: true,
                email_verified: false,
                created_at: new Date(),
                updated_at: new Date()
            },
            select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
                role: true,
                is_active: true,
                created_at: true
            }
        });

        // Create agent status if user is an agent
        if (role === 'agent') {
            await prisma.agent_status.create({
                data: {
                    id: uuidv4(),
                    user_id: user.id,
                    status: 'offline',
                    updated_at: new Date()
                }
            });
        }

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                user,
                password // Return the generated password (one-time only)
            }
        });
    });

    /**
     * Get specific user by ID (admin only)
     */
    getUserById = asyncHandler(async (req, res) => {
        const { id } = req.params;

        const user = await prisma.users.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
                role: true,
                is_active: true,
                email_verified: true,
                last_login: true,
                created_at: true,
                updated_at: true,
                user_number: true,
                agent_status: {
                    select: {
                        status: true,
                        updated_at: true
                    }
                },
                _count: {
                    select: {
                        messages: true,
                        tickets_tickets_assigned_agent_idTousers: true,
                        tickets_tickets_user_idTousers: true
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Convert snake_case fields to camelCase for frontend compatibility
        const formattedUser = {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            isActive: user.is_active,
            emailVerified: user.email_verified,
            lastLogin: user.last_login,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
            userNumber: user.user_number,
            agentStatus: user.agent_status ? {
                status: user.agent_status.status,
                updatedAt: user.agent_status.updated_at
            } : null,
            messageCount: user._count.messages,
            assignedTicketsCount: user._count.tickets_tickets_assigned_agent_idTousers,
            userTicketsCount: user._count.tickets_tickets_user_idTousers
        };

        res.json({
            success: true,
            data: formattedUser
        });
    });

    /**
     * Update user profile (admin only)
     */
    updateUser = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { email, firstName, lastName, role, isActive } = req.body;

        // Check if user exists
        const existingUser = await prisma.users.findUnique({
            where: { id }
        });

        if (!existingUser) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Check if email is already taken by another user
        if (email && email !== existingUser.email) {
            const emailExists = await prisma.users.findFirst({
                where: {
                    email: email.toLowerCase(),
                    id: { not: id }
                }
            });

            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    error: 'Email address is already in use'
                });
            }
        }

        // Prepare update data
        const updateData = {
            updated_at: new Date()
        };

        if (email !== undefined) {
            updateData.email = email.toLowerCase();
        }
        if (firstName !== undefined) {
            updateData.first_name = firstName;
        }
        if (lastName !== undefined) {
            updateData.last_name = lastName;
        }
        if (role !== undefined && ['admin', 'agent', 'user'].includes(role)) {
            updateData.role = role;
        }
        if (isActive !== undefined) {
            updateData.is_active = isActive;
        }

        // Update user
        const updatedUser = await prisma.users.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
                role: true,
                is_active: true,
                email_verified: true,
                updated_at: true
            }
        });

        res.json({
            success: true,
            message: 'User updated successfully',
            data: updatedUser
        });
    });

    /**
     * Regenerate password for user (admin only)
     * Generates a new secure password and returns it to admin
     * Does NOT expose the current password
     */
    regeneratePassword = asyncHandler(async (req, res) => {
        const { id } = req.params;

        // Check if user exists
        const user = await prisma.users.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
                role: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Generate new secure password
        const newPassword = generateSecurePassword();
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update user's password
        await prisma.users.update({
            where: { id },
            data: {
                password_hash: hashedPassword,
                updated_at: new Date()
            }
        });

        // Invalidate all refresh tokens for this user to force re-login
        await prisma.refresh_tokens.updateMany({
            where: { user_id: id },
            data: { is_revoked: true }
        });

        res.json({
            success: true,
            message: 'Password regenerated successfully',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role
                },
                newPassword: newPassword,
                note: 'Please provide this password to the user. It cannot be recovered once this response is closed.'
            }
        });
    });

    /**
     * Deactivate user account (admin only)
     * Marks user as inactive instead of deleting
     */
    deactivateUser = asyncHandler(async (req, res) => {
        const { id } = req.params;

        // Check if user exists
        const user = await prisma.users.findUnique({
            where: { id }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Prevent admin from deactivating themselves
        if (req.user.id === id) {
            return res.status(400).json({
                success: false,
                error: 'You cannot deactivate your own account'
            });
        }

        // Deactivate user
        const updatedUser = await prisma.users.update({
            where: { id },
            data: {
                is_active: false,
                updated_at: new Date()
            },
            select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
                is_active: true
            }
        });

        // Invalidate all refresh tokens
        await prisma.refresh_tokens.updateMany({
            where: { user_id: id },
            data: { is_revoked: true }
        });

        res.json({
            success: true,
            message: 'User deactivated successfully',
            data: updatedUser
        });
    });

    /**
     * Reactivate user account (admin only)
     */
    reactivateUser = asyncHandler(async (req, res) => {
        const { id } = req.params;

        // Check if user exists
        const user = await prisma.users.findUnique({
            where: { id }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Reactivate user
        const updatedUser = await prisma.users.update({
            where: { id },
            data: {
                is_active: true,
                updated_at: new Date()
            },
            select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
                is_active: true
            }
        });

        res.json({
            success: true,
            message: 'User reactivated successfully',
            data: updatedUser
        });
    });

    /**
     * Delete user permanently (admin only)
     */
    deleteUser = asyncHandler(async (req, res) => {
        const { id } = req.params;

        // Check if user exists
        const user = await prisma.users.findUnique({
            where: { id },
            select: { id: true, email: true, role: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Prevent deleting the current admin (if it's the same user)
        if (user.id === req.user.id) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete your own account'
            });
        }

        // Delete related records first (to avoid foreign key constraints)
        await prisma.$transaction(async (tx) => {
            // Delete agent status if exists
            await tx.agent_status.deleteMany({ where: { user_id: id } });
            
            // Delete refresh tokens
            await tx.refresh_tokens.deleteMany({ where: { user_id: id } });
            
            // Delete messages (if any)
            await tx.messages.deleteMany({ where: { sender_id: id } });
            
            // Delete tickets assigned to this user
            await tx.tickets.updateMany({ 
                where: { assigned_agent_id: id },
                data: { assigned_agent_id: null }
            });
            
            // Finally delete the user
            await tx.users.delete({ where: { id } });
        });

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    });

    /**
     * Get user statistics (admin only)
     */
    getUserStats = asyncHandler(async (req, res) => {
        const stats = await prisma.$transaction([
            prisma.users.count(),
            prisma.users.count({ where: { role: 'admin' } }),
            prisma.users.count({ where: { role: 'agent' } }),
            prisma.users.count({ where: { role: 'user' } }),
            prisma.users.count({ where: { is_active: true } }),
            prisma.users.count({ where: { is_active: false } }),
            prisma.users.count({ where: { email_verified: true } })
        ]);

        res.json({
            success: true,
            data: {
                total: stats[0],
                admins: stats[1],
                agents: stats[2],
                regularUsers: stats[3],
                active: stats[4],
                inactive: stats[5],
                emailVerified: stats[6]
            }
        });
    });
}

module.exports = new UserController();