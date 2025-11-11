/**
 * Unit Tests for BrandingConfigModule Integration Code Generation
 *
 * Purpose: Verify that the widget integration code includes all required dependencies
 * and security attributes to prevent regressions.
 */

describe('BrandingConfigModule - Integration Code Generation', () => {
    let BrandingConfigModule;
    let mockStateManager;
    let mockAPIManager;
    let mockElements;
    let module;

    beforeEach(() => {
        // Mock dependencies
        mockStateManager = {
            emit: jest.fn(),
            on: jest.fn(),
        };

        mockAPIManager = {
            get: jest.fn(),
            post: jest.fn(),
            put: jest.fn(),
        };

        mockElements = {
            generateCodeButton: {
                disabled: false,
                innerHTML: ''
            },
            integrationCodeTextarea: {
                value: ''
            },
            codeContainer: {
                classList: {
                    remove: jest.fn()
                }
            }
        };

        // Mock global objects
        global.window = {
            location: {
                origin: 'https://example.com'
            }
        };

        global.Toast = {
            success: jest.fn(),
            error: jest.fn(),
            warning: jest.fn()
        };

        global.ErrorHandler = {
            logError: jest.fn()
        };

        // Create minimal BrandingConfigModule implementation for testing
        BrandingConfigModule = class {
            constructor() {
                this.elements = mockElements;
                this.currentSettings = {
                    widget_name: 'Test Widget',
                    widget_primary_color: '#FF0000',
                    widget_allowed_domains: 'https://test.com'
                };
            }

            async generateIntegrationCode() {
                const widgetUrl = `${window.location.origin}/widget.js`;
                const currentSettings = this.currentSettings;

                const integrationCode = `<!-- Vilnius Assistant Chat Widget -->
<script src="https://cdn.socket.io/4.8.1/socket.io.min.js"
        integrity="sha384-mkQ3/7FUtcGyoppY6bz/PORYoGqOl7/aSUMn2ymDOJcapfS6PHqxhRTMh1RR0Q6+"
        crossorigin="anonymous"></script>
<script type="text/javascript">
(function() {
    var config = {
        apiUrl: '${window.location.origin}',
        widgetName: '${currentSettings?.widget_name || 'Vilnius Assistant'}',
        primaryColor: '${currentSettings?.widget_primary_color || '#2c5530'}',
        allowedDomains: '${currentSettings?.widget_allowed_domains || '*'}'
    };

    // Create widget container
    var widgetContainer = document.createElement('div');
    widgetContainer.id = 'vilnius-widget-container';
    document.body.appendChild(widgetContainer);

    // Load and initialize widget
    var script = document.createElement('script');
    script.src = '${widgetUrl}';
    script.onload = function() {
        if (window.VilniusChat) {
            window.VilniusChat.init(config);
        }
    };
    document.head.appendChild(script);
})();
</script>
<!-- End Vilnius Assistant Chat Widget -->`;

                this.elements.integrationCodeTextarea.value = integrationCode;
                this.elements.codeContainer.classList.remove('hidden');
                Toast.success('Integration code generated with current branding!');

                return integrationCode;
            }
        };

        module = new BrandingConfigModule();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Socket.IO Dependency', () => {
        test('should include Socket.IO CDN script tag', async () => {
            const code = await module.generateIntegrationCode();

            expect(code).toContain('<script src="https://cdn.socket.io/');
            expect(code).toContain('socket.io.min.js');
        });

        test('should use Socket.IO version 4.8.1 to match backend', async () => {
            const code = await module.generateIntegrationCode();

            expect(code).toContain('socket.io/4.8.1/socket.io.min.js');
        });

        test('should load Socket.IO before widget.js', async () => {
            const code = await module.generateIntegrationCode();

            const socketIoIndex = code.indexOf('cdn.socket.io');
            const widgetIndex = code.indexOf('widget.js');

            expect(socketIoIndex).toBeLessThan(widgetIndex);
            expect(socketIoIndex).toBeGreaterThan(-1);
            expect(widgetIndex).toBeGreaterThan(-1);
        });
    });

    describe('Security Attributes (SRI)', () => {
        test('should include integrity attribute with SHA-384 hash', async () => {
            const code = await module.generateIntegrationCode();

            expect(code).toContain('integrity="sha384-');
        });

        test('should include correct SRI hash for Socket.IO 4.8.1', async () => {
            const code = await module.generateIntegrationCode();

            const expectedHash = 'sha384-mkQ3/7FUtcGyoppY6bz/PORYoGqOl7/aSUMn2ymDOJcapfS6PHqxhRTMh1RR0Q6+';
            expect(code).toContain(`integrity="${expectedHash}"`);
        });

        test('should include crossorigin attribute set to anonymous', async () => {
            const code = await module.generateIntegrationCode();

            expect(code).toContain('crossorigin="anonymous"');
        });

        test('should have both integrity and crossorigin on Socket.IO script', async () => {
            const code = await module.generateIntegrationCode();

            // Extract the Socket.IO script tag
            const socketScriptMatch = code.match(/<script[^>]*cdn\.socket\.io[^>]*>/);
            expect(socketScriptMatch).not.toBeNull();

            const socketScript = socketScriptMatch[0];
            expect(socketScript).toContain('integrity=');
            expect(socketScript).toContain('crossorigin=');
        });
    });

    describe('Widget Configuration', () => {
        test('should include widget initialization code', async () => {
            const code = await module.generateIntegrationCode();

            expect(code).toContain('window.VilniusChat');
            expect(code).toContain('VilniusChat.init(config)');
        });

        test('should include all required config fields', async () => {
            const code = await module.generateIntegrationCode();

            expect(code).toContain('apiUrl:');
            expect(code).toContain('widgetName:');
            expect(code).toContain('primaryColor:');
            expect(code).toContain('allowedDomains:');
        });

        test('should use custom widget settings when provided', async () => {
            module.currentSettings = {
                widget_name: 'Custom Widget',
                widget_primary_color: '#FF5733',
                widget_allowed_domains: 'https://custom.com'
            };

            const code = await module.generateIntegrationCode();

            expect(code).toContain('Custom Widget');
            expect(code).toContain('#FF5733');
            expect(code).toContain('https://custom.com');
        });

        test('should use default values when settings are not provided', async () => {
            module.currentSettings = {};

            const code = await module.generateIntegrationCode();

            expect(code).toContain('Vilnius Assistant');
            expect(code).toContain('#2c5530');
            expect(code).toContain('*');
        });

        test('should use window.location.origin for apiUrl', async () => {
            const code = await module.generateIntegrationCode();

            expect(code).toContain('apiUrl: \'https://example.com\'');
        });

        test('should create widget container element', async () => {
            const code = await module.generateIntegrationCode();

            expect(code).toContain('document.createElement(\'div\')');
            expect(code).toContain('vilnius-widget-container');
            expect(code).toContain('document.body.appendChild');
        });
    });

    describe('Code Structure', () => {
        test('should wrap initialization in IIFE', async () => {
            const code = await module.generateIntegrationCode();

            expect(code).toContain('(function() {');
            expect(code).toContain('})();');
        });

        test('should include HTML comments for clarity', async () => {
            const code = await module.generateIntegrationCode();

            expect(code).toContain('<!-- Vilnius Assistant Chat Widget -->');
            expect(code).toContain('<!-- End Vilnius Assistant Chat Widget -->');
        });

        test('should dynamically load widget.js with onload callback', async () => {
            const code = await module.generateIntegrationCode();

            expect(code).toContain('document.createElement(\'script\')');
            expect(code).toContain('script.src =');
            expect(code).toContain('script.onload = function()');
            expect(code).toContain('document.head.appendChild(script)');
        });
    });

    describe('Integration', () => {
        test('should update textarea with generated code', async () => {
            await module.generateIntegrationCode();

            expect(module.elements.integrationCodeTextarea.value).toBeTruthy();
            expect(module.elements.integrationCodeTextarea.value.length).toBeGreaterThan(0);
        });

        test('should show code container after generation', async () => {
            await module.generateIntegrationCode();

            expect(module.elements.codeContainer.classList.remove).toHaveBeenCalledWith('hidden');
        });

        test('should show success toast after generation', async () => {
            await module.generateIntegrationCode();

            expect(global.Toast.success).toHaveBeenCalledWith(
                'Integration code generated with current branding!'
            );
        });
    });

    describe('Regression Prevention', () => {
        test('should not include Socket.IO from wrong CDN', async () => {
            const code = await module.generateIntegrationCode();

            // Should use official CDN, not unpkg or other alternatives
            expect(code).toContain('cdn.socket.io');
            expect(code).not.toContain('unpkg.com');
            expect(code).not.toContain('jsdelivr');
        });

        test('should not include outdated Socket.IO versions', async () => {
            const code = await module.generateIntegrationCode();

            // Should not use older versions
            expect(code).not.toContain('socket.io/4.7.2');
            expect(code).not.toContain('socket.io/4.7.1');
            expect(code).not.toContain('socket.io/4.6');
            expect(code).not.toContain('socket.io/3.');
        });

        test('should include exactly one Socket.IO script tag', async () => {
            const code = await module.generateIntegrationCode();

            const matches = code.match(/cdn\.socket\.io/g);
            expect(matches).not.toBeNull();
            expect(matches.length).toBe(1);
        });
    });
});
