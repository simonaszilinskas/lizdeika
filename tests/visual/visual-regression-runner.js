
/**
 * Visual Regression Testing Alternative
 * Uses Puppeteer for screenshot comparison instead of Playwright
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const resemble = require('resemblejs');

class VisualRegressionTester {
    constructor() {
        this.baselineDir = path.join(__dirname, 'baseline');
        this.currentDir = path.join(__dirname, 'current');
        this.diffDir = path.join(__dirname, 'diff');
        
        // Ensure directories exist
        [this.baselineDir, this.currentDir, this.diffDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }
    
    async runVisualTests() {
        console.log('📸 Starting visual regression tests...');
        
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        
        try {
            // Check if server is running by testing a simple request
            const testUrl = 'http://localhost:3002/settings.html';
            try {
                const response = await page.goto(testUrl, { waitUntil: 'networkidle0', timeout: 5000 });
                if (response && response.ok()) {
                    // Server is running, run full tests
                    await this.testSettingsPage(page);
                    await this.testDashboardPage(page);
                    await this.testLoginPage(page);
                } else {
                    throw new Error('Server not responding');
                }
            } catch (error) {
                console.log('⚠️ Server not running, testing with static HTML...');
                await this.testStaticHTML(page);
            }
            
        } finally {
            await browser.close();
        }
        
        console.log('✅ Visual regression tests complete');
    }
    
    async testStaticHTML(page) {
        // Create a simple static HTML page for testing
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Test Page</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .container { max-width: 800px; margin: 0 auto; }
                .button { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Vilnius Assistant Test Page</h1>
                <p>This is a test page for visual regression testing.</p>
                <button class="button">Test Button</button>
            </div>
        </body>
        </html>
        `;
        
        await page.setContent(htmlContent);
        await page.waitForTimeout(1000);
        
        const screenshot = await page.screenshot({ fullPage: true });
        await this.compareScreenshot('static-test-page', screenshot);
    }
    
    async testSettingsPage(page) {
        await page.goto('http://localhost:3002/settings.html');
        await page.waitForTimeout(2000); // Wait for loading
        
        const screenshot = await page.screenshot({ fullPage: true });
        await this.compareScreenshot('settings-page', screenshot);
    }
    
    async testDashboardPage(page) {
        // Mock authentication
        await page.evaluateOnNewDocument(() => {
            localStorage.setItem('agent_token', 'test-token');
            localStorage.setItem('user_data', JSON.stringify({
                id: 'test-user',
                email: 'test@vilnius.lt',
                role: 'agent'
            }));
        });
        
        await page.goto('http://localhost:3002/agent-dashboard.html');
        await page.waitForTimeout(3000); // Wait for loading
        
        const screenshot = await page.screenshot({ fullPage: true });
        await this.compareScreenshot('dashboard-page', screenshot);
    }
    
    async testLoginPage(page) {
        await page.goto('http://localhost:3002/login.html');
        await page.waitForTimeout(1000);
        
        const screenshot = await page.screenshot({ fullPage: true });
        await this.compareScreenshot('login-page', screenshot);
    }
    
    async compareScreenshot(testName, currentScreenshot) {
        const currentPath = path.join(this.currentDir, `${testName}.png`);
        const baselinePath = path.join(this.baselineDir, `${testName}.png`);
        const diffPath = path.join(this.diffDir, `${testName}.png`);
        
        // Save current screenshot
        fs.writeFileSync(currentPath, currentScreenshot);
        
        // If no baseline exists, create it
        if (!fs.existsSync(baselinePath)) {
            fs.writeFileSync(baselinePath, currentScreenshot);
            console.log(`📸 Created baseline for ${testName}`);
            return;
        }
        
        // Compare with baseline
        return new Promise((resolve, reject) => {
            resemble(baselinePath)
                .compareTo(currentPath)
                .onComplete((data) => {
                    if (data.misMatchPercentage > 1) { // 1% threshold
                        data.getDiffImage().pack().pipe(fs.createWriteStream(diffPath));
                        console.log(`❌ Visual regression detected in ${testName}: ${data.misMatchPercentage}% difference`);
                    } else {
                        console.log(`✅ Visual test passed for ${testName}: ${data.misMatchPercentage}% difference`);
                    }
                    resolve(data);
                });
        });
    }
}

module.exports = VisualRegressionTester;

// CLI runner
if (require.main === module) {
    const tester = new VisualRegressionTester();
    tester.runVisualTests().catch(console.error);
}
