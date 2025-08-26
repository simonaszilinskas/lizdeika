/**
 * Phase 5A: Deep Codebase Analysis Tool
 * Analyzes the monolithic vanilla JavaScript codebase to understand dependencies,
 * functions, event listeners, DOM manipulations, and API calls
 */

const fs = require('fs');
const path = require('path');

class CodebaseAnalyzer {
    constructor(rootPath) {
        this.rootPath = rootPath;
        this.results = {
            summary: {},
            files: {},
            functions: {},
            classes: {},
            eventListeners: {},
            domManipulations: {},
            apiCalls: {},
            dependencies: {},
            cssSelectors: {},
            globalVariables: {},
            webSocketEvents: {},
            localStorageOperations: {},
            modalOperations: {},
            formOperations: {},
            riskAssessment: {}
        };
    }

    /**
     * Main analysis method
     */
    async analyze() {
        console.log('🔍 Starting Deep Codebase Analysis...');
        
        const jsFiles = this.findJavaScriptFiles();
        const htmlFiles = this.findHTMLFiles();
        
        console.log(`📁 Found ${jsFiles.length} JavaScript files and ${htmlFiles.length} HTML files`);
        
        // Analyze JavaScript files
        for (const file of jsFiles) {
            console.log(`🔬 Analyzing: ${path.relative(this.rootPath, file)}`);
            await this.analyzeJavaScriptFile(file);
        }
        
        // Analyze HTML files for inline JS and DOM structure
        for (const file of htmlFiles) {
            console.log(`📄 Analyzing HTML: ${path.relative(this.rootPath, file)}`);
            await this.analyzeHTMLFile(file);
        }
        
        // Generate dependency graph
        this.generateDependencyGraph();
        
        // Perform risk assessment
        this.performRiskAssessment();
        
        // Generate summary
        this.generateSummary();
        
        console.log('✅ Analysis complete!');
        return this.results;
    }

    /**
     * Find all JavaScript files
     */
    findJavaScriptFiles() {
        const jsFiles = [];
        
        // Focus on main JS files only
        const mainJSFiles = [
            path.join(this.rootPath, 'custom-widget/js/agent-dashboard.js'),
            path.join(this.rootPath, 'custom-widget/js/settings.js'),
            path.join(this.rootPath, 'custom-widget/js/chat.js')
        ];
        
        // Add modules directory
        const modulesPath = path.join(this.rootPath, 'custom-widget/js/modules');
        if (fs.existsSync(modulesPath)) {
            const moduleFiles = fs.readdirSync(modulesPath)
                .filter(file => file.endsWith('.js'))
                .map(file => path.join(modulesPath, file));
            jsFiles.push(...moduleFiles);
        }
        
        // Add main files that exist
        mainJSFiles.forEach(filePath => {
            if (fs.existsSync(filePath)) {
                jsFiles.push(filePath);
            }
        });
        
        return jsFiles;
    }

    /**
     * Find all HTML files
     */
    findHTMLFiles() {
        const htmlFiles = [];
        const mainHTMLFiles = [
            path.join(this.rootPath, 'custom-widget/agent-dashboard.html'),
            path.join(this.rootPath, 'custom-widget/settings.html'),
            path.join(this.rootPath, 'custom-widget/chat.html'),
            path.join(this.rootPath, 'custom-widget/login.html')
        ];
        
        mainHTMLFiles.forEach(filePath => {
            if (fs.existsSync(filePath)) {
                htmlFiles.push(filePath);
            }
        });
        
        return htmlFiles;
    }

