
/**
 * jsdom Configuration for DOM Testing
 */

const { JSDOM } = require('jsdom');

class JSDOMEnvironment {
    constructor() {
        this.dom = null;
        this.window = null;
        this.document = null;
    }
    
    setup() {
        // Create a basic HTML structure similar to our app
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Test Environment</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
            <div id="app"></div>
            <div id="message"></div>
            <div id="notification-container"></div>
        </body>
        </html>
        `;
        
        this.dom = new JSDOM(html, {
            url: 'http://localhost:3002',
            pretendToBeVisual: true,
            resources: 'usable'
        });
        
        this.window = this.dom.window;
        this.document = this.window.document;
        
        // Make global
        global.window = this.window;
        global.document = this.document;
        global.navigator = this.window.navigator;
        
        return this;
    }
    
    teardown() {
        if (this.dom) {
            this.dom.window.close();
        }
    }
    
    loadHTML(htmlContent) {
        this.document.body.innerHTML = htmlContent;
    }
    
    loadScript(scriptPath) {
        const script = this.document.createElement('script');
        const fs = require('fs');
        script.textContent = fs.readFileSync(scriptPath, 'utf8');
        this.document.head.appendChild(script);
    }
}

module.exports = JSDOMEnvironment;
