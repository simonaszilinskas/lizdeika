/**
 * Template Routes Unit Tests
 * Tests for response template API endpoints
 */

const request = require('supertest');
const express = require('express');
const templateRoutes = require('../../src/routes/templateRoutes');
const databaseClient = require('../../src/utils/database');
const { authenticateToken, requireAgent, requireAdmin } = require('../../src/middleware/authMiddleware');

jest.mock('../../src/utils/database');
jest.mock('../../src/middleware/authMiddleware');

describe('Template Routes', () => {
  let app;
  let mockDb;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/templates', templateRoutes);

    mockDb = {
      response_templates: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    databaseClient.getClient = jest.fn().mockReturnValue(mockDb);

    authenticateToken.mockImplementation((req, res, next) => {
      req.user = { id: 'user-123', role: 'admin', email: 'admin@test.com' };
      next();
    });

    requireAgent.mockImplementation((req, res, next) => next());
    requireAdmin.mockImplementation((req, res, next) => next());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /', () => {
    it('should return all active templates', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          title: 'Welcome',
          content: 'Welcome message',
          is_active: true,
          creator: { id: 'user-123', first_name: 'John', last_name: 'Doe', email: 'john@test.com' },
        },
      ];

      mockDb.response_templates.findMany.mockResolvedValue(mockTemplates);

      const response = await request(app).get('/api/templates');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.templates).toEqual(mockTemplates);
      expect(mockDb.response_templates.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        include: {
          creator: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
        orderBy: { title: 'asc' },
      });
    });

    it('should handle database errors', async () => {
      mockDb.response_templates.findMany.mockRejectedValue(new Error('DB Error'));

      const response = await request(app).get('/api/templates');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch templates');
    });
  });

  describe('GET /all', () => {
    it('should return all templates including inactive', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          title: 'Active',
          content: 'Active template',
          is_active: true,
        },
        {
          id: 'template-2',
          title: 'Inactive',
          content: 'Inactive template',
          is_active: false,
        },
      ];

      mockDb.response_templates.findMany.mockResolvedValue(mockTemplates);

      const response = await request(app).get('/api/templates/all');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.templates).toHaveLength(2);
    });
  });

  describe('POST /', () => {
    it('should create a new template successfully', async () => {
      const newTemplate = {
        title: 'New Template',
        content: 'New template content',
      };

      const mockCreatedTemplate = {
        id: 'template-new',
        ...newTemplate,
        is_active: true,
        created_by: 'user-123',
        creator: { id: 'user-123', first_name: 'John', last_name: 'Doe', email: 'john@test.com' },
      };

      mockDb.response_templates.create.mockResolvedValue(mockCreatedTemplate);

      const response = await request(app)
        .post('/api/templates')
        .send(newTemplate);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.template).toMatchObject({
        title: newTemplate.title,
        content: newTemplate.content,
      });
    });

    it('should reject template with missing title', async () => {
      const response = await request(app)
        .post('/api/templates')
        .send({ content: 'Content only' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title and content are required');
    });

    it('should reject template with missing content', async () => {
      const response = await request(app)
        .post('/api/templates')
        .send({ title: 'Title only' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title and content are required');
    });

    it('should reject template with title exceeding 200 characters', async () => {
      const longTitle = 'a'.repeat(201);
      const response = await request(app)
        .post('/api/templates')
        .send({ title: longTitle, content: 'Content' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title must not exceed 200 characters');
    });

    it('should reject template with content exceeding 10000 characters', async () => {
      const longContent = 'a'.repeat(10001);
      const response = await request(app)
        .post('/api/templates')
        .send({ title: 'Title', content: longContent });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Content must not exceed 10,000 characters');
    });

    it('should accept template at maximum length limits', async () => {
      const maxTitle = 'a'.repeat(200);
      const maxContent = 'b'.repeat(10000);

      const mockCreatedTemplate = {
        id: 'template-max',
        title: maxTitle,
        content: maxContent,
        is_active: true,
        created_by: 'user-123',
        creator: { id: 'user-123', first_name: 'John', last_name: 'Doe', email: 'john@test.com' },
      };

      mockDb.response_templates.create.mockResolvedValue(mockCreatedTemplate);

      const response = await request(app)
        .post('/api/templates')
        .send({ title: maxTitle, content: maxContent });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /:id', () => {
    it('should update template successfully', async () => {
      const updates = {
        title: 'Updated Title',
        content: 'Updated content',
      };

      const mockUpdatedTemplate = {
        id: 'template-1',
        ...updates,
        is_active: true,
        updated_by: 'user-123',
        creator: { id: 'user-123', first_name: 'John', last_name: 'Doe', email: 'john@test.com' },
        updater: { id: 'user-123', first_name: 'John', last_name: 'Doe', email: 'john@test.com' },
      };

      mockDb.response_templates.update.mockResolvedValue(mockUpdatedTemplate);

      const response = await request(app)
        .put('/api/templates/template-1')
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.template.title).toBe(updates.title);
    });

    it('should return 404 when template not found', async () => {
      const error = new Error('Not found');
      error.code = 'P2025';
      mockDb.response_templates.update.mockRejectedValue(error);

      const response = await request(app)
        .put('/api/templates/nonexistent')
        .send({ title: 'Updated' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Template not found');
    });

    it('should reject update with title exceeding 200 characters', async () => {
      const longTitle = 'a'.repeat(201);
      const response = await request(app)
        .put('/api/templates/template-1')
        .send({ title: longTitle });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title must not exceed 200 characters');
    });

    it('should reject update with content exceeding 10000 characters', async () => {
      const longContent = 'a'.repeat(10001);
      const response = await request(app)
        .put('/api/templates/template-1')
        .send({ content: longContent });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Content must not exceed 10,000 characters');
    });
  });

  describe('DELETE /:id', () => {
    it('should soft delete template successfully', async () => {
      const mockDeletedTemplate = {
        id: 'template-1',
        title: 'Deleted',
        content: 'Deleted content',
        is_active: false,
        updated_by: 'user-123',
        creator: { id: 'user-123', first_name: 'John', last_name: 'Doe', email: 'john@test.com' },
        updater: { id: 'user-123', first_name: 'John', last_name: 'Doe', email: 'john@test.com' },
      };

      mockDb.response_templates.update.mockResolvedValue(mockDeletedTemplate);

      const response = await request(app).delete('/api/templates/template-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.template.is_active).toBe(false);
      expect(mockDb.response_templates.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: {
          is_active: false,
          updated_by: 'user-123',
        },
        include: expect.any(Object),
      });
    });

    it('should return 404 when deleting nonexistent template', async () => {
      const error = new Error('Not found');
      error.code = 'P2025';
      mockDb.response_templates.update.mockRejectedValue(error);

      const response = await request(app).delete('/api/templates/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Template not found');
    });

    it('should return 500 for other database errors', async () => {
      mockDb.response_templates.update.mockRejectedValue(new Error('DB Error'));

      const response = await request(app).delete('/api/templates/template-1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to delete template');
    });
  });

  describe('XSS Prevention', () => {
    it('should accept template with HTML/script content for testing XSS escaping', async () => {
      const xssTemplate = {
        title: '<script>alert("xss")</script>',
        content: '<img src=x onerror=alert(1)>',
      };

      const mockCreatedTemplate = {
        id: 'template-xss',
        ...xssTemplate,
        is_active: true,
        created_by: 'user-123',
        creator: { id: 'user-123', first_name: 'John', last_name: 'Doe', email: 'john@test.com' },
      };

      mockDb.response_templates.create.mockResolvedValue(mockCreatedTemplate);

      const response = await request(app)
        .post('/api/templates')
        .send(xssTemplate);

      expect(response.status).toBe(200);
      expect(response.body.template.title).toBe(xssTemplate.title);
    });
  });
});
