/**
 * Category Management Module
 *
 * Handles category management operations in the settings page including:
 * - Category CRUD operations (create, read, update, delete/archive)
 * - Category filtering and search functionality
 * - Statistics display for admins
 * - Real-time UI updates and state management
 */

import { Toast } from '../../agent-dashboard/utils/Toast.js';
import { ErrorHandler } from '../../agent-dashboard/utils/ErrorHandler.js';

export class CategoryManagementModule {
    constructor(apiManager, stateManager, connectionManager) {
        this.apiManager = apiManager;
        this.stateManager = stateManager;
        this.connectionManager = connectionManager;

        // Module state
        this.state = {
            categories: [],
            filteredCategories: [],
            filters: {
                search: '',
                includeArchived: false
            },
            editingCategory: null,
            isLoading: false
        };

        // DOM elements
        this.elements = {
            // Category list and controls
            categoriesList: null,
            createCategoryBtn: null,
            searchInput: null,
            includeArchivedCheckbox: null,

            // Modal elements
            categoryModal: null,
            categoryForm: null,
            modalTitle: null,
            nameInput: null,
            descriptionInput: null,
            colorInput: null,
            colorHexInput: null,
            saveButton: null,
            saveButtonText: null,
            closeCategoryModal: null,
            cancelCategory: null,

            // Statistics
            categoryStatsContent: null
        };

        // Event listeners array for cleanup
        this.eventListeners = [];

        // Store WebSocket callback for proper cleanup
        this.categoriesUpdatedCallback = null;

        console.log('🏷️ CategoryManagementModule: Initialized');
    }

    /**
     * Initialize the category management module
     */
    async initialize() {
        try {
            // Initialize DOM elements
            this.initializeElements();

            // Setup event listeners
            this.setupEventListeners();

            // Setup real-time category updates
            this.setupWebSocketListeners();

            // Load initial categories
            await this.loadCategories();

            // Setup UI permissions
            this.setupPermissions();

            // Load statistics if admin
            if (this.isAdmin()) {
                await this.loadStatistics();
            }

            console.log('✅ CategoryManagementModule: Initialization complete');

        } catch (error) {
            ErrorHandler.logError(error, 'CategoryManagementModule initialization failed');
            this.showError('Failed to initialize category management');
        }
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        // Category list and controls
        this.elements.categoriesList = document.getElementById('categories-list');
        this.elements.createCategoryBtn = document.getElementById('create-category-btn');
        this.elements.searchInput = document.getElementById('category-search');
        this.elements.includeArchivedCheckbox = document.getElementById('include-archived-categories');

        // Modal elements
        this.elements.categoryModal = document.getElementById('category-modal');
        this.elements.categoryForm = document.getElementById('category-form');
        this.elements.modalTitle = document.getElementById('category-modal-title');
        this.elements.nameInput = document.getElementById('category-name');
        this.elements.descriptionInput = document.getElementById('category-description');
        this.elements.colorInput = document.getElementById('category-color');
        this.elements.colorHexInput = document.getElementById('category-color-hex');
        this.elements.saveButton = document.getElementById('save-category');
        this.elements.saveButtonText = document.getElementById('save-category-text');
        this.elements.closeCategoryModal = document.getElementById('close-category-modal');
        this.elements.cancelCategory = document.getElementById('cancel-category');

        // Statistics
        this.elements.categoryStatsContent = document.getElementById('category-stats-content');

        // Validate all required elements exist
        const requiredElements = [
            'categoriesList', 'createCategoryBtn', 'searchInput',
            'categoryModal', 'categoryForm', 'modalTitle', 'nameInput'
        ];

        for (const elementKey of requiredElements) {
            if (!this.elements[elementKey]) {
                throw new Error(`Required DOM element ${elementKey} not found`);
            }
        }

        console.log('🎯 CategoryManagementModule: DOM elements initialized');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Create category button
        const createCategoryHandler = () => this.openCreateModal();
        this.elements.createCategoryBtn.addEventListener('click', createCategoryHandler);
        this.eventListeners.push({
            element: this.elements.createCategoryBtn,
            event: 'click',
            handler: createCategoryHandler
        });

        // Filter controls

        const searchHandler = (e) => this.handleFilterChange('search', e.target.value);
        this.elements.searchInput.addEventListener('input', searchHandler);
        this.eventListeners.push({
            element: this.elements.searchInput,
            event: 'input',
            handler: searchHandler
        });

        const archivedHandler = (e) => this.handleFilterChange('includeArchived', e.target.checked);
        this.elements.includeArchivedCheckbox.addEventListener('change', archivedHandler);
        this.eventListeners.push({
            element: this.elements.includeArchivedCheckbox,
            event: 'change',
            handler: archivedHandler
        });

        // Modal controls
        const closeCategoryHandler = () => this.closeModal();
        this.elements.closeCategoryModal.addEventListener('click', closeCategoryHandler);
        this.elements.cancelCategory.addEventListener('click', closeCategoryHandler);
        this.eventListeners.push({
            element: this.elements.closeCategoryModal,
            event: 'click',
            handler: closeCategoryHandler
        });
        this.eventListeners.push({
            element: this.elements.cancelCategory,
            event: 'click',
            handler: closeCategoryHandler
        });

        // Form submission
        const formSubmitHandler = (e) => this.handleFormSubmit(e);
        this.elements.categoryForm.addEventListener('submit', formSubmitHandler);
        this.eventListeners.push({
            element: this.elements.categoryForm,
            event: 'submit',
            handler: formSubmitHandler
        });

        // Color input synchronization
        const colorInputHandler = (e) => {
            this.elements.colorHexInput.value = e.target.value;
        };
        this.elements.colorInput.addEventListener('change', colorInputHandler);
        this.eventListeners.push({
            element: this.elements.colorInput,
            event: 'change',
            handler: colorInputHandler
        });

        const colorHexHandler = (e) => {
            const value = e.target.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                this.elements.colorInput.value = value;
            }
        };
        this.elements.colorHexInput.addEventListener('change', colorHexHandler);
        this.eventListeners.push({
            element: this.elements.colorHexInput,
            event: 'change',
            handler: colorHexHandler
        });

        // Close modal on outside click
        const modalBackdropHandler = (e) => {
            if (e.target === this.elements.categoryModal) {
                this.closeModal();
            }
        };
        this.elements.categoryModal.addEventListener('click', modalBackdropHandler);
        this.eventListeners.push({
            element: this.elements.categoryModal,
            event: 'click',
            handler: modalBackdropHandler
        });

        console.log('🔗 CategoryManagementModule: Event listeners setup complete');
    }

    /**
     * Load categories from API
     */
    async loadCategories() {
        if (this.state.isLoading) return;

        this.state.isLoading = true;
        this.showLoadingState();

        try {
            const params = new URLSearchParams({
                include_archived: this.state.filters.includeArchived.toString(),
                search: this.state.filters.search,
                limit: '100'
            });

            const response = await this.apiManager.get(`/api/categories?${params}`);

            // Handle response - some APIs return success field, others don't but have categories
            if ((response && response.success) || (response && response.categories)) {
                this.state.categories = response.categories || [];
                this.applyFilters();
                this.renderCategories();

                console.log(`📋 Loaded ${this.state.categories.length} categories`);
            } else {
                throw new Error(response?.error || 'Failed to load categories');
            }
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load categories');
            this.showError('Failed to load categories. Please try again.');
        } finally {
            this.state.isLoading = false;
        }
    }

    /**
     * Load category statistics (admin only)
     */
    async loadStatistics() {
        if (!this.isAdmin() || !this.elements.categoryStatsContent) return;

        try {
            const response = await this.apiManager.get('/api/categories/stats');

            if (response.success) {
                this.renderStatistics(response.stats);
            } else {
                console.warn('Failed to load category statistics:', response.error);
                this.elements.categoryStatsContent.innerHTML = '<p class="text-gray-500">Failed to load statistics</p>';
            }
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to load category statistics');
            this.elements.categoryStatsContent.innerHTML = '<p class="text-gray-500">Failed to load statistics</p>';
        }
    }

    /**
     * Handle filter changes
     */
    handleFilterChange(filterType, value) {
        this.state.filters[filterType] = value;

        // Reload data if needed or apply local filters
        if (filterType === 'includeArchived') {
            this.loadCategories();
        } else {
            this.applyFilters();
            this.renderCategories();
        }
    }

    /**
     * Apply current filters to categories
     */
    applyFilters() {
        let filtered = [...this.state.categories];

        // Apply search filter
        if (this.state.filters.search.trim()) {
            const searchTerm = this.state.filters.search.toLowerCase().trim();
            filtered = filtered.filter(category =>
                category.name.toLowerCase().includes(searchTerm) ||
                (category.description && category.description.toLowerCase().includes(searchTerm))
            );
        }

        this.state.filteredCategories = filtered;
    }

    /**
     * Render categories list
     */
    renderCategories() {
        if (!this.elements.categoriesList) return;

        if (this.state.filteredCategories.length === 0) {
            this.elements.categoriesList.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-tags text-3xl mb-2"></i>
                    <p>No categories found</p>
                    <p class="text-sm">Try adjusting your filters or create a new category.</p>
                </div>
            `;
            return;
        }

        const categoriesHtml = this.state.filteredCategories
            .map(category => this.renderCategoryCard(category))
            .join('');

        this.elements.categoriesList.innerHTML = categoriesHtml;

        // Add event listeners to category cards
        this.attachCategoryEventListeners();
    }

    /**
     * Render individual category card
     */
    renderCategoryCard(category) {
        const isArchived = category.is_archived;
        const canEdit = this.canEditCategory(category);
        const canDelete = this.canDeleteCategory(category);
        return `
            <div class="category-card bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ${isArchived ? 'opacity-60' : ''}" data-category-id="${category.id}">
                <div class="flex items-start justify-between">
                    <div class="flex items-start gap-3 flex-1">
                        <div class="w-4 h-4 rounded-full mt-1 flex-shrink-0" style="background-color: ${category.color}"></div>
                        <div class="flex-1 min-w-0">
                            <h3 class="font-medium text-gray-900 flex items-center gap-2">
                                ${category.name}
                                ${isArchived ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"><i class="fas fa-archive mr-1"></i>Archived</span>' : ''}
                            </h3>
                            ${category.description ? `<p class="text-sm text-gray-600 mt-1">${category.description}</p>` : ''}
                            <div class="flex items-center gap-4 text-xs text-gray-500 mt-2">
                                <span><i class="fas fa-ticket-alt mr-1"></i>${category._count?.tickets || 0} tickets</span>
                                <span><i class="fas fa-user mr-1"></i>${category.creator?.first_name} ${category.creator?.last_name}</span>
                                <span><i class="fas fa-clock mr-1"></i>${this.formatDate(category.created_at)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center gap-1">
                        ${canEdit ? `<button class="edit-category-btn text-gray-400 hover:text-indigo-600 p-2" data-category-id="${category.id}" title="Edit Category"><i class="fas fa-edit"></i></button>` : ''}
                        ${canDelete ? `<button class="delete-category-btn text-gray-400 hover:text-red-600 p-2" data-category-id="${category.id}" title="Archive Category"><i class="fas fa-archive"></i></button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners to category cards
     */
    attachCategoryEventListeners() {
        // Edit buttons
        const editButtons = this.elements.categoriesList.querySelectorAll('.edit-category-btn');
        editButtons.forEach(button => {
            const handler = () => {
                const categoryId = button.dataset.categoryId;
                this.openEditModal(categoryId);
            };
            button.addEventListener('click', handler);
        });

        // Delete buttons
        const deleteButtons = this.elements.categoriesList.querySelectorAll('.delete-category-btn');
        deleteButtons.forEach(button => {
            const handler = () => {
                const categoryId = button.dataset.categoryId;
                this.handleDeleteCategory(categoryId);
            };
            button.addEventListener('click', handler);
        });
    }

    /**
     * Open create category modal
     */
    openCreateModal() {
        this.state.editingCategory = null;
        this.elements.modalTitle.textContent = 'Create Category';
        this.elements.saveButtonText.textContent = 'Create Category';

        // Reset form
        this.elements.categoryForm.reset();
        this.elements.colorInput.value = '#6B7280';
        this.elements.colorHexInput.value = '#6B7280';

        this.elements.categoryModal.classList.remove('hidden');
        this.elements.nameInput.focus();
    }

    /**
     * Open edit category modal
     */
    openEditModal(categoryId) {
        const category = this.state.categories.find(c => c.id === categoryId);
        if (!category) {
            this.showError('Category not found');
            return;
        }

        this.state.editingCategory = category;
        this.elements.modalTitle.textContent = 'Edit Category';
        this.elements.saveButtonText.textContent = 'Update Category';

        // Populate form
        this.elements.nameInput.value = category.name;
        this.elements.descriptionInput.value = category.description || '';
        this.elements.colorInput.value = category.color;
        this.elements.colorHexInput.value = category.color;

        this.elements.categoryModal.classList.remove('hidden');
        this.elements.nameInput.focus();
    }

    /**
     * Close modal
     */
    closeModal() {
        this.elements.categoryModal.classList.add('hidden');
        this.state.editingCategory = null;
        this.elements.categoryForm.reset();
    }

    /**
     * Handle form submission
     */
    async handleFormSubmit(e) {
        e.preventDefault();

        const formData = new FormData(this.elements.categoryForm);
        const categoryData = {
            name: formData.get('name').trim(),
            description: formData.get('description').trim() || null,
            color: formData.get('color')
        };

        // Validate required fields
        if (!categoryData.name) {
            this.showError('Category name is required');
            return;
        }

        // Validate color format
        if (!/^#[0-9A-Fa-f]{6}$/.test(categoryData.color)) {
            this.showError('Please enter a valid color in hex format (e.g., #FF0000)');
            return;
        }

        try {
            this.elements.saveButton.disabled = true;
            this.elements.saveButtonText.textContent = this.state.editingCategory ? 'Updating...' : 'Creating...';

            let response;
            if (this.state.editingCategory) {
                // Update existing category
                response = await this.apiManager.put(`/api/categories/${this.state.editingCategory.id}`, categoryData);
            } else {
                // Create new category
                response = await this.apiManager.post('/api/categories', categoryData);
            }

            // Handle response - check for success or if response contains category data
            if (response.success || (response && (response.id || response.category))) {
                Toast.show(
                    this.state.editingCategory ? 'Category updated successfully!' : 'Category created successfully!',
                    'success'
                );
                this.closeModal();
                await this.loadCategories();

                // Reload statistics if admin
                if (this.isAdmin()) {
                    await this.loadStatistics();
                }
            } else {
                throw new Error(response.error || 'Failed to save category');
            }
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to save category');
            this.showError(error.message || 'Failed to save category. Please try again.');
        } finally {
            this.elements.saveButton.disabled = false;
            this.elements.saveButtonText.textContent = this.state.editingCategory ? 'Update Category' : 'Create Category';
        }
    }

    /**
     * Handle delete category
     */
    async handleDeleteCategory(categoryId) {
        const category = this.state.categories.find(c => c.id === categoryId);
        if (!category) {
            this.showError('Category not found');
            return;
        }

        const ticketCount = category._count?.tickets || 0;
        const confirmMessage = ticketCount > 0
            ? `Are you sure you want to archive "${category.name}"? This will affect ${ticketCount} ticket(s).`
            : `Are you sure you want to archive "${category.name}"?`;

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const response = await this.apiManager.delete(`/api/categories/${categoryId}`);

            if (response.success) {
                Toast.show('Category archived successfully!', 'success');
                await this.loadCategories();

                // Reload statistics if admin
                if (this.isAdmin()) {
                    await this.loadStatistics();
                }
            } else {
                throw new Error(response.error || 'Failed to archive category');
            }
        } catch (error) {
            ErrorHandler.logError(error, 'Failed to archive category');
            this.showError(error.message || 'Failed to archive category. Please try again.');
        }
    }

    /**
     * Render statistics (admin only)
     */
    renderStatistics(stats) {
        if (!this.elements.categoryStatsContent || !stats) return;

        const html = `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="text-center">
                    <div class="text-2xl font-bold text-gray-900">${stats.totals?.total_categories || 0}</div>
                    <div class="text-sm text-gray-600">Total Categories</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-green-600">${stats.totals?.active_categories || 0}</div>
                    <div class="text-sm text-gray-600">Active</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-gray-600">${stats.totals?.archived_categories || 0}</div>
                    <div class="text-sm text-gray-600">Archived</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-blue-600">${stats.totals?.categorized_tickets || 0}</div>
                    <div class="text-sm text-gray-600">Categorized Tickets</div>
                </div>
            </div>

            <div class="grid md:grid-cols-1 gap-6">
                <div>
                    <h4 class="font-medium text-gray-900 mb-3">Most Used Categories</h4>
                    <div class="space-y-2">
                        ${stats.top_categories?.slice(0, 5).map(cat => `
                            <div class="flex justify-between items-center">
                                <div class="flex items-center gap-2">
                                    <div class="w-3 h-3 rounded-full" style="background-color: ${cat.color || '#6B7280'}"></div>
                                    <span class="text-gray-600 truncate">${cat.name}</span>
                                </div>
                                <span class="font-medium">${cat.ticket_count}</span>
                            </div>
                        `).join('') || '<p class="text-gray-500 text-sm">No data available</p>'}
                    </div>
                </div>
            </div>
        `;

        this.elements.categoryStatsContent.innerHTML = html;
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        if (this.elements.categoriesList) {
            this.elements.categoriesList.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-spinner fa-spin text-3xl mb-2"></i>
                    <p>Loading categories...</p>
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

        // Hide create category button for non-admins
        if (this.elements.createCategoryBtn) {
            this.elements.createCategoryBtn.style.display = isAdmin ? 'block' : 'none';
        }
    }

    /**
     * Check if user can edit category
     */
    canEditCategory(category) {
        const user = this.stateManager.getCurrentUser();
        if (!user) return false;

        // Only admin can edit categories
        return user.role === 'admin';
    }

    /**
     * Check if user can delete category
     */
    canDeleteCategory(category) {
        const user = this.stateManager.getCurrentUser();
        if (!user) return false;

        // Only admin can archive categories
        return user.role === 'admin';
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
     * Setup WebSocket listeners for real-time category updates
     */
    setupWebSocketListeners() {
        if (this.stateManager) {
            // Store callback reference for proper cleanup
            this.categoriesUpdatedCallback = (categories) => {
                console.log('🏷️ CategoryManagementModule: Received real-time category update');
                if (categories && Array.isArray(categories)) {
                    this.state.categories = categories;
                    this.applyFilters();
                    this.renderCategories();
                } else {
                    // If we receive a signal but no data, reload categories
                    this.loadCategories();
                }
            };

            // Listen for category updates from StateManager/ConnectionManager
            this.stateManager.on('categoriesUpdated', this.categoriesUpdatedCallback);

            console.log('👂 CategoryManagementModule: WebSocket listeners setup complete');
        } else {
            console.warn('⚠️ CategoryManagementModule: No StateManager available for WebSocket listeners');
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
        if (this.stateManager && this.categoriesUpdatedCallback) {
            this.stateManager.off('categoriesUpdated', this.categoriesUpdatedCallback);
            this.categoriesUpdatedCallback = null;
        }

        // Reset state
        this.state = {
            categories: [],
            filteredCategories: [],
            filters: {
                search: '',
                includeArchived: false
            },
            editingCategory: null,
            isLoading: false
        };

        console.log('🧹 CategoryManagementModule: Cleanup completed');
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