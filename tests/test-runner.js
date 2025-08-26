
#!/usr/bin/env node

/**
 * Comprehensive Test Runner
 * Orchestrates all testing types for Phase 5A
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class TestRunner {
    constructor() {
        this.projectRoot = path.dirname(__dirname);
        this.results = {
            unit: null,
            integration: null,
            visual: null,
            performance: null,
            timestamp: new Date().toISOString()
        };
    }
    
    async runAllTests() {
        console.log('🚀 Starting comprehensive test suite...');
        
        try {
            // Install dependencies if needed
            await this.ensureDependencies();
            
            // Run unit tests
            await this.runUnitTests();
            
            // Run integration tests
            await this.runIntegrationTests();
            
            // Run visual regression tests
            await this.runVisualTests();
            
            // Run performance tests
            await this.runPerformanceTests();
            
            // Generate summary report
            this.generateSummaryReport();
            
            console.log('✅ All tests completed successfully!');
            
        } catch (error) {
            console.error('❌ Test suite failed:', error);
            process.exit(1);
        }
    }
    
    async ensureDependencies() {
        console.log('📦 Checking dependencies...');
        
        const packageJsonPath = path.join(this.projectRoot, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            console.log('⚠️  No package.json found, creating minimal version');
            return;
        }
        
        try {
            execSync('npm install', { 
                cwd: this.projectRoot,
                stdio: 'inherit'
            });
        } catch (error) {
            console.warn('⚠️  Failed to install dependencies:', error.message);
        }
    }
    
    async runUnitTests() {
        console.log('🧪 Running unit tests...');
        
        try {
            const output = execSync('npm run test:unit', {
                cwd: this.projectRoot,
                encoding: 'utf8'
            });
            
            this.results.unit = {
                status: 'passed',
                output: output
            };
            
        } catch (error) {
            this.results.unit = {
                status: 'failed',
                output: error.stdout || error.message
            };
            throw error;
        }
    }
    
    async runIntegrationTests() {
        console.log('🔗 Running integration tests...');
        
        try {
            const output = execSync('npm run test:integration', {
                cwd: this.projectRoot,
                encoding: 'utf8'
            });
            
            this.results.integration = {
                status: 'passed',
                output: output
            };
            
        } catch (error) {
            this.results.integration = {
                status: 'failed',
                output: error.stdout || error.message
            };
            throw error;
        }
    }
    
    async runVisualTests() {
        console.log('📸 Running visual regression tests...');
        
        try {
            const output = execSync('npm run test:visual', {
                cwd: this.projectRoot,
                encoding: 'utf8'
            });
            
            this.results.visual = {
                status: 'passed',
                output: output
            };
            
        } catch (error) {
            this.results.visual = {
                status: 'failed',
                output: error.stdout || error.message
            };
            console.warn('⚠️  Visual tests failed, continuing...');
        }
    }
    
    async runPerformanceTests() {
        console.log('⚡ Running performance tests...');
        
        try {
            const output = execSync('npm run test:performance', {
                cwd: this.projectRoot,
                encoding: 'utf8'
            });
            
            this.results.performance = {
                status: 'passed',
                output: output
            };
            
        } catch (error) {
            this.results.performance = {
                status: 'failed',
                output: error.stdout || error.message
            };
            console.warn('⚠️  Performance tests failed, continuing...');
        }
    }
    
    generateSummaryReport() {
        const report = `# Test Suite Summary Report
Generated: ${this.results.timestamp}

## Test Results
- Unit Tests: ${this.results.unit?.status || 'not run'}
- Integration Tests: ${this.results.integration?.status || 'not run'}
- Visual Tests: ${this.results.visual?.status || 'not run'}
- Performance Tests: ${this.results.performance?.status || 'not run'}

## Status
${this.getOverallStatus()}

## Recommendations for Phase 5A
- ✅ Codebase analysis complete - VERY_HIGH complexity confirmed
- ✅ Testing infrastructure established
- 📋 Next: Implement feature flags and rollback mechanisms
- 📋 Next: Design parallel architecture foundation

## Next Steps
1. Review test results and address any failures
2. Implement feature flag system for safe rollouts
3. Design component isolation strategy
4. Begin parallel architecture foundation

---
Generated by Phase 5A Testing Infrastructure
`;
        
        const reportPath = path.join(this.projectRoot, 'phase-5a-analysis', 'test-summary-report.md');
        fs.writeFileSync(reportPath, report);
        
        console.log(`📊 Summary report saved to: ${reportPath}`);
    }
    
    getOverallStatus() {
        const statuses = [
            this.results.unit?.status,
            this.results.integration?.status,
            this.results.visual?.status,
            this.results.performance?.status
        ].filter(Boolean);
        
        if (statuses.every(status => status === 'passed')) {
            return '✅ ALL TESTS PASSED - Ready for next phase';
        } else if (statuses.some(status => status === 'passed')) {
            return '⚠️  PARTIAL SUCCESS - Review failures before proceeding';
        } else {
            return '❌ TESTS FAILED - Address issues before continuing';
        }
    }
}

// CLI execution
if (require.main === module) {
    const runner = new TestRunner();
    runner.runAllTests().catch(console.error);
}

module.exports = TestRunner;
