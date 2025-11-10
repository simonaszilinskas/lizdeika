/**
 * VILNIUS CHAT WIDGET - CUSTOMER INTERFACE
 * 
 * Main Purpose: Embeddable chat widget for customer-facing websites
 * 
 * Key Responsibilities:
 * - Customer Chat Interface: Provide intuitive chat UI for website visitors
 * - Real-time Communication: WebSocket-based messaging with fallback to polling
 * - Session Management: Handle visitor identification and conversation persistence
 * - AI Integration: Interface with backend AI services for automated responses
 * - Multi-language Support: Lithuanian localization for customer messages
 * 
 * Dependencies:
 * - Socket.io client library for WebSocket communication
 * - Backend chat API on configurable server endpoint
 * - Browser localStorage for session persistence
 * 
 * Features:
 * - Floating chat bubble with customizable positioning and theming
 * - Expandable chat window with message history
 * - Typing indicators for both customer and agent
 * - Markdown rendering for rich AI responses
 * - Automatic message polling fallback when WebSocket fails
 * - Responsive design with mobile-friendly interface
 * - Error handling with user-friendly messages in Lithuanian
 * 
 * Configuration:
 * - apiUrl: Backend server URL (default: localhost:3002)
 * - flowiseUrl: Flowise server URL for direct AI integration
 * - theme.primaryColor: Widget color scheme
 * - theme.position: Widget placement (bottom-right/bottom-left)
 * 
 * Notes:
 * - Self-contained IIFE to avoid global namespace pollution
 * - Generates unique visitor and session IDs for tracking
 * - Handles both AI responses and human agent handoff
 * - Includes comprehensive error handling and connection recovery
 */
