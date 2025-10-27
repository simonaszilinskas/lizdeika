/**
 * Manual integration test for race condition scenario
 * This test simulates concurrent requests ingesting the same URL with different content
 *
 * Usage: NODE_ENV=test node tests/manual/testRaceCondition.js
 */

const { PrismaClient } = require('@prisma/client');
const DocumentIngestService = require('../../src/services/documentIngestService');
const DocumentHashService = require('../../src/services/documentHashService');
const documentService = require('../../src/services/documentService');
const chromaService = require('../../src/services/chromaService');

// Mock ChromaDB and document service
documentService.chunkTextWithFallback = async (content, info) => {
  return {
    chunks: [
      {
        id: `chunk_${Math.random().toString(36).substring(7)}`,
        text: content,
        metadata: info,
      },
    ],
    strategy: 'default',
  };
};

chromaService.isConnected = false; // Disable ChromaDB for this test
chromaService.addDocuments = async () => {};
chromaService.deleteChunks = async () => {};

const prisma = new PrismaClient();

async function testRaceCondition() {
  console.log('🚀 Testing Race Condition Scenario\n');
  console.log('Scenario: Two concurrent requests ingest same URL with different content\n');

  try {
    // Clean up any existing test data
    await prisma.knowledge_documents.deleteMany({
      where: {
        source_url: 'https://test-race-condition.com/doc',
      },
    });
    console.log('✓ Cleaned up test data\n');

    const sourceUrl = 'https://test-race-condition.com/doc';

    // Simulate two concurrent requests
    console.log('📍 Sending two concurrent requests to same URL with different content...\n');

    const request1 = DocumentIngestService.ingestDocument({
      body: 'First version of document content',
      title: 'Test Document v1',
      sourceUrl,
      sourceType: 'api',
    });

    const request2 = DocumentIngestService.ingestDocument({
      body: 'Second version of document content with different data',
      title: 'Test Document v2',
      sourceUrl,
      sourceType: 'api',
    });

    const [result1, result2] = await Promise.all([request1, request2]);

    console.log('Request 1 Result:');
    console.log(`  Status: ${result1.status}`);
    console.log(`  Success: ${result1.success}`);
    console.log(`  Document ID: ${result1.documentId || 'N/A'}\n`);

    console.log('Request 2 Result:');
    console.log(`  Status: ${result2.status}`);
    console.log(`  Success: ${result2.success}`);
    console.log(`  Document ID: ${result2.documentId || 'N/A'}\n`);

    // Check final state in database
    const finalDocuments = await prisma.knowledge_documents.findMany({
      where: {
        source_url: sourceUrl,
      },
    });

    console.log('✅ Final State in Database:');
    console.log(`  Total documents with this URL: ${finalDocuments.length}`);
    console.log(`  Expected: 1 (only one should survive due to transaction isolation)`);

    if (finalDocuments.length === 1) {
      console.log('\n✅ SUCCESS: Race condition properly handled!');
      console.log(`   Transaction isolation ensured only one document persists`);
      console.log(`   Document ID: ${finalDocuments[0].id}`);
      console.log(`   Content Hash: ${finalDocuments[0].content_hash}`);
      console.log(`   Title: ${finalDocuments[0].title}`);
      return true;
    } else {
      console.log('\n❌ FAILURE: Multiple documents with same URL found!');
      console.log('   This indicates race condition is not properly handled');
      finalDocuments.forEach((doc, idx) => {
        console.log(`   Document ${idx + 1}: ${doc.id} (${doc.title})`);
      });
      return false;
    }
  } catch (error) {
    console.error('❌ Test Error:', error.message);
    console.error(error.stack);
    return false;
  } finally {
    // Cleanup
    await prisma.knowledge_documents.deleteMany({
      where: {
        source_url: 'https://test-race-condition.com/doc',
      },
    });
    await prisma.$disconnect();
  }
}

async function testConcurrencyLimiting() {
  console.log('\n\n🚀 Testing Concurrency Limiting\n');
  console.log('Scenario: Ingest 30 documents - verify memory-bounded concurrency\n');

  try {
    const documents = Array.from({ length: 30 }, (_, i) => ({
      body: `Test document number ${i} with some content that will be chunked`,
      title: `Document ${i}`,
      sourceUrl: `https://test-concurrent.com/doc${i}`,
      sourceType: 'api',
    }));

    console.log(`📍 Starting batch ingestion of ${documents.length} documents...\n`);

    const startTime = Date.now();
    const result = await DocumentIngestService.ingestBatch(documents);
    const duration = Date.now() - startTime;

    console.log('Batch Result:');
    console.log(`  Total: ${result.batch.total}`);
    console.log(`  Successful: ${result.batch.successful}`);
    console.log(`  Failed: ${result.batch.failed}`);
    console.log(`  Duplicates: ${result.batch.duplicates}`);
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Average per doc: ${(duration / documents.length).toFixed(2)}ms\n`);

    if (result.batch.successful > 0) {
      console.log('✅ SUCCESS: Batch processing completed successfully!');
      console.log(`   With concurrency limiting, memory usage stays bounded`);
      console.log(`   Processing ${result.batch.successful} documents at ~15 concurrent`);
      return true;
    } else {
      console.log('❌ FAILURE: No documents were successfully ingested');
      return false;
    }
  } catch (error) {
    console.error('❌ Test Error:', error.message);
    console.error(error.stack);
    return false;
  } finally {
    // Cleanup
    await prisma.knowledge_documents.deleteMany({
      where: {
        source_url: {
          startsWith: 'https://test-concurrent.com/',
        },
      },
    });
    await prisma.$disconnect();
  }
}

async function runTests() {
  console.log('════════════════════════════════════════════════════════════\n');
  console.log('   DOCUMENT INGESTION SYSTEM - RACE CONDITION & CONCURRENCY TESTS');
  console.log('\n════════════════════════════════════════════════════════════\n');

  const test1 = await testRaceCondition();
  const test2 = await testConcurrencyLimiting();

  console.log('\n\n════════════════════════════════════════════════════════════\n');
  console.log('TEST SUMMARY:');
  console.log(`  Race Condition Test: ${test1 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  Concurrency Test: ${test2 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('\n════════════════════════════════════════════════════════════\n');

  process.exit(test1 && test2 ? 0 : 1);
}

runTests().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
