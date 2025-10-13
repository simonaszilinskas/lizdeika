#!/usr/bin/env node

/**
 * Script to replace console.log/error/warn statements with Winston logger
 * This handles the bulk replacement for issue #51
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files to process
const sourceFiles = glob.sync('src/**/*.js', { cwd: __dirname + '/..' });

let totalFiles = 0;
let totalReplacements = 0;

sourceFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Extract module name from file path for logger
    const moduleName = path.basename(file, '.js');

    // Check if logger is already imported
    const hasLoggerImport = content.includes("require('../utils/logger')") ||
                           content.includes("require('./utils/logger')") ||
                           content.includes('createLogger');

    // Count console statements before replacement
    const consoleMatches = content.match(/console\.(log|error|warn|info|debug)/g);
    if (!consoleMatches || consoleMatches.length === 0) {
        return; // Skip files with no console statements
    }

    console.log(`\nProcessing: ${file} (${consoleMatches.length} console statements)`);

    // Add logger import if not present
    if (!hasLoggerImport) {
        // Find the last require statement
        const requireRegex = /const .+ = require\(.+\);/g;
        const requires = content.match(requireRegex);

        if (requires && requires.length > 0) {
            const lastRequire = requires[requires.length - 1];
            const loggerImport = `\nconst { createLogger } = require('../utils/logger');\n\nconst logger = createLogger('${moduleName}');`;
            content = content.replace(lastRequire, lastRequire + loggerImport);
        } else {
            // No requires found, add at top after comments
            const lines = content.split('\n');
            let insertIndex = 0;
            for (let i = 0; i < lines.length; i++) {
                if (!lines[i].trim().startsWith('*') &&
                    !lines[i].trim().startsWith('//') &&
                    !lines[i].trim().startsWith('/*') &&
                    lines[i].trim() !== '') {
                    insertIndex = i;
                    break;
                }
            }
            lines.splice(insertIndex, 0, `const { createLogger } = require('../utils/logger');`, `const logger = createLogger('${moduleName}');`, '');
            content = lines.join('\n');
        }
    }

    // Replace console.log statements
    // Simple cases: console.log('message')
    content = content.replace(/console\.log\((['"`])([^'"`]+)\1\);/g, (match, quote, message) => {
        return `logger.info('${message.replace(/^[📋🔧✅❌⚠️ℹ️🚀🛑⏸️🔄⏭️🤖═─📊📝🎯🔍]+\\s*/, '')}');`;
    });

    // console.error statements
    content = content.replace(/console\.error\((['"`])([^'"`]+)\1,?\s*([^)]*)\);/g, (match, quote, message, args) => {
        const cleanMessage = message.replace(/^[📋🔧✅❌⚠️ℹ️🚀🛑⏸️🔄⏭️🤖═─📊📝🎯🔍]+\\s*/, '');
        if (args.trim()) {
            return `logger.error('${cleanMessage}', { error: ${args.includes('error') ? 'error.message' : args}, stack: ${args}.stack });`;
        }
        return `logger.error('${cleanMessage}');`;
    });

    // console.warn statements
    content = content.replace(/console\.warn\((['"`])([^'"`]+)\1,?\s*([^)]*)\);/g, (match, quote, message, args) => {
        const cleanMessage = message.replace(/^[📋🔧✅❌⚠️ℹ️🚀🛑⏸️🔄⏭️🤖═─📊📝🎯🔍]+\\s*/, '');
        if (args.trim()) {
            return `logger.warn('${cleanMessage}', { ${args} });`;
        }
        return `logger.warn('${cleanMessage}');`;
    });

    // Template literal cases
    content = content.replace(/console\.log\(`([^`]+)`\);/g, (match, message) => {
        // Convert template literal to string concatenation for logger
        const cleanMessage = message.replace(/^[📋🔧✅❌⚠️ℹ️🚀🛑⏸️🔄⏭️🤖═─📊📝🎯🔍]+\\s*/, '');
        return `logger.info(\`${cleanMessage}\`);`;
    });

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        totalFiles++;
        totalReplacements += consoleMatches.length;
        console.log(`  ✓ Replaced ${consoleMatches.length} statements`);
    }
});

console.log(`\n========================================`);
console.log(`Total files processed: ${totalFiles}`);
console.log(`Total replacements: ${totalReplacements}`);
console.log(`========================================\n`);
