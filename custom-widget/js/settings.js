/**
 * Settings JavaScript
 * Handles the widget settings interface
 */

class Settings {
    constructor() {
        this.apiUrl = 'http://localhost:3002';
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadWidgetConfiguration();
    }

    initializeElements() {
        // Widget configuration elements
        this.widgetConfigDiv = document.getElementById('current-widget-config');
        this.generateCodeButton = document.getElementById('generate-code');
        this.codeContainer = document.getElementById('integration-code-container');
        this.integrationCodeTextarea = document.getElementById('integration-code');
        this.copyCodeButton = document.getElementById('copy-code');
    }

    attachEventListeners() {
        // Generate integration code
        this.generateCodeButton.addEventListener('click', () => this.generateIntegrationCode());
        
        // Copy code to clipboard
        this.copyCodeButton.addEventListener('click', () => this.copyCodeToClipboard());
    }

    async loadWidgetConfiguration() {
        try {
            const response = await fetch(`${this.apiUrl}/api/widget/config`);
            const data = await response.json();

            if (response.ok) {
                this.renderWidgetConfiguration(data.data);
            } else {
                throw new Error(data.error || 'Failed to load widget configuration');
            }
        } catch (error) {
            console.error('Failed to load widget configuration:', error);
            this.widgetConfigDiv.innerHTML = `
                <h4>Configuration Error</h4>
                <p>Unable to load current widget configuration: ${error.message}</p>
            `;
        }
    }

    renderWidgetConfiguration(config) {
        this.widgetConfigDiv.innerHTML = `
            <h4>Current Configuration</h4>
            <div style="margin-top: 10px;">
                <p><strong>Widget Name:</strong> ${config.name}</p>
                <p><strong>Primary Color:</strong> 
                    <span style="display: inline-flex; align-items: center; gap: 8px;">
                        ${config.primaryColor}
                        <span style="width: 20px; height: 20px; background-color: ${config.primaryColor}; border-radius: 3px; border: 1px solid #ddd; display: inline-block;"></span>
                    </span>
                </p>
                <p><strong>Allowed Domains:</strong> ${config.allowedDomains}</p>
                <p><strong>Server URL:</strong> ${config.serverUrl}</p>
            </div>
        `;
    }

    async generateIntegrationCode() {
        const button = this.generateCodeButton;
        const originalText = button.textContent;
        
        try {
            button.disabled = true;
            button.innerHTML = '<span class="loading"></span>Generating...';
            
            const response = await fetch(`${this.apiUrl}/api/widget/integration-code`);
            const data = await response.json();

            if (response.ok) {
                this.integrationCodeTextarea.value = data.data.integrationCode;
                this.codeContainer.style.display = 'block';
                this.showAlert('Integration code generated successfully!', 'success');
            } else {
                throw new Error(data.error || 'Failed to generate integration code');
            }

        } catch (error) {
            console.error('Failed to generate integration code:', error);
            this.showAlert(`Failed to generate integration code: ${error.message}`, 'error');
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    async copyCodeToClipboard() {
        try {
            await navigator.clipboard.writeText(this.integrationCodeTextarea.value);
            this.showAlert('Integration code copied to clipboard!', 'success');
            
            // Temporarily change button text
            const button = this.copyCodeButton;
            const originalText = button.textContent;
            button.textContent = '✓ Copied!';
            
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);

        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            
            // Fallback: select the text
            this.integrationCodeTextarea.select();
            this.integrationCodeTextarea.setSelectionRange(0, 99999);
            
            try {
                document.execCommand('copy');
                this.showAlert('Integration code copied to clipboard!', 'success');
            } catch (fallbackError) {
                this.showAlert('Please manually select and copy the code above', 'error');
            }
        }
    }

    showAlert(message, type = 'info') {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.alert');
        existingAlerts.forEach(alert => alert.remove());

        // Create new alert
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.textContent = message;

        // Insert at the top of the container
        const container = document.querySelector('.container');
        container.insertBefore(alert, container.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            alert.remove();
        }, 5000);
    }
}

// Initialize when DOM is loaded
let settings;
document.addEventListener('DOMContentLoaded', () => {
    settings = new Settings();
});