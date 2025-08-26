
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
            // Test settings page load time
            const settingsStart = Date.now();
            await page.goto('http://localhost:3002/settings.html');
            await page.waitForLoadState('networkidle');
            loadTimes.settings = Date.now() - settingsStart;
            
            // Test dashboard page load time
            await page.evaluateOnNewDocument(() => {
                localStorage.setItem('agent_token', 'test-token');
            });
            
            const dashboardStart = Date.now();
            await page.goto('http://localhost:3002/agent-dashboard.html');
            await page.waitForTimeout(3000); // Wait for JS initialization
            loadTimes.dashboard = Date.now() - dashboardStart;
            
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
            // Test settings page memory usage
            await page.goto('http://localhost:3002/settings.html');
            await page.waitForTimeout(2000);
            
            const settingsMetrics = await page.metrics();
            memoryUsage.settings = {
                jsHeapUsedSize: settingsMetrics.JSHeapUsedSize,
                jsHeapTotalSize: settingsMetrics.JSHeapTotalSize
            };
            
            // Test dashboard page memory usage
            await page.goto('http://localhost:3002/agent-dashboard.html');
            await page.waitForTimeout(3000);
            
            const dashboardMetrics = await page.metrics();
            memoryUsage.dashboard = {
                jsHeapUsedSize: dashboardMetrics.JSHeapUsedSize,
                jsHeapTotalSize: dashboardMetrics.JSHeapTotalSize
            };
            
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
- Settings Page: ${results.loadTimes.settings}ms
- Dashboard Page: ${results.loadTimes.dashboard}ms

## Memory Usage
- Settings Page: ${Math.round(results.memoryUsage.settings.jsHeapUsedSize / 1024 / 1024)}MB
- Dashboard Page: ${Math.round(results.memoryUsage.dashboard.jsHeapUsedSize / 1024 / 1024)}MB

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
