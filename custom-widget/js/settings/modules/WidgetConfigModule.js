/**
 * Widget Configuration Module
 * 
 * Handles widget configuration display, integration code generation, and copying
 * Extracted from SettingsManager for better modularity and single responsibility
 */

import { Toast } from '../../agent-dashboard/utils/Toast.js';
import { ErrorHandler } from '../../agent-dashboard/utils/ErrorHandler.js';

export class WidgetConfigModule {
    constructor(apiManager, stateManager, connectionManager) {
        this.apiManager = apiManager;
        this.stateManager = stateManager;
        this.connectionManager = connectionManager;
        
        // DOM elements
        this.elements = {
            widgetConfigDiv: null,
            generateCodeButton: null,
            copyCodeButton: null,
            codeContainer: null,
            integrationCodeTextarea: null
        };
        
        // Event listeners
        this.eventListeners = [];
        
        console.log('🎨 WidgetConfigModule: Initialized');
    }

    /**
     * Initialize the widget configuration module
     */
    async initialize() {
        try {
            // Initialize DOM elements
            this.initializeElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load current widget configuration
            await this.loadConfiguration();
            
            // Setup state change listeners
            this.setupStateListeners();
            
            console.log('✅ WidgetConfigModule: Initialization complete');
            
        } catch (error) {
            ErrorHandler.logError(error, 'WidgetConfigModule initialization failed');
            throw error;
        }
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.elements = {
            widgetConfigDiv: document.getElementById('current-widget-config'),
            generateCodeButton: document.getElementById('generate-code'),
            copyCodeButton: document.getElementById('copy-code'),
            codeContainer: document.getElementById('integration-code-container'),
            integrationCodeTextarea: document.getElementById('integration-code')
        };
        
        console.log('🎯 WidgetConfigModule: DOM elements initialized');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Generate code button
        if (this.elements.generateCodeButton) {
            const generateHandler = () => this.handleGenerateCodeClick();
            this.elements.generateCodeButton.addEventListener('click', generateHandler);
            this.eventListeners.push({
                element: this.elements.generateCodeButton,
                event: 'click',
                handler: generateHandler
            });
        }
        
        // Copy code button
        if (this.elements.copyCodeButton) {
            const copyHandler = () => this.handleCopyCodeClick();
            this.elements.copyCodeButton.addEventListener('click', copyHandler);
            this.eventListeners.push({
                element: this.elements.copyCodeButton,
                event: 'click',
                handler: copyHandler
            });
        }
        
        console.log('🔗 WidgetConfigModule: Event listeners setup');
    }

    /**
     * Setup state change listeners
     */
    setupStateListeners() {
        // Listen for widget configuration changes from other sources
        this.stateManager.on('widgetConfigurationChanged', (config) => {
            console.log('🎨 WidgetConfigModule: Widget configuration changed via state:', config);
            this.renderConfiguration(config);
        });
        
        console.log('👂 WidgetConfigModule: State listeners setup');
    }

    // =========================
    // CORE FUNCTIONALITY
    // =========================

    /**
     * Load widget configuration
     */
    async loadConfiguration() {
        try {
            console.log('📥 WidgetConfigModule: Loading widget configuration');
            
            // Delegate to APIManager
            await this.apiManager.loadWidgetConfiguration();
            
            // Get configuration from state and update display
            const currentConfig = this.stateManager.getWidgetConfiguration();
            if (currentConfig) {
                this.renderConfiguration(currentConfig);
                console.log('✅ WidgetConfigModule: Configuration loaded:', currentConfig);
            }
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load widget configuration');
            this.renderConfigurationError(error.message);
        }
    }

    /**
     * Render widget configuration in UI
     */
    renderConfiguration(config) {
        console.log('🎨 WidgetConfigModule: Rendering widget configuration');
        
        if (!this.elements.widgetConfigDiv) {
            console.log('❌ WidgetConfigModule: No widgetConfigDiv element found');
            return;
        }

        if (!config) {
            this.renderConfigurationError('No configuration data available');
            return;
        }

        this.elements.widgetConfigDiv.innerHTML = `
            <h4 class="font-semibold text-blue-800 mb-2">Current Configuration</h4>
            <div class="space-y-2 text-blue-700">
                <p><strong>Widget Name:</strong> ${config.name || 'Not set'}</p>
                <p><strong>Primary Color:</strong> 
                    <span class="inline-flex items-center gap-2">
                        ${config.primaryColor || '#000000'}
                        <span class="w-5 h-5 rounded border border-blue-300" style="background-color: ${config.primaryColor || '#000000'};"></span>
                    </span>
                </p>
                <p><strong>Allowed Domains:</strong> ${config.allowedDomains || 'All domains'}</p>
                <p><strong>Server URL:</strong> ${config.serverUrl || 'Default'}</p>
            </div>
        `;
        
        console.log('✅ WidgetConfigModule: Configuration rendered');
    }

    /**
     * Render configuration error state
     */
    renderConfigurationError(errorMessage) {
        if (!this.elements.widgetConfigDiv) return;
        
        this.elements.widgetConfigDiv.innerHTML = `
            <h4 class="font-semibold text-red-800">Configuration Error</h4>
            <p class="text-red-600">Unable to load current widget configuration: ${errorMessage}</p>
        `;
    }

