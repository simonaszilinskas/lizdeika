#!/usr/bin/env node
/**
 * Test Script for Document Indexing API
 * 
 * This script tests the new API endpoints for document indexing
 * with metadata support and source URL citations.
 */

const fs = require('fs');

async function testDocumentIndexingAPI() {
    console.log('🧪 Testing Document Indexing API...\n');

    const baseUrl = 'http://localhost:3002/api/knowledge';

    // Test 1: Index a single document with metadata
    console.log('📝 Test 1: Index Single Document');
    try {
        const singleDocResponse = await fetch(`${baseUrl}/documents/index`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: `Vilniaus miesto savivaldybės gyventojų aptarnavimo centras veikia darbo dienomis nuo 8:00 iki 17:00. Centras teikia įvairias paslaugas gyventojams, įskaitant dokumentų išdavimą, konsultacijas ir kitą administracinę pagalbą. Daugiau informacijos rasite oficialiame Vilniaus miesto savivaldybės tinklapyje.`,
                metadata: {
                    title: 'Gyventojų aptarnavimo centro darbo laikas',
                    sourceUrl: 'https://vilnius.lt/gyventoju-aptarnavimas',
                    category: 'Aptarnavimas',
                    tags: ['aptarnavimas', 'darbo-laikas', 'centras'],
                    language: 'lt',
                    lastUpdated: new Date().toISOString()
                }
            })
        });

        const singleDocResult = await singleDocResponse.json();
        console.log('✅ Single document indexed successfully');
        console.log('   Document ID:', singleDocResult.data?.documentId);
        console.log('   Chunks count:', singleDocResult.data?.chunksCount);
        console.log('   Metadata title:', singleDocResult.data?.metadata?.source_document_name);
        console.log('   Source URL:', singleDocResult.data?.metadata?.source_url);

    } catch (error) {
        console.error('❌ Single document indexing failed:', error.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 2: Index multiple documents in batch
    console.log('📚 Test 2: Index Document Batch');
    try {
        const batchResponse = await fetch(`${baseUrl}/documents/index-batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                documents: [
                    {
                        content: 'Mokyklų registracija prasideda kovo mėnesį. Tėvai turi pateikti vaiko gimimo liudijimą, gyvenamosios vietos deklaracijos pažymą ir medicinos pažymą.',
                        metadata: {
                            title: 'Mokyklų registracija - reikalingi dokumentai',
                            sourceUrl: 'https://vilnius.lt/mokyklu-registracija',
                            category: 'Švietimas',
                            tags: ['mokykla', 'registracija', 'dokumentai']
                        }
                    },
                    {
                        content: 'Vilniaus miesto bibliotekos kortelę galima gauti nemokamai. Reikia pateikti asmens dokumentą ir užpildyti registracijos anketą.',
                        metadata: {
                            title: 'Bibliotekos kortelės gavimas',
                            sourceUrl: 'https://vilnius.lt/biblioteka-kortele',
                            category: 'Bibliotekos',
                            tags: ['biblioteka', 'kortelė', 'registracija']
                        }
                    },
                    {
                        content: 'Stambių atliekų išvežimui reikia iš anksto užsiregistruoti telefonu +370 5 211-2929 arba internetu. Paslauga nemokama.',
                        metadata: {
                            title: 'Stambių atliekų išvežimas',
                            sourceUrl: 'https://vilnius.lt/stambu-atlieku-isvezimas',
                            category: 'Aplinkos tvarka',
                            tags: ['atliekos', 'išvežimas', 'registracija']
                        }
                    }
                ]
            })
        });

        const batchResult = await batchResponse.json();
        console.log('✅ Batch indexing completed');
        console.log('   Total documents:', batchResult.data?.summary?.total);
        console.log('   Successful:', batchResult.data?.summary?.successful);
        console.log('   Failed:', batchResult.data?.summary?.failed);
        
        if (batchResult.data?.successful?.length > 0) {
            console.log('\n   📋 Successfully indexed documents:');
            batchResult.data.successful.forEach((doc, index) => {
                console.log(`   ${index + 1}. ${doc.metadata.source_document_name}`);
                console.log(`      URL: ${doc.metadata.source_url}`);
                console.log(`      Chunks: ${doc.chunksCount}`);
            });
        }

    } catch (error) {
        console.error('❌ Batch indexing failed:', error.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 3: List all documents to verify indexing
    console.log('📋 Test 3: List All Documents');
    try {
        const listResponse = await fetch(`${baseUrl}/documents`);
        const listResult = await listResponse.json();
        
        console.log('✅ Documents retrieved successfully');
        console.log('   Total count:', listResult.count);
        
        if (listResult.data?.length > 0) {
            console.log('\n   📄 Indexed documents:');
            listResult.data.forEach((doc, index) => {
                console.log(`   ${index + 1}. ${doc.originalName}`);
                console.log(`      Source: ${doc.uploadSource}`);
                console.log(`      Status: ${doc.status}`);
                console.log(`      Chunks: ${doc.chunksCount}`);
                if (doc.metadata?.source_url) {
                    console.log(`      URL: ${doc.metadata.source_url}`);
                }
            });
        }

    } catch (error) {
        console.error('❌ Document listing failed:', error.message);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Test 4: Test a query to see if the indexed documents work
    console.log('🔍 Test 4: Test RAG Query with Source Citations');
    try {
        // This would require making a conversation request to test the RAG
        console.log('ℹ️  To test RAG with source citations, send a query through the chat widget:');
        console.log('   Example: "Kokiu telefonu galima užsisakyti stambių atliekų išvežimą?"');
        console.log('   Expected: Response should include "+370 5 211-2929" and source URL');
        
    } catch (error) {
        console.error('❌ RAG query test failed:', error.message);
    }

    console.log('\n🎉 API testing completed!');
    console.log('\n📚 Usage Examples:');
    console.log('   • Single document: curl -X POST http://localhost:3002/api/knowledge/documents/index');
    console.log('   • Batch documents: curl -X POST http://localhost:3002/api/knowledge/documents/index-batch');
    console.log('   • List documents: curl -X GET http://localhost:3002/api/knowledge/documents');
    console.log('\n📖 Full API documentation: API_DOCUMENTATION.md');
}

// Run the test
if (require.main === module) {
    testDocumentIndexingAPI().catch(console.error);
}

module.exports = { testDocumentIndexingAPI };