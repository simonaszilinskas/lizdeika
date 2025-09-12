/**
 * DOM HELPER UTILITY
 * 
 * Provides abstraction layer for common DOM operations
 * Reduces coupling and improves testability
 * 
 * @version 1.0.0
 */

import CONTEXT_ENGINEERING_CONSTANTS from '../constants/ContextEngineeringConstants.js';

const { DOM_IDS, CSS_CLASSES } = CONTEXT_ENGINEERING_CONSTANTS;

export class DOMHelper {
    
    /**
     * Get element by ID with error handling
     * @param {string} id - Element ID
     * @returns {HTMLElement|null}
     */
    getElementById(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with ID '${id}' not found`);
        }
        return element;
    }
    
    /**
     * Get element value safely
     * @param {string} id - Element ID
     * @returns {string} Element value or empty string
     */
    getElementValue(id) {
        const element = this.getElementById(id);
        return element ? element.value : '';
    }
    
    /**
     * Set element value safely
     * @param {string} id - Element ID
     * @param {string} value - Value to set
     * @returns {boolean} Success status
     */
    setElementValue(id, value) {
        const element = this.getElementById(id);
        if (element) {
            element.value = value;
            return true;
        }
        return false;
    }
    
    /**
     * Get element text content safely
     * @param {string} id - Element ID
     * @returns {string} Text content or empty string
     */
    getElementText(id) {
        const element = this.getElementById(id);
        return element ? element.textContent : '';
    }
    
    /**
     * Set element text content safely
     * @param {string} id - Element ID
     * @param {string} text - Text to set
     * @returns {boolean} Success status
     */
    setElementText(id, text) {
        const element = this.getElementById(id);
        if (element) {
            element.textContent = text;
            return true;
        }
        return false;
    }
    
    /**
     * Set element HTML content safely
     * @param {string} id - Element ID
     * @param {string} html - HTML to set
     * @returns {boolean} Success status
     */
    setElementHTML(id, html) {
        const element = this.getElementById(id);
        if (element) {
            element.innerHTML = html;
            return true;
        }
        return false;
    }
    
    /**
     * Show element by removing hidden class
     * @param {string} id - Element ID
     * @returns {boolean} Success status
     */
    showElement(id) {
        const element = this.getElementById(id);
        if (element) {
            element.classList.remove(CSS_CLASSES.HIDDEN);
            return true;
        }
        return false;
    }
    
    /**
     * Hide element by adding hidden class
     * @param {string} id - Element ID
     * @returns {boolean} Success status
     */
    hideElement(id) {
        const element = this.getElementById(id);
        if (element) {
            element.classList.add(CSS_CLASSES.HIDDEN);
            return true;
        }
        return false;
    }
    
    /**
     * Toggle element visibility
     * @param {string} id - Element ID
     * @returns {boolean} Success status
     */
    toggleElement(id) {
        const element = this.getElementById(id);
        if (element) {
            element.classList.toggle(CSS_CLASSES.HIDDEN);
            return true;
        }
        return false;
    }
    
    /**
     * Enable/disable element
     * @param {string} id - Element ID
     * @param {boolean} enabled - Whether element should be enabled
     * @returns {boolean} Success status
     */
    setElementEnabled(id, enabled) {
        const element = this.getElementById(id);
        if (element) {
            element.disabled = !enabled;
            return true;
        }
        return false;
    }
    
    /**
     * Add CSS class to element
     * @param {string} id - Element ID
     * @param {string} className - CSS class to add
     * @returns {boolean} Success status
     */
    addElementClass(id, className) {
        const element = this.getElementById(id);
        if (element) {
            element.classList.add(className);
            return true;
        }
        return false;
    }
    
    /**
     * Remove CSS class from element
     * @param {string} id - Element ID
     * @param {string} className - CSS class to remove
     * @returns {boolean} Success status
     */
    removeElementClass(id, className) {
        const element = this.getElementById(id);
        if (element) {
            element.classList.remove(className);
            return true;
        }
        return false;
    }
    
    /**
     * Check if element has CSS class
     * @param {string} id - Element ID
     * @param {string} className - CSS class to check
     * @returns {boolean} Whether element has the class
     */
    elementHasClass(id, className) {
        const element = this.getElementById(id);
        return element ? element.classList.contains(className) : false;
    }
    
    /**
     * Set loading state on element
     * @param {string} id - Element ID
     * @param {boolean} loading - Whether element is loading
     * @returns {boolean} Success status
     */
    setElementLoading(id, loading) {
        const element = this.getElementById(id);
        if (element) {
            if (loading) {
                element.classList.add(CSS_CLASSES.LOADING);
                element.disabled = true;
            } else {
                element.classList.remove(CSS_CLASSES.LOADING);
                element.disabled = false;
            }
            return true;
        }
        return false;
    }
    
    /**
     * Set validation state on element
     * @param {string} id - Element ID
     * @param {boolean} isValid - Whether validation passed
     * @param {Array} errors - Array of error messages
     * @returns {boolean} Success status
     */
    setValidationState(id, isValid, errors = []) {
        const element = this.getElementById(id);
        if (!element) return false;
        
        // Remove existing validation classes
        element.classList.remove(CSS_CLASSES.ERROR_BORDER, CSS_CLASSES.SUCCESS_BORDER);
        
        // Add appropriate validation class
        if (isValid) {
            element.classList.add(CSS_CLASSES.SUCCESS_BORDER);
        } else {
            element.classList.add(CSS_CLASSES.ERROR_BORDER);
        }
        
        return true;
    }
    
    /**
     * Create and show validation message
     * @param {string} containerId - Container element ID
     * @param {boolean} isValid - Whether validation passed
     * @param {Array} errors - Array of error messages
     */
    showValidationMessage(containerId, isValid, errors = []) {
        const container = this.getElementById(containerId);
        if (!container) return;
        
        if (isValid) {
            container.innerHTML = '';
            this.hideElement(containerId);
        } else if (errors.length > 0) {
            const errorList = errors.map(error => `<li>${error}</li>`).join('');
            container.innerHTML = `
                <div class="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div class="flex items-start gap-2">
                        <i class="fas fa-exclamation-circle text-red-600 mt-0.5"></i>
                        <div class="text-sm text-red-800">
                            <strong>Validation Errors:</strong>
                            <ul class="list-disc list-inside mt-1 ml-4 text-xs">${errorList}</ul>
                        </div>
                    </div>
                </div>
            `;
            this.showElement(containerId);
        }
    }
    
    /**
     * Get all local prompt values
     * @returns {Object} Object with prompt type as key and content as value
     */
    getAllPromptValues() {
        return {
            system: this.getElementValue(DOM_IDS.LOCAL_SYSTEM_PROMPT),
            processing: this.getElementValue(DOM_IDS.LOCAL_PROCESSING_PROMPT),
            formatting: this.getElementValue(DOM_IDS.LOCAL_FORMATTING_PROMPT)
        };
    }
    
    /**
     * Set all local prompt values
     * @param {Object} values - Object with prompt type as key and content as value
     */
    setAllPromptValues(values) {
        if (values.system !== undefined) {
            this.setElementValue(DOM_IDS.LOCAL_SYSTEM_PROMPT, values.system);
        }
        if (values.processing !== undefined) {
            this.setElementValue(DOM_IDS.LOCAL_PROCESSING_PROMPT, values.processing);
        }
        if (values.formatting !== undefined) {
            this.setElementValue(DOM_IDS.LOCAL_FORMATTING_PROMPT, values.formatting);
        }
    }
    
    /**
     * Get all Langfuse prompt selections
     * @returns {Object} Object with prompt type as key and selected prompt as value
     */
    getAllLangfuseSelections() {
        return {
            system: this.getElementValue(DOM_IDS.SYSTEM_LANGFUSE_PROMPT),
            processing: this.getElementValue(DOM_IDS.PROCESSING_LANGFUSE_PROMPT),
            formatting: this.getElementValue(DOM_IDS.FORMATTING_LANGFUSE_PROMPT)
        };
    }
    
    /**
     * Set all Langfuse prompt selections
     * @param {Object} selections - Object with prompt type as key and prompt name as value
     */
    setAllLangfuseSelections(selections) {
        if (selections.system !== undefined) {
            this.setElementValue(DOM_IDS.SYSTEM_LANGFUSE_PROMPT, selections.system);
        }
        if (selections.processing !== undefined) {
            this.setElementValue(DOM_IDS.PROCESSING_LANGFUSE_PROMPT, selections.processing);
        }
        if (selections.formatting !== undefined) {
            this.setElementValue(DOM_IDS.FORMATTING_LANGFUSE_PROMPT, selections.formatting);
        }
    }
    
    /**
     * Get current prompt mode
     * @returns {string} Current prompt mode (langfuse or local)
     */
    getCurrentMode() {
        const langfuseRadio = this.getElementById(DOM_IDS.MODE_LANGFUSE);
        const localRadio = this.getElementById(DOM_IDS.MODE_LOCAL);
        
        if (langfuseRadio && langfuseRadio.checked) {
            return 'langfuse';
        } else if (localRadio && localRadio.checked) {
            return 'local';
        }
        
        return 'local'; // default
    }
    
    /**
     * Set prompt mode
     * @param {string} mode - Mode to set (langfuse or local)
     */
    setCurrentMode(mode) {
        const langfuseRadio = this.getElementById(DOM_IDS.MODE_LANGFUSE);
        const localRadio = this.getElementById(DOM_IDS.MODE_LOCAL);
        
        if (mode === 'langfuse' && langfuseRadio) {
            langfuseRadio.checked = true;
        } else if (mode === 'local' && localRadio) {
            localRadio.checked = true;
        }
        
        // Update UI visibility
        this.updateModeUI(mode);
    }
    
    /**
     * Update mode UI visibility
     * @param {string} mode - Current mode
     */
    updateModeUI(mode) {
        if (mode === 'langfuse') {
            this.showElement(DOM_IDS.LANGFUSE_CONFIG);
            this.hideElement(DOM_IDS.LOCAL_CONFIG);
        } else {
            this.hideElement(DOM_IDS.LANGFUSE_CONFIG);
            this.showElement(DOM_IDS.LOCAL_CONFIG);
        }
    }
}

export default DOMHelper;