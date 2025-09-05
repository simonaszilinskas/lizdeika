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
     * @param {Object} messageData - Message data
     * @returns {boolean} Whether to notify
     */
    shouldNotify(messageData) {
        if (!this.enabled) return false;

        // Only notify for messages in conversations assigned to this agent
        // or for customer messages in unassigned conversations
        if (messageData.conversation && messageData.conversation.assigned_agent_id) {
            return messageData.conversation.assigned_agent_id === this.agentId;
        }

        // For customer messages in unassigned conversations, notify all agents
        return messageData.senderType === 'user';
    }

    /**
     * Check if we should notify for this conversation
     * @param {Object} conversationData - Conversation data  
     * @returns {boolean} Whether to notify
     */
    shouldNotifyForConversation(conversationData) {
        if (!this.enabled) return false;

        // Notify for new conversations that get assigned to this agent
        // or for unassigned conversations (so agents can pick them up)
        return !conversationData.assigned_agent_id || 
               conversationData.assigned_agent_id === this.agentId;
    }
}