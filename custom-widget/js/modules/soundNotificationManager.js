/**
 * Sound Notification Manager
 * Handles audio notifications for new messages and conversations
 * Replaces desktop notification system with subtle sound alerts
 * 
 * Features:
 * - Sound alerts for new messages/conversations assigned to current agent
 * - Volume control and mute functionality
 * - Multiple notification sounds
 * - Respects user preferences and browser policies
 */

class SoundNotificationManager {
    constructor(options = {}) {
        this.agentId = options.agentId;
        this.logger = options.logger || console;
        this.enabled = true;
        this.volume = 0.3; // Default volume (30%)
        
        // Audio context for better browser support
        this.audioContext = null;
        this.sounds = new Map();
        
        this.initialize();
    }

    /**
     * Initialize the sound manager
     */
    async initialize() {
        try {
            // Initialize audio context on user interaction
            this.setupAudioContext();
            
            // Load notification sounds
            await this.loadSounds();
            
            this.logger.log('🔊 SoundNotificationManager initialized');
        } catch (error) {
            this.logger.error('❌ Failed to initialize sound notifications:', error);
            this.enabled = false;
        }
    }

    /**
     * Setup Web Audio API context
     */
    setupAudioContext() {
        try {
            // Create audio context on first user interaction
            document.addEventListener('click', () => {
                if (!this.audioContext) {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    this.logger.log('🎵 Audio context created');
                }
            }, { once: true });
        } catch (error) {
            this.logger.warn('⚠️ Web Audio API not supported, falling back to HTML5 audio');
        }
    }

    /**
     * Load notification sound files
     */
    async loadSounds() {
        const soundFiles = {
            newMessage: this.createNotificationTone(800, 0.1), // High tone for messages
            newConversation: this.createNotificationTone(400, 0.2) // Lower tone for conversations
        };

        // Generate simple notification tones
        for (const [type, audioData] of Object.entries(soundFiles)) {
            this.sounds.set(type, audioData);
        }
    }

    /**
     * Create a simple notification tone using Web Audio API
     */
    createNotificationTone(frequency, duration) {
        return {
            frequency,
            duration,
            type: 'sine'
        };
    }

    /**
     * Play notification sound
     */
    async playSound(type = 'newMessage') {
        if (!this.enabled || !this.sounds.has(type)) {
            return;
        }

        try {
            if (this.audioContext) {
                await this.playWithWebAudio(type);
            } else {
                // Fallback to simple beep
                this.playSimpleBeep();
            }
        } catch (error) {
            this.logger.warn('⚠️ Failed to play notification sound:', error);
        }
    }

    /**
     * Play sound using Web Audio API
     */
    async playWithWebAudio(type) {
        const soundData = this.sounds.get(type);
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.setValueAtTime(soundData.frequency, this.audioContext.currentTime);
        oscillator.type = soundData.type;

        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + soundData.duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + soundData.duration);
    }

    /**
     * Simple beep fallback
     */
    playSimpleBeep() {
        // Create a very short data URL audio file
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    }

    /**
     * Handle new message notification
     */
    onNewMessage(messageData) {
        if (!this.shouldNotify(messageData)) {
            return;
        }

        this.playSound('newMessage');
        this.logger.log('🔔 New message sound notification played');
    }

    /**
     * Handle new conversation notification
     */
    onNewConversation(conversationData) {
        if (!this.shouldNotifyForConversation(conversationData)) {
            return;
        }

        this.playSound('newConversation');
        this.logger.log('🔔 New conversation sound notification played');
    }

    /**
     * Check if we should notify for this message
     */
    shouldNotify(messageData) {
        if (!this.enabled) {
            return false;
        }

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
     */
    shouldNotifyForConversation(conversationData) {
        if (!this.enabled) {
            return false;
        }

        // Notify for new conversations that get assigned to this agent
        // or for unassigned conversations (so agents can pick them up)
        return !conversationData.assigned_agent_id || 
               conversationData.assigned_agent_id === this.agentId;
    }

    /**
     * Enable/disable sound notifications
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        this.logger.log(`🔊 Sound notifications ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Set notification volume (0.0 to 1.0)
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.logger.log(`🔊 Sound notification volume set to ${Math.round(this.volume * 100)}%`);
    }

    /**
     * Test notification sound
     */
    testSound(type = 'newMessage') {
        this.playSound(type);
        this.logger.log(`🔊 Playing test sound: ${type}`);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoundNotificationManager;
}