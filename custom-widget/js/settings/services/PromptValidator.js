/**
 * PROMPT VALIDATOR SERVICE
 * 
 * Handles all prompt validation logic for Context Engineering
 * Provides clean, testable validation methods
 * 
 * @version 1.0.0
 */

import CONTEXT_ENGINEERING_CONSTANTS from '../constants/ContextEngineeringConstants.js';

const { 
    REQUIRED_VARIABLES, 
    VALID_VARIABLES, 
    VALIDATION_MESSAGES,
    PROMPT_TYPES 
} = CONTEXT_ENGINEERING_CONSTANTS;

export class PromptValidator {
    
    /**
     * Validate a single prompt
     * @param {string} content - The prompt content to validate
     * @param {string} type - The prompt type (system, processing, formatting)
     * @returns {Object} Validation result with isValid and errors array
     */
    validatePrompt(content, type) {
        const errors = [];
        
        // Validate prompt type
        if (!this.isValidPromptType(type)) {
            errors.push(VALIDATION_MESSAGES.INVALID_PROMPT_TYPE);
            return { isValid: false, errors };
        }
        
        // Check if prompt is empty
        if (this.isEmpty(content)) {
            errors.push(VALIDATION_MESSAGES.EMPTY_PROMPT);
            return { isValid: false, errors };
        }
        
        // Check for required variables
        const missingVariables = this.getMissingRequiredVariables(content, type);
        if (missingVariables.length > 0) {
            missingVariables.forEach(variable => {
                errors.push(`${VALIDATION_MESSAGES.MISSING_VARIABLE}: <code>${variable}</code>`);
            });
        }
        
        // Check for unknown variables
        const unknownVariables = this.getUnknownVariables(content);
        if (unknownVariables.length > 0) {
            errors.push(`${VALIDATION_MESSAGES.UNKNOWN_VARIABLE}: ${unknownVariables.map(v => `<code>${v}</code>`).join(', ')}`);
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Validate multiple prompts at once
     * @param {Object} prompts - Object with prompt type as key and content as value
     * @returns {Object} Overall validation result
     */
    validateAllPrompts(prompts) {
        const allErrors = [];
        
        Object.entries(prompts).forEach(([type, content]) => {
            const validation = this.validatePrompt(content, type);
            if (!validation.isValid) {
                const promptLabel = this.getPromptLabel(type);
                validation.errors.forEach(error => {
                    allErrors.push(`${promptLabel}: ${error}`);
                });
            }
        });
        
        return {
            isValid: allErrors.length === 0,
            errors: allErrors
        };
    }
    
    /**
     * Check if content is empty or only whitespace
     * @param {string} content - Content to check
     * @returns {boolean}
     */
    isEmpty(content) {
        return !content || content.trim().length === 0;
    }
    
    /**
     * Check if prompt type is valid
     * @param {string} type - Prompt type to validate
     * @returns {boolean}
     */
    isValidPromptType(type) {
        return Object.values(PROMPT_TYPES).includes(type);
    }
    
    /**
     * Get missing required variables for a prompt type
     * @param {string} content - Prompt content
     * @param {string} type - Prompt type
     * @returns {Array} Array of missing variables
     */
    getMissingRequiredVariables(content, type) {
        const required = REQUIRED_VARIABLES[type] || [];
        return required.filter(variable => !content.includes(variable));
    }
    
    /**
     * Get unknown/invalid variables in prompt content
     * @param {string} content - Prompt content
     * @returns {Array} Array of unknown variables
     */
    getUnknownVariables(content) {
        const usedVariables = this.extractVariables(content);
        return usedVariables.filter(variable => !VALID_VARIABLES.includes(variable));
    }
    
    /**
     * Extract all variables from prompt content
     * @param {string} content - Prompt content
     * @returns {Array} Array of found variables
     */
    extractVariables(content) {
        const matches = content.match(/\{[^}]*\}/g);
        return matches ? [...new Set(matches)] : [];
    }
    
    /**
     * Get user-friendly label for prompt type
     * @param {string} type - Prompt type
     * @returns {string} User-friendly label
     */
    getPromptLabel(type) {
        const labels = {
            [PROMPT_TYPES.SYSTEM]: 'System Prompt',
            [PROMPT_TYPES.PROCESSING]: 'Query Rephrasing Prompt', 
            [PROMPT_TYPES.FORMATTING]: 'Context Template Prompt'
        };
        return labels[type] || type;
    }
    
    /**
     * Check if a prompt has all required variables
     * @param {string} content - Prompt content
     * @param {string} type - Prompt type
     * @returns {boolean}
     */
    hasRequiredVariables(content, type) {
        return this.getMissingRequiredVariables(content, type).length === 0;
    }
    
    /**
     * Check if a prompt has only valid variables
     * @param {string} content - Prompt content
     * @returns {boolean}
     */
    hasOnlyValidVariables(content) {
        return this.getUnknownVariables(content).length === 0;
    }
    
    /**
     * Get validation summary for a prompt
     * @param {string} content - Prompt content
     * @param {string} type - Prompt type
     * @returns {Object} Detailed validation summary
     */
    getValidationSummary(content, type) {
        const validation = this.validatePrompt(content, type);
        const extractedVariables = this.extractVariables(content);
        const requiredVariables = REQUIRED_VARIABLES[type] || [];
        
        return {
            ...validation,
            summary: {
                promptType: type,
                promptLabel: this.getPromptLabel(type),
                isEmpty: this.isEmpty(content),
                contentLength: content.trim().length,
                extractedVariables: extractedVariables,
                requiredVariables: requiredVariables,
                missingVariables: this.getMissingRequiredVariables(content, type),
                unknownVariables: this.getUnknownVariables(content),
                hasAllRequired: this.hasRequiredVariables(content, type),
                hasOnlyValid: this.hasOnlyValidVariables(content)
            }
        };
    }
}

export default PromptValidator;