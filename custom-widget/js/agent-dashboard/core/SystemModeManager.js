export class SystemModeManager {
    constructor({ chatManager = null, documentRef = typeof document !== 'undefined' ? document : null } = {}) {
        this.chatManager = chatManager;
        this.document = documentRef;
        this.currentMode = null;
    }

    setChatManager(chatManager) {
        this.chatManager = chatManager;
    }

    update(mode) {
        this.currentMode = mode;

        try {
            this.updateUI(mode);
        } catch (uiError) {
            console.error('SystemModeManager UI update error:', uiError);
        }

        try {
            this.applyBehavior(mode);
        } catch (behaviorError) {
            console.error('SystemModeManager behavior error:', behaviorError);
        }
    }

    updateUI(mode) {
        if (!this.document) {
            return;
        }

        const systemModeElement = this.document.getElementById('system-mode');
        const systemStatusDot = this.document.getElementById('system-status-dot');

        if (systemModeElement) {
            systemModeElement.textContent = mode.toUpperCase();
        }

        if (systemStatusDot) {
            systemStatusDot.className = `w-2 h-2 rounded-full system-${mode}`;
        }
    }

    applyBehavior(mode) {
        switch (mode) {
            case 'hitl':
                console.log('System Mode: HITL - Human in the Loop mode activated');
                break;
            case 'autopilot':
                console.log('System Mode: Autopilot - Automatic AI responses activated');
                this.hideAISuggestion();
                break;
            case 'off':
                console.log('System Mode: OFF - Customer support offline mode activated');
                this.hideAISuggestion();
                break;
            default:
                console.log(`System Mode: ${mode}`);
        }
    }

    hideAISuggestion() {
        if (this.chatManager && typeof this.chatManager.hideAISuggestion === 'function') {
            this.chatManager.hideAISuggestion();
        }
    }

    getCurrentMode() {
        return this.currentMode;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SystemModeManager };
}
