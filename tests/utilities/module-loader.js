/**
 * Module Loader Utility for Testing
 * 
 * Handles ES6 module loading in Jest testing environment
 * Transforms ES6 imports to CommonJS for compatibility
 */

const fs = require('fs');
const path = require('path');

class ModuleLoader {
    static transformES6ToCommonJS(content) {
        // Remove ES6 imports - they will be provided as globals
        content = content.replace(
            /import\s*{\s*([^}]+)\s*}\s*from\s*['"]([^'"]+)['"]\s*;?\s*/g,
            ''
        );
        
        content = content.replace(
            /import\s+(\w+)\s+from\s*['"]([^'"]+)['"]\s*;?\s*/g,
            ''
        );
        
        // Replace ES6 exports with CommonJS
        content = content.replace(
            /export\s*{\s*([^}]+)\s*}/g,
            'module.exports = { $1 }'
        );
        
        content = content.replace(
            /export\s+class\s+(\w+)/g,
            'class $1'
        );
        
        content = content.replace(
            /export\s+default\s+(\w+)/g,
            'module.exports = $1'
        );
        
        // Add module.exports at the end for class exports
        if (content.includes('class ') && !content.includes('module.exports')) {
            const classMatch = content.match(/class\s+(\w+)/);
            if (classMatch) {
                content += `\nmodule.exports = ${classMatch[1]};`;
            }
        }
        
        return content;
    }
    
    static createMockDependencies() {
        return {
            Toast: {
                success: jest.fn(),
                error: jest.fn(),
                info: jest.fn()
            },
            ErrorHandler: {
                logError: jest.fn()
            }
        };
    }
    
    static loadModule(modulePath, mockDependencies = {}) {
        const absolutePath = path.resolve(modulePath);
        const content = fs.readFileSync(absolutePath, 'utf8');
        
        // Transform ES6 to CommonJS
        const transformedContent = this.transformES6ToCommonJS(content);
        
        // Create mock environment
        const mockGlobals = {
            console: console,
            setTimeout: setTimeout,
            setInterval: setInterval,
            clearTimeout: clearTimeout,
            clearInterval: clearInterval,
            document: global.document,
            window: global.window,
            fetch: global.fetch,
            navigator: global.navigator,
            ...mockDependencies
        };
        
        // Create module context
        const moduleContext = {
            module: { exports: {} },
            exports: {},
            require: require,
            __filename: absolutePath,
            __dirname: path.dirname(absolutePath),
            ...mockGlobals
        };
        
        // Execute transformed code
        const func = new Function(...Object.keys(moduleContext), transformedContent);
        func.apply(null, Object.values(moduleContext));
        
        return moduleContext.module.exports;
    }
}

module.exports = ModuleLoader;