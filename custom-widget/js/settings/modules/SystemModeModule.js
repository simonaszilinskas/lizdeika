/**
 * System Mode Module
 * 
 * Handles system mode management (HITL/Autopilot/OFF)
 * Extracted from SettingsManager for better modularity and single responsibility
 */

import { Toast } from '../../agent-dashboard/utils/Toast.js';
import { ErrorHandler } from '../../agent-dashboard/utils/ErrorHandler.js';

export class SystemModeModule {
    constructor(apiManager, stateManager, connectionManager) {
        this.apiManager = apiManager;
        this.stateManager = stateManager;
        this.connectionManager = connectionManager;
        
        // DOM elements
        this.elements = {
            currentModeSpan: null,
            saveModeButton: null,
            systemModeRadios: null
        };
        
        // Event listeners
        this.eventListeners = [];
        
        console.log('🎛️ SystemModeModule: Initialized');
    }

    /**
     * Initialize the system mode module
     */
    async initialize() {
        try {
            // Initialize DOM elements
            this.initializeElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load current system mode
            await this.loadCurrentMode();
            
            // Setup state change listeners
            this.setupStateListeners();
            
            console.log('✅ SystemModeModule: Initialization complete');
            
        } catch (error) {
            ErrorHandler.logError(error, 'SystemModeModule initialization failed');
            throw error;
        }
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.elements = {
            currentModeSpan: document.getElementById('current-mode'),
            saveModeButton: document.getElementById('save-mode'),
            systemModeRadios: document.querySelectorAll('input[name="systemMode"]')
        };
        
        console.log('🎯 SystemModeModule: DOM elements initialized');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Save mode button click
        if (this.elements.saveModeButton) {
            const saveHandler = () => this.handleSaveModeClick();
            this.elements.saveModeButton.addEventListener('click', saveHandler);
            this.eventListeners.push({
                element: this.elements.saveModeButton,
                event: 'click',
                handler: saveHandler
            });
        }
        
        // Radio button changes (for immediate feedback)
        this.elements.systemModeRadios.forEach(radio => {
            const changeHandler = () => this.handleModeRadioChange();
            radio.addEventListener('change', changeHandler);
            this.eventListeners.push({
                element: radio,
                event: 'change', 
                handler: changeHandler
            });
        });
        
        console.log('🔗 SystemModeModule: Event listeners setup');
    }

    /**
     * Setup state change listeners
     */
    setupStateListeners() {
        // Listen for system mode changes from other sources
        this.stateManager.on('systemModeChanged', (mode) => {
            console.log('🎛️ SystemModeModule: System mode changed via state:', mode);
            this.updateModeDisplay(mode);
        });
        
        console.log('👂 SystemModeModule: State listeners setup');
    }

    // =========================
    // CORE FUNCTIONALITY
    // =========================

    /**
     * Load current system mode
     */
    async loadCurrentMode() {
        try {
            console.log('📥 SystemModeModule: Loading current system mode');
            
            // Delegate to APIManager
            await this.apiManager.loadSystemMode();
            
            // Get mode from state and update display
            const currentMode = this.stateManager.getSystemMode();
            if (currentMode) {
                this.updateModeDisplay(currentMode);
                console.log('✅ SystemModeModule: Current mode loaded:', currentMode);
            }
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load current system mode');
            Toast.error('Failed to load current system mode', '');
        }
    }

    /**
     * Change system mode
     */
    async changeMode(newMode) {
        if (!this.validateMode(newMode)) {
            Toast.error('Invalid system mode', '');
            return false;
        }

        const currentMode = this.stateManager.getSystemMode();
        if (newMode === currentMode) {
            Toast.info('No changes to save', '');
            return true;
        }

        try {
            console.log('💾 SystemModeModule: Changing mode to:', newMode);
            
            // Update UI to show saving state
            this.setButtonState('saving');
            
            // Save via APIManager
            await this.saveSystemMode(newMode);
            
            // Success feedback
            Toast.success(`System mode changed to ${newMode.toUpperCase()}`, '');
            console.log('✅ SystemModeModule: Mode changed successfully:', newMode);
            
            return true;
            
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to change system mode');
            Toast.error('Failed to update system mode', '');
            return false;
        } finally {
            this.setButtonState('normal');
        }
    }

