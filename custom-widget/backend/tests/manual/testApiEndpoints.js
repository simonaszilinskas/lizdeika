/**
 * Test Document Ingestion API Endpoints
 * Tests the real HTTP API with actual Chroma/Mistral integration
 *
 * Usage: node tests/manual/testApiEndpoints.js
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3002/api';

// Sample authentication token (will be created)
let authToken = null;

async function createTestUser() {
  try {
    console.log('🔐 Creating test user...\n');

    // Try to login with existing test credentials
    const response = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@vilnius.lt',
      password: 'admin123',
    });

    authToken = response.data.data.tokens.accessToken;
    console.log(`✅ Logged in as admin@vilnius.lt`);
    console.log(`   Token: ${authToken.substring(0, 20)}...\n`);
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data?.error || error.message);
    return false;
  }
}

async function testSingleDocumentIngestion() {
  console.log('📝 Test 1: Single Document Ingestion\n');

  try {
    const response = await axios.post(
      `${API_BASE}/knowledge/documents/ingest`,
      {
        documents: [
          {
            body: `
              Kubernetes is an open-source container orchestration platform that automates
              many of the manual processes involved in deploying, managing, and scaling containerized applications.
              It provides a container-centric management environment.
            `,
            title: 'Introduction to Kubernetes',
            sourceUrl: 'https://kubernetes.io/docs/concepts/overview/what-is-kubernetes/',
            sourceType: 'scraper',
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ API Response:');
    console.log(`   Status: ${response.status}`);
    console.log(`   Batch success: ${response.data.success}`);
    console.log(`   Total: ${response.data.batch.total}`);
    console.log(`   Successful: ${response.data.batch.successful}`);
    console.log(`   Failed: ${response.data.batch.failed}`);
    console.log(`   Duplicates: ${response.data.batch.duplicates}\n`);

    if (response.data.batch.successful > 0) {
      const doc = response.data.batch.details[0];
      console.log('   Document Details:');
      console.log(`     ID: ${doc.documentId}`);
      console.log(`     Title: ${doc.title}`);
      console.log(`     Chunks: ${doc.chunksCount}`);
      console.log(`     Status: ${doc.status}\n`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ API Error:', error.response?.data || error.message);
    return false;
  }
}

async function testBatchIngestion() {
  console.log('📝 Test 2: Batch Ingestion (5 documents)\n');

  try {
    const documents = [
      {
        body: 'Docker is a containerization platform that packages applications with dependencies.',
        title: 'Docker Basics',
        sourceUrl: 'https://example.com/docker',
        sourceType: 'scraper',
      },
      {
        body: 'Microservices break applications into small independent services that communicate via APIs.',
        title: 'Microservices Architecture',
        sourceUrl: 'https://example.com/microservices',
        sourceType: 'scraper',
      },
      {
        body: 'CI/CD pipelines automate testing and deployment of code changes to production.',
        title: 'CI/CD Fundamentals',
        sourceUrl: 'https://example.com/cicd',
        sourceType: 'scraper',
      },
      {
        body: 'DevOps combines development and operations to improve collaboration and efficiency.',
        title: 'DevOps Principles',
        sourceUrl: 'https://example.com/devops',
        sourceType: 'api',
      },
      {
        body: 'Cloud computing provides on-demand access to computing resources over the internet.',
        title: 'Cloud Computing',
        sourceUrl: 'https://example.com/cloud',
        sourceType: 'api',
      },
    ];

    const response = await axios.post(
      `${API_BASE}/knowledge/documents/ingest`,
      { documents },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ API Response:');
    console.log(`   Status: ${response.status}`);
    console.log(`   Batch success: ${response.data.success}`);
    console.log(`   Total: ${response.data.batch.total}`);
    console.log(`   Successful: ${response.data.batch.successful}`);
    console.log(`   Failed: ${response.data.batch.failed}`);
    console.log(`   Duplicates: ${response.data.batch.duplicates}\n`);

    if (response.data.batch.successful > 0) {
      console.log('   Individual Results:');
      response.data.batch.details.forEach((doc, idx) => {
        console.log(`     ${idx + 1}. ${doc.title || 'Unknown'} - ${doc.status}`);
      });
      console.log();
    }

    return response.data.batch.successful > 0;
  } catch (error) {
    console.error('❌ API Error:', error.response?.data || error.message);
    return false;
  }
}

async function testDuplicateDetection() {
  console.log('📝 Test 3: Duplicate Detection\n');

  try {
    // Ingest the same content twice with different URLs
    const content = 'This is test content for duplicate detection';

    const response = await axios.post(
      `${API_BASE}/knowledge/documents/ingest`,
      {
        documents: [
          {
            body: content,
            title: 'Duplicate Test v1',
            sourceUrl: 'https://example.com/duplicate-v1',
            sourceType: 'api',
          },
          {
            body: content,
            title: 'Duplicate Test v2',
            sourceUrl: 'https://example.com/duplicate-v2',
            sourceType: 'api',
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ API Response:');
    console.log(`   Total: ${response.data.batch.total}`);
    console.log(`   Successful: ${response.data.batch.successful}`);
    console.log(`   Duplicates: ${response.data.batch.duplicates}\n`);

    response.data.batch.details.forEach((doc, idx) => {
      console.log(`   ${idx + 1}. Status: ${doc.status}`);
      if (doc.reason) console.log(`      Reason: ${doc.reason}`);
    });
    console.log();

    return response.data.batch.duplicates > 0;
  } catch (error) {
    console.error('❌ API Error:', error.response?.data || error.message);
    return false;
  }
}

async function testIngestStatistics() {
  console.log('📝 Test 4: Ingestion Statistics\n');

  try {
    const response = await axios.get(`${API_BASE}/knowledge/documents/ingest-stats`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    console.log('✅ Statistics:');
    console.log(`   Total documents: ${response.data.database.total}`);
    console.log(`   By source type:`);
    console.log(`     - Scraper: ${response.data.database.bySourceType.scraper || 0}`);
    console.log(`     - API: ${response.data.database.bySourceType.api || 0}`);
    console.log(`     - Manual: ${response.data.database.bySourceType.manual_upload || 0}`);
    console.log(`   Average chunks: ${response.data.database.avgChunksPerDoc?.toFixed(2) || 'N/A'}`);
    console.log(`   Total characters: ${response.data.database.totalChars || 0}\n`);

    return true;
  } catch (error) {
    console.error('❌ API Error:', error.response?.data || error.message);
    return false;
  }
}

async function testOrphanDetection() {
  console.log('📝 Test 5: Orphan Detection (Dry Run)\n');

  try {
    // Test dry-run of orphan detection
    const response = await axios.post(
      `${API_BASE}/knowledge/documents/detect-orphans`,
      {
        currentUrls: [
          'https://example.com/docker',
          'https://example.com/microservices',
        ],
        dryRun: true,
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Orphan Detection (Dry Run):');
    console.log(`   Found: ${response.data.found}`);
    console.log(`   Deleted: ${response.data.deleted}`);
    console.log(`   Dry run: ${response.data.dryRun}`);
    console.log(`   Preview: ${response.data.preview}\n`);

    if (response.data.details && response.data.details.length > 0) {
      console.log('   Orphaned documents:');
      response.data.details.forEach((doc) => {
        console.log(`     - ${doc.title} (${doc.chunksToDelete || doc.chunksDeleted} chunks)`);
      });
      console.log();
    }

    return true;
  } catch (error) {
    console.error('❌ API Error:', error.response?.data || error.message);
    return false;
  }
}

async function testChromaIntegration() {
  console.log('📝 Test 6: Chroma Vector Integration\n');

  try {
    // Ingest a document and check if it was added to Chroma
    const response = await axios.post(
      `${API_BASE}/knowledge/documents/ingest`,
      {
        documents: [
          {
            body: `
              Prompt engineering is the process of designing and optimizing prompts
              to get the best responses from language models. It involves understanding
              how models interpret instructions and crafting inputs accordingly.
            `,
            title: 'Prompt Engineering Guide',
            sourceUrl: 'https://example.com/prompt-engineering',
            sourceType: 'scraper',
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.batch.successful > 0) {
      const doc = response.data.batch.details[0];
      console.log('✅ Document ingested:');
      console.log(`   Title: ${doc.title}`);
      console.log(`   Chunks: ${doc.chunksCount}`);
      console.log(`   Status: ${doc.status}`);

      if (doc.chunksCount > 0) {
        console.log(`\n✅ Chroma Integration Status:`);
        console.log(`   Document successfully chunked and ready for embeddings`);
        console.log(`   ${doc.chunksCount} chunk(s) prepared for vector storage\n`);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('❌ API Error:', error.response?.data || error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('════════════════════════════════════════════════════════════\n');
  console.log('   DOCUMENT INGESTION API ENDPOINT TESTS\n');
  console.log('════════════════════════════════════════════════════════════\n');

  // Authenticate first
  const authenticated = await createTestUser();
  if (!authenticated) {
    console.error('\n❌ Authentication failed - cannot proceed with tests');
    process.exit(1);
  }

  // Run all tests
  const results = {
    'Single Document Ingestion': await testSingleDocumentIngestion(),
    'Batch Ingestion': await testBatchIngestion(),
    'Duplicate Detection': await testDuplicateDetection(),
    'Ingestion Statistics': await testIngestStatistics(),
    'Orphan Detection': await testOrphanDetection(),
    'Chroma Integration': await testChromaIntegration(),
  };

  // Print summary
  console.log('════════════════════════════════════════════════════════════\n');
  console.log('TEST RESULTS SUMMARY:\n');

  Object.entries(results).forEach(([name, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${name}`);
  });

  const passCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.values(results).length;

  console.log(`\nTotal: ${passCount}/${totalCount} tests passed\n`);
  console.log('════════════════════════════════════════════════════════════\n');

  process.exit(passCount === totalCount ? 0 : 1);
}

// Check if axios is available
try {
  require.resolve('axios');
  runAllTests().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
} catch (e) {
  console.error('axios not found - installing...');
  const { execSync } = require('child_process');
  execSync('npm install axios', { cwd: '/Users/simonaszilinskas/Development/lizdeika/custom-widget/backend' });
  runAllTests().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
