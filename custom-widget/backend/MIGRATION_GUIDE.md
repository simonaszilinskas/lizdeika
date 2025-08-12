# Migration Guide: Monolithic to Modular Architecture

This guide explains the changes made during the code quality improvements (Priority 1 & 2) and how to work with the new architecture.

## What Changed

### Before (Monolithic)
- Single `server.js` file with 775+ lines
- All functionality mixed together
- No separation of concerns
- Limited testing
- Hard to maintain and extend

### After (Modular)
- Organized into layers: controllers, services, routes, middleware
- Clear separation of concerns
- Comprehensive test coverage
- Easy to maintain and extend
- Following best practices

## Breaking Changes

### Import Changes
If you were importing from `server.js`, update your imports:

```javascript
// OLD
const server = require('./server.js');

// NEW
const { app, server, io } = require('./server.js');
// OR
const createApp = require('./src/app.js');
```

### Testing Changes
- Test files moved to `tests/` directory
- New test structure: `tests/unit/` and `tests/integration/`
- Added comprehensive test coverage

## New Architecture Benefits

### 1. Maintainability
- **Modular Structure**: Each component has a single responsibility
- **Clear Dependencies**: Easy to understand what depends on what
- **Consistent Patterns**: Similar structure across all modules

### 2. Testability
- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test interactions between components
- **Mocking**: Easy to mock dependencies for testing

### 3. Scalability
- **Service Layer**: Business logic separated from HTTP concerns
- **Pluggable Components**: Easy to swap implementations
- **Configuration Management**: Centralized and flexible

## Working with the New Architecture

### Adding New Features

#### 1. Add a New API Endpoint
1. **Define Route** in appropriate route file (`src/routes/`)
2. **Create Controller Method** in appropriate controller (`src/controllers/`)
3. **Add Business Logic** in appropriate service (`src/services/`)
4. **Write Tests** in `tests/unit/` and `tests/integration/`

Example:
```javascript
// 1. Add route (src/routes/conversationRoutes.js)
router.get('/conversations/:id/summary', (req, res) => {
    conversationController.getSummary(req, res);
});

// 2. Add controller method (src/controllers/conversationController.js)
async getSummary(req, res) {
    try {
        const summary = await conversationService.generateSummary(req.params.id);
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// 3. Add service method (src/services/conversationService.js)
async generateSummary(conversationId) {
    const messages = this.getMessages(conversationId);
    // Business logic here
    return summary;
}
```

#### 2. Add a New Service
1. **Create Service File** in `src/services/`
2. **Define Service Class** with clear methods
3. **Export Instance** for singleton pattern
4. **Write Unit Tests**

Example:
```javascript
// src/services/notificationService.js
class NotificationService {
    async sendEmail(recipient, subject, body) {
        // Implementation
    }
    
    async sendSMS(phoneNumber, message) {
        // Implementation
    }
}

module.exports = new NotificationService();
```

### Testing Guidelines

#### Unit Tests
- Test individual functions/methods
- Mock external dependencies
- Focus on business logic
- Fast execution

```javascript
// tests/unit/conversationService.test.js
describe('ConversationService', () => {
    describe('createConversation', () => {
        it('should create conversation with correct data', async () => {
            const result = await conversationService.createConversation(id, data);
            expect(result.id).toBe(id);
            expect(result.status).toBe('active');
        });
    });
});
```

#### Integration Tests
- Test component interactions
- Test API endpoints end-to-end
- Test WebSocket functionality
- Include error scenarios

```javascript
// tests/integration/api.test.js
describe('Conversation API', () => {
    it('should create conversation via POST /api/conversations', async () => {
        const response = await request(app)
            .post('/api/conversations')
            .send({ visitorId: 'test-visitor' })
            .expect(200);
            
        expect(response.body.conversationId).toBeDefined();
    });
});
```

## Migration Checklist

### ✅ Completed
- [x] Organized code into modular structure
- [x] Created comprehensive test suite
- [x] Added error handling middleware
- [x] Implemented request logging
- [x] Created documentation

### Future Improvements
- [ ] Add authentication middleware
- [ ] Implement rate limiting
- [ ] Add API documentation (Swagger)
- [ ] Add database persistence layer
- [ ] Add caching layer (Redis)
- [ ] Add monitoring and metrics
- [ ] Add CI/CD pipeline

## Configuration Changes

### Environment Variables
No changes to environment variables. All existing configuration works as before.

### Package.json Scripts
New test scripts added:
```json
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

## Troubleshooting

### Common Issues

#### 1. Module Import Errors
**Problem**: `Cannot find module` errors
**Solution**: Check that you're importing from the correct path and that the module exports what you expect

#### 2. Test Failures
**Problem**: Tests failing after migration
**Solution**: Run tests individually to isolate issues, check mock configurations

#### 3. WebSocket Issues
**Problem**: WebSocket connections not working
**Solution**: Verify that the WebSocket service is properly initialized in `src/app.js`

### Debug Mode
Set `NODE_ENV=development` to enable detailed logging:
```bash
NODE_ENV=development npm start
```

## Best Practices

### Code Organization
1. **Single Responsibility**: Each module should have one clear purpose
2. **Dependency Injection**: Pass dependencies as parameters
3. **Error Handling**: Always handle errors gracefully
4. **Documentation**: Document complex business logic

### Testing
1. **Test First**: Write tests before implementing features
2. **Test Coverage**: Aim for high test coverage
3. **Fast Tests**: Keep unit tests fast and focused
4. **Realistic Tests**: Make integration tests realistic

### Performance
1. **Async/Await**: Use modern async patterns
2. **Error Boundaries**: Implement proper error boundaries
3. **Resource Cleanup**: Clean up resources properly
4. **Monitoring**: Add monitoring for production

## Support

For questions about the new architecture:
1. Check the `ARCHITECTURE.md` documentation
2. Look at existing tests for examples
3. Review the service implementations
4. Check the commit history for detailed changes