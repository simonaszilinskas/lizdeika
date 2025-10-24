const { validateIngestDocuments, validateDetectOrphans } = require('../../src/middleware/validationMiddleware');

describe('Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    next = jest.fn();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    req = {
      ip: '127.0.0.1',
      user: { id: 'user-1' },
    };
  });

  describe('validateIngestDocuments', () => {
    it('should pass valid ingest request', () => {
      req.body = {
        documents: [
          {
            body: 'Valid document content',
            title: 'Test Doc',
            sourceUrl: 'https://example.com',
            sourceType: 'scraper',
          },
        ],
      };

      validateIngestDocuments(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.validatedData).toEqual(req.body);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should fail when documents array is empty', () => {
      req.body = { documents: [] };

      validateIngestDocuments(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should fail when documents array exceeds max size', () => {
      const documents = Array(101).fill({
        body: 'Test',
        sourceType: 'api',
      });
      req.body = { documents };

      validateIngestDocuments(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
        })
      );
    });

    it('should fail when document body is empty', () => {
      req.body = {
        documents: [
          {
            body: '',
            sourceType: 'api',
          },
        ],
      };

      validateIngestDocuments(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
          details: expect.any(Array),
        })
      );
    });

    it('should fail when sourceType is invalid', () => {
      req.body = {
        documents: [
          {
            body: 'Valid content',
            sourceType: 'invalid_type',
          },
        ],
      };

      validateIngestDocuments(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should fail when sourceUrl is not a valid URL', () => {
      req.body = {
        documents: [
          {
            body: 'Valid content',
            sourceUrl: 'not-a-url',
            sourceType: 'scraper',
          },
        ],
      };

      validateIngestDocuments(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should use default sourceType when not provided', () => {
      req.body = {
        documents: [
          {
            body: 'Valid content',
          },
        ],
      };

      validateIngestDocuments(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.validatedData.documents[0].sourceType).toBe('api');
    });
  });

  describe('validateDetectOrphans', () => {
    it('should pass valid orphan detection request', () => {
      req.body = {
        currentUrls: ['https://example.com/doc1', 'https://example.com/doc2'],
      };

      validateDetectOrphans(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.validatedData).toEqual({
        currentUrls: req.body.currentUrls,
        dryRun: false,
      });
    });

    it('should pass with dryRun=true', () => {
      req.body = {
        currentUrls: ['https://example.com/doc1'],
        dryRun: true,
      };

      validateDetectOrphans(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.validatedData.dryRun).toBe(true);
    });

    it('should fail when currentUrls is empty', () => {
      req.body = {
        currentUrls: [],
      };

      validateDetectOrphans(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
        })
      );
    });

    it('should fail when currentUrls is missing', () => {
      req.body = {};

      validateDetectOrphans(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should fail when URL in array is invalid', () => {
      req.body = {
        currentUrls: ['https://example.com/doc1', 'not-a-url'],
      };

      validateDetectOrphans(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
          details: expect.any(Array),
        })
      );
    });

    it('should default dryRun to false', () => {
      req.body = {
        currentUrls: ['https://example.com/doc1'],
      };

      validateDetectOrphans(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.validatedData.dryRun).toBe(false);
    });
  });
});
