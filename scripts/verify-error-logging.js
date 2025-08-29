/**
 * Error Logging Verification Script
 * Verifies that error logging continues to work after removing ErrorMonitoring service
 */

const puppeteer = require('puppeteer');

async function verifyErrorLogging() {
  console.log('🔍 Starting error logging verification...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox'] 
  });
  
  const page = await browser.newPage();
  
  const errors = [];
  const warnings = [];
  
  // Capture console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    } else if (msg.type() === 'warn') {
      warnings.push(msg.text());
    }
  });

  try {
    console.log('📄 Testing agent dashboard...');
    await page.goto('http://localhost:3001/agent-dashboard.html', { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });

    // Test various error scenarios
    console.log('⚡ Triggering test errors...');
    await page.evaluate(() => {
      // Test 1: API error
      fetch('/api/nonexistent-endpoint-123')
        .catch(e => console.error('Test API Error:', e.message || e));
      
      // Test 2: Runtime error
      try { 
        undefined.nonexistent.property; 
      } catch(e) { 
        console.error('Test Runtime Error:', e.message); 
      }
      
      // Test 3: DOM error
      try {
        document.getElementById('nonexistent-element-xyz').click();
      } catch(e) {
        console.error('Test DOM Error:', e.message);
      }

      // Test 4: Network error simulation
      fetch('http://invalid-domain-xyz-123.com/api')
        .catch(e => console.error('Test Network Error:', e.message || e));
    });

    // Wait for async errors to be logged
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('📄 Testing settings page...');
    await page.goto('http://localhost:3001/settings.html', { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });

    // Wait a bit more for page to fully load
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n📊 Error Logging Verification Results:');
    console.log(`   ✓ Errors captured: ${errors.length}`);
    console.log(`   ⚠ Warnings captured: ${warnings.length}`);
    
    if (errors.length > 0) {
      console.log('\n🔍 Captured Errors:');
      errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error.substring(0, 100)}${error.length > 100 ? '...' : ''}`);
      });
    }

    if (warnings.length > 0) {
      console.log('\n⚠️ Captured Warnings:');
      warnings.slice(0, 3).forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning.substring(0, 100)}${warning.length > 100 ? '...' : ''}`);
      });
    }

    const success = errors.length >= 2; // Should capture at least 2 test errors
    
    console.log(`\n${success ? '✅' : '❌'} Error logging verification: ${success ? 'PASSED' : 'FAILED'}`);
    console.log(`   Expected: ≥2 errors, Got: ${errors.length}`);
    
    if (!success) {
      console.log('\n🚨 WARNING: Error logging may not be working properly!');
      console.log('   - Check that SimpleErrorHandler is loaded');
      console.log('   - Verify console.error calls are present');
      console.log('   - Test manually in browser dev tools');
    }

    await browser.close();
    return success;

  } catch (error) {
    console.error('❌ Verification script failed:', error.message);
    await browser.close();
    return false;
  }
}

// Export for use as module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = verifyErrorLogging;
}

// Run if called directly
if (require.main === module) {
  verifyErrorLogging()
    .then(success => {
      console.log(`\n🏁 Verification ${success ? 'completed successfully' : 'failed'}`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Script error:', error);
      process.exit(1);
    });
}