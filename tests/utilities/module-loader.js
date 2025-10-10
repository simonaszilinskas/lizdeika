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
        // Handle destructuring imports and regular imports
        content = content.replace(
            /import\s*{\s*([^}]+)\s*}\s*from\s*['"]([^'"]+)['"]\s*;?\s*/g,
            ''
        );
        
        content = content.replace(
            /import\s+(\w+)\s+from\s*['"]([^'"]+)['"]\s*;?\s*/g,
            ''
        );
        
        // Handle const destructuring from imports
        content = content.replace(
            /const\s*{\s*([^}]+)\s*}\s*=\s*require\([^\)]+\);\s*/g,
            ''
        );
        
        // Replace export class with class and add module.exports
        content = content.replace(
            /export\s+class\s+(\w+)/g,
            'class $1'
        );
        
        // Replace export const CONSTANT = with const and add to module.exports
        content = content.replace(
            /export\s+const\s+(\w+)\s*=/g,
            'const $1 ='
        );
        
        // Replace export default with module.exports assignment
        content = content.replace(
            /export\s+default\s+(\w+)/g,
            'module.exports = $1'
        );
        
        // Handle export { ... } syntax
        content = content.replace(
            /export\s*{\s*([^}]+)\s*}/g,
            'module.exports = { $1 }'
        );
        
        // Find classes that need to be exported
        const classMatches = content.match(/class\s+(\w+)/g);
        if (classMatches && !content.includes('module.exports')) {
            const className = classMatches[0].replace('class ', '');
            content += `\nmodule.exports = ${className};`;
        }
        
        // Find constants that need to be exported
        const constantMatch = content.match(/const\s+([A-Z_]+)\s*=/);
        if (constantMatch && !content.includes('module.exports')) {
            const constantName = constantMatch[1];
            content += `\nmodule.exports = ${constantName};`;
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
            get document() { return global.document; },
            get window() { return global.window; },
            get fetch() { return global.fetch; },
            get navigator() { return global.navigator; },
            get localStorage() { return global.localStorage; },
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
