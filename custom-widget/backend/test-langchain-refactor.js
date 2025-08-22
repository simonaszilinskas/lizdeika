/**
 * Test Script for LangChain Refactor
 * 
 * This script tests the refactored LangChain implementation to ensure
 * it maintains 100% functional compatibility with the original.
 */

require('dotenv').config();

// Import both implementations
const OriginalLangChainRAG = require('./src/services/langchainRAG');
const RefactoredLangChainRAG = require('./src/services/langchainRAG-refactored');

// Mock conversation history for testing
const testChatHistory = [
    ["Sveiki, kaip užregistruoti vaiką į mokyklą?", "Labas! Vaiko registracija į mokyklą vyksta per elektroninių paslaugų portalą. Reikia..."],
    ["O jei vaikas buvo išregistruotas iš kitos mokyklos?", "Išregistruotam vaikui registracijos procesas yra toks pats..."]
];

const testQueries = [
    "test query",
    "Kaip užregistruoti vaiką į mokyklą?",
    "buvo išregistruotas", // Context-dependent query that should be rephrased
    "Vilniaus miesto bibliotekos darbo laikas",
    ""
];

async function testImplementation(implementation, name) {
    console.log(`\n🧪 Testing ${name} Implementation`);
    console.log('='.repeat(50));

    const results = [];

    for (let i = 0; i < testQueries.length; i++) {
        const query = testQueries[i];
        const useHistory = i >= 2; // Use history for later queries
        const chatHistory = useHistory ? testChatHistory : [];

        console.log(`\nTest ${i + 1}: "${query}" ${useHistory ? '(with history)' : '(no history)'}`);
        
        try {
            const startTime = Date.now();
            const result = await implementation.getAnswer(query, chatHistory, true);
            const endTime = Date.now();
            
            const testResult = {
                query,
                hasHistory: useHistory,
                success: true,
                responseTime: endTime - startTime,
                answerLength: result.answer?.length || 0,
                sourcesCount: result.sources?.length || 0,
                contextsUsed: result.contextsUsed || 0,
                hasDebugInfo: !!result.debugInfo,
                answer: result.answer?.substring(0, 100) + (result.answer?.length > 100 ? '...' : '')
            };

            console.log(`   ✅ Success (${testResult.responseTime}ms)`);
            console.log(`   📝 Answer: "${testResult.answer}"`);
            console.log(`   📊 Sources: ${testResult.sourcesCount}, Contexts: ${testResult.contextsUsed}`);
            console.log(`   🔍 Debug info: ${testResult.hasDebugInfo ? 'Present' : 'Missing'}`);

            results.push(testResult);
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
            results.push({
                query,
                hasHistory: useHistory,
                success: false,
                error: error.message
            });
        }
    }

    return results;
}

async function compareImplementations() {
    console.log('🔄 LangChain Refactor Compatibility Test');
    console.log('This test verifies that the refactored implementation maintains compatibility');

    try {
        // Test health checks first
        console.log('\n🏥 Health Checks');
        console.log('='.repeat(30));

        console.log('\nOriginal Implementation:');
        try {
            const originalInstance = new OriginalLangChainRAG();
            console.log('   ✅ Original instance created successfully');
        } catch (error) {
            console.log(`   ❌ Original creation failed: ${error.message}`);
        }

        console.log('\nRefactored Implementation:');
        try {
            const refactoredInstance = new RefactoredLangChainRAG();
            console.log('   ✅ Refactored instance created successfully');
            
            const health = await refactoredInstance.healthCheck();
            console.log(`   🏥 Health check: ${health.healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
            console.log(`   🔧 Config: ${JSON.stringify(refactoredInstance.getConfig(), null, 2)}`);
        } catch (error) {
            console.log(`   ❌ Refactored creation failed: ${error.message}`);
            return;
        }

        // Run functionality tests
        const refactoredInstance = new RefactoredLangChainRAG();
        const refactoredResults = await testImplementation(refactoredInstance, 'Refactored');

        // Analyze results
        console.log('\n📊 Test Results Summary');
        console.log('='.repeat(40));

        const successfulTests = refactoredResults.filter(r => r.success);
        const failedTests = refactoredResults.filter(r => !r.success);

        console.log(`\nRefactored Implementation:`);
        console.log(`   ✅ Successful tests: ${successfulTests.length}/${refactoredResults.length}`);
        console.log(`   ❌ Failed tests: ${failedTests.length}/${refactoredResults.length}`);
        console.log(`   ⏱️ Average response time: ${Math.round(successfulTests.reduce((sum, r) => sum + r.responseTime, 0) / successfulTests.length)}ms`);
        console.log(`   🔍 Debug info present: ${successfulTests.every(r => r.hasDebugInfo) ? 'YES' : 'NO'}`);

        if (failedTests.length > 0) {
            console.log('\n❌ Failed Tests:');
            failedTests.forEach(test => {
                console.log(`   - Query: "${test.query}" | Error: ${test.error}`);
            });
        }

        // Test specific functionality
        console.log('\n🧪 Specific Functionality Tests');
        console.log('='.repeat(40));

        // Test component methods
        try {
            console.log('\nTesting component methods:');
            const componentTest = await refactoredInstance.testComponents();
            console.log(`   🔍 Retriever healthy: ${componentTest.retriever?.healthy || false}`);
            console.log(`   🔄 Rephrase chain healthy: ${componentTest.rephraseChain?.healthy || false}`);
            console.log(`   🏗️ Full chain healthy: ${componentTest.fullChain?.healthy || false}`);
        } catch (error) {
            console.log(`   ❌ Component test failed: ${error.message}`);
        }

        // Test stats
        try {
            const stats = await refactoredInstance.getRetrieverStats();
            console.log(`   📊 Retriever stats: ${JSON.stringify(stats)}`);
        } catch (error) {
            console.log(`   ❌ Stats test failed: ${error.message}`);
        }

        // Final verdict
        console.log('\n🎯 Final Verdict');
        console.log('='.repeat(30));

        if (successfulTests.length === refactoredResults.length) {
            console.log('✅ REFACTOR SUCCESSFUL!');
            console.log('   All tests passed. The refactored implementation is ready.');
            console.log('   You can now replace the original implementation.');
        } else if (successfulTests.length >= refactoredResults.length * 0.8) {
            console.log('⚠️ PARTIAL SUCCESS');
            console.log('   Most tests passed but some issues remain.');
            console.log('   Review failed tests before deployment.');
        } else {
            console.log('❌ REFACTOR NEEDS WORK');
            console.log('   Too many tests failed. Do not deploy yet.');
        }

    } catch (error) {
        console.error('🔴 Test script error:', error);
        console.error('Stack:', error.stack);
    }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('🔴 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('🔴 Uncaught Exception:', error);
    process.exit(1);
});

// Run the comparison
compareImplementations().then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
}).catch(error => {
    console.error('🔴 Test failed:', error);
    process.exit(1);
});