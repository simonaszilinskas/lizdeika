/**
 * Sound Notification Manager for Agent Dashboard
 * Simplified audio notifications for new messages and conversations
 * 
 * Features:
 * - Simple sound alerts for new messages/conversations
 * - Fixed volume and settings (no user configuration)
 * - Auto-enabled with sensible defaults
 */

export class SoundNotificationManager {
    constructor(dashboard) {
        try {
            this.dashboard = dashboard;
            this.agentId = dashboard.agentId;
            
            // Fixed settings - no user configuration
            this.enabled = true;
            this.volume = 0.3; // 30% volume
            
            this.audioContext = null;
            this.initialized = false;
            
            console.log('🔊 SoundNotificationManager initialized (simplified)');
        } catch (error) {
            console.error('❌ Failed to initialize SoundNotificationManager:', error);
            this.enabled = false;
        }
    }

    /**
     * Initialize Web Audio API context (lazy initialization)
     */
    initializeAudio() {
        if (this.initialized) return;
        
        try {
            // Create audio context on first user interaction
            if (typeof document !== 'undefined') {
                document.addEventListener('click', () => {
                    if (!this.audioContext) {
                        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        console.log('🎵 Audio context created');
                    }
                }, { once: true });
            }
            this.initialized = true;
        } catch (error) {
            console.warn('⚠️ Failed to initialize audio context setup:', error);
            this.initialized = true; // Prevent retrying
        }
    }

    /**
     * Play notification sound
     * @param {string} type - 'message' or 'conversation'
     */
    playSound(type = 'message') {
        if (!this.enabled) return;

        // Initialize audio on first use
        this.initializeAudio();

        try {
            if (this.audioContext && this.audioContext.state === 'running') {
                this.playTone(type);
            } else {
                // Fallback for browsers without Web Audio API support
                this.playSimpleBeep();
            }
        } catch (error) {
            console.warn('⚠️ Failed to play notification sound:', error);
        }
    }

    /**
     * Play notification tone using Web Audio API
     * @param {string} type - Sound type
     */
    playTone(type) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        // Connect audio nodes
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Configure sound based on type
        const soundConfig = type === 'conversation' 
            ? { frequency: 400, duration: 0.2 } // Lower tone for conversations
            : { frequency: 800, duration: 0.1 }; // Higher tone for messages

        oscillator.frequency.setValueAtTime(soundConfig.frequency, this.audioContext.currentTime);
        oscillator.type = 'sine';

        // Set volume envelope
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + soundConfig.duration);

        // Play the tone
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + soundConfig.duration);
    }

    /**
     * Simple beep fallback for browsers without Web Audio API
     */
    playSimpleBeep() {
        try {
            const tempAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = tempAudioContext.createOscillator();
            const gainNode = tempAudioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(tempAudioContext.destination);
            
            oscillator.frequency.setValueAtTime(600, tempAudioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, tempAudioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(this.volume, tempAudioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, tempAudioContext.currentTime + 0.1);
            
            oscillator.start();
            oscillator.stop(tempAudioContext.currentTime + 0.1);
        } catch (error) {
            console.warn('⚠️ Fallback beep failed:', error);
        }
    }

    /**
     * Handle new message notification
     * @param {Object} messageData - Message data from WebSocket
     */
    onNewMessage(messageData) {
        try {
            if (!this.shouldNotify(messageData)) {
                return;
            }

            this.playSound('message');
            console.log('🔔 New message sound notification played');
        } catch (error) {
            console.warn('⚠️ Failed to play new message notification:', error);
        }
    }

    /**
     * Handle new conversation notification  
     * @param {Object} conversationData - Conversation data from WebSocket
     */
    onNewConversation(conversationData) {
        try {
            if (!this.shouldNotifyForConversation(conversationData)) {
                return;
            }

            this.playSound('conversation');
            console.log('🔔 New conversation sound notification played');
        } catch (error) {
            console.warn('⚠️ Failed to play new conversation notification:', error);
        }
    }

    /**
     * Check if we should notify for this message
     * Handles various WebSocket message structures: nested message objects, direct properties, etc.
     * @param {Object} messageData - Message data from WebSocket
     * @returns {boolean} Whether to notify
     */
    shouldNotify(messageData) {
        if (!this.enabled) return false;

        // Extract sender information from various possible structures
        let sender = '';
        if (messageData.message && messageData.message.sender) {
            sender = messageData.message.sender;
        } else if (messageData.sender) {
            sender = messageData.sender;
        } else if (messageData.senderType) {
            sender = messageData.senderType;
        }

        // Extract conversation assignment information
        let assignedAgentId = null;
        if (messageData.conversation && messageData.conversation.assigned_agent_id) {
            assignedAgentId = messageData.conversation.assigned_agent_id;
        } else if (messageData.conversation && messageData.conversation.assignedAgent) {
            assignedAgentId = messageData.conversation.assignedAgent;
        } else if (messageData.assignedAgent) {
            assignedAgentId = messageData.assignedAgent;
        }

        // Only notify for customer/visitor messages, not agent messages
        const isCustomerMessage = sender === 'visitor' || sender === 'customer' || sender === 'user';
        if (!isCustomerMessage) {
            return false;
        }

        // If conversation is assigned to this agent, always notify
        if (assignedAgentId === this.agentId) {
            return true;
        }

        // For unassigned conversations, notify all agents about customer messages
        if (!assignedAgentId && isCustomerMessage) {
            return true;
        }

        return false;
    }

    /**
     * Check if we should notify for this conversation
     * Handles various WebSocket conversation structures: nested properties, direct properties, etc.
     * @param {Object} conversationData - Conversation data  
     * @returns {boolean} Whether to notify
     */
    shouldNotifyForConversation(conversationData) {
        if (!this.enabled) return false;

        // Extract assignment information from various possible structures
        let assignedAgentId = null;
        if (conversationData.assigned_agent_id !== undefined) {
            assignedAgentId = conversationData.assigned_agent_id;
        } else if (conversationData.assignedAgent !== undefined) {
            assignedAgentId = conversationData.assignedAgent;
        } else if (conversationData.conversation && conversationData.conversation.assigned_agent_id !== undefined) {
            assignedAgentId = conversationData.conversation.assigned_agent_id;
        } else if (conversationData.conversation && conversationData.conversation.assignedAgent !== undefined) {
            assignedAgentId = conversationData.conversation.assignedAgent;
        }

        // Notify for new conversations that get assigned to this agent
        // or for unassigned conversations (so agents can pick them up)
        return !assignedAgentId || assignedAgentId === this.agentId;
    }
}