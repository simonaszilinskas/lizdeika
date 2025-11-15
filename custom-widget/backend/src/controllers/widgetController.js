const { createLogger } = require('../utils/logger');
const logger = createLogger('widgetController');

/**
 * Widget Controller
 * Handles widget customization settings and integration code generation
 */
class WidgetController {
    /**
     * Get widget configuration
     */
    async getWidgetConfig(req, res) {
        try {
            const config = {
                name: process.env.WIDGET_NAME || 'Lizdeika',
                primaryColor: process.env.WIDGET_PRIMARY_COLOR || '#2c5530',
                allowedDomains: this.parseAllowedDomains(process.env.WIDGET_ALLOWED_DOMAINS || '*'),
                serverUrl: process.env.SITE_URL || 'http://localhost:3002'
            };

            res.json({
                success: true,
                data: config
            });
        } catch (error) {
            logger.error('Failed to get widget config', { error: error.message, stack: error.stack });
            res.status(500).json({
                error: 'Failed to get widget configuration',
                details: error.message
            });
        }
    }


    /**
     * Generate integration code for embedding the widget
     */
    async getIntegrationCode(req, res) {
        try {
            const serverUrl = process.env.SITE_URL || 'http://localhost:3002';
            const widgetName = process.env.WIDGET_NAME || 'Lizdeika';
            const primaryColor = process.env.WIDGET_PRIMARY_COLOR || '#2c5530';
            
            const integrationCode = this.generateIntegrationCode(serverUrl, widgetName, primaryColor);

            res.json({
                success: true,
                data: {
                    integrationCode,
                    serverUrl,
                    widgetName,
                    primaryColor,
                    instructions: [
                        '1. Copy the integration code below',
                        '2. Paste it into your website\'s HTML, preferably before the closing </body> tag',
                        '3. The widget will appear as a floating chat button in the bottom-right corner',
                        '4. Users can click it to start chatting with the assistant'
                    ]
                }
            });
        } catch (error) {
            logger.error('Failed to generate integration code', { error: error.message, stack: error.stack });
            res.status(500).json({
                error: 'Failed to generate integration code',
                details: error.message
            });
        }
    }

    /**
     * Validate domain access (for CORS and widget embedding)
     */
    async validateDomain(req, res) {
        try {
            const { domain } = req.query;
            
            if (!domain) {
                return res.status(400).json({ error: 'Domain parameter required' });
            }

            const allowedDomains = this.parseAllowedDomains(process.env.WIDGET_ALLOWED_DOMAINS || '*');
            const isAllowed = this.isDomainAllowed(domain, allowedDomains);

            res.json({
                success: true,
                data: {
                    domain,
                    allowed: isAllowed,
                    allowedDomains: allowedDomains
                }
            });
        } catch (error) {
            logger.error('Failed to validate domain', { error: error.message, stack: error.stack });
            res.status(500).json({
                error: 'Failed to validate domain',
                details: error.message
            });
        }
    }

    // Helper methods
    parseAllowedDomains(domainsString) {
        if (domainsString === '*') {
            return ['*'];
        }
        return domainsString.split(',').map(domain => domain.trim()).filter(domain => domain.length > 0);
    }

    isDomainAllowed(domain, allowedDomains) {
        if (allowedDomains.includes('*')) {
            return true;
        }
        
        // Remove protocol and www if present
        const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        
        return allowedDomains.some(allowed => {
            if (allowed === cleanDomain) return true;
            if (allowed.startsWith('*.')) {
                const wildcardDomain = allowed.substring(2);
                return cleanDomain.endsWith('.' + wildcardDomain) || cleanDomain === wildcardDomain;
            }
            return false;
        });
    }

    isValidHexColor(color) {
        return /^#[0-9A-Fa-f]{6}$/.test(color);
    }

    generateIntegrationCode(serverUrl, widgetName, primaryColor) {
        return `<!-- ${widgetName} Widget Integration -->
<div id="vilnius-chat-widget"></div>
<script>
  (function() {
    // Widget configuration
    const WIDGET_CONFIG = {
      serverUrl: '${serverUrl}',
      widgetName: '${widgetName}',
      primaryColor: '${primaryColor}'
    };
    
    // Create widget container
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'vilnius-widget-container';
    widgetContainer.style.cssText = \`
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    \`;
    
    // Create toggle button
    const toggleButton = document.createElement('button');
    toggleButton.id = 'vilnius-widget-toggle';
    toggleButton.innerHTML = '💬';
    toggleButton.style.cssText = \`
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: none;
      background-color: \${WIDGET_CONFIG.primaryColor};
      color: white;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      transition: transform 0.2s;
    \`;
    
    toggleButton.addEventListener('mouseenter', () => {
      toggleButton.style.transform = 'scale(1.1)';
    });
    
    toggleButton.addEventListener('mouseleave', () => {
      toggleButton.style.transform = 'scale(1)';
    });
    
    // Create chat iframe
    const chatIframe = document.createElement('iframe');
    chatIframe.src = \`\${WIDGET_CONFIG.serverUrl}/widget?name=\${encodeURIComponent(WIDGET_CONFIG.widgetName)}&color=\${encodeURIComponent(WIDGET_CONFIG.primaryColor.substring(1))}\`;
    chatIframe.style.cssText = \`
      display: none;
      width: 400px;
      height: 600px;
      border: none;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      position: absolute;
      bottom: 80px;
      right: 0;
    \`;
    
    let isOpen = false;
    
    toggleButton.addEventListener('click', () => {
      isOpen = !isOpen;
      chatIframe.style.display = isOpen ? 'block' : 'none';
      toggleButton.innerHTML = isOpen ? '✕' : '💬';
    });
    
    // Add to page
    widgetContainer.appendChild(toggleButton);
    widgetContainer.appendChild(chatIframe);
    document.body.appendChild(widgetContainer);
    
    // Domain validation
    const currentDomain = window.location.hostname;
    fetch(\`\${WIDGET_CONFIG.serverUrl}/api/widget/validate-domain?domain=\${currentDomain}\`)
      .then(response => response.json())
      .then(data => {
        if (!data.data.allowed) {
          console.warn('${widgetName} widget: Domain not allowed:', currentDomain);
          widgetContainer.style.display = 'none';
        }
      })
      .catch(err => {
        console.warn('${widgetName} widget: Could not validate domain:', err);
      });
  })();
</script>`;
    }
}

module.exports = WidgetController;