
/**
 * Performance Testing Suite
 * Tests load times, memory usage, and execution speed
 */

const Benchmark = require('benchmark');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class PerformanceTester {
    constructor() {
        this.resultsDir = path.join(__dirname, 'results');
        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        }
    }
    
    async runPerformanceTests() {
        console.log('⚡ Starting performance tests...');
        
        const results = {
            loadTimes: await this.testLoadTimes(),
            memoryUsage: await this.testMemoryUsage(),
            executionSpeed: await this.testExecutionSpeed(),
            timestamp: new Date().toISOString()
        };
        
        // Save results
        fs.writeFileSync(
            path.join(this.resultsDir, `performance-${Date.now()}.json`),
            JSON.stringify(results, null, 2)
        );
        
        this.generateReport(results);
        console.log('✅ Performance tests complete');
        
        return results;
    }
    
    async testLoadTimes() {
        console.log('📊 Testing load times...');
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        
        const loadTimes = {};
        
        try {
            // Test if server is running first
            try {
                const settingsStart = Date.now();
                const response = await page.goto('http://localhost:3002/settings.html', { timeout: 5000 });
                if (response && response.ok()) {
                    await page.waitForTimeout(1000);
                    loadTimes.settings = Date.now() - settingsStart;
                    
                    // Test dashboard page load time
                    await page.evaluateOnNewDocument(() => {
                        localStorage.setItem('agent_token', 'test-token');
                    });
                    
                    const dashboardStart = Date.now();
                    await page.goto('http://localhost:3002/agent-dashboard.html');
                    await page.waitForTimeout(3000);
                    loadTimes.dashboard = Date.now() - dashboardStart;
                } else {
                    throw new Error('Server not responding');
                }
            } catch (error) {
                console.log('⚠️ Server not running, testing static content...');
                const staticStart = Date.now();
                await page.setContent('<html><body><h1>Test Performance</h1><div id="content">Sample content for testing</div></body></html>');
                await page.waitForTimeout(100);
                loadTimes.staticContent = Date.now() - staticStart;
            }
            
        } finally {
            await browser.close();
        }
        
        return loadTimes;
    }
    
    async testMemoryUsage() {
        console.log('🧠 Testing memory usage...');
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        
        const memoryUsage = {};
        
        try {
            // Test if server is running, else use static content
            try {
                await page.goto('http://localhost:3002/settings.html', { timeout: 5000 });
                await page.waitForTimeout(2000);
                
                const settingsMetrics = await page.metrics();
                memoryUsage.settings = {
                    jsHeapUsedSize: settingsMetrics.JSHeapUsedSize,
                    jsHeapTotalSize: settingsMetrics.JSHeapTotalSize
                };
            } catch (error) {
                console.log('⚠️ Server not running, using static content for memory test...');
                await page.setContent('<html><body><div id="memory-test">Memory test content</div></body></html>');
                await page.waitForTimeout(500);
                
                const staticMetrics = await page.metrics();
                memoryUsage.staticContent = {
                    jsHeapUsedSize: staticMetrics.JSHeapUsedSize,
                    jsHeapTotalSize: staticMetrics.JSHeapTotalSize
                };
            }
            
        } finally {
            await browser.close();
        }
        
        return memoryUsage;
    }
    
    async testExecutionSpeed() {
        console.log('🏃 Testing execution speed...');
        
        const suite = new Benchmark.Suite();
        const results = {};
        
        return new Promise((resolve) => {
            suite
                .add('DOM Query Performance', () => {
                    // Mock DOM operations
                    const elements = [];
                    for (let i = 0; i < 100; i++) {
                        elements.push(`element-${i}`);
                    }
                    return elements.filter(el => el.includes('5'));
                })
                .add('Array Processing', () => {
                    const arr = Array.from({ length: 1000 }, (_, i) => i);
                    return arr.map(x => x * 2).filter(x => x % 3 === 0);
                })
                .add('Object Manipulation', () => {
                    const obj = {};
                    for (let i = 0; i < 100; i++) {
                        obj[`key${i}`] = `value${i}`;
                    }
                    return Object.keys(obj).length;
                })
                .on('cycle', (event) => {
                    const benchmark = event.target;
                    results[benchmark.name] = {
                        hz: benchmark.hz,
                        stats: benchmark.stats
                    };
                    console.log(String(event.target));
                })
                .on('complete', () => {
                    resolve(results);
                })
                .run({ async: false });
        });
    }
    
    generateReport(results) {
        const report = `# Performance Test Report
Generated: ${results.timestamp}

## Load Times
${results.loadTimes.settings ? `- Settings Page: ${results.loadTimes.settings}ms` : ''}
${results.loadTimes.dashboard ? `- Dashboard Page: ${results.loadTimes.dashboard}ms` : ''}
${results.loadTimes.staticContent ? `- Static Content: ${results.loadTimes.staticContent}ms` : ''}

## Memory Usage
${results.memoryUsage.settings ? `- Settings Page: ${Math.round(results.memoryUsage.settings.jsHeapUsedSize / 1024 / 1024)}MB` : ''}
${results.memoryUsage.dashboard ? `- Dashboard Page: ${Math.round(results.memoryUsage.dashboard.jsHeapUsedSize / 1024 / 1024)}MB` : ''}
${results.memoryUsage.staticContent ? `- Static Content: ${Math.round(results.memoryUsage.staticContent.jsHeapUsedSize / 1024 / 1024)}MB` : ''}

## Execution Speed
${Object.keys(results.executionSpeed).map(key => 
    `- ${key}: ${Math.round(results.executionSpeed[key].hz)} ops/sec`
).join('\n')}

## Recommendations
- Load times should be under 3 seconds
- Memory usage should remain stable during navigation
- Critical operations should execute under 100ms
`;
        
        fs.writeFileSync(path.join(this.resultsDir, 'latest-report.md'), report);
        console.log('📊 Performance report generated');
    }
}

module.exports = PerformanceTester;

// CLI runner
if (require.main === module) {
    const tester = new PerformanceTester();
    tester.runPerformanceTests().catch(console.error);
}
