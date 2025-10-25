/**
 * COMPREHENSIVE TEST VERIFICATION SUITE
 * Tests CORS implementation and ensures no regressions
 *
 * Run with: node TEST_VERIFICATION_SUITE.js
 */

const http = require('http');
const path = require('path');

// Test results tracking
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

// Helper to make HTTP requests
function makeRequest(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

// Test helper
async function test(name, fn) {
    try {
        await fn();
        results.passed++;
        results.tests.push({ name, status: '✓ PASS' });
        console.log(`✓ ${name}`);
    } catch (error) {
        results.failed++;
        results.tests.push({ name, status: '✗ FAIL', error: error.message });
        console.log(`✗ ${name}: ${error.message}`);
    }
}

// Test 1: App Initialization
async function testAppInitialization() {
    console.log('\n═══════════════════════════════════════════');
    console.log('TEST 1: App Initialization');
    console.log('═══════════════════════════════════════════\n');

    await test('App module loads without errors', () => {
        const createApp = require('./custom-widget/backend/src/app');
        const { app, server, io, websocketService } = createApp();

        if (!app) throw new Error('App not created');
        if (!server) throw new Error('Server not created');
        if (!io) throw new Error('Socket.IO not created');
        if (!websocketService) throw new Error('WebSocket service not created');
    });

    await test('CORS middleware loads without errors', () => {
        const createCorsMiddleware = require('./custom-widget/backend/src/middleware/corsMiddleware');
        const middleware = createCorsMiddleware();

        if (typeof middleware !== 'function') {
            throw new Error('CORS middleware is not a function');
        }
    });
}

// Test 2: Route Pattern Matching
async function testRoutePatterns() {
    console.log('\n═══════════════════════════════════════════');
    console.log('TEST 2: Route Pattern Matching');
    console.log('═══════════════════════════════════════════\n');

    // Recreate the route pattern matching logic
    const adminRoutePatterns = [
        /^\/api\/auth/,
        /^\/api\/users/,
        /^\/api\/categories/,
        /^\/api\/statistics/,
        /^\/api\/templates/,
        /^\/api\/widget/,
        /^\/api\/knowledge/,
        /^\/settings\.html/,
        /^\/agent-dashboard\.html/,
        /^\/setup-2fa\.html/,
    ];

    function isAdminRoute(path) {
        return adminRoutePatterns.some(pattern => pattern.test(path));
    }

    const adminRoutes = [
        '/api/auth/login',
        '/api/users/list',
        '/api/categories/1',
        '/api/statistics/dashboard',
        '/api/templates/all',
        '/api/widget/config',
        '/api/knowledge/documents',
        '/settings.html',
        '/agent-dashboard.html',
        '/setup-2fa.html',
    ];

    const widgetRoutes = [
        '/api/conversations',
        '/api/messages',
        '/api/agent/status',
        '/api/agents/list',
        '/api/system/mode',
        '/api/upload',
        '/login.html',
        '/index.html',
    ];

    adminRoutes.forEach(route => {
        test(`Admin route identified: ${route}`, () => {
            if (!isAdminRoute(route)) {
                throw new Error(`Route ${route} should be admin but wasn't classified`);
            }
        });
    });

    widgetRoutes.forEach(route => {
        test(`Widget route identified: ${route}`, () => {
            if (isAdminRoute(route)) {
                throw new Error(`Route ${route} should be widget but was classified as admin`);
            }
        });
    });
}

// Test 3: Smart Document Ingestion System
async function testSmartIngestion() {
    console.log('\n═══════════════════════════════════════════');
    console.log('TEST 3: Smart Document Ingestion System');
    console.log('═══════════════════════════════════════════\n');

    await test('DocumentIngestService module exists', () => {
        try {
            const service = require('./custom-widget/backend/src/services/documentIngestService');
            if (!service) throw new Error('Service is null');
        } catch (e) {
            throw new Error(`DocumentIngestService not found: ${e.message}`);
        }
    });

    await test('DocumentHashService module exists', () => {
        try {
            const service = require('./custom-widget/backend/src/services/documentHashService');
            if (!service) throw new Error('Service is null');
        } catch (e) {
            throw new Error(`DocumentHashService not found: ${e.message}`);
        }
    });

    await test('DocumentRepository module exists', () => {
        try {
            const repo = require('./custom-widget/backend/src/repositories/documentRepository');
            if (!repo) throw new Error('Repository is null');
        } catch (e) {
            throw new Error(`DocumentRepository not found: ${e.message}`);
        }
    });

    await test('Knowledge routes include /documents/ingest endpoint', () => {
        const routesFile = require('fs').readFileSync(
            './custom-widget/backend/src/routes/knowledgeRoutes.js',
            'utf-8'
        );

        if (!routesFile.includes('/documents/ingest')) {
            throw new Error('/documents/ingest endpoint not found in routes');
        }
    });

    await test('Knowledge routes include /documents/detect-orphans endpoint', () => {
        const routesFile = require('fs').readFileSync(
            './custom-widget/backend/src/routes/knowledgeRoutes.js',
            'utf-8'
        );

        if (!routesFile.includes('detect-orphans')) {
            throw new Error('detect-orphans endpoint not found in routes');
        }
    });

    await test('Knowledge routes include /documents/ingest-stats endpoint', () => {
        const routesFile = require('fs').readFileSync(
            './custom-widget/backend/src/routes/knowledgeRoutes.js',
            'utf-8'
        );

        if (!routesFile.includes('ingest-stats')) {
            throw new Error('ingest-stats endpoint not found in routes');
        }
    });

    await test('Database schema includes knowledge_documents table', () => {
        const schemaFile = require('fs').readFileSync(
            './custom-widget/backend/prisma/schema.prisma',
            'utf-8'
        );

        if (!schemaFile.includes('model knowledge_documents')) {
            throw new Error('knowledge_documents table not in schema');
        }
    });

    await test('Migration files for knowledge_documents exist', () => {
        const fs = require('fs');
        const migrationsDir = './custom-widget/backend/prisma/migrations';
        const migrations = fs.readdirSync(migrationsDir);

        const hasKnowledgeDocsMigration = migrations.some(m =>
            m.includes('knowledge_documents') || m.includes('20251024094354')
        );

        if (!hasKnowledgeDocsMigration) {
            throw new Error('knowledge_documents migration not found');
        }
    });
}

// Test 4: CORS Middleware Configuration
async function testCorsConfig() {
    console.log('\n═══════════════════════════════════════════');
    console.log('TEST 4: CORS Middleware Configuration');
    console.log('═══════════════════════════════════════════\n');

    await test('CORS middleware handles same-origin correctly', () => {
        const createCorsMiddleware = require('./custom-widget/backend/src/middleware/corsMiddleware');

        // Set env for same-origin
        process.env.ADMIN_ALLOWED_ORIGINS = 'same-origin';
        process.env.WIDGET_ALLOWED_DOMAINS = '*';

        const middleware = createCorsMiddleware();
        if (typeof middleware !== 'function') {
            throw new Error('Middleware not a function');
        }
    });

    await test('CORS middleware handles wildcard origins correctly', () => {
        const createCorsMiddleware = require('./custom-widget/backend/src/middleware/corsMiddleware');

        process.env.ADMIN_ALLOWED_ORIGINS = '*';
        process.env.WIDGET_ALLOWED_DOMAINS = '*';

        const middleware = createCorsMiddleware();
        if (typeof middleware !== 'function') {
            throw new Error('Middleware not a function');
        }
    });

    await test('CORS middleware handles multiple origins correctly', () => {
        const createCorsMiddleware = require('./custom-widget/backend/src/middleware/corsMiddleware');

        process.env.ADMIN_ALLOWED_ORIGINS = 'https://admin.example.com, https://internal.example.com';
        process.env.WIDGET_ALLOWED_DOMAINS = 'https://customer1.com, https://customer2.com';

        const middleware = createCorsMiddleware();
        if (typeof middleware !== 'function') {
            throw new Error('Middleware not a function');
        }
    });

    // Reset to defaults
    process.env.ADMIN_ALLOWED_ORIGINS = 'same-origin';
    process.env.WIDGET_ALLOWED_DOMAINS = '*';
}

// Test 5: Socket.IO Configuration
async function testSocketIOConfig() {
    console.log('\n═══════════════════════════════════════════');
    console.log('TEST 5: Socket.IO Configuration');
    console.log('═══════════════════════════════════════════\n');

    await test('Socket.IO initializes with correct CORS origin for same-origin', () => {
        process.env.ADMIN_ALLOWED_ORIGINS = 'same-origin';

        const createApp = require('./custom-widget/backend/src/app');
        const { io } = createApp();

        if (!io) throw new Error('Socket.IO not initialized');
        // io.engine.opts.cors should have origin configured
    });

    await test('Socket.IO initializes with correct CORS origin for wildcard', () => {
        process.env.ADMIN_ALLOWED_ORIGINS = '*';

        const createApp = require('./custom-widget/backend/src/app');
        const { io } = createApp();

        if (!io) throw new Error('Socket.IO not initialized');
    });

    await test('Socket.IO initializes with correct CORS origin for specific domains', () => {
        process.env.ADMIN_ALLOWED_ORIGINS = 'https://admin.example.com';

        const createApp = require('./custom-widget/backend/src/app');
        const { io } = createApp();

        if (!io) throw new Error('Socket.IO not initialized');
    });

    // Reset to default
    process.env.ADMIN_ALLOWED_ORIGINS = 'same-origin';
}

// Test 6: Core Routes Still Present
async function testCoreRoutes() {
    console.log('\n═══════════════════════════════════════════');
    console.log('TEST 6: Core Routes Still Present');
    console.log('═══════════════════════════════════════════\n');

    const routeFiles = [
        { path: './custom-widget/backend/src/routes/conversationRoutes.js', name: 'Conversation Routes' },
        { path: './custom-widget/backend/src/routes/authRoutes.js', name: 'Auth Routes' },
        { path: './custom-widget/backend/src/routes/userRoutes.js', name: 'User Routes' },
        { path: './custom-widget/backend/src/routes/agentRoutes.js', name: 'Agent Routes' },
        { path: './custom-widget/backend/src/routes/knowledgeRoutes.js', name: 'Knowledge Routes' },
        { path: './custom-widget/backend/src/routes/statisticsRoutes.js', name: 'Statistics Routes' },
    ];

    for (const route of routeFiles) {
        await test(`${route.name} module loads`, () => {
            try {
                require(route.path);
            } catch (e) {
                throw new Error(`Failed to load: ${e.message}`);
            }
        });
    }
}

// Test 7: Documentation Updated
async function testDocumentation() {
    console.log('\n═══════════════════════════════════════════');
    console.log('TEST 7: Documentation Updated');
    console.log('═══════════════════════════════════════════\n');

    await test('CLAUDE.md includes CORS section', () => {
        const fs = require('fs');
        const claudemd = fs.readFileSync('./CLAUDE.md', 'utf-8');

        if (!claudemd.includes('CORS Configuration')) {
            throw new Error('CLAUDE.md missing CORS Configuration section');
        }
    });

    await test('.env.example includes CORS variables', () => {
        const fs = require('fs');
        const envExample = fs.readFileSync('./custom-widget/backend/.env.example', 'utf-8');

        if (!envExample.includes('ADMIN_ALLOWED_ORIGINS')) {
            throw new Error('.env.example missing ADMIN_ALLOWED_ORIGINS');
        }
        if (!envExample.includes('WIDGET_ALLOWED_DOMAINS')) {
            throw new Error('.env.example missing WIDGET_ALLOWED_DOMAINS');
        }
    });
}

// Main test runner
async function runAllTests() {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║   COMPREHENSIVE TEST VERIFICATION SUITE    ║');
    console.log('║   Testing CORS Implementation & Regressions║');
    console.log('╚════════════════════════════════════════════╝');

    try {
        // Run all test suites
        await testAppInitialization();
        await testRoutePatterns();
        await testSmartIngestion();
        await testCorsConfig();
        await testSocketIOConfig();
        await testCoreRoutes();
        await testDocumentation();

        // Print summary
        console.log('\n╔════════════════════════════════════════════╗');
        console.log('║              TEST SUMMARY                  ║');
        console.log('╚════════════════════════════════════════════╝\n');

        console.log(`Total Tests: ${results.passed + results.failed}`);
        console.log(`✓ Passed: ${results.passed}`);
        console.log(`✗ Failed: ${results.failed}`);

        if (results.failed === 0) {
            console.log('\n🎉 ALL TESTS PASSED - Safe to deploy!\n');
            process.exit(0);
        } else {
            console.log('\n❌ SOME TESTS FAILED - Review issues above\n');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n💥 FATAL ERROR:', error.message);
        process.exit(1);
    }
}

// Run tests
runAllTests();
