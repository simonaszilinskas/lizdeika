/**
 * Automated script to replace console.log/error/warn with Winston logger
 * For issue #51 - Replace console.log statements with Winston logger
 */

const fs = require('fs');
const path = require('path');

// List of files from grep results
const filesToProcess = [
    'custom-widget/backend/src/services/websocketService.js',
    'custom-widget/backend/src/utils/database.js',
    'custom-widget/backend/src/utils/errorHandler.js',
    'custom-widget/backend/src/utils/errors.js',
    'custom-widget/backend/src/utils/migrationManager.js',
    'custom-widget/backend/src/services/chains/VilniusPrompts.js',
    'custom-widget/backend/src/services/chains/VilniusRAGChain.js',
    'custom-widget/backend/src/services/chromaService.js',
    'custom-widget/backend/src/services/conversationService.js',
    'custom-widget/backend/src/services/documentService.js',
    'custom-widget/backend/src/services/knowledgeManagerService.js',
    'custom-widget/backend/src/services/knowledgeService.js',
    'custom-widget/backend/src/services/mistralEmbeddingFunction.js',
    'custom-widget/backend/src/services/promptManager.js',
    'custom-widget/backend/src/routes/templateRoutes.js',
    'custom-widget/backend/src/routes/uploadRoutes.js',
    'custom-widget/backend/src/services/activityService.js',
    'custom-widget/backend/src/services/agentService.js',
    'custom-widget/backend/src/services/aiCategorizationService.js',
    'custom-widget/backend/src/services/aiService.js',
    'custom-widget/backend/src/services/authService.js',
    'custom-widget/backend/src/services/chains/ChromaRetriever.js',
    'custom-widget/backend/src/services/chains/QueryRephraseChain.js',
    'custom-widget/backend/src/controllers/systemController.js',
    'custom-widget/backend/src/controllers/widgetController.js',
    'custom-widget/backend/src/middleware/authMiddleware.js',
    'custom-widget/backend/src/middleware/errorHandler.js',
    'custom-widget/backend/src/middleware/requestLogger.js',
    'custom-widget/backend/src/routes/systemRoutes.js',
    'custom-widget/backend/src/app.js',
    'custom-widget/backend/src/controllers/agentController.js',
    'custom-widget/backend/src/controllers/authController.js',
    'custom-widget/backend/src/controllers/categoryController.js',
    'custom-widget/backend/src/controllers/conversationController.js',
    'custom-widget/backend/src/controllers/knowledgeController.js',
    'custom-widget/backend/server.js',
    'custom-widget/backend/ai-providers.js'
];

let totalFiles = 0;
let totalReplacements = 0;
let skippedFiles = [];

console.log('Starting console.log replacement process...\n');

filesToProcess.forEach(relPath => {
    const filePath = path.join(__dirname, relPath);

    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Skipping (not found): ${relPath}`);
        skippedFiles.push(relPath);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Count console statements
    const consoleMatches = content.match(/console\.(log|error|warn|info|debug)/g);
    if (!consoleMatches || consoleMatches.length === 0) {
        return;
    }

    console.log(`Processing: ${relPath} (${consoleMatches.length} console statements)`);

    // Extract module name
    const moduleName = path.basename(relPath, '.js');

    // Check if logger is already imported
    const hasLoggerImport = content.includes("require('../utils/logger')") ||
                           content.includes("require('./utils/logger')") ||
                           content.includes("require('../../utils/logger')") ||
                           content.includes('createLogger');

    // Add logger import if not present
    if (!hasLoggerImport) {
        // Determine correct relative path to logger
        const depth = relPath.split('/').length - 3; // Subtract backend, src, and filename
        const relativePath = '../'.repeat(depth) + 'utils/logger';

        // Find the position after the last require statement
        const lines = content.split('\n');
        let insertIndex = 0;
        let lastRequireIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('require(') && !lines[i].trim().startsWith('//') && !lines[i].trim().startsWith('*')) {
                lastRequireIndex = i;
            }
        }

        if (lastRequireIndex >= 0) {
            insertIndex = lastRequireIndex + 1;
            lines.splice(insertIndex, 0, `const { createLogger } = require('${relativePath}');`, ``, `const logger = createLogger('${moduleName}');`);
            content = lines.join('\n');
        }
    }

    // Replace console statements
    // Note: This is a basic replacement. Complex multiline console statements may need manual review

    // Replace console.error - handle different patterns
    content = content.replace(/console\.error\(/g, 'logger.error(');

    // Replace console.warn
    content = content.replace(/console\.warn\(/g, 'logger.warn(');

    // Replace console.log - some might need to be info or debug
    // For now, replace all with logger.info
    content = content.replace(/console\.log\(/g, 'logger.info(');

    // Replace console.info
    content = content.replace(/console\.info\(/g, 'logger.info(');

    // Replace console.debug
    content = content.replace(/console\.debug\(/g, 'logger.debug(');

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        totalFiles++;
        totalReplacements += consoleMatches.length;
        console.log(`  ✓ Updated (${consoleMatches.length} replacements)\n`);
    }
});

console.log('========================================');
console.log(`Total files processed: ${totalFiles}`);
console.log(`Total replacements: ${totalReplacements}`);
if (skippedFiles.length > 0) {
    console.log(`Skipped files: ${skippedFiles.length}`);
    skippedFiles.forEach(f => console.log(`  - ${f}`));
}
console.log('========================================\n');
console.log('⚠️  IMPORTANT: Please manually review the changes to ensure:');
console.log('   1. Logger is properly imported in all files');
console.log('   2. Structured logging is used where beneficial');
console.log('   3. Error objects have .message and .stack properties logged');
console.log('   4. Complex multiline console statements are properly converted\n');
