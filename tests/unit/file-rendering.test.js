/**
 * File Rendering Security Tests
 *
 * Tests XSS protection and rendering logic for file attachments in:
 * - Agent Dashboard (ConversationRenderer.js) - ES6 module
 * - Customer Widget (widget.js) - IIFE
 *
 * Focus on:
 * - URL validation (reject javascript:, data:, external URLs)
 * - HTML escaping (filenames, captions, URLs)
 * - Rendering logic (images vs documents, captions)
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const ModuleLoader = require('../utilities/module-loader');

describe('File Rendering Security', () => {
    let dom;

    beforeEach(() => {
        // Setup fresh JSDOM environment for each test
        dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
        global.document = dom.window.document;
        global.window = dom.window;
        global.navigator = { userAgent: 'test' };
    });

    afterEach(() => {
        // Cleanup
        delete global.document;
        delete global.window;
        delete global.navigator;
    });

    describe('Agent Dashboard - ConversationRenderer', () => {
        let ConversationRenderer;
        let renderer;
        let mockDashboard;
        let mockUIHelpers;

        beforeEach(() => {
            // Mock UIHelpers.escapeHtml
            mockUIHelpers = {
                escapeHtml: (text) => {
                    if (!text) return '';
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                }
            };

            // Mock StateManager
            const mockStateManager = {
                getState: jest.fn(() => ({})),
                setState: jest.fn()
            };

            // Load ConversationRenderer with mocked dependencies
            ConversationRenderer = ModuleLoader.loadModule(
                'custom-widget/js/agent-dashboard/ConversationRenderer.js',
                { UIHelpers: { UIHelpers: mockUIHelpers } }
            );

            mockDashboard = {
                agentId: 'test-agent',
                stateManager: mockStateManager
            };

            renderer = new ConversationRenderer(mockDashboard);
        });

        it('should render valid image with escaped URL', () => {
            const message = {
                id: 'msg1',
                sender: 'customer',
                content: 'Screenshot',
                metadata: {
                    file: {
                        url: '/api/uploads/test-image.png',
                        filename: 'test-image.png',
                        mimetype: 'image/png'
                    }
                }
            };

            const html = renderer.renderMessage(message);

            expect(html).toContain('img src=');
            expect(html).toContain('/api/uploads/test-image.png');
            expect(html).not.toContain('<script>');
        });

        it('should render valid PDF as download link with escaped filename', () => {
            const message = {
                id: 'msg1',
                sender: 'customer',
                content: 'Document',
                metadata: {
                    file: {
                        url: '/api/uploads/report.pdf',
                        filename: 'report.pdf',
                        mimetype: 'application/pdf'
                    }
                }
            };

            const html = renderer.renderMessage(message);

            expect(html).toContain('📎');
            expect(html).toContain('download=');
            expect(html).toContain('report.pdf');
            expect(html).not.toContain('img src');
        });

        it('should escape filename with XSS payload', () => {
            const xssFilename = '"><img src=x onerror=alert(1)>';
            const message = {
                id: 'msg1',
                sender: 'customer',
                content: 'XSS attempt',
                metadata: {
                    file: {
                        url: '/api/uploads/safe-file.png',
                        filename: xssFilename,
                        mimetype: 'image/png'
                    }
                }
            };

            const html = renderer.renderMessage(message);

            // Should escape the XSS payload
            expect(html).not.toContain('onerror=alert');
            expect(html).toContain('&quot;');
            expect(html).toContain('&gt;');
        });

        it('should escape caption with HTML tags', () => {
            const xssCaption = '<script>alert("xss")</script>';
            const message = {
                id: 'msg1',
                sender: 'customer',
                content: xssCaption,
                metadata: {
                    file: {
                        url: '/api/uploads/test.png',
                        filename: 'test.png',
                        mimetype: 'image/png'
                    }
                }
            };

            const html = renderer.renderMessage(message);

            expect(html).not.toContain('<script>');
            expect(html).toContain('&lt;script&gt;');
        });

        it('should reject javascript: URL and show error message', () => {
            const message = {
                id: 'msg1',
                sender: 'customer',
                content: 'Malicious',
                metadata: {
                    file: {
                        url: 'javascript:alert(document.cookie)',
                        filename: 'fake.png',
                        mimetype: 'image/png'
                    }
                }
            };

            const html = renderer.renderMessage(message);

            expect(html).toContain('Invalid file attachment');
            expect(html).not.toContain('javascript:');
        });

        it('should reject data: URL and show error message', () => {
            const message = {
                id: 'msg1',
                sender: 'customer',
                content: 'Data URI',
                metadata: {
                    file: {
                        url: 'data:text/html,<script>alert(1)</script>',
                        filename: 'fake.png',
                        mimetype: 'image/png'
                    }
                }
            };

            const html = renderer.renderMessage(message);

            expect(html).toContain('Invalid file attachment');
            expect(html).not.toContain('data:text/html');
        });

        it('should reject URL without /api/uploads/ prefix', () => {
            const message = {
                id: 'msg1',
                sender: 'customer',
                content: 'External',
                metadata: {
                    file: {
                        url: 'http://evil.com/malware.png',
                        filename: 'malware.png',
                        mimetype: 'image/png'
                    }
                }
            };

            const html = renderer.renderMessage(message);

            expect(html).toContain('Invalid file attachment');
            expect(html).not.toContain('http://evil.com');
        });

        it('should only show caption if different from filename', () => {
            const message = {
                id: 'msg1',
                sender: 'customer',
                content: 'test.png', // Same as filename
                metadata: {
                    file: {
                        url: '/api/uploads/test.png',
                        filename: 'test.png',
                        mimetype: 'image/png'
                    }
                }
            };

            const html = renderer.renderMessage(message);

            // Caption should not appear twice
            const matches = (html.match(/test\.png/g) || []).length;
            expect(matches).toBeLessThanOrEqual(2); // Once in filename, maybe once in URL
        });
    });

    describe('Customer Widget - renderFileMessage', () => {
        let VilniusChat;

        beforeEach(() => {
            // Setup localStorage mock
            global.localStorage = {
                getItem: jest.fn(),
                setItem: jest.fn(),
                removeItem: jest.fn(),
                clear: jest.fn()
            };

            // Load widget.js (IIFE)
            const widgetPath = path.resolve('custom-widget/widget.js');
            const widgetCode = fs.readFileSync(widgetPath, 'utf8');

            // Execute widget IIFE in global context
            // Wrap in function to capture VilniusChat
            const wrappedCode = `
                ${widgetCode}
                return VilniusChat;
            `;

            const func = new Function(wrappedCode);
            VilniusChat = func.call(global);
        });

        afterEach(() => {
            delete global.localStorage;
        });

        it('should escape HTML in escapeHtml() function', () => {
            const xssInput = '<script>alert("xss")</script>';
            const escaped = VilniusChat.escapeHtml(xssInput);

            expect(escaped).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
            expect(escaped).not.toContain('<script>');
        });

        it('should escape HTML entities in escapeHtml()', () => {
            const input = '"><img src=x onerror=alert(1)>';
            const escaped = VilniusChat.escapeHtml(input);

            expect(escaped).toContain('&quot;');
            expect(escaped).toContain('&gt;');
            expect(escaped).not.toContain('onerror=');
        });

        it('should validate relative URL path in renderFileMessage', () => {
            const fileMetadata = {
                url: '/api/uploads/test.png',
                filename: 'test.png',
                mimetype: 'image/png'
            };
            const fileUrl = 'http://localhost:3002/api/uploads/test.png';

            const html = VilniusChat.renderFileMessage(fileMetadata, 'Caption', fileUrl);

            // Should accept because fileMetadata.url starts with /api/uploads/
            expect(html).not.toContain('Invalid file attachment');
            expect(html).toContain('test.png');
        });

        it('should reject malicious URL in fileMetadata.url', () => {
            const fileMetadata = {
                url: 'javascript:alert(1)',
                filename: 'fake.png',
                mimetype: 'image/png'
            };
            const fileUrl = 'http://localhost:3002/api/uploads/fake.png';

            const html = VilniusChat.renderFileMessage(fileMetadata, 'Caption', fileUrl);

            expect(html).toContain('Invalid file attachment');
            expect(html).not.toContain('javascript:');
        });

        it('should use absolute URL for rendering but validate relative URL', () => {
            const fileMetadata = {
                url: '/api/uploads/image.png', // Relative (validated)
                filename: 'image.png',
                mimetype: 'image/png'
            };
            const fileUrl = 'http://localhost:3002/api/uploads/image.png'; // Absolute (used)

            const html = VilniusChat.renderFileMessage(fileMetadata, 'Image', fileUrl);

            // Should use absolute URL in src
            expect(html).toContain('http://localhost:3002/api/uploads/image.png');
            // But validation passed because fileMetadata.url is relative and valid
            expect(html).not.toContain('Invalid file attachment');
        });

        it('should escape filename in download link', () => {
            const fileMetadata = {
                url: '/api/uploads/safe.pdf',
                filename: '"><script>alert(1)</script>',
                mimetype: 'application/pdf'
            };
            const fileUrl = 'http://localhost:3002/api/uploads/safe.pdf';

            const html = VilniusChat.renderFileMessage(fileMetadata, 'PDF', fileUrl);

            expect(html).not.toContain('<script>');
            expect(html).toContain('&quot;');
        });

        it('should escape caption text', () => {
            const fileMetadata = {
                url: '/api/uploads/test.png',
                filename: 'test.png',
                mimetype: 'image/png'
            };
            const caption = '<img src=x onerror=alert(1)>';
            const fileUrl = 'http://localhost:3002/api/uploads/test.png';

            const html = VilniusChat.renderFileMessage(fileMetadata, caption, fileUrl);

            expect(html).not.toContain('onerror=alert');
            expect(html).toContain('&lt;img');
        });

        it('should render image with escaped absolute URL', () => {
            const fileMetadata = {
                url: '/api/uploads/photo.jpg',
                filename: 'photo.jpg',
                mimetype: 'image/jpeg'
            };
            const fileUrl = 'http://localhost:3002/api/uploads/photo.jpg';

            const html = VilniusChat.renderFileMessage(fileMetadata, 'Photo', fileUrl);

            expect(html).toContain('<img src=');
            expect(html).toContain('http://localhost:3002/api/uploads/photo.jpg');
            expect(html).toContain('<a href=');
        });

        it('should render document with escaped filename and download attribute', () => {
            const fileMetadata = {
                url: '/api/uploads/document.docx',
                filename: 'report.docx',
                mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            };
            const fileUrl = 'http://localhost:3002/api/uploads/document.docx';

            const html = VilniusChat.renderFileMessage(fileMetadata, 'Report', fileUrl);

            expect(html).toContain('📎');
            expect(html).toContain('download=');
            expect(html).toContain('report.docx');
            expect(html).not.toContain('<img');
        });
    });

    describe('XSS Attack Vectors', () => {
        let VilniusChat;

        beforeEach(() => {
            global.localStorage = {
                getItem: jest.fn(),
                setItem: jest.fn(),
                removeItem: jest.fn(),
                clear: jest.fn()
            };

            const widgetPath = path.resolve('custom-widget/widget.js');
            const widgetCode = fs.readFileSync(widgetPath, 'utf8');
            const wrappedCode = `${widgetCode}\nreturn VilniusChat;`;
            const func = new Function(wrappedCode);
            VilniusChat = func.call(global);
        });

        afterEach(() => {
            delete global.localStorage;
        });

        it('should prevent XSS via filename with script tag', () => {
            const fileMetadata = {
                url: '/api/uploads/safe.png',
                filename: '"><script>alert(1)</script><div class="',
                mimetype: 'image/png'
            };
            const fileUrl = 'http://localhost:3002/api/uploads/safe.png';

            const html = VilniusChat.renderFileMessage(fileMetadata, 'Test', fileUrl);

            // Parse HTML to verify no script execution
            const div = document.createElement('div');
            div.innerHTML = html;

            const scripts = div.getElementsByTagName('script');
            expect(scripts.length).toBe(0);
        });

        it('should prevent XSS via caption with img onerror', () => {
            const fileMetadata = {
                url: '/api/uploads/test.png',
                filename: 'test.png',
                mimetype: 'image/png'
            };
            const caption = '<img src=x onerror=alert(document.cookie)>';
            const fileUrl = 'http://localhost:3002/api/uploads/test.png';

            const html = VilniusChat.renderFileMessage(fileMetadata, caption, fileUrl);

            expect(html).not.toContain('onerror=alert');

            // Verify when rendered to DOM
            const div = document.createElement('div');
            div.innerHTML = html;

            const imgs = div.querySelectorAll('img[onerror]');
            expect(imgs.length).toBe(0);
        });

        it('should prevent XSS via URL with javascript: scheme', () => {
            const fileMetadata = {
                url: 'javascript:alert(document.cookie)',
                filename: 'fake.png',
                mimetype: 'image/png'
            };
            const fileUrl = 'javascript:alert(document.cookie)';

            const html = VilniusChat.renderFileMessage(fileMetadata, 'XSS', fileUrl);

            expect(html).toContain('Invalid file attachment');
            expect(html).not.toContain('javascript:');

            // Verify no executable links
            const div = document.createElement('div');
            div.innerHTML = html;

            const links = div.querySelectorAll('a[href^="javascript:"]');
            expect(links.length).toBe(0);
        });
    });
});