(function() {
    'use strict';

    const VilniusChat = {
        config: {
            apiUrl: window.location.origin,
            flowiseUrl: window.location.origin, // Legacy: Flowise integration (unused, backend handles AI provider)
            flowiseChatflowId: '',
            theme: {
                primaryColor: '#4F46E5',
                position: 'bottom-right'
            }
        },
        privacyAccepted: false,
        privacyCheckboxText: '',
        initialMessagesLoaded: false,
        focusableElementsCache: null,

        init: function(options) {
            Object.assign(this.config, options);
            this.loadPrivacySettings().then(() => {
                this.createWidget();
                this.updatePrivacyText();
                this.attachEventListeners();
                this.initializeWebSocket();
                this.loadConversation();
            });
        },

        createWidget: function() {
            const srOnlyStyle = 'position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0;';
            const widgetHTML = `
                <div id="vilnius-chat-container" style="
                    position: fixed;
                    ${this.config.theme.position === 'bottom-right' ? 'right: 20px; bottom: 20px;' : 'left: 20px; bottom: 20px;'}
                    z-index: 9999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                ">
                    <!-- Chat Bubble -->
                    <button id="vilnius-chat-bubble" type="button" aria-label="Atidaryti pokalbių langą" aria-haspopup="dialog" aria-controls="vilnius-chat-window" aria-expanded="false" style="
                        width: 60px;
                        height: 60px;
                        border-radius: 50%;
                        background: ${this.config.theme.primaryColor};
                        border: none;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: transform 0.3s ease;
                    ">
                        <span class="vilnius-sr-only" style="${srOnlyStyle}">Atidaryti pokalbių langą</span>
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
                            <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L1 23l6.71-1.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.41 0-2.73-.36-3.88-.99l-.28-.15-2.9.85.85-2.9-.15-.28C4.36 14.73 4 13.41 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/>
                            <path d="M7 9h10v2H7zm0 3h7v2H7z"/>
                        </svg>
                    </button>

                    <!-- Chat Window -->
                    <div id="vilnius-chat-window" style="
                        display: none;
                        position: absolute;
                        bottom: 80px;
                        ${this.config.theme.position === 'bottom-right' ? 'right: 0;' : 'left: 0;'}
                        width: 380px;
                        height: 600px;
                        background: white;
                        border-radius: 16px;
                        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                        overflow: hidden;
                        flex-direction: column;
                    " role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="vilnius-chat-title" tabindex="-1">
                        <!-- Privacy Gate Overlay (shown initially) -->
                        <div id="vilnius-privacy-gate" style="
                            display: flex;
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            padding: 40px 32px;
                            background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
                        " aria-hidden="false">
                            <div style="
                                text-align: center;
                                max-width: 320px;
                            ">
                                <!-- Icon -->
                                <div style="
                                    width: 80px;
                                    height: 80px;
                                    margin: 0 auto 24px;
                                    background: ${this.config.theme.primaryColor};
                                    border-radius: 50%;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                                ">
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                                        <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L1 23l6.71-1.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.41 0-2.73-.36-3.88-.99l-.28-.15-2.9.85.85-2.9-.15-.28C4.36 14.73 4 13.41 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/>
                                    </svg>
                                </div>

                                <!-- Welcome Text -->
                                <h3 style="
                                    margin: 0 0 12px 0;
                                    font-size: 20px;
                                    font-weight: 600;
                                    color: #111827;
                                ">Sveiki!</h3>
                                <p style="
                                    margin: 0 0 28px 0;
                                    font-size: 14px;
                                    color: #6b7280;
                                    line-height: 1.6;
                                ">Prieš pradėdami pokalbį, prašome susipažinti su mūsų privatumo politika.</p>

                                <!-- Privacy Checkbox -->
                                <div style="
                                    background: white;
                                    padding: 16px;
                                    border-radius: 12px;
                                    margin-bottom: 20px;
                                    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                                    border: 2px solid #e5e7eb;
                                ">
                                    <label style="
                                        display: flex;
                                        align-items: flex-start;
                                        cursor: pointer;
                                        font-size: 13px;
                                        color: #374151;
                                        line-height: 1.6;
                                        text-align: left;
                                    ">
                                        <input
                                            type="checkbox"
                                            id="vilnius-privacy-checkbox"
                                            aria-required="true"
                                            aria-label="Accept privacy policy and terms of service"
                                            style="
                                                margin-right: 10px;
                                                margin-top: 3px;
                                                cursor: pointer;
                                                width: 18px;
                                                height: 18px;
                                                flex-shrink: 0;
                                            "
                                        />
                                        <span id="vilnius-privacy-text" style="flex: 1;">
                                            <!-- Privacy text will be loaded from settings -->
                                        </span>
                                    </label>
                                </div>

                                <!-- Start Chat Button -->
                                <button id="vilnius-start-chat-btn" type="button" disabled aria-disabled="true" aria-describedby="vilnius-privacy-text" style="
                                    width: 100%;
                                    padding: 14px 24px;
                                    background: ${this.config.theme.primaryColor};
                                    color: white;
                                    border: none;
                                    border-radius: 12px;
                                    font-size: 15px;
                                    font-weight: 600;
                                    cursor: pointer;
                                    transition: all 0.3s ease;
                                    opacity: 0.5;
                                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                                ">
                                    Pradėti pokalbį
                                </button>
                            </div>
                        </div>

                        <!-- Main Chat Interface (hidden initially) -->
                        <div id="vilnius-chat-interface" style="
                            display: none;
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            flex-direction: column;
                        " aria-hidden="true">
                            <!-- Header -->
                            <div style="
                                background: ${this.config.theme.primaryColor};
                                color: white;
                                padding: 12px 16px;
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                            ">
                                <div>
                                    <h3 id="vilnius-chat-title" style="margin: 0; font-size: 15px;">Pagalbos asistentas</h3>
                                </div>
                                <button id="vilnius-close-chat" type="button" aria-label="Uždaryti pokalbių langą" style="
                                    background: none;
                                    border: none;
                                    color: white;
                                    cursor: pointer;
                                    padding: 8px;
                                ">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                    </svg>
                                </button>
                            </div>

                            <!-- Messages Container -->
                            <div id="vilnius-messages" role="log" aria-live="polite" aria-relevant="additions text" aria-label="Pokalbio pranešimai" tabindex="0" style="
                                flex: 1;
                                overflow-y: auto;
                                padding: 20px;
                                background: #f9fafb;
                            ">
                                <!-- Typing indicator for agent -->
                                <div id="vilnius-agent-typing" style="
                                    display: none;
                                    margin-bottom: 16px;
                                    font-size: 14px;
                                    font-style: italic;
                                    color: #6b7280;
                                " role="status" aria-live="polite">Agentas rašo...</div>
                                <div class="vilnius-message vilnius-ai" role="article" aria-label="Pagalbos asistento pranešimas" style="
                                    margin-bottom: 16px;
                                    display: flex;
                                    align-items: flex-start;
                                ">
                                    <div style="
                                        background: white;
                                        padding: 12px 16px;
                                        border-radius: 12px;
                                        max-width: 80%;
                                        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                                    ">
                                        <p style="margin: 0; color: #1f2937;">
                                            Labas! Aš čia, kad padėčiau. Kuo galiu jums padėti šiandien?
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <!-- Input Area -->
                            <div style="
                                background: white;
                                border-top: 1px solid #e5e7eb;
                                padding: 16px;
                            ">
                                <form id="vilnius-chat-form" style="
                                    display: flex;
                                    gap: 12px;
                                    align-items: center;
                                ">
                                <input
                                    type="file"
                                    id="vilnius-file-input"
                                    style="display: none;"
                                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                                />
                                <button type="button" id="vilnius-attach-button" aria-label="Pridėti failą" style="
                                    background: none;
                                    border: none;
                                    color: #6b7280;
                                    cursor: pointer;
                                    padding: 8px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    transition: color 0.3s;
                                ">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
                                    </svg>
                                </button>
                                <input
                                    id="vilnius-chat-input"
                                    type="text"
                                    placeholder="Rašykite savo pranešimą..."
                                    aria-label="Rašykite savo pranešimą"
                                    style="
                                        flex: 1;
                                        padding: 12px 16px;
                                        border: 1px solid #e5e7eb;
                                        border-radius: 24px;
                                        outline: none;
                                        font-size: 14px;
                                        transition: border-color 0.3s;
                                    "
                                />
                                <button id="vilnius-send-button" type="submit" aria-label="Siųsti pranešimą" style="
                                    background: ${this.config.theme.primaryColor};
                                    color: white;
                                    border: none;
                                    border-radius: 50%;
                                    width: 44px;
                                    height: 44px;
                                    cursor: pointer;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    transition: background 0.3s;
                                ">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                                    </svg>
                                </button>
                            </form>
                            <div id="vilnius-file-preview" role="status" aria-live="polite" style="
                                margin-top: 8px;
                                display: none;
                                padding: 8px;
                                background: #f3f4f6;
                                border-radius: 8px;
                                font-size: 14px;
                            "></div>
                            </div>
                        </div>
                    </div>
                    <div id="vilnius-live-region" role="status" aria-live="polite" aria-atomic="false" style="${srOnlyStyle}"></div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', widgetHTML);
        },

        attachEventListeners: function() {
            const bubble = document.getElementById('vilnius-chat-bubble');
            const chatWindow = document.getElementById('vilnius-chat-window');
            const closeBtn = document.getElementById('vilnius-close-chat');
            const form = document.getElementById('vilnius-chat-form');
            const input = document.getElementById('vilnius-chat-input');
            const attachButton = document.getElementById('vilnius-attach-button');
            const fileInput = document.getElementById('vilnius-file-input');
            const filePreview = document.getElementById('vilnius-file-preview');
            const privacyCheckbox = document.getElementById('vilnius-privacy-checkbox');
            const startChatBtn = document.getElementById('vilnius-start-chat-btn');
            const privacyGate = document.getElementById('vilnius-privacy-gate');
            const chatInterface = document.getElementById('vilnius-chat-interface');
            const liveRegion = document.getElementById('vilnius-live-region');

            if (!bubble || !chatWindow || !closeBtn || !form || !input || !attachButton || !fileInput || !filePreview || !startChatBtn || !privacyGate || !chatInterface || !liveRegion) {
                return;
            }

            const updateStartChatAccessibility = () => {
                startChatBtn.setAttribute('aria-disabled', this.privacyAccepted ? 'false' : 'true');
            };

            // Privacy checkbox handler - enables Start Chat button
            if (privacyCheckbox && startChatBtn) {
                privacyCheckbox.addEventListener('change', () => {
                    this.privacyAccepted = privacyCheckbox.checked;
                    startChatBtn.disabled = !this.privacyAccepted;
                    updateStartChatAccessibility();

                    if (this.privacyAccepted) {
                        startChatBtn.style.opacity = '1';
                        startChatBtn.style.cursor = 'pointer';
                        startChatBtn.style.transform = 'scale(1.02)';
                    } else {
                        startChatBtn.style.opacity = '0.5';
                        startChatBtn.style.cursor = 'not-allowed';
                        startChatBtn.style.transform = 'scale(1)';
                    }
                });

                updateStartChatAccessibility();
            }

            // Start Chat button - shows chat interface
            if (startChatBtn && privacyGate && chatInterface) {
                startChatBtn.addEventListener('click', () => {
                    if (this.privacyAccepted) {
                        privacyGate.style.display = 'none';
                        privacyGate.setAttribute('aria-hidden', 'true');
                        chatInterface.style.display = 'flex';
                        chatInterface.setAttribute('aria-hidden', 'false');
                        if (input) {
                            input.focus();
                        }
                    }
                });
            }

            bubble.addEventListener('click', () => {
                if (chatWindow.getAttribute('aria-hidden') === 'true') {
                    this.openChatWindow();
                } else {
                    this.closeChatWindow();
                }
            });

            closeBtn.addEventListener('click', () => {
                this.closeChatWindow();
            });

            chatWindow.addEventListener('keydown', (event) => {
                if (chatWindow.getAttribute('aria-hidden') === 'true') {
                    return;
                }

                if (event.key === 'Escape') {
                    event.preventDefault();
                    this.closeChatWindow();
                    return;
                }

                if (event.key === 'Tab') {
                    const focusableElements = this.focusableElementsCache || this.getFocusableElements(chatWindow);
                    if (focusableElements.length === 0) return;

                    const firstElement = focusableElements[0];
                    const lastElement = focusableElements[focusableElements.length - 1];
                    const activeElement = document.activeElement;

                    if (!chatWindow.contains(activeElement)) {
                        event.preventDefault();
                        firstElement.focus();
                        return;
                    }

                    if (event.shiftKey) {
                        if (activeElement === firstElement) {
                            event.preventDefault();
                            lastElement.focus();
                        }
                    } else if (activeElement === lastElement) {
                        event.preventDefault();
                        firstElement.focus();
                    }
                }
            });

            // File attachment handling
            attachButton.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.selectedFile = file;
                    filePreview.style.display = 'block';
                    filePreview.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>📎 ${file.name}</span>
                            <button type="button" id="vilnius-remove-file" aria-label="Pašalinti priedą" style="
                                background: none;
                                border: none;
                                color: #ef4444;
                                cursor: pointer;
                                padding: 4px;
                            ">✕</button>
                        </div>
                    `;

                    document.getElementById('vilnius-remove-file').addEventListener('click', () => {
                        this.selectedFile = null;
                        fileInput.value = '';
                        filePreview.style.display = 'none';
                        liveRegion.textContent = 'Priedas pašalintas.';
                    });

                    liveRegion.textContent = `Prisegtas failas ${file.name}`;
                }
            });

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const message = input.value.trim();

                if (this.selectedFile) {
                    await this.sendFileMessage(this.selectedFile, message);
                    this.selectedFile = null;
                    fileInput.value = '';
                    filePreview.style.display = 'none';
                    liveRegion.textContent = 'Failas išsiųstas.';
                } else if (message) {
                    await this.sendMessage(message);
                }

                input.value = '';
            });
            
            // Add typing indicators for customer
            let typingTimer;
            input.addEventListener('input', () => {
                this.sendCustomerTyping(true);
                
                // Clear existing timer
                clearTimeout(typingTimer);
                
                // Set timer to stop typing after 1 second of inactivity
                typingTimer = setTimeout(() => {
                    this.sendCustomerTyping(false);
                }, 1000);
            });
            
            input.addEventListener('blur', () => {
                this.sendCustomerTyping(false);
                clearTimeout(typingTimer);
            });


            // Style focus states
            input.addEventListener('focus', () => {
                input.style.borderColor = this.config.theme.primaryColor;
            });

            input.addEventListener('blur', () => {
                input.style.borderColor = '#e5e7eb';
            });
        },

        openChatWindow() {
            const chatWindow = document.getElementById('vilnius-chat-window');
            const bubble = document.getElementById('vilnius-chat-bubble');
            const privacyGate = document.getElementById('vilnius-privacy-gate');
            const privacyCheckbox = document.getElementById('vilnius-privacy-checkbox');
            const startChatBtn = document.getElementById('vilnius-start-chat-btn');
            const chatInterface = document.getElementById('vilnius-chat-interface');
            const input = document.getElementById('vilnius-chat-input');

            if (!chatWindow || !bubble) return;

            chatWindow.style.display = 'flex';
            chatWindow.setAttribute('aria-hidden', 'false');
            bubble.setAttribute('aria-expanded', 'true');
            if (privacyGate) {
                privacyGate.setAttribute('aria-hidden', privacyGate.style.display === 'none' ? 'true' : 'false');
            }
            if (chatInterface) {
                chatInterface.setAttribute('aria-hidden', chatInterface.style.display === 'none' ? 'true' : 'false');
            }

            this.focusableElementsCache = this.getFocusableElements(chatWindow);

            if (privacyGate && privacyGate.style.display !== 'none') {
                const focusTarget = privacyCheckbox || startChatBtn || chatWindow;
                if (focusTarget && typeof focusTarget.focus === 'function') {
                    focusTarget.focus();
                }
            } else if (chatInterface && chatInterface.style.display !== 'none' && input) {
                input.focus();
            } else {
                chatWindow.focus();
            }
        },

        closeChatWindow() {
            const chatWindow = document.getElementById('vilnius-chat-window');
            const bubble = document.getElementById('vilnius-chat-bubble');

            if (!chatWindow || !bubble) return;

            chatWindow.style.display = 'none';
            chatWindow.setAttribute('aria-hidden', 'true');
            bubble.setAttribute('aria-expanded', 'false');
            this.focusableElementsCache = null;
            bubble.focus();
        },

        getFocusableElements(container) {
            if (!container) return [];
            const focusableSelectors = [
                'a[href]',
                'area[href]',
                'button:not([disabled])',
                'input:not([disabled])',
                'select:not([disabled])',
                'textarea:not([disabled])',
                '[tabindex]:not([tabindex="-1"])'
            ];

            return Array.from(container.querySelectorAll(focusableSelectors.join(',')))
                .filter(el => {
                    if (el.getAttribute('aria-hidden') === 'true') {
                        return false;
                    }

                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden';
                });
        },

        getAccessibleSenderInfo(sender) {
            switch (sender) {
                case 'visitor':
                case 'user':
                    return {
                        ariaLabel: 'Jūsų pranešimas',
                        announcement: 'Jūs'
                    };
                case 'agent':
                    return {
                        ariaLabel: 'Agento pranešimas',
                        announcement: 'Agentas'
                    };
                default:
                    return {
                        ariaLabel: 'Pagalbos asistento pranešimas',
                        announcement: 'Pagalbos asistentas'
                    };
            }
        },

        announceNewMessage(message) {
            const liveRegion = document.getElementById('vilnius-live-region');
            if (!liveRegion) return;
            if (!message || typeof message !== 'object') return;

            const senderInfo = this.getAccessibleSenderInfo(message.sender);
            let announcementText = '';

            if (message.metadata && message.metadata.file) {
                const filename = message.metadata.file.filename || message.metadata.file.originalname || 'failas';
                announcementText = `pridėtas failas ${filename}`;
            } else if (message.content) {
                announcementText = this.stripMarkdown(message.content);
            } else if (message.text) {
                announcementText = this.stripMarkdown(message.text);
            }

            if (!announcementText) {
                announcementText = 'naujas pranešimas';
            }

            liveRegion.textContent = `${senderInfo.announcement}: ${announcementText}`;
        },

        stripMarkdown(text) {
            if (text === null || text === undefined) {
                return '';
            }

            let content = text;
            if (typeof content === 'object' && content.response) {
                content = content.response;
            }

            if (typeof content !== 'string') {
                content = String(content);
            }

            return content
                .replace(/!\[[^\]]*\]\([^\)]*\)/g, '') // Remove images
                .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Links to text
                .replace(/^>\s?/gm, '') // Blockquotes
                .replace(/^#{1,6}\s*/gm, '') // Headings
                .replace(/^\s*[-+*]\s+/gm, '') // List markers
                .replace(/[*_`~]/g, '') // Emphasis markers
                .replace(/\s+/g, ' ')
                .trim();
        },

        initializeWebSocket: function() {
            const wsUrl = this.config.apiUrl.replace('http', 'ws');
            this.socket = io(wsUrl);
            
            this.socket.on('connect', () => {
                console.log('Widget connected to WebSocket server');
                
                // Join conversation room if we have an active conversation
                if (this.conversationId) {
                    this.socket.emit('join-conversation', this.conversationId);
                }
            });
            
            this.socket.on('disconnect', () => {
                console.log('Widget disconnected from WebSocket server');
            });
            
            // Listen for agent messages
            this.socket.on('agent-message', (data) => {
                console.log('Received agent message:', data);

                // Filter out internal system messages
                if (this.isInternalSystemMessage(data.message.content, data.message.sender, data.message.metadata)) {
                    return; // Skip internal system messages
                }

                // Check for autopilot disclaimer
                let content = data.message.content;
                if (data.message.metadata && data.message.metadata.displayDisclaimer) {
                    content = `🤖 *Atsako robotas - galimos klaidos*\n\n${content}`;
                }
                this.addMessage(content, 'agent', data.message.id);
            });
            
            // Listen for agent typing status
            this.socket.on('agent-typing-status', (data) => {
                this.showAgentTyping(data.isTyping);
            });
            
            this.socket.on('connect_error', (error) => {
                console.error('Widget WebSocket connection error:', error);
                this.handleConnectionError();
            });
            
            this.socket.on('reconnect', (attemptNumber) => {
                console.log(`Widget reconnected after ${attemptNumber} attempts`);
                this.handleReconnection();
            });
            
            this.socket.on('reconnect_error', (error) => {
                console.error('Widget reconnection error:', error);
            });
            
            this.socket.on('reconnect_failed', () => {
                console.error('Widget reconnection failed - using polling fallback');
                this.ensurePollingActive();
            });
        },
        
        showAgentTyping: function(isTyping) {
            const indicator = document.getElementById('vilnius-agent-typing');
            if (indicator) {
                indicator.style.display = isTyping ? 'block' : 'none';
                
                // Auto-scroll to show typing indicator
                if (isTyping) {
                    const messagesContainer = document.getElementById('vilnius-messages');
                    if (messagesContainer) {
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    }
                }
            }
        },
        
        sendCustomerTyping: function(isTyping) {
            if (this.socket && this.conversationId) {
                this.socket.emit('customer-typing', {
                    conversationId: this.conversationId,
                    isTyping: isTyping
                });
            }
        },

        async loadPrivacySettings() {
            try {
                const response = await fetch(`${this.config.apiUrl}/api/config/branding`);
                if (response.ok) {
                    const data = await response.json();
                    this.privacyCheckboxText = data.data.privacy_checkbox_text?.value ||
                        'I agree to the Privacy Policy and Terms of Service.';
                } else {
                    console.warn('Failed to load privacy settings, using default text');
                    this.privacyCheckboxText = 'I agree to the Privacy Policy and Terms of Service.';
                }
            } catch (error) {
                console.error('Error loading privacy settings:', error);
                this.privacyCheckboxText = 'I agree to the Privacy Policy and Terms of Service.';
            }
        },

        updatePrivacyText() {
            const privacyTextElement = document.getElementById('vilnius-privacy-text');
            if (privacyTextElement && this.privacyCheckboxText) {
                // Use DOM-based rendering instead of innerHTML to prevent XSS
                this.renderMarkdownToDom(privacyTextElement, this.privacyCheckboxText);
            }
        },

        /**
         * Render Markdown text to DOM safely (XSS prevention)
         */
        renderMarkdownToDom(element, text) {
            // Clear existing content
            element.textContent = '';

            // Extract Markdown links [text](url)
            const parts = text.split(/(\[.*?\]\(.*?\))/g);

            parts.forEach(part => {
                // Check if this part is a Markdown link
                const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);

                if (linkMatch) {
                    // Create link element
                    const linkText = linkMatch[1];
                    const linkUrl = linkMatch[2];

                    const link = document.createElement('a');
                    link.textContent = linkText;
                    link.href = this.sanitizeUrl(linkUrl);
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer nofollow';
                    link.style.color = '#4F46E5';
                    link.style.textDecoration = 'underline';

                    element.appendChild(link);
                } else if (part) {
                    // Regular text - create text node
                    element.appendChild(document.createTextNode(part));
                }
            });
        },

        loadConversation: function() {
            const conversationId = localStorage.getItem('vilnius_conversation_id');
            if (conversationId) {
                this.conversationId = conversationId;
                // Load previous messages if needed
                this.loadMessages();
                
                // Join conversation room via WebSocket
                if (this.socket && this.socket.connected) {
                    this.socket.emit('join-conversation', this.conversationId);
                }
                
                // Start polling for new messages (fallback)
                this.startPolling();
            }
        },

        async loadMessages() {
            if (!this.conversationId) return;
            
            try {
                const response = await fetch(`${this.config.apiUrl}/api/conversations/${this.conversationId}/messages`);
                if (response.ok) {
                    const data = await response.json();
                    this.renderMessages(data.messages);
                }
            } catch (error) {
                console.error('Error loading messages:', error);
            }
        },

        renderMessages(messages) {
            const messagesContainer = document.getElementById('vilnius-messages');
            
            // Get all existing message elements
            const existingMessages = Array.from(messagesContainer.querySelectorAll('.vilnius-message:not(:first-child)'));
            
            // Filter messages for customer view
            const visibleMessages = messages.filter(msg => 
                msg.sender === 'visitor' || msg.sender === 'agent' || msg.sender === 'ai'
            );
            
            // Track which messages we've already displayed using data attributes
            const existingMessageIds = new Set(
                existingMessages
                    .map(el => el.getAttribute('data-message-id'))
                    .filter(id => id)
            );
            
            // Check if we have any agent responses
            const hasAgentResponse = visibleMessages.some(msg => msg.sender === 'agent');
            
            // If we have agent responses, remove any system waiting messages
            if (hasAgentResponse) {
                existingMessages.forEach(el => {
                    const msgId = el.getAttribute('data-message-id');
                    if (msgId && msgId.startsWith('system-')) {
                        el.remove();
                    }
                });
            }
            
            const shouldAnnounce = this.initialMessagesLoaded;

            // Only add new messages that haven't been displayed yet
            visibleMessages.forEach(msg => {
                // Check both ID and content to prevent duplicates
                const isDuplicate = existingMessageIds.has(msg.id) ||
                    existingMessages.some(el => {
                        const elContent = el.textContent?.trim();
                        const elSender = el.classList.contains('vilnius-user') ? 'visitor' :
                                        el.classList.contains('vilnius-ai') ? 'ai' : 'agent';
                        // Check if same content and sender (and not system messages)
                        return elContent === msg.content && elSender === msg.sender && msg.content.length > 0;
                    });

                if (!isDuplicate) {
                    const messageEl = this.createMessageElement(msg);
                    messagesContainer.appendChild(messageEl);
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    if (shouldAnnounce) {
                        this.announceNewMessage(msg);
                    }
                }
            });

            if (!this.initialMessagesLoaded) {
                this.initialMessagesLoaded = true;
            }
        },

        createMessageElement(msg) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `vilnius-message vilnius-${msg.sender === 'visitor' ? 'user' : 'ai'}`;
            messageDiv.setAttribute('data-message-id', msg.id);
            const senderInfo = this.getAccessibleSenderInfo(msg.sender);
            messageDiv.setAttribute('role', 'article');
            messageDiv.setAttribute('aria-label', senderInfo.ariaLabel);
            messageDiv.style.cssText = `
                margin-bottom: 16px;
                display: flex;
                align-items: flex-start;
                ${msg.sender === 'visitor' ? 'justify-content: flex-end;' : ''}
            `;

            const bubbleStyle = msg.sender === 'visitor'
                ? `background: ${this.config.theme.primaryColor}; color: white;`
                : 'background: white; color: #1f2937;';

            let content = msg.content;
            if (msg.sender === 'agent' && msg.metadata && msg.metadata.displayDisclaimer) {
                // Add robot disclaimer for autopilot responses (display only)
                content = `🤖 *Atsako robotas - galimos klaidos*\n\n${content}`;
            }

            // Check for file attachment in metadata
            let formattedText;
            if (msg.metadata && msg.metadata.file) {
                const fileUrl = `${this.config.apiUrl}${msg.metadata.file.url}?conversationId=${this.conversationId}`;
                formattedText = this.renderFileMessage(msg.metadata.file, content, fileUrl);
            } else {
                formattedText = (msg.sender === 'agent' || msg.sender === 'ai') ? this.markdownToHtml(content) : content;
            }

            messageDiv.innerHTML = `
                <div style="
                    ${bubbleStyle}
                    padding: 12px 16px;
                    border-radius: 12px;
                    max-width: 80%;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                ">
                    <div style="margin: 0;">${formattedText}</div>
                </div>
            `;

            return messageDiv;
        },

        handleConnectionError: function() {
            console.log('Widget WebSocket failed, ensuring polling is active');
            this.ensurePollingActive();
        },
        
        handleReconnection: function() {
            // Rejoin conversation room if we have one
            if (this.conversationId && this.socket && this.socket.connected) {
                this.socket.emit('join-conversation', this.conversationId);
                console.log('Widget rejoined conversation room after reconnection');
            }
        },
        
        ensurePollingActive: function() {
            if (!this.pollingInterval && this.conversationId) {
                console.log('Starting polling fallback for widget');
                this.startPolling();
            }
        },

        startPolling: function() {
            // Prevent multiple polling intervals
            if (this.pollingInterval) return;
            
            // Poll for new messages every 30 seconds (reduced from 2s)
            this.pollingInterval = setInterval(() => {
                if (this.conversationId) {
                    this.loadMessages();
                }
            }, 30000);
        },

        async sendMessage(message) {
            // Generate a temporary ID for the message
            const tempMessageId = 'temp-' + Date.now();
            
            // Add user message to chat with temporary ID
            this.addMessage(message, 'user', tempMessageId);

            // Show typing indicator
            const typingId = this.showTypingIndicator();

            try {
                // Ensure we have a conversation ID
                const isNewConversation = !this.conversationId;
                if (isNewConversation) {
                    this.conversationId = this.generateSessionId();
                }

                // Send message through backend API
                const response = await fetch(`${this.config.apiUrl}/api/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        conversationId: this.conversationId,
                        message: message,
                        visitorId: this.getVisitorId()
                    })
                });

                const data = await response.json();
                
                // Remove typing indicator
                this.removeTypingIndicator(typingId);
                
                // Replace temp message with the real one from server
                const tempMsg = document.querySelector(`[data-message-id="${tempMessageId}"]`);
                if (tempMsg && data.userMessage) {
                    tempMsg.setAttribute('data-message-id', data.userMessage.id);
                }
                
                // Start polling if this was a new conversation
                if (isNewConversation) {
                    this.startPolling();
                    
                    // Join WebSocket room for this conversation
                    if (this.socket && this.socket.connected) {
                        this.socket.emit('join-conversation', this.conversationId);
                    }
                }
                
                if (data.aiMessage) {
                    // Filter out internal system messages that should not be shown to customers
                    if (!this.isInternalSystemMessage(data.aiMessage.content, data.aiMessage.sender, data.aiMessage.metadata)) {
                        this.addMessage(data.aiMessage.content, data.aiMessage.sender, data.aiMessage.id, data.aiMessage.metadata);
                    }
                } else {
                    // Error handling - only if no aiMessage at all
                    this.addMessage('Atsiprašau, bet įvyko klaida. Pabandykite dar kartą.', 'ai', 'error-' + Date.now());
                }

            } catch (error) {
                console.error('Error sending message:', error);
                this.removeTypingIndicator(typingId);
                
                // Provide different error messages based on error type
                let errorMessage = 'Atsiprašau, bet kyla ryšio problemų. Pabandykite vėliau.';
                
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    errorMessage = 'Nepavyksta prisijungti prie serverio. Patikrinkite interneto ryšį ir pabandykite dar kartą.';
                } else if (error.message.includes('timeout')) {
                    errorMessage = 'Užklausa trunka ilgiau nei tikėtasi. Pabandykite dar kartą.';
                } else if (error.message.includes('500')) {
                    errorMessage = 'Serveris patiria problemų. Pabandykite po kelių akimirkų.';
                }
                
                this.addMessage(errorMessage, 'ai', 'error-' + Date.now());
                
                // Ensure polling is active as fallback
                this.ensurePollingActive();
            }
        },

        async sendFileMessage(file, caption = '') {
            const tempMessageId = 'temp-' + Date.now();

            // Show uploading message
            const uploadingText = caption ? `📎 ${file.name}\n${caption}` : `📎 ${file.name}`;
            this.addMessage(uploadingText, 'user', tempMessageId);

            const typingId = this.showTypingIndicator();

            try {
                // Ensure we have a conversation ID BEFORE uploading
                const isNewConversation = !this.conversationId;
                if (isNewConversation) {
                    this.conversationId = this.generateSessionId();
                }

                // Upload file first with conversationId for authentication
                const formData = new FormData();
                formData.append('file', file);
                formData.append('conversationId', this.conversationId);

                const uploadResponse = await fetch(`${this.config.apiUrl}/api/upload`, {
                    method: 'POST',
                    body: formData
                });

                const uploadData = await uploadResponse.json();

                if (!uploadData.success) {
                    throw new Error(uploadData.error || 'File upload failed');
                }

                // Send message with file metadata
                const response = await fetch(`${this.config.apiUrl}/api/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        conversationId: this.conversationId,
                        message: caption || file.name,
                        visitorId: this.getVisitorId(),
                        messageType: 'file',
                        fileMetadata: uploadData.file
                    })
                });

                const data = await response.json();

                this.removeTypingIndicator(typingId);

                // Replace temp message with actual file message
                const tempMsg = document.querySelector(`[data-message-id="${tempMessageId}"]`);
                if (tempMsg && data.userMessage) {
                    tempMsg.setAttribute('data-message-id', data.userMessage.id);
                    // Update message with clickable file link (include conversationId for authorization)
                    const fileUrl = `${this.config.apiUrl}${uploadData.file.url}?conversationId=${this.conversationId}`;
                    const contentDiv = tempMsg.querySelector('div > div');
                    if (contentDiv) {
                        contentDiv.innerHTML = this.renderFileMessage(uploadData.file, caption, fileUrl);
                    }
                }

                if (isNewConversation) {
                    this.startPolling();
                    if (this.socket && this.socket.connected) {
                        this.socket.emit('join-conversation', this.conversationId);
                    }
                }

                if (data.aiMessage) {
                    if (!this.isInternalSystemMessage(data.aiMessage.content, data.aiMessage.sender, data.aiMessage.metadata)) {
                        this.addMessage(data.aiMessage.content, data.aiMessage.sender, data.aiMessage.id, data.aiMessage.metadata);
                    }
                }

            } catch (error) {
                console.error('Error sending file:', error);
                this.removeTypingIndicator(typingId);
                this.addMessage('Nepavyko nusiųsti failo. Pabandykite dar kartą.', 'ai', 'error-' + Date.now());
            }
        },

        escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        renderFileMessage(fileMetadata, caption, fileUrl) {
            // Validate fileUrl parameter
            if (!fileUrl || typeof fileUrl !== 'string') {
                return '<div style="color: red;">⚠️ Invalid file URL</div>';
            }

            // Validate the RELATIVE URL path from metadata (not the absolute fileUrl)
            if (!fileMetadata.url || typeof fileMetadata.url !== 'string' || !fileMetadata.url.startsWith('/api/uploads/')) {
                return '<div style="color: red;">⚠️ Invalid file attachment</div>';
            }

            const isImage = fileMetadata.mimetype && fileMetadata.mimetype.startsWith('image/');
            let html = '';

            const escapedUrl = this.escapeHtml(fileUrl);
            const escapedFilename = this.escapeHtml(fileMetadata.filename || 'file');

            if (isImage) {
                html = `<a href="${escapedUrl}" target="_blank"><img src="${escapedUrl}" style="max-width: 200px; border-radius: 8px; margin-bottom: 4px;" /></a>`;
            } else {
                html = `<a href="${escapedUrl}" download="${escapedFilename}" style="color: #4F46E5; text-decoration: underline;">📎 ${escapedFilename}</a>`;
            }

            // Only add caption if it's different from filename
            if (caption && caption !== fileMetadata.filename) {
                html += `<br/>${this.escapeHtml(caption)}`;
            }

            return html;
        },

        getVisitorId() {
            let visitorId = localStorage.getItem('vilnius_visitor_id');
            if (!visitorId) {
                visitorId = 'visitor-' + Math.random().toString(36).substring(2, 11);
                localStorage.setItem('vilnius_visitor_id', visitorId);
            }
            return visitorId;
        },

        /**
         * Check if a system message should be hidden from customers
         * Internal agent workflow messages should not be shown to customers
         */
        isInternalSystemMessage(content, sender, metadata) {
            if (sender !== 'system') return false;

            // Hide internal agent workflow messages
            if (content.includes('[Message pending agent response') ||
                content.includes('[No agents online - Message awaiting assignment]') ||
                content.includes('[Manual AI suggestion generated]') ||
                content.includes('Agent has joined the conversation') ||
                content.includes('Agent has left the conversation')) {
                return true;
            }

            // Allow system messages with offline notifications and other customer-facing content
            return false;
        },

        addMessage(text, sender, messageId = null, messageMetadata = null) {
            const messagesContainer = document.getElementById('vilnius-messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = `vilnius-message vilnius-${sender}`;
            const senderInfo = this.getAccessibleSenderInfo(sender);
            messageDiv.setAttribute('role', 'article');
            messageDiv.setAttribute('aria-label', senderInfo.ariaLabel);

            // Add message ID if provided
            if (messageId) {
                messageDiv.setAttribute('data-message-id', messageId);
            }
            
            messageDiv.style.cssText = `
                margin-bottom: 16px;
                display: flex;
                align-items: flex-start;
                ${sender === 'user' ? 'justify-content: flex-end;' : ''}
            `;

            const bubbleStyle = sender === 'user' 
                ? `background: ${this.config.theme.primaryColor}; color: white;`
                : 'background: white; color: #1f2937;';

            if (sender === 'agent' && messageMetadata && messageMetadata.displayDisclaimer) {
                // Add robot disclaimer for autopilot responses
                text = `🤖 *Atsako robotas - galimos klaidos*\n\n${text}`;
            }

            // Convert markdown to HTML for AI/agent messages
            const formattedText = (sender === 'ai' || sender === 'agent') ? this.markdownToHtml(text) : text;

            messageDiv.innerHTML = `
                <div style="
                    ${bubbleStyle}
                    padding: 12px 16px;
                    border-radius: 12px;
                    max-width: 80%;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                ">
                    <div style="margin: 0;">${formattedText}</div>
                </div>
            `;

            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            this.announceNewMessage({
                sender,
                content: text,
                metadata: messageMetadata
            });
        },

        showTypingIndicator() {
            const id = 'typing-' + Date.now();
            const messagesContainer = document.getElementById('vilnius-messages');
            const typingDiv = document.createElement('div');
            typingDiv.id = id;
            typingDiv.className = 'vilnius-message vilnius-ai';
            typingDiv.style.cssText = 'margin-bottom: 16px; display: flex; align-items: flex-start;';
            typingDiv.setAttribute('role', 'status');
            typingDiv.setAttribute('aria-live', 'polite');
            typingDiv.setAttribute('aria-label', 'Agentas rašo');

            typingDiv.innerHTML = `
                <div style="
                    background: white;
                    padding: 16px;
                    border-radius: 12px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                ">
                    <div style="display: flex; gap: 4px;">
                        <span style="
                            width: 8px;
                            height: 8px;
                            background: #9ca3af;
                            border-radius: 50%;
                            animation: typing 1.4s infinite;
                        "></span>
                        <span style="
                            width: 8px;
                            height: 8px;
                            background: #9ca3af;
                            border-radius: 50%;
                            animation: typing 1.4s infinite 0.2s;
                        "></span>
                        <span style="
                            width: 8px;
                            height: 8px;
                            background: #9ca3af;
                            border-radius: 50%;
                            animation: typing 1.4s infinite 0.4s;
                        "></span>
                    </div>
                </div>
            `;

            // Add CSS animation
            if (!document.getElementById('vilnius-typing-styles')) {
                const style = document.createElement('style');
                style.id = 'vilnius-typing-styles';
                style.textContent = `
                    @keyframes typing {
                        0%, 60%, 100% { transform: translateY(0); }
                        30% { transform: translateY(-10px); }
                    }
                `;
                document.head.appendChild(style);
            }

            messagesContainer.appendChild(typingDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            return id;
        },

        removeTypingIndicator(id) {
            const element = document.getElementById(id);
            if (element) {
                element.remove();
            }
        },

        generateSessionId() {
            const sessionId = 'session-' + Math.random().toString(36).substring(2, 11);
            this.conversationId = sessionId;
            localStorage.setItem('vilnius_conversation_id', sessionId);
            return sessionId;
        },

        sanitizeUrl(url) {
            try {
                const parsedUrl = new URL(url, window.location.origin);
                const protocol = parsedUrl.protocol.toLowerCase();
                if (protocol === 'http:' || protocol === 'https:') {
                    return parsedUrl.href;
                }
            } catch (e) {
                // Invalid URL
            }
            return '#';
        },

        markdownToHtml(text) {
            if (!text) return '';

            // Handle AI suggestion object format
            let content = text;
            if (typeof text === 'object' && text.response) {
                content = text.response;
            } else if (typeof text === 'object') {
                content = String(text);
            }

            // Ensure content is a string
            if (typeof content !== 'string') {
                content = String(content);
            }

            // Escape HTML first to prevent injection
            content = this.escapeHtml(content);

            return content
                // Bold text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                // Italic text
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                // Links - sanitize URLs to prevent XSS
                .replace(/\[(.*?)\]\((.*?)\)/g, (match, text, url) => {
                    const safeUrl = this.sanitizeUrl(url);
                    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer nofollow" style="color: #4F46E5; text-decoration: underline;">${text}</a>`;
                })
                // Line breaks
                .replace(/\n/g, '<br>')
                // Bullet points
                .replace(/^\*\s+(.+)$/gm, '<li style="margin-left: 16px;">$1</li>')
                // Wrap lists
                .replace(/(<li.*?<\/li>)/gs, '<ul style="margin: 8px 0; padding-left: 0;">$1</ul>')
                // Headers
                .replace(/^### (.*$)/gm, '<h3 style="margin: 8px 0; font-size: 16px; font-weight: bold;">$1</h3>')
                .replace(/^## (.*$)/gm, '<h2 style="margin: 8px 0; font-size: 18px; font-weight: bold;">$1</h2>')
                .replace(/^# (.*$)/gm, '<h1 style="margin: 8px 0; font-size: 20px; font-weight: bold;">$1</h1>');
        }

    };

    // Expose to global scope
    window.VilniusChat = VilniusChat;
})();