    /**
     * Generate integration code
     */
    async generateIntegrationCode() {
        try {
            console.log('📝 WidgetConfigModule: Generating integration code');
            
            // Update UI to show generating state
            this.setGenerateButtonState('generating');
            
            // Call API to generate code
            const response = await fetch(`${this.apiManager.apiUrl}/api/widget/integration-code`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate integration code');
            }
            
            // Update UI with generated code
            if (this.elements.integrationCodeTextarea) {
                this.elements.integrationCodeTextarea.value = data.data.integrationCode;
            }
            
            if (this.elements.codeContainer) {
                this.elements.codeContainer.classList.remove('hidden');
            }
            
            Toast.success('Integration code generated successfully', '');
            console.log('✅ WidgetConfigModule: Integration code generated');
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to generate integration code');
            Toast.error('Failed to generate integration code', '');
        } finally {
            this.setGenerateButtonState('normal');
        }
    }

    /**
     * Copy integration code to clipboard
     */
    async copyIntegrationCode() {
        if (!this.elements.integrationCodeTextarea?.value) {
            Toast.error('No integration code to copy. Please generate code first.', '');
            return;
        }

        try {
            await navigator.clipboard.writeText(this.elements.integrationCodeTextarea.value);
            
            Toast.success('Integration code copied to clipboard!', '');
            
            // Update button to show success
            this.setCopyButtonState('success');
            
            console.log('✅ WidgetConfigModule: Code copied to clipboard');
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to copy code to clipboard');
            Toast.error('Failed to copy to clipboard', '');
        }
    }

    /**
     * Validate widget configuration
     */
    validateConfiguration(config) {
        if (!config) return false;
        
        // Basic validation
        const hasRequiredFields = config.name && config.primaryColor && config.serverUrl;
        
        // Color validation
        const isValidColor = /^#[0-9A-F]{6}$/i.test(config.primaryColor);
        
        return hasRequiredFields && isValidColor;
    }

    // =========================
    // UI UPDATE METHODS
    // =========================

    /**
     * Set generate button state
     */
    setGenerateButtonState(state) {
        if (!this.elements.generateCodeButton) return;
        
        switch (state) {
            case 'generating':
                this.elements.generateCodeButton.disabled = true;
                this.elements.generateCodeButton.textContent = 'Generating...';
                break;
                
            case 'normal':
            default:
                this.elements.generateCodeButton.disabled = false;
                this.elements.generateCodeButton.textContent = 'Generate Integration Code';
                break;
        }
    }

    /**
     * Set copy button state
     */
    setCopyButtonState(state) {
        if (!this.elements.copyCodeButton) return;
        
        switch (state) {
            case 'success':
                const originalText = this.elements.copyCodeButton.textContent;
                this.elements.copyCodeButton.textContent = '✓ Copied!';
                
                setTimeout(() => {
                    this.elements.copyCodeButton.textContent = originalText;
                }, 2000);
                break;
                
            case 'normal':
            default:
                this.elements.copyCodeButton.textContent = 'Copy to Clipboard';
                break;
        }
    }

    // =========================
    // EVENT HANDLERS
    // =========================

    /**
     * Handle generate code button click
     */
    async handleGenerateCodeClick() {
        await this.generateIntegrationCode();
    }

    /**
     * Handle copy code button click
     */
    async handleCopyCodeClick() {
        await this.copyIntegrationCode();
    }

    // =========================
    // PUBLIC API
    // =========================

    /**
     * Get current widget configuration
     */
    getCurrentConfiguration() {
        return this.stateManager.getWidgetConfiguration();
    }

    /**
     * Force refresh of configuration
     */
    async refresh() {
        console.log('🔄 WidgetConfigModule: Forcing refresh');
        await this.loadConfiguration();
    }

    /**
     * Add event listener for configuration changes
     */
    onConfigurationChanged(callback) {
        this.stateManager.on('widgetConfigurationChanged', callback);
    }

    /**
     * Remove event listener for configuration changes
     */
    offConfigurationChanged(callback) {
        this.stateManager.off('widgetConfigurationChanged', callback);
    }

    /**
     * Check if integration code is available
     */
    hasIntegrationCode() {
        return !!(this.elements.integrationCodeTextarea?.value);
    }

    // =========================
    // UTILITY METHODS
    // =========================

    /**
     * Get configuration display information
     */
    getConfigurationInfo(config) {
        if (!config) return null;
        
        return {
            name: config.name || 'Unnamed Widget',
            primaryColor: config.primaryColor || '#000000',
            allowedDomains: config.allowedDomains || 'All domains',
            serverUrl: config.serverUrl || window.location.origin,
            isValid: this.validateConfiguration(config)
        };
    }

    /**
     * Get module status for debugging
     */
    getStatus() {
        const config = this.getCurrentConfiguration();
        
        return {
            hasConfiguration: !!config,
            configurationValid: this.validateConfiguration(config),
            hasIntegrationCode: this.hasIntegrationCode(),
            elements: {
                widgetConfigDiv: !!this.elements.widgetConfigDiv,
                generateCodeButton: !!this.elements.generateCodeButton,
                copyCodeButton: !!this.elements.copyCodeButton,
                codeContainer: !!this.elements.codeContainer,
                integrationCodeTextarea: !!this.elements.integrationCodeTextarea
            },
            eventListeners: this.eventListeners.length
        };
    }

    /**
     * Cleanup method for proper shutdown
     */
    destroy() {
        // Remove event listeners
        this.eventListeners.forEach(({ element, event, handler }) => {
            if (element && handler) {
                element.removeEventListener(event, handler);
            }
        });
        
        this.eventListeners = [];
        
        console.log('🧹 WidgetConfigModule: Cleanup complete');
    }
}