    /**
     * Recursively walk directory
     */
    walkDirectory(dir, callback) {
        const files = fs.readdirSync(dir);
        
        files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
                this.walkDirectory(filePath, callback);
            } else {
                callback(filePath);
            }
        });
    }

    /**
     * Analyze a JavaScript file
     */
    async analyzeJavaScriptFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(this.rootPath, filePath);
        const fileName = path.basename(filePath);
        
        const fileAnalysis = {
            path: relativePath,
            size: content.length,
            lines: content.split('\n').length,
            functions: [],
            classes: [],
            eventListeners: [],
            domManipulations: [],
            apiCalls: [],
            dependencies: [],
            cssSelectors: [],
            globalVariables: [],
            webSocketEvents: [],
            localStorageOperations: [],
            modalOperations: [],
            formOperations: [],
            complexity: 0
        };

        // Analyze functions
        this.analyzeFunctions(content, fileAnalysis);
        
        // Analyze classes
        this.analyzeClasses(content, fileAnalysis);
        
        // Analyze event listeners
        this.analyzeEventListeners(content, fileAnalysis);
        
        // Analyze DOM manipulations
        this.analyzeDOMManipulations(content, fileAnalysis);
        
        // Analyze API calls
        this.analyzeAPICalls(content, fileAnalysis);
        
        // Analyze CSS selectors
        this.analyzeCSSSelectors(content, fileAnalysis);
        
        // Analyze global variables
        this.analyzeGlobalVariables(content, fileAnalysis);
        
        // Analyze WebSocket events
        this.analyzeWebSocketEvents(content, fileAnalysis);
        
        // Analyze localStorage operations
        this.analyzeLocalStorageOperations(content, fileAnalysis);
        
        // Analyze modal operations
        this.analyzeModalOperations(content, fileAnalysis);
        
        // Analyze form operations
        this.analyzeFormOperations(content, fileAnalysis);
        
        // Calculate complexity
        this.calculateComplexity(content, fileAnalysis);
        
        this.results.files[fileName] = fileAnalysis;
    }

    /**
     * Analyze functions in the code
     */
    analyzeFunctions(content, fileAnalysis) {
        // Function declarations
        const functionDeclarations = content.matchAll(/(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{/g);
        for (const match of functionDeclarations) {
            const functionInfo = {
                name: match[1],
                type: 'declaration',
                async: match[0].includes('async'),
                line: this.getLineNumber(content, match.index)
            };
            fileAnalysis.functions.push(functionInfo);
            this.results.functions[match[1]] = functionInfo;
        }
        
        // Method definitions in classes/objects
        const methodDefinitions = content.matchAll(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/g);
        for (const match of methodDefinitions) {
            if (!match[0].startsWith('function')) {
                const methodInfo = {
                    name: match[1],
                    type: 'method',
                    async: match[0].includes('async'),
                    line: this.getLineNumber(content, match.index)
                };
                fileAnalysis.functions.push(methodInfo);
            }
        }
        
        // Arrow functions
        const arrowFunctions = content.matchAll(/(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g);
        for (const match of arrowFunctions) {
            const functionInfo = {
                name: match[1],
                type: 'arrow',
                async: match[0].includes('async'),
                line: this.getLineNumber(content, match.index)
            };
            fileAnalysis.functions.push(functionInfo);
        }
    }

    /**
     * Analyze classes in the code
     */
    analyzeClasses(content, fileAnalysis) {
        const classes = content.matchAll(/class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{/g);
        for (const match of classes) {
            const classInfo = {
                name: match[1],
                extends: match[2] || null,
                line: this.getLineNumber(content, match.index)
            };
            fileAnalysis.classes.push(classInfo);
            this.results.classes[match[1]] = classInfo;
        }
    }

    /**
     * Analyze event listeners
     */
    analyzeEventListeners(content, fileAnalysis) {
        // addEventListener
        const addEventListeners = content.matchAll(/(\w+)\.addEventListener\s*\(\s*['"`](\w+)['"`]\s*,\s*([^)]+)\)/g);
        for (const match of addEventListeners) {
            const eventInfo = {
                element: match[1],
                event: match[2],
                handler: match[3].trim(),
                type: 'addEventListener',
                line: this.getLineNumber(content, match.index)
            };
            fileAnalysis.eventListeners.push(eventInfo);
        }
        
        // onclick, onload, etc.
        const inlineEvents = content.matchAll(/(\w+)\.on(\w+)\s*=\s*([^;]+)/g);
        for (const match of inlineEvents) {
            const eventInfo = {
                element: match[1],
                event: match[2],
                handler: match[3].trim(),
                type: 'inline',
                line: this.getLineNumber(content, match.index)
            };
            fileAnalysis.eventListeners.push(eventInfo);
        }
    }

    /**
     * Analyze DOM manipulations
     */
    analyzeDOMManipulations(content, fileAnalysis) {
        const domPatterns = [
            { pattern: /(\w+)\.innerHTML\s*=/g, type: 'innerHTML', risk: 'high' },
            { pattern: /(\w+)\.textContent\s*=/g, type: 'textContent', risk: 'low' },
            { pattern: /(\w+)\.appendChild\s*\(/g, type: 'appendChild', risk: 'medium' },
            { pattern: /(\w+)\.removeChild\s*\(/g, type: 'removeChild', risk: 'medium' },
            { pattern: /(\w+)\.classList\.(add|remove|toggle)/g, type: 'classList', risk: 'low' },
            { pattern: /(\w+)\.style\.(\w+)\s*=/g, type: 'style', risk: 'low' },
            { pattern: /document\.createElement\s*\(/g, type: 'createElement', risk: 'medium' },
            { pattern: /document\.getElementById\s*\(/g, type: 'getElementById', risk: 'low' },
            { pattern: /document\.querySelector(All)?\s*\(/g, type: 'querySelector', risk: 'low' }
        ];
        
        domPatterns.forEach(({ pattern, type, risk }) => {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                const domInfo = {
                    type,
                    element: match[1] || 'document',
                    operation: match[0],
                    risk,
                    line: this.getLineNumber(content, match.index)
                };
                fileAnalysis.domManipulations.push(domInfo);
            }
        });
    }

    /**
     * Analyze API calls
     */
    analyzeAPICalls(content, fileAnalysis) {
        // fetch calls
        const fetchCalls = content.matchAll(/fetch\s*\(\s*(['"`][^'"`]+['"`]|[^,)]+)/g);
        for (const match of fetchCalls) {
            const apiInfo = {
                type: 'fetch',
                url: match[1].replace(/['"`]/g, ''),
                line: this.getLineNumber(content, match.index)
            };
            fileAnalysis.apiCalls.push(apiInfo);
        }
        
        // XMLHttpRequest
        const xhrCalls = content.matchAll(/new\s+XMLHttpRequest/g);
        for (const match of xhrCalls) {
            const apiInfo = {
                type: 'XMLHttpRequest',
                line: this.getLineNumber(content, match.index)
            };
            fileAnalysis.apiCalls.push(apiInfo);
        }
    }

    /**
     * Analyze CSS selectors used in JavaScript
     */
    analyzeCSSSelectors(content, fileAnalysis) {
        const selectorPatterns = [
            /getElementById\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /querySelector\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /querySelectorAll\s*\(\s*['"`]([^'"`]+)['"`]/g
        ];
        
        selectorPatterns.forEach(pattern => {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                const selectorInfo = {
                    selector: match[1],
                    line: this.getLineNumber(content, match.index)
                };
                fileAnalysis.cssSelectors.push(selectorInfo);
            }
        });
    }

    /**
     * Analyze global variables
     */
    analyzeGlobalVariables(content, fileAnalysis) {
        const globalPatterns = [
            /window\.(\w+)\s*=/g,
            /var\s+(\w+)\s*=/g,
            /let\s+(\w+)\s*=/g,
            /const\s+(\w+)\s*=/g
        ];
        
        globalPatterns.forEach(pattern => {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                const varInfo = {
                    name: match[1],
                    line: this.getLineNumber(content, match.index)
                };
                fileAnalysis.globalVariables.push(varInfo);
            }
        });
    }

    /**
     * Analyze WebSocket events
     */
    analyzeWebSocketEvents(content, fileAnalysis) {
        const wsPatterns = [
            /socket\.on\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /socket\.emit\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /io\s*\(/g
        ];
        
        wsPatterns.forEach((pattern, index) => {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                const wsInfo = {
                    type: index === 0 ? 'listener' : index === 1 ? 'emit' : 'connection',
                    event: match[1] || null,
                    line: this.getLineNumber(content, match.index)
                };
                fileAnalysis.webSocketEvents.push(wsInfo);
            }
        });
    }

    /**
     * Analyze localStorage operations
     */
    analyzeLocalStorageOperations(content, fileAnalysis) {
        const storagePatterns = [
            /localStorage\.getItem\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /localStorage\.setItem\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /localStorage\.removeItem\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /sessionStorage\.getItem\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /sessionStorage\.setItem\s*\(\s*['"`]([^'"`]+)['"`]/g
        ];
        
        storagePatterns.forEach((pattern, index) => {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                const storageInfo = {
                    type: index < 3 ? 'localStorage' : 'sessionStorage',
                    operation: pattern.source.includes('getItem') ? 'get' : 
                              pattern.source.includes('setItem') ? 'set' : 'remove',
                    key: match[1],
                    line: this.getLineNumber(content, match.index)
                };
                fileAnalysis.localStorageOperations.push(storageInfo);
            }
        });
    }

    /**
     * Analyze modal operations
     */
    analyzeModalOperations(content, fileAnalysis) {
        const modalPatterns = [
            /(\w+)\.classList\.(add|remove)\s*\(\s*['"`]hidden['"`]/g,
            /(\w+Modal)/g,
            /openModal|closeModal/g
        ];
        
        modalPatterns.forEach(pattern => {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                const modalInfo = {
                    operation: match[0],
                    line: this.getLineNumber(content, match.index)
                };
                fileAnalysis.modalOperations.push(modalInfo);
            }
        });
    }

    /**
     * Analyze form operations
     */
    analyzeFormOperations(content, fileAnalysis) {
        const formPatterns = [
            /addEventListener\s*\(\s*['"`]submit['"`]/g,
            /\.value\s*=/g,
            /\.value(?!\s*=)/g,
            /FormData/g,
            /preventDefault/g
        ];
        
        formPatterns.forEach(pattern => {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                const formInfo = {
                    operation: match[0],
                    line: this.getLineNumber(content, match.index)
                };
                fileAnalysis.formOperations.push(formInfo);
            }
        });
    }

    /**
     * Calculate code complexity metrics
     */
    calculateComplexity(content, fileAnalysis) {
        const complexityFactors = {
            functions: fileAnalysis.functions.length,
            eventListeners: fileAnalysis.eventListeners.length,
            domManipulations: fileAnalysis.domManipulations.length,
            apiCalls: fileAnalysis.apiCalls.length,
            conditionals: (content.match(/if\s*\(/g) || []).length,
            loops: (content.match(/(for|while)\s*\(/g) || []).length,
            tryCatch: (content.match(/try\s*\{/g) || []).length,
            lines: fileAnalysis.lines
        };
        
        // Calculate weighted complexity score
        fileAnalysis.complexity = 
            complexityFactors.functions * 2 +
            complexityFactors.eventListeners * 3 +
            complexityFactors.domManipulations * 2 +
            complexityFactors.apiCalls * 4 +
            complexityFactors.conditionals * 1 +
            complexityFactors.loops * 2 +
            complexityFactors.tryCatch * 1 +
            Math.floor(complexityFactors.lines / 50);
    }

    /**
     * Analyze HTML file
     */
    async analyzeHTMLFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(this.rootPath, filePath);
        
        // Extract inline JavaScript
        const inlineJS = content.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        if (inlineJS) {
            for (const script of inlineJS) {
                const jsContent = script.replace(/<\/?script[^>]*>/gi, '');
                // Analyze inline JS similar to JS files
                // (simplified for this implementation)
            }
        }
        
        // Extract script src references
        const scriptRefs = content.match(/<script[^>]*src=['"`]([^'"`]+)['"`]/gi);
        if (scriptRefs) {
            // Track script dependencies
        }
    }

    /**
     * Generate dependency graph
     */
    generateDependencyGraph() {
        // Create relationships between functions, classes, and files
        // This is a simplified version - would need more sophisticated parsing
        Object.keys(this.results.files).forEach(fileName => {
            const file = this.results.files[fileName];
            this.results.dependencies[fileName] = {
                functions: file.functions.map(f => f.name),
                classes: file.classes.map(c => c.name),
                dependencies: [] // Would need to analyze imports/requires
            };
        });
    }

    /**
     * Perform risk assessment
     */
    performRiskAssessment() {
        let totalRiskScore = 0;
        let riskFactors = [];
        
        Object.keys(this.results.files).forEach(fileName => {
            const file = this.results.files[fileName];
            let fileRisk = 0;
            
            // High risk: innerHTML usage (XSS potential)
            const innerHTMLCount = file.domManipulations.filter(d => d.type === 'innerHTML').length;
            if (innerHTMLCount > 0) {
                fileRisk += innerHTMLCount * 10;
                riskFactors.push(`${fileName}: ${innerHTMLCount} innerHTML operations`);
            }
            
            // Medium risk: Complex event handling
            if (file.eventListeners.length > 10) {
                fileRisk += 5;
                riskFactors.push(`${fileName}: High event listener count (${file.eventListeners.length})`);
            }
            
            // Medium risk: Many API calls
            if (file.apiCalls.length > 5) {
                fileRisk += 3;
                riskFactors.push(`${fileName}: Many API calls (${file.apiCalls.length})`);
            }
            
            // High risk: High complexity
            if (file.complexity > 100) {
                fileRisk += 15;
                riskFactors.push(`${fileName}: High complexity score (${file.complexity})`);
            }
            
            totalRiskScore += fileRisk;
        });
        
        this.results.riskAssessment = {
            totalScore: totalRiskScore,
            level: totalRiskScore > 100 ? 'HIGH' : totalRiskScore > 50 ? 'MEDIUM' : 'LOW',
            factors: riskFactors,
            recommendations: this.generateRecommendations(totalRiskScore)
        };
    }

    /**
     * Generate recommendations based on risk assessment
     */
    generateRecommendations(riskScore) {
        const recommendations = [];
        
        if (riskScore > 100) {
            recommendations.push('CRITICAL: Implement comprehensive testing before any changes');
            recommendations.push('Use feature flags for all new components');
            recommendations.push('Consider parallel implementation strategy');
        }
        
        if (riskScore > 50) {
            recommendations.push('Implement gradual migration approach');
            recommendations.push('Set up extensive monitoring');
        }
        
        recommendations.push('Start with lowest-risk components first');
        recommendations.push('Maintain backward compatibility throughout migration');
        
        return recommendations;
    }

    /**
     * Generate analysis summary
     */
    generateSummary() {
        const fileCount = Object.keys(this.results.files).length;
        const totalLines = Object.values(this.results.files).reduce((sum, file) => sum + file.lines, 0);
        const totalFunctions = Object.values(this.results.files).reduce((sum, file) => sum + file.functions.length, 0);
        const totalEventListeners = Object.values(this.results.files).reduce((sum, file) => sum + file.eventListeners.length, 0);
        const totalDOMOps = Object.values(this.results.files).reduce((sum, file) => sum + file.domManipulations.length, 0);
        const totalAPICalls = Object.values(this.results.files).reduce((sum, file) => sum + file.apiCalls.length, 0);
        const avgComplexity = Object.values(this.results.files).reduce((sum, file) => sum + file.complexity, 0) / fileCount;
        
        this.results.summary = {
            fileCount,
            totalLines,
            totalFunctions,
            totalEventListeners,
            totalDOMOperations: totalDOMOps,
            totalAPICalls,
            averageComplexity: Math.round(avgComplexity),
            riskLevel: this.results.riskAssessment.level,
            migrationComplexity: this.calculateMigrationComplexity()
        };
    }

    /**
     * Calculate migration complexity
     */
    calculateMigrationComplexity() {
        const summary = this.results.summary;
        const riskScore = this.results.riskAssessment.totalScore;
        
        if (riskScore > 150 || summary.totalLines > 3000) return 'VERY_HIGH';
        if (riskScore > 100 || summary.totalLines > 2000) return 'HIGH';
        if (riskScore > 50 || summary.totalLines > 1000) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Get line number for a character index
     */
    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }

    /**
     * Save analysis results to file
     */
    async saveResults(outputPath) {
        const resultsJson = JSON.stringify(this.results, null, 2);
        fs.writeFileSync(path.join(outputPath, 'codebase-analysis-results.json'), resultsJson);
        
        // Generate human-readable report
        const report = this.generateTextReport();
        fs.writeFileSync(path.join(outputPath, 'codebase-analysis-report.md'), report);
        
        console.log(`📊 Analysis results saved to ${outputPath}`);
    }

    /**
     * Generate human-readable report
     */
    generateTextReport() {
        const { summary, riskAssessment } = this.results;
        
        return `# Codebase Analysis Report
Generated on: ${new Date().toISOString()}

## Summary
- **Files Analyzed**: ${summary.fileCount}
- **Total Lines of Code**: ${summary.totalLines}
- **Total Functions**: ${summary.totalFunctions}
- **Event Listeners**: ${summary.totalEventListeners}
- **DOM Operations**: ${summary.totalDOMOperations}
- **API Calls**: ${summary.totalAPICalls}
- **Average Complexity**: ${summary.averageComplexity}

## Risk Assessment
- **Risk Level**: ${riskAssessment.level}
- **Risk Score**: ${riskAssessment.totalScore}
- **Migration Complexity**: ${summary.migrationComplexity}

## Risk Factors
${riskAssessment.factors.map(factor => `- ${factor}`).join('\n')}

## Recommendations
${riskAssessment.recommendations.map(rec => `- ${rec}`).join('\n')}

## File Details
${Object.keys(this.results.files).map(fileName => {
    const file = this.results.files[fileName];
    return `
### ${fileName}
- Lines: ${file.lines}
- Functions: ${file.functions.length}
- Event Listeners: ${file.eventListeners.length}
- DOM Operations: ${file.domManipulations.length}
- API Calls: ${file.apiCalls.length}
- Complexity Score: ${file.complexity}
`;
}).join('\n')}
`;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodebaseAnalyzer;
}

// CLI usage
if (require.main === module) {
    const analyzer = new CodebaseAnalyzer(process.cwd());
    analyzer.analyze()
        .then(() => analyzer.saveResults('./phase-5a-analysis'))
        .catch(console.error);
}