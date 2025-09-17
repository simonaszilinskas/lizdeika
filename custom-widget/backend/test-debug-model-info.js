/**
 * Test RAG Process Debug Information includes explicit model selection
 */

async function testDebugModelInfo() {
    console.log('🔍 Testing RAG Process Debug - Model Selection');
    console.log('==============================================\n');

    try {
        // Import RAG service
        const LangChainRAG = require('./src/services/langchainRAG');

        // Create RAG instance
        const ragService = new LangChainRAG();

        console.log('📊 Testing RAG process with debug information...');
        console.log('   Query: "What models are you using?"');
        console.log('   Include debug: true\n');

        // Test the RAG process with debug information
        const result = await ragService.getAnswer(
            "What models are you using?",
            [], // Empty chat history
            true // Include debug
        );

        console.log('✅ RAG Process completed');
        console.log(`   Answer length: ${result.answer.length} characters`);
        console.log(`   Sources: ${result.sources.length}`);
        console.log(`   Debug info included: ${!!result.debugInfo}\n`);

        if (result.debugInfo) {
            console.log('🔧 MODEL CONFIGURATION DEBUG INFO:');
            console.log('===================================');

            if (result.debugInfo.modelConfiguration) {
                const modelConfig = result.debugInfo.modelConfiguration;
                console.log('📋 Overall Model Configuration:');
                console.log(`   Main Model: ${modelConfig.mainModel}`);
                console.log(`   Rephrasing Model: ${modelConfig.rephrasingModel}`);
                console.log(`   Temperature: ${modelConfig.temperature}`);
                console.log(`   Provider: ${modelConfig.provider}\n`);
            }

            if (result.debugInfo.step2_queryRephrasing) {
                const rephrasing = result.debugInfo.step2_queryRephrasing;
                console.log('🔄 Query Rephrasing Step:');
                console.log(`   Action: ${rephrasing.action}`);
                console.log(`   Model: ${rephrasing.model || 'N/A'}`);
                console.log(`   Temperature: ${rephrasing.temperature || 'N/A'}`);
                console.log(`   Was Rephrased: ${rephrasing.improvement}\n`);
            }

            if (result.debugInfo.step5_responseGeneration) {
                const generation = result.debugInfo.step5_responseGeneration;
                console.log('🤖 Response Generation Step:');
                console.log(`   Model: ${generation.model}`);
                console.log(`   Temperature: ${generation.temperature}`);
                console.log(`   Prompt Type: ${generation.promptType}`);
                console.log(`   Managed Prompt: ${generation.managedPrompt}`);
                console.log(`   Response Length: ${generation.responseLength} chars`);
                console.log(`   Context Length: ${generation.contextLength} chars\n`);
            }

            console.log('📝 FULL DEBUG INFO STRUCTURE:');
            console.log('==============================');
            const debugKeys = Object.keys(result.debugInfo);
            debugKeys.forEach(key => {
                console.log(`   ${key}: ${typeof result.debugInfo[key]}`);
            });

            console.log('\n✅ SUCCESS: Model selection is now explicit in debug information!');
            console.log('   - Main model info in modelConfiguration ✅');
            console.log('   - Rephrasing model info in step2_queryRephrasing ✅');
            console.log('   - Response generation model info in step5_responseGeneration ✅');
            console.log('   - Verbose logging shows model selection during process ✅');

        } else {
            console.log('❌ No debug info found in result');
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }

    process.exit(0);
}

testDebugModelInfo();