    /**
     * Save system mode via API
     */
    async saveSystemMode(mode) {
        const response = await fetch(`${this.apiManager.apiUrl}/api/system/mode`, {
            method: 'POST',
            headers: this.apiManager.getAuthHeaders(),
            body: JSON.stringify({ mode })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update system mode');
        }

        // Update state manager
        this.stateManager.setSystemMode(mode);
    }

    /**
     * Get selected mode from radio buttons
     */
    getSelectedMode() {
        const selectedRadio = document.querySelector('input[name="systemMode"]:checked');
        return selectedRadio ? selectedRadio.value : null;
    }

    /**
     * Validate system mode
     */
    validateMode(mode) {
        const validModes = ['hitl', 'autopilot', 'off'];
        return validModes.includes(mode);
    }

    // =========================
    // UI UPDATE METHODS
    // =========================

    /**
     * Update system mode display
     */
    updateModeDisplay(mode) {
        console.log('🎨 SystemModeModule: Updating mode display:', mode);
        
        // Update current mode text
        if (this.elements.currentModeSpan) {
            this.elements.currentModeSpan.textContent = mode.toUpperCase();
        }
        
        // Update radio button selection
        const radioButton = document.querySelector(`input[value="${mode}"]`);
        if (radioButton) {
            radioButton.checked = true;
        }
        
        // Update button state
        this.updateSaveButtonState();
    }

    /**
     * Update save button state based on current selection
     */
    updateSaveButtonState() {
        if (!this.elements.saveModeButton) return;
        
        const selectedMode = this.getSelectedMode();
        const currentMode = this.stateManager.getSystemMode();
        
        // Enable/disable save button based on whether there are changes
        const hasChanges = selectedMode && selectedMode !== currentMode;
        this.elements.saveModeButton.disabled = !hasChanges;
        
        // Update button text
        if (hasChanges) {
            this.elements.saveModeButton.textContent = 'Save Changes';
        } else {
            this.elements.saveModeButton.textContent = 'No Changes';
        }
    }

    /**
     * Set button state (normal/saving/disabled)
     */
    setButtonState(state) {
        if (!this.elements.saveModeButton) return;
        
        switch (state) {
            case 'saving':
                this.elements.saveModeButton.disabled = true;
                this.elements.saveModeButton.textContent = 'Saving...';
                break;
                
            case 'disabled':
                this.elements.saveModeButton.disabled = true;
                this.elements.saveModeButton.textContent = 'No Changes';
                break;
                
            case 'normal':
            default:
                this.elements.saveModeButton.disabled = false;
                this.elements.saveModeButton.textContent = 'Save Changes';
                break;
        }
    }

    // =========================
    // EVENT HANDLERS
    // =========================

    /**
     * Handle save mode button click
     */
    async handleSaveModeClick() {
        const selectedMode = this.getSelectedMode();
        
        if (!selectedMode) {
            Toast.error('Please select a system mode', '');
            return;
        }
        
        await this.changeMode(selectedMode);
    }

    /**
     * Handle mode radio button change
     */
    handleModeRadioChange() {
        // Update save button state when radio selection changes
        this.updateSaveButtonState();
    }

    // =========================
    // PUBLIC API
    // =========================

    /**
     * Get current system mode
     */
    getCurrentMode() {
        return this.stateManager.getSystemMode();
    }

    /**
     * Check if there are unsaved changes
     */
    hasUnsavedChanges() {
        const selectedMode = this.getSelectedMode();
        const currentMode = this.stateManager.getSystemMode();
        return selectedMode && selectedMode !== currentMode;
    }

    /**
     * Reset to current mode (discard changes)
     */
    resetToCurrentMode() {
        const currentMode = this.stateManager.getSystemMode();
        if (currentMode) {
            this.updateModeDisplay(currentMode);
        }
    }

    /**
     * Add event listener for mode changes
     */
    onModeChanged(callback) {
        this.stateManager.on('systemModeChanged', callback);
    }

    /**
     * Remove event listener for mode changes  
     */
    offModeChanged(callback) {
        this.stateManager.off('systemModeChanged', callback);
    }

    // =========================
    // UTILITY METHODS
    // =========================

    /**
     * Get mode display information
     */
    getModeInfo(mode) {
        const modeInfo = {
            'hitl': {
                name: 'HITL (Human in the Loop)',
                description: 'AI generates suggestions that agents must review and approve before sending',
                color: 'bg-green-100 text-green-800',
                icon: 'fas fa-user-check'
            },
            'autopilot': {
                name: 'Autopilot Mode',
                description: 'AI automatically responds to customers with disclaimer messages',
                color: 'bg-blue-100 text-blue-800',
                icon: 'fas fa-robot'
            },
            'off': {
                name: 'OFF Mode',
                description: 'System sends offline messages to customers when they write',
                color: 'bg-red-100 text-red-800',
                icon: 'fas fa-power-off'
            }
        };
        
        return modeInfo[mode] || null;
    }

    /**
     * Get module status for debugging
     */
    getStatus() {
        return {
            currentMode: this.stateManager.getSystemMode(),
            selectedMode: this.getSelectedMode(),
            hasUnsavedChanges: this.hasUnsavedChanges(),
            elements: {
                currentModeSpan: !!this.elements.currentModeSpan,
                saveModeButton: !!this.elements.saveModeButton,
                radioButtons: this.elements.systemModeRadios.length
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
        
        console.log('🧹 SystemModeModule: Cleanup complete');
    }
}