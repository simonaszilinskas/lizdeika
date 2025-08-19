/**
 * Request Validation Schemas
 * Uses Zod for runtime type checking and validation
 */

const { z } = require('zod');

// Custom email validation
const emailSchema = z.string()
  .email('Invalid email format')
  .min(1, 'Email is required')
  .max(255, 'Email is too long')
  .transform(email => email.toLowerCase().trim());

// Custom password validation
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password is too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/, 'Password must contain at least one special character');

// Name validation
const nameSchema = z.string()
  .min(1, 'Name is required')
  .max(100, 'Name is too long')
  .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Name contains invalid characters')
  .transform(name => name.trim());

// User role validation
const userRoleSchema = z.enum(['admin', 'agent', 'user'], {
  errorMap: () => ({ message: 'Role must be admin, agent, or user' })
});

// Ticket status validation
const ticketStatusSchema = z.enum(['open', 'in_progress', 'waiting_user', 'resolved', 'closed', 'archived'], {
  errorMap: () => ({ message: 'Invalid ticket status' })
});

// Ticket priority validation
const ticketPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent'], {
  errorMap: () => ({ message: 'Invalid ticket priority' })
});

// Agent status validation
const agentStatusSchema = z.enum(['online', 'busy', 'offline'], {
  errorMap: () => ({ message: 'Invalid agent status' })
});

/**
 * Authentication Validation Schemas
 */
const authSchemas = {
  // User registration
  register: z.object({
    email: emailSchema,
    password: passwordSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    role: userRoleSchema.optional().default('user'),
  }),

  // User login
  login: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
  }),

  // Token refresh
  refreshToken: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),

  // Password reset request
  forgotPassword: z.object({
    email: emailSchema,
  }),

  // Password reset
  resetPassword: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: passwordSchema,
  }),

  // Change password
  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
  }),

  // Email verification
  verifyEmail: z.object({
    token: z.string().min(1, 'Verification token is required'),
  }),

  // Resend verification email
  resendVerification: z.object({
    email: emailSchema,
  }),
};

/**
 * User Management Validation Schemas
 */
const userSchemas = {
  // Update user profile
  updateProfile: z.object({
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional(),
    email: emailSchema.optional(),
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
  }),

  // Update user role (admin only)
  updateRole: z.object({
    userId: z.string().uuid('Invalid user ID'),
    role: userRoleSchema,
  }),

  // Activate/deactivate user (admin only)
  updateStatus: z.object({
    userId: z.string().uuid('Invalid user ID'),
    isActive: z.boolean(),
  }),

  // Get user by ID
  getUserById: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),

  // Search users
  searchUsers: z.object({
    query: z.string().min(1, 'Search query is required').optional(),
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }),
};

/**
 * Agent Management Validation Schemas
 */
const agentSchemas = {
  // Update agent status
  updateStatus: z.object({
    status: agentStatusSchema,
  }),

  // Get agent workload
  getWorkload: z.object({
    agentId: z.string().uuid('Invalid agent ID').optional(),
  }),
};

/**
 * Ticket Management Validation Schemas
 */
const ticketSchemas = {
  // Create ticket
  createTicket: z.object({
    userId: z.string().uuid('Invalid user ID').optional().nullable(),
    subject: z.string().min(1, 'Subject is required').max(255, 'Subject is too long'),
    description: z.string().min(1, 'Description is required').max(5000, 'Description is too long'),
    priority: ticketPrioritySchema.optional().default('medium'),
    category: z.string().max(100, 'Category is too long').optional().nullable(),
    source: z.enum(['widget', 'admin_panel', 'email']).optional().default('widget'),
  }),

  // Update ticket
  updateTicket: z.object({
    ticketId: z.string().uuid('Invalid ticket ID'),
    subject: z.string().min(1, 'Subject is required').max(255, 'Subject is too long').optional(),
    description: z.string().max(5000, 'Description is too long').optional(),
    priority: ticketPrioritySchema.optional(),
    category: z.string().max(100, 'Category is too long').optional().nullable(),
    status: ticketStatusSchema.optional(),
    assignedAgentId: z.string().uuid('Invalid agent ID').optional().nullable(),
  }).refine(data => Object.keys(data).filter(key => key !== 'ticketId').length > 0, {
    message: 'At least one field must be provided for update'
  }),

  // Get ticket by ID
  getTicketById: z.object({
    ticketId: z.string().uuid('Invalid ticket ID'),
  }),

  // Search tickets
  searchTickets: z.object({
    query: z.string().optional(),
    status: ticketStatusSchema.optional(),
    priority: ticketPrioritySchema.optional(),
    assignedAgentId: z.string().uuid('Invalid agent ID').optional(),
    userId: z.string().uuid('Invalid user ID').optional(),
    category: z.string().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'status']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
};

/**
 * Message Validation Schemas
 */
const messageSchemas = {
  // Create message
  createMessage: z.object({
    ticketId: z.string().uuid('Invalid ticket ID'),
    content: z.string().min(1, 'Message content is required').max(10000, 'Message is too long'),
    senderType: z.enum(['user', 'agent', 'system', 'ai']),
    messageType: z.enum(['text', 'file', 'system_action', 'ai_response']).optional().default('text'),
    metadata: z.record(z.any()).optional(),
  }),

  // Get messages for ticket
  getMessages: z.object({
    ticketId: z.string().uuid('Invalid ticket ID'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
};

/**
 * System Settings Validation Schemas
 */
const systemSchemas = {
  // Update system setting
  updateSetting: z.object({
    key: z.string().min(1, 'Setting key is required'),
    value: z.string().min(1, 'Setting value is required'),
  }),

  // Get system logs
  getLogs: z.object({
    action: z.string().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  }),
};

/**
 * Validation middleware factory
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {string} property - Request property to validate ('body', 'params', 'query')
 * @returns {Function} Express middleware function
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    try {
      const validated = schema.parse(req[property]);
      req[property] = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errorMessages,
        });
      }
      
      next(error);
    }
  };
};

module.exports = {
  // Schemas
  authSchemas,
  userSchemas,
  agentSchemas,
  ticketSchemas,
  messageSchemas,
  systemSchemas,
  
  // Middleware
  validate,
  
  // Base schemas for reuse
  emailSchema,
  passwordSchema,
  nameSchema,
  userRoleSchema,
  ticketStatusSchema,
  ticketPrioritySchema,
  agentStatusSchema,
};