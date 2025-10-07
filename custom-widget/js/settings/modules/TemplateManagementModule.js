/**
 * Template Management Module
 *
 * Handles template management operations in the settings page including:
 * - Template CRUD operations (create, read, update, delete/archive)
 * - Template filtering and search functionality
 * - Category-based organization
 * - Real-time UI updates and state management
 */

import { Toast } from '../../agent-dashboard/utils/Toast.js';
import { ErrorHandler } from '../../agent-dashboard/utils/ErrorHandler.js';

export class TemplateManagementModule {
    constructor(apiManager, stateManager, connectionManager) {
        this.apiManager = apiManager;
        this.stateManager = stateManager;
        this.connectionManager = connectionManager;

        // Module state
        this.state = {
            templates: [],
            filteredTemplates: [],
            templateOrder: [],
            filters: {
                search: '',
                includeInactive: false
            },
            editingTemplate: null,
            isLoading: false
        };

        // DOM elements
        this.elements = {
            // Template list and controls
            templatesList: null,
            createTemplateBtn: null,
            searchInput: null,
            includeInactiveCheckbox: null,

            // Modal elements
            templateModal: null,
            templateForm: null,
            modalTitle: null,
            titleInput: null,
            contentInput: null,
            saveButton: null,
            saveButtonText: null,
            closeTemplateModal: null,
            cancelTemplate: null
        };

        // Event listeners array for cleanup
        this.eventListeners = [];

        // Store WebSocket callback for proper cleanup
        this.templatesUpdatedCallback = null;

        console.log('📝 TemplateManagementModule: Initialized');
    }

    /**
     * Initialize the template management module
     */
    async initialize() {
        try {
            // Initialize DOM elements
            this.initializeElements();

            // Setup event listeners
            this.setupEventListeners();

            // Setup real-time template updates
            this.setupWebSocketListeners();

            // Load initial templates
            await this.loadTemplates();

            // Setup UI permissions
            this.setupPermissions();

            console.log('✅ TemplateManagementModule: Initialization complete');

        } catch (error) {
            ErrorHandler.logError(error, 'TemplateManagementModule initialization failed');
            this.showError('Failed to initialize template management');
        }
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        // Template list and controls
        this.elements.templatesList = document.getElementById('templates-list');
        this.elements.createTemplateBtn = document.getElementById('create-template-btn');
        this.elements.searchInput = document.getElementById('template-search');
        this.elements.includeInactiveCheckbox = document.getElementById('include-inactive-templates');

        // Modal elements
        this.elements.templateModal = document.getElementById('template-modal');
        this.elements.templateForm = document.getElementById('template-form');
        this.elements.modalTitle = document.getElementById('template-modal-title');
        this.elements.titleInput = document.getElementById('template-title');
        this.elements.contentInput = document.getElementById('template-content');
        this.elements.saveButton = document.getElementById('save-template');
        this.elements.saveButtonText = document.getElementById('save-template-text');
        this.elements.closeTemplateModal = document.getElementById('close-template-modal');
        this.elements.cancelTemplate = document.getElementById('cancel-template');

        // Validate all required elements exist
        const requiredElements = [
            'templatesList', 'createTemplateBtn', 'searchInput',
            'templateModal', 'templateForm', 'modalTitle', 'titleInput', 'contentInput'
        ];

        for (const elementKey of requiredElements) {
            if (!this.elements[elementKey]) {
                throw new Error(`Required DOM element ${elementKey} not found`);
            }
        }

        console.log('🎯 TemplateManagementModule: DOM elements initialized');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Create template button
        const createTemplateHandler = () => this.openCreateModal();
        this.elements.createTemplateBtn.addEventListener('click', createTemplateHandler);
        this.eventListeners.push({
            element: this.elements.createTemplateBtn,
            event: 'click',
            handler: createTemplateHandler
        });

        // Filter controls
        const searchHandler = (e) => this.handleFilterChange('search', e.target.value);
        this.elements.searchInput.addEventListener('input', searchHandler);
        this.eventListeners.push({
            element: this.elements.searchInput,
            event: 'input',
            handler: searchHandler
        });

        const inactiveHandler = (e) => this.handleFilterChange('includeInactive', e.target.checked);
        this.elements.includeInactiveCheckbox.addEventListener('change', inactiveHandler);
        this.eventListeners.push({
            element: this.elements.includeInactiveCheckbox,
            event: 'change',
            handler: inactiveHandler
        });

        // Modal controls
        const closeTemplateHandler = () => this.closeModal();
        this.elements.closeTemplateModal.addEventListener('click', closeTemplateHandler);
        this.elements.cancelTemplate.addEventListener('click', closeTemplateHandler);
        this.eventListeners.push({
            element: this.elements.closeTemplateModal,
            event: 'click',
            handler: closeTemplateHandler
        });
        this.eventListeners.push({
            element: this.elements.cancelTemplate,
            event: 'click',
            handler: closeTemplateHandler
        });

        // Form submission
        const formSubmitHandler = (e) => this.handleFormSubmit(e);
        this.elements.templateForm.addEventListener('submit', formSubmitHandler);
        this.eventListeners.push({
            element: this.elements.templateForm,
            event: 'submit',
            handler: formSubmitHandler
        });

        // Close modal on outside click
        const modalBackdropHandler = (e) => {
            if (e.target === this.elements.templateModal) {
                this.closeModal();
            }
        };
        this.elements.templateModal.addEventListener('click', modalBackdropHandler);
        this.eventListeners.push({
            element: this.elements.templateModal,
            event: 'click',
            handler: modalBackdropHandler
        });

        console.log('🔗 TemplateManagementModule: Event listeners setup complete');
    }

    /**
     * Load templates from API
     */
    async loadTemplates() {
        if (this.state.isLoading) return;

        this.state.isLoading = true;
        this.showLoadingState();

        try {
            const endpoint = this.state.filters.includeInactive ? '/api/templates/all' : '/api/templates';
            const response = await this.apiManager.get(endpoint);

            if ((response && response.success) || (response && response.templates)) {
                const templates = response.templates || [];
                this.state.templates = this.sortTemplatesByOrder(templates);
                this.applyFilters();
                this.renderTemplates();

                console.log(`📋 Loaded ${this.state.templates.length} templates`);
            } else {
                throw new Error(response?.error || 'Failed to load templates');
            }
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load templates');
            this.showError('Failed to load templates. Please try again.');
        } finally {
            this.state.isLoading = false;
        }
    }

    /**
     * Handle filter changes
     */
    handleFilterChange(filterType, value) {
        this.state.filters[filterType] = value;

        if (filterType === 'includeInactive') {
            this.loadTemplates();
        } else {
            this.applyFilters();
            this.renderTemplates();
        }
    }

    /**
     * Apply current filters to templates
     */
    applyFilters() {
        let filtered = [...this.state.templates];

        // Apply search filter
        if (this.state.filters.search.trim()) {
            const searchTerm = this.state.filters.search.toLowerCase().trim();
            filtered = filtered.filter(template =>
                template.title.toLowerCase().includes(searchTerm) ||
                template.content.toLowerCase().includes(searchTerm)
            );
        }

        this.state.filteredTemplates = filtered;
    }

    /**
     * Maintain a stable display order for templates between updates
     */
    sortTemplatesByOrder(templates) {
        if (!Array.isArray(templates)) {
            return [];
        }

        const incomingIds = templates
            .map(template => template?.id)
            .filter(Boolean);

        if (incomingIds.length === 0) {
            return [...templates];
        }

        const preservedOrder = this.state.templateOrder
            .filter(id => incomingIds.includes(id));

        const newIds = incomingIds
            .filter(id => !this.state.templateOrder.includes(id));

        const updatedOrder = [...preservedOrder, ...newIds];
        this.state.templateOrder = updatedOrder;

        const orderIndex = new Map(updatedOrder.map((id, index) => [id, index]));

        return templates.slice().sort((a, b) => {
            const aIndex = orderIndex.get(a?.id) ?? Number.MAX_SAFE_INTEGER;
            const bIndex = orderIndex.get(b?.id) ?? Number.MAX_SAFE_INTEGER;
            return aIndex - bIndex;
        });
    }

    /**
     * Render templates list
     */
    renderTemplates() {
        if (!this.elements.templatesList) return;

        if (this.state.filteredTemplates.length === 0) {
            this.elements.templatesList.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-file-alt text-3xl mb-2"></i>
                    <p>No templates found</p>
                    <p class="text-sm">Try adjusting your filters or create a new template.</p>
                </div>
            `;
            return;
        }

        const templatesHtml = this.state.filteredTemplates
            .map(template => this.renderTemplateCard(template))
            .join('');

        this.elements.templatesList.innerHTML = templatesHtml;

        // Add event listeners to template cards
        this.attachTemplateEventListeners();
    }

    /**
     * Render individual template card
     */
    renderTemplateCard(template) {
        const isInactive = !template.is_active;
        const canEdit = this.canEditTemplate(template);
        const canDelete = this.canDeleteTemplate(template);

        return `
            <div class="template-card bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ${isInactive ? 'opacity-60' : ''}" data-template-id="${template.id}">
                <div class="flex items-start justify-between">
                    <div class="flex-1 min-w-0">
                        <h3 class="font-medium text-gray-900 flex items-center gap-2 mb-2">
                            ${template.title}
                            ${isInactive ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"><i class="fas fa-archive mr-1"></i>Inactive</span>' : ''}
                        </h3>
                        <p class="text-sm text-gray-600 mb-3 line-clamp-2">${this.truncateContent(template.content, 150)}</p>
                        <div class="flex items-center gap-4 text-xs text-gray-500">
                            <span><i class="fas fa-user mr-1"></i>${template.creator?.first_name} ${template.creator?.last_name}</span>
                            <span><i class="fas fa-clock mr-1"></i>${this.formatDate(template.created_at)}</span>
                            ${template.updated_at && template.updated_at !== template.created_at ? `<span><i class="fas fa-edit mr-1"></i>Updated ${this.formatDate(template.updated_at)}</span>` : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-1 ml-4">
                        ${canEdit ? `<button class="edit-template-btn text-gray-400 hover:text-indigo-600 p-2" data-template-id="${template.id}" title="Edit Template"><i class="fas fa-edit"></i></button>` : ''}
                        ${canDelete ? `<button class="delete-template-btn text-gray-400 hover:text-red-600 p-2" data-template-id="${template.id}" title="Archive Template"><i class="fas fa-archive"></i></button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners to template cards
     */
    attachTemplateEventListeners() {
        // Edit buttons
        const editButtons = this.elements.templatesList.querySelectorAll('.edit-template-btn');
        editButtons.forEach(button => {
            const handler = () => {
                const templateId = button.dataset.templateId;
                this.openEditModal(templateId);
            };
            button.addEventListener('click', handler);
        });

        // Delete buttons
        const deleteButtons = this.elements.templatesList.querySelectorAll('.delete-template-btn');
        deleteButtons.forEach(button => {
            const handler = () => {
                const templateId = button.dataset.templateId;
                this.handleDeleteTemplate(templateId);
            };
            button.addEventListener('click', handler);
        });
    }

    /**
     * Open create template modal
     */
    openCreateModal() {
        this.state.editingTemplate = null;
        this.elements.modalTitle.textContent = 'Create Template';
        this.elements.saveButtonText.textContent = 'Create Template';

        // Reset form
        this.elements.templateForm.reset();

        this.elements.templateModal.classList.remove('hidden');
        this.elements.titleInput.focus();
    }

    /**
     * Open edit template modal
     */
    openEditModal(templateId) {
        const template = this.state.templates.find(t => t.id === templateId);
        if (!template) {
            this.showError('Template not found');
            return;
        }

        this.state.editingTemplate = template;
        this.elements.modalTitle.textContent = 'Edit Template';
        this.elements.saveButtonText.textContent = 'Update Template';

        // Populate form
        this.elements.titleInput.value = template.title;
        this.elements.contentInput.value = template.content;

        this.elements.templateModal.classList.remove('hidden');
        this.elements.titleInput.focus();
    }

    /**
     * Close modal
     */
    closeModal() {
        this.elements.templateModal.classList.add('hidden');
        this.state.editingTemplate = null;
        this.elements.templateForm.reset();
    }

    /**
     * Handle form submission
     */
    async handleFormSubmit(e) {
        e.preventDefault();

        const formData = new FormData(this.elements.templateForm);
        const templateData = {
            title: formData.get('title').trim(),
            content: formData.get('content').trim()
        };

        // Validate required fields
        if (!templateData.title) {
            this.showError('Template title is required');
            return;
        }

        if (!templateData.content) {
            this.showError('Template content is required');
            return;
        }

        try {
            this.elements.saveButton.disabled = true;
            this.elements.saveButtonText.textContent = this.state.editingTemplate ? 'Updating...' : 'Creating...';

            let response;
            if (this.state.editingTemplate) {
                // Update existing template
                response = await this.apiManager.put(`/api/templates/${this.state.editingTemplate.id}`, templateData);
            } else {
                // Create new template
                response = await this.apiManager.post('/api/templates', templateData);
            }

            if (response.success || (response && (response.id || response.template))) {
                Toast.show(
                    this.state.editingTemplate ? 'Template updated successfully!' : 'Template created successfully!',
                    'success'
                );
                this.closeModal();
                await this.loadTemplates();
            } else {
                throw new Error(response.error || 'Failed to save template');
            }
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to save template');
            this.showError(error.message || 'Failed to save template. Please try again.');
        } finally {
            this.elements.saveButton.disabled = false;
            this.elements.saveButtonText.textContent = this.state.editingTemplate ? 'Update Template' : 'Create Template';
        }
    }

    /**
     * Handle delete template
     */
    async handleDeleteTemplate(templateId) {
        const template = this.state.templates.find(t => t.id === templateId);
        if (!template) {
            this.showError('Template not found');
            return;
        }

        const confirmMessage = `Are you sure you want to archive "${template.title}"?`;

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const response = await this.apiManager.delete(`/api/templates/${templateId}`);

            if (response.success) {
                Toast.show('Template archived successfully!', 'success');
                await this.loadTemplates();
            } else {
                throw new Error(response.error || 'Failed to archive template');
            }
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to archive template');
            this.showError(error.message || 'Failed to archive template. Please try again.');
        }
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        if (this.elements.templatesList) {
            this.elements.templatesList.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-spinner fa-spin text-3xl mb-2"></i>
                    <p>Loading templates...</p>
                </div>
            `;
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        Toast.show(message, 'error');
    }

    /**
     * Check if current user is admin
     */
    isAdmin() {
        return this.stateManager.isCurrentUserAdmin();
    }

    /**
     * Setup UI permissions based on user role
     */
    setupPermissions() {
        const isAdmin = this.isAdmin();

        // Hide create template button for non-admins
        if (this.elements.createTemplateBtn) {
            this.elements.createTemplateBtn.style.display = isAdmin ? 'flex' : 'none';
        }
    }

    /**
     * Check if user can edit template
     */
    canEditTemplate(template) {
        const user = this.stateManager.getCurrentUser();
        if (!user) return false;

        // Only admin can edit templates
        return user.role === 'admin';
    }

    /**
     * Check if user can delete template
     */
    canDeleteTemplate(template) {
        const user = this.stateManager.getCurrentUser();
        if (!user) return false;

        // Only admin can archive templates
        return user.role === 'admin';
    }

    /**
     * Truncate content for display
     */
    truncateContent(content, maxLength = 150) {
        if (!content) return '';
        if (content.length <= maxLength) return content;
        return content.substring(0, maxLength) + '...';
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        if (!dateString) return 'Unknown';

        try {
            const date = new Date(dateString);
            return date.toLocaleDateString();
        } catch (error) {
            return 'Invalid date';
        }
    }

    /**
     * Setup WebSocket listeners for real-time template updates
     */
    setupWebSocketListeners() {
        if (this.stateManager) {
            // Store callback reference for proper cleanup
            this.templatesUpdatedCallback = (templates) => {
                console.log('📝 TemplateManagementModule: Received real-time template update');
                if (templates && Array.isArray(templates)) {
                    this.state.templates = this.sortTemplatesByOrder(templates);
                    this.applyFilters();
                    this.renderTemplates();
                } else {
                    // If we receive a signal but no data, reload templates
                    this.loadTemplates();
                }
            };

            // Listen for template updates from StateManager/ConnectionManager
            this.stateManager.on('templatesUpdated', this.templatesUpdatedCallback);

            console.log('👂 TemplateManagementModule: WebSocket listeners setup complete');
        } else {
            console.warn('⚠️ TemplateManagementModule: No StateManager available for WebSocket listeners');
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Remove event listeners
        this.eventListeners.forEach(({ element, event, handler }) => {
            if (element && handler) {
                element.removeEventListener(event, handler);
            }
        });
        this.eventListeners = [];

        // Remove WebSocket listeners
        if (this.stateManager && this.templatesUpdatedCallback) {
            this.stateManager.off('templatesUpdated', this.templatesUpdatedCallback);
            this.templatesUpdatedCallback = null;
        }

        // Reset state
        this.state = {
            templates: [],
            filteredTemplates: [],
            templateOrder: [],
            filters: {
                search: '',
                includeInactive: false
            },
            editingTemplate: null,
            isLoading: false
        };

        console.log('🧹 TemplateManagementModule: Cleanup completed');
    }

    /**
     * Get module state (for debugging)
     */
    getState() {
        return {
            ...this.state,
            elements: Object.keys(this.elements).reduce((acc, key) => {
                acc[key] = !!this.elements[key];
                return acc;
            }, {})
        };
    }
}
