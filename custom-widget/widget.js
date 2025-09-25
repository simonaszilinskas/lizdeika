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
            apiUrl: 'http://localhost:3002',
            flowiseUrl: 'http://localhost:3000',
            flowiseChatflowId: '',
            theme: {
                primaryColor: '#4F46E5',
                position: 'bottom-right'
            }
        },

        init: function(options) {
            Object.assign(this.config, options);
            this.createWidget();
            this.attachEventListeners();
            this.initializeWebSocket();
            this.loadConversation();
            this.loadSupportStatus();
        },

        createWidget: function() {
            const widgetHTML = `
                <div id="vilnius-chat-container" style="
                    position: fixed;
                    ${this.config.theme.position === 'bottom-right' ? 'right: 20px; bottom: 20px;' : 'left: 20px; bottom: 20px;'}
                    z-index: 9999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                ">
                    <!-- Chat Bubble -->
                    <button id="vilnius-chat-bubble" style="
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
                    ">
                        <!-- Header -->
                        <div style="
                            background: ${this.config.theme.primaryColor};
                            color: white;
                            padding: 20px;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        ">
                            <div>
                                <h3 style="margin: 0; font-size: 18px;">Pagalbos asistentas</h3>
                                <p id="vilnius-support-status" style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">
                                    Kraunama...
                                </p>
                            </div>
                            <button id="vilnius-close-chat" style="
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
                        <div id="vilnius-messages" style="
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
                            ">Agentas rašo...</div>
                            <div class="vilnius-message vilnius-ai" style="
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
                            ">
                                <input 
                                    id="vilnius-chat-input"
                                    type="text" 
                                    placeholder="Rašykite savo pranešimą..."
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
                                <button type="submit" style="
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
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', widgetHTML);
        },

        attachEventListeners: function() {
            const bubble = document.getElementById('vilnius-chat-bubble');
            const window = document.getElementById('vilnius-chat-window');
            const closeBtn = document.getElementById('vilnius-close-chat');
            const form = document.getElementById('vilnius-chat-form');
            const input = document.getElementById('vilnius-chat-input');

            bubble.addEventListener('click', () => {
                window.style.display = window.style.display === 'none' ? 'flex' : 'none';
                if (window.style.display === 'flex') {
                    input.focus();
                }
            });

            closeBtn.addEventListener('click', () => {
                window.style.display = 'none';
            });

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const message = input.value.trim();
                if (message) {
                    await this.sendMessage(message);
                    input.value = '';
                }
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
                }
            });
        },
        
        createMessageElement(msg) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `vilnius-message vilnius-${msg.sender === 'visitor' ? 'user' : 'ai'}`;
            messageDiv.setAttribute('data-message-id', msg.id);
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

            const formattedText = (msg.sender === 'agent' || msg.sender === 'ai') ? this.markdownToHtml(content) : content;

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
                    // Show all AI messages to customer (including system messages with offline notifications)
                    this.addMessage(data.aiMessage.content, data.aiMessage.sender, data.aiMessage.id, data.aiMessage.metadata);
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

        getVisitorId() {
            let visitorId = localStorage.getItem('vilnius_visitor_id');
            if (!visitorId) {
                visitorId = 'visitor-' + Math.random().toString(36).substring(2, 11);
                localStorage.setItem('vilnius_visitor_id', visitorId);
            }
            return visitorId;
        },

        addMessage(text, sender, messageId = null, messageMetadata = null) {
            const messagesContainer = document.getElementById('vilnius-messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = `vilnius-message vilnius-${sender}`;
            
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
        },

        showTypingIndicator() {
            const id = 'typing-' + Date.now();
            const messagesContainer = document.getElementById('vilnius-messages');
            const typingDiv = document.createElement('div');
            typingDiv.id = id;
            typingDiv.className = 'vilnius-message vilnius-ai';
            typingDiv.style.cssText = 'margin-bottom: 16px; display: flex; align-items: flex-start;';
            
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

        markdownToHtml(text) {
            return text
                // Bold text
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                // Italic text
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                // Links
                .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color: #4F46E5; text-decoration: underline;">$1</a>')
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
        },

        loadSupportStatus: function() {
            const statusElement = document.getElementById('vilnius-support-status');
            
            // Fetch current agent status from backend
            fetch(`${this.config.apiUrl}/api/agent/status`)
                .then(response => response.json())
                .then(data => {
                    let statusText = 'Veikia su AI'; // Default fallback
                    
                    if (data.success && data.status) {
                        switch(data.status) {
                            case 'hitl':
                                statusText = 'Aktyvus, DI + žmogus';
                                break;
                            case 'autopilot':
                                statusText = 'Dirbtinio intelekto atsakymai';
                                break;
                            case 'off':
                                statusText = 'Konsultacijų centras šiuo metu nedirba';
                                break;
                            default:
                                statusText = 'Aktyvus, DI + žmogus';
                        }
                    }
                    
                    if (statusElement) {
                        statusElement.textContent = statusText;
                    }
                })
                .catch(error => {
                    console.error('Failed to load support status:', error);
                    if (statusElement) {
                        statusElement.textContent = 'Veikia su AI';
                    }
                });
        },

    };

    // Expose to global scope
    window.VilniusChat = VilniusChat;
})();