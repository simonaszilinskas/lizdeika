/**
 * Widget Accessibility Test Suite
 * Tests accessibility features including ARIA attributes, keyboard navigation, and screen reader support
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Widget Accessibility', () => {
    let dom;
    let window;
    let document;
    let VilniusChat;

    beforeEach(() => {
        dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
            url: 'http://localhost',
            pretendToBeVisual: true,
            resources: 'usable'
        });
        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn()
        };
        global.io = jest.fn(() => ({
            on: jest.fn(),
            emit: jest.fn(),
            connected: false
        }));

        const widgetCode = fs.readFileSync(
            path.join(__dirname, '../../custom-widget/widget.js'),
            'utf8'
        );
        const widgetScript = new window.Function(widgetCode);
        widgetScript.call(window);
        VilniusChat = window.VilniusChat;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    describe('ARIA Attributes', () => {
        test('chat bubble has proper ARIA attributes', async () => {
            await VilniusChat.init({ apiUrl: 'http://localhost:3002' });

            const bubble = document.getElementById('vilnius-chat-bubble');
            expect(bubble).toBeTruthy();
            expect(bubble.getAttribute('aria-label')).toBe('Atidaryti pokalbių langą');
            expect(bubble.getAttribute('aria-haspopup')).toBe('dialog');
            expect(bubble.getAttribute('aria-expanded')).toBe('false');
            expect(bubble.getAttribute('aria-controls')).toBe('vilnius-chat-window');
        });

        test('chat window has dialog role and proper ARIA attributes', async () => {
            await VilniusChat.init({ apiUrl: 'http://localhost:3002' });

            const chatWindow = document.getElementById('vilnius-chat-window');
            expect(chatWindow).toBeTruthy();
            expect(chatWindow.getAttribute('role')).toBe('dialog');
            expect(chatWindow.getAttribute('aria-modal')).toBe('true');
            expect(chatWindow.getAttribute('aria-hidden')).toBe('true');
            expect(chatWindow.getAttribute('aria-labelledby')).toBe('vilnius-chat-title');
        });

        test('messages container has log role and live region attributes', async () => {
            await VilniusChat.init({ apiUrl: 'http://localhost:3002' });

            const messagesContainer = document.getElementById('vilnius-messages');
            expect(messagesContainer).toBeTruthy();
            expect(messagesContainer.getAttribute('role')).toBe('log');
            expect(messagesContainer.getAttribute('aria-live')).toBe('polite');
            expect(messagesContainer.getAttribute('aria-relevant')).toBe('additions text');
        });

        test('live region exists with proper attributes', async () => {
            await VilniusChat.init({ apiUrl: 'http://localhost:3002' });

            const liveRegion = document.getElementById('vilnius-live-region');
            expect(liveRegion).toBeTruthy();
            expect(liveRegion.getAttribute('role')).toBe('status');
            expect(liveRegion.getAttribute('aria-live')).toBe('polite');
            expect(liveRegion.getAttribute('aria-atomic')).toBe('false');
        });

        test('start chat button has aria-disabled attribute', async () => {
            await VilniusChat.init({ apiUrl: 'http://localhost:3002' });

            const startChatBtn = document.getElementById('vilnius-start-chat-btn');
            expect(startChatBtn).toBeTruthy();
            expect(startChatBtn.getAttribute('aria-disabled')).toBe('true');
            expect(startChatBtn.disabled).toBe(true);
        });
    });

    describe('Keyboard Navigation', () => {
        test('escape key closes chat window', async () => {
            await VilniusChat.init({ apiUrl: 'http://localhost:3002' });

            VilniusChat.openChatWindow();
            const chatWindow = document.getElementById('vilnius-chat-window');
            expect(chatWindow.getAttribute('aria-hidden')).toBe('false');

            const escapeEvent = new window.KeyboardEvent('keydown', { key: 'Escape' });
            chatWindow.dispatchEvent(escapeEvent);

            expect(chatWindow.getAttribute('aria-hidden')).toBe('true');
        });

        test('focus trap handles Tab key at boundaries', async () => {
            await VilniusChat.init({ apiUrl: 'http://localhost:3002' });

            const privacyCheckbox = document.getElementById('vilnius-privacy-checkbox');
            privacyCheckbox.checked = true;
            privacyCheckbox.dispatchEvent(new window.Event('change'));

            const startChatBtn = document.getElementById('vilnius-start-chat-btn');
            startChatBtn.click();

            VilniusChat.openChatWindow();

            const chatWindow = document.getElementById('vilnius-chat-window');
            const focusableElements = VilniusChat.getFocusableElements(chatWindow);

            expect(focusableElements.length).toBeGreaterThan(0);
        });

        test('focus is returned to bubble when closing', async () => {
            await VilniusChat.init({ apiUrl: 'http://localhost:3002' });

            const bubble = document.getElementById('vilnius-chat-bubble');
            VilniusChat.openChatWindow();
            VilniusChat.closeChatWindow();

            expect(document.activeElement).toBe(bubble);
        });
    });

    describe('Focus Management', () => {
        test('openChatWindow updates aria-expanded on bubble', async () => {
            await VilniusChat.init({ apiUrl: 'http://localhost:3002' });

            const bubble = document.getElementById('vilnius-chat-bubble');
            expect(bubble.getAttribute('aria-expanded')).toBe('false');

            VilniusChat.openChatWindow();
            expect(bubble.getAttribute('aria-expanded')).toBe('true');
        });

        test('closeChatWindow clears focusable elements cache', async () => {
            await VilniusChat.init({ apiUrl: 'http://localhost:3002' });

            VilniusChat.openChatWindow();
            expect(VilniusChat.focusableElementsCache).not.toBeNull();

            VilniusChat.closeChatWindow();
            expect(VilniusChat.focusableElementsCache).toBeNull();
        });

        test('getFocusableElements returns only visible elements', async () => {
            await VilniusChat.init({ apiUrl: 'http://localhost:3002' });

            const chatWindow = document.getElementById('vilnius-chat-window');
            const focusable = VilniusChat.getFocusableElements(chatWindow);

            focusable.forEach(el => {
                const style = window.getComputedStyle(el);
                expect(style.display).not.toBe('none');
                expect(style.visibility).not.toBe('hidden');
                expect(el.getAttribute('aria-hidden')).not.toBe('true');
            });
        });
    });

    describe('Screen Reader Announcements', () => {
        test('stripMarkdown removes markdown formatting', () => {
            const markdown = '**Bold** and *italic* and [link](http://example.com)';
            const stripped = VilniusChat.stripMarkdown(markdown);
            expect(stripped).toBe('Bold and italic and link');
        });

        test('stripMarkdown handles null and undefined', () => {
            expect(VilniusChat.stripMarkdown(null)).toBe('');
            expect(VilniusChat.stripMarkdown(undefined)).toBe('');
        });

        test('getAccessibleSenderInfo returns correct info for visitor', () => {
            const info = VilniusChat.getAccessibleSenderInfo('visitor');
            expect(info.ariaLabel).toBe('Jūsų pranešimas');
            expect(info.announcement).toBe('Jūs');
        });

        test('getAccessibleSenderInfo returns correct info for agent', () => {
            const info = VilniusChat.getAccessibleSenderInfo('agent');
            expect(info.ariaLabel).toBe('Agento pranešimas');
            expect(info.announcement).toBe('Agentas');
        });

        test('getAccessibleSenderInfo returns correct info for AI', () => {
            const info = VilniusChat.getAccessibleSenderInfo('ai');
            expect(info.ariaLabel).toBe('Pagalbos asistento pranešimas');
            expect(info.announcement).toBe('Pagalbos asistentas');
        });

        test('announceNewMessage updates live region', async () => {
            await VilniusChat.init({ apiUrl: 'http://localhost:3002' });
            VilniusChat.initialMessagesLoaded = true;

            const liveRegion = document.getElementById('vilnius-live-region');
            const message = {
                sender: 'agent',
                content: 'Test message'
            };

            VilniusChat.announceNewMessage(message);
            expect(liveRegion.textContent).toBe('Agentas: Test message');
        });

        test('announceNewMessage handles file attachments', async () => {
            await VilniusChat.init({ apiUrl: 'http://localhost:3002' });
            VilniusChat.initialMessagesLoaded = true;

            const liveRegion = document.getElementById('vilnius-live-region');
            const message = {
                sender: 'visitor',
                metadata: {
                    file: {
                        filename: 'test.pdf'
                    }
                }
            };

            VilniusChat.announceNewMessage(message);
            expect(liveRegion.textContent).toBe('Jūs: pridėtas failas test.pdf');
        });

        test('renderMessages does not announce during initial load', async () => {
            await VilniusChat.init({ apiUrl: 'http://localhost:3002' });
            VilniusChat.initialMessagesLoaded = false;

            const liveRegion = document.getElementById('vilnius-live-region');
            const messages = [{
                id: 'test-1',
                sender: 'agent',
                content: 'Test message'
            }];

            VilniusChat.renderMessages(messages);
            expect(liveRegion.textContent).toBe('');
        });
    });

    describe('File Attachment Accessibility', () => {
        test('attach button has aria-label', async () => {
            await VilniusChat.init({ apiUrl: 'http://localhost:3002' });

            const attachButton = document.getElementById('vilnius-attach-button');
            expect(attachButton.getAttribute('aria-label')).toBe('Pridėti failą');
        });

        test('file preview has role status', async () => {
            await VilniusChat.init({ apiUrl: 'http://localhost:3002' });

            const filePreview = document.getElementById('vilnius-file-preview');
            expect(filePreview.getAttribute('role')).toBe('status');
            expect(filePreview.getAttribute('aria-live')).toBe('polite');
        });
    });

    describe('Message Accessibility', () => {
        test('messages have article role and aria-label', async () => {
            await VilniusChat.init({ apiUrl: 'http://localhost:3002' });
            VilniusChat.initialMessagesLoaded = true;

            VilniusChat.addMessage('Test message', 'user', 'test-id');

            const message = document.querySelector('[data-message-id="test-id"]');
            expect(message.getAttribute('role')).toBe('article');
            expect(message.getAttribute('aria-label')).toBe('Jūsų pranešimas');
        });

        test('typing indicator has proper ARIA attributes', async () => {
            await VilniusChat.init({ apiUrl: 'http://localhost:3002' });

            const typingId = VilniusChat.showTypingIndicator();
            const typingIndicator = document.getElementById(typingId);

            expect(typingIndicator.getAttribute('role')).toBe('status');
            expect(typingIndicator.getAttribute('aria-live')).toBe('polite');
            expect(typingIndicator.getAttribute('aria-label')).toBe('Agentas rašo');
        });
    });
});
