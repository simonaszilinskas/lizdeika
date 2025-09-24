/**
 * Sidebar Manager for Agent Dashboard
 * Handles sidebar resizing, toggling, and responsive behavior
 */

export class SidebarManager {
    constructor(dashboard) {
        this.dashboard = dashboard;

        // Elements
        this.sidebar = document.getElementById('sidebar');
        this.resizeHandle = document.getElementById('resize-handle');
        this.mainChatArea = document.getElementById('main-chat-area');
        this.sidebarToggle = document.getElementById('sidebar-toggle');
        this.filterToggle = document.getElementById('filter-section-toggle');
        this.filterButtons = document.getElementById('filter-buttons');
        this.filterIcon = document.getElementById('filter-toggle-icon');

        // State
        this.isResizing = false;
        this.sidebarVisible = true;
        this.filterSectionCollapsed = false;

        // Configuration
        this.minWidth = 280;
        this.maxWidth = 600;
        this.defaultWidth = 400;
        this.collapsedWidth = 50;

        // Initialize
        this.init();
    }

    init() {
        // Load saved preferences
        this.loadPreferences();

        // Set up resize functionality
        this.setupResize();

        // Set up toggle functionality
        this.setupToggle();

        // Set up collapsible sections
        this.setupCollapsibleSections();

        // Set up keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Set up responsive behavior
        this.setupResponsiveObserver();

        // Initial responsive check
        this.checkResponsiveState();
    }

    /**
     * Load saved preferences from localStorage
     */
    loadPreferences() {
        // Load sidebar width
        const savedWidth = localStorage.getItem('agent_dashboard_sidebar_width');
        if (savedWidth && this.sidebar) {
            const width = parseInt(savedWidth);
            if (width >= this.minWidth && width <= this.maxWidth) {
                this.sidebar.style.width = `${width}px`;
            }
        }

        // Load sidebar visibility
        const savedVisibility = localStorage.getItem('agent_dashboard_sidebar_visible');
        if (savedVisibility === 'false') {
            this.hideSidebar(false); // Don't animate on initial load
        }

        // Load filter section state
        const filterCollapsed = localStorage.getItem('agent_dashboard_filter_collapsed');
        if (filterCollapsed === 'true') {
            this.collapseFilterSection(false); // Don't animate on initial load
        }
    }

    /**
     * Set up sidebar resize functionality
     */
    setupResize() {
        if (!this.resizeHandle || !this.sidebar) return;

        this.resizeHandle.addEventListener('mousedown', (e) => {
            // Don't allow resizing when sidebar is collapsed
            if (!this.sidebarVisible) {
                return;
            }

            this.isResizing = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isResizing) return;

            const newWidth = e.clientX;
            if (newWidth >= this.minWidth && newWidth <= this.maxWidth) {
                this.sidebar.style.width = `${newWidth}px`;
                this.checkResponsiveState();
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isResizing) {
                this.isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';

                // Save the new width
                const width = parseInt(this.sidebar.style.width);
                localStorage.setItem('agent_dashboard_sidebar_width', width);
            }
        });
    }

    /**
     * Set up sidebar toggle functionality
     */
    setupToggle() {
        if (!this.sidebarToggle) return;

        this.sidebarToggle.addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Also handle collapsed state toggle button
        const collapsedToggle = document.getElementById('sidebar-toggle-collapsed');
        if (collapsedToggle) {
            collapsedToggle.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }
    }

    /**
     * Toggle sidebar visibility
     */
    toggleSidebar() {
        if (this.sidebarVisible) {
            this.hideSidebar(true);
        } else {
            this.showSidebar(true);
        }
    }

    /**
     * Hide sidebar (collapse to thin strip)
     * @param {boolean} animate - Whether to animate the transition
     */
    hideSidebar(animate = true) {
        if (!this.sidebar || !this.resizeHandle) return;

        // Store current width for restoration
        const currentWidth = parseInt(this.sidebar.style.width) || this.defaultWidth;
        this.sidebar.dataset.expandedWidth = currentWidth;

        if (animate) {
            this.sidebar.style.transition = 'width 0.3s ease';
            this.resizeHandle.style.transition = 'opacity 0.3s ease';
        }

        // Collapse to thin strip instead of hiding completely
        this.sidebar.style.width = `${this.collapsedWidth}px`;
        this.sidebar.style.minWidth = `${this.collapsedWidth}px`;
        this.sidebar.classList.add('sidebar-collapsed');

        // Hide resize handle in collapsed state
        this.resizeHandle.style.opacity = '0';
        this.resizeHandle.style.pointerEvents = 'none';

        this.sidebarVisible = false;
        localStorage.setItem('agent_dashboard_sidebar_visible', 'false');

        if (animate) {
            setTimeout(() => {
                this.sidebar.style.transition = '';
                this.resizeHandle.style.transition = '';
            }, 300);
        }
    }

    /**
     * Show sidebar (expand from collapsed state)
     * @param {boolean} animate - Whether to animate the transition
     */
    showSidebar(animate = true) {
        if (!this.sidebar || !this.resizeHandle) return;

        if (animate) {
            this.sidebar.style.transition = 'width 0.3s ease';
            this.resizeHandle.style.transition = 'opacity 0.3s ease';
        }

        // Restore to expanded width
        const expandedWidth = this.sidebar.dataset.expandedWidth || this.defaultWidth;
        this.sidebar.style.width = `${expandedWidth}px`;
        this.sidebar.style.minWidth = '280px';
        this.sidebar.classList.remove('sidebar-collapsed');

        // Show resize handle in expanded state
        this.resizeHandle.style.opacity = '1';
        this.resizeHandle.style.pointerEvents = 'auto';

        this.sidebarVisible = true;
        localStorage.setItem('agent_dashboard_sidebar_visible', 'true');

        if (animate) {
            setTimeout(() => {
                this.sidebar.style.transition = '';
                this.resizeHandle.style.transition = '';
            }, 300);
        }
    }


    /**
     * Set up collapsible sections
     */
    setupCollapsibleSections() {
        if (!this.filterToggle) return;

        this.filterToggle.addEventListener('click', () => {
            if (this.filterSectionCollapsed) {
                this.expandFilterSection(true);
            } else {
                this.collapseFilterSection(true);
            }
        });
    }

    /**
     * Collapse filter section
     * @param {boolean} animate - Whether to animate the transition
     */
    collapseFilterSection(animate = true) {
        if (!this.filterButtons || !this.filterIcon) return;

        if (animate) {
            this.filterButtons.style.transition = 'max-height 0.3s ease';
            this.filterButtons.style.maxHeight = this.filterButtons.scrollHeight + 'px';
            setTimeout(() => {
                this.filterButtons.style.maxHeight = '0';
                this.filterButtons.style.overflow = 'hidden';
            }, 10);
        } else {
            this.filterButtons.style.maxHeight = '0';
            this.filterButtons.style.overflow = 'hidden';
        }

        this.filterIcon.style.transform = 'rotate(-90deg)';
        this.filterSectionCollapsed = true;
        localStorage.setItem('agent_dashboard_filter_collapsed', 'true');
    }

    /**
     * Expand filter section
     * @param {boolean} animate - Whether to animate the transition
     */
    expandFilterSection(animate = true) {
        if (!this.filterButtons || !this.filterIcon) return;

        if (animate) {
            this.filterButtons.style.transition = 'max-height 0.3s ease';
            this.filterButtons.style.maxHeight = this.filterButtons.scrollHeight + 'px';
            setTimeout(() => {
                this.filterButtons.style.maxHeight = '';
                this.filterButtons.style.overflow = '';
                this.filterButtons.style.transition = '';
            }, 300);
        } else {
            this.filterButtons.style.maxHeight = '';
            this.filterButtons.style.overflow = '';
        }

        this.filterIcon.style.transform = 'rotate(0deg)';
        this.filterSectionCollapsed = false;
        localStorage.setItem('agent_dashboard_filter_collapsed', 'false');
    }

    /**
     * Set up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+B to toggle sidebar
            if (e.ctrlKey && e.key === 'b') {
                e.preventDefault();
                this.toggleSidebar();
            }
        });
    }

    /**
     * Set up responsive observer to watch sidebar width
     */
    setupResponsiveObserver() {
        if (!this.sidebar) return;

        const observer = new ResizeObserver(() => {
            this.checkResponsiveState();
        });

        observer.observe(this.sidebar);
    }

    /**
     * Check and apply responsive states based on sidebar width
     */
    checkResponsiveState() {
        if (!this.sidebar) return;

        const width = parseInt(this.sidebar.style.width) || this.defaultWidth;

        // Update button text based on width
        this.updateButtonText(width);

        // Update navigation layout based on width
        this.updateNavigationLayout(width);

        // Update header layout based on width
        this.updateHeaderLayout(width);
    }

    /**
     * Update button text based on sidebar width
     * @param {number} width - Current sidebar width
     */
    updateButtonText(width) {
        const filterButtons = document.querySelectorAll('#filter-buttons button');
        const useShortText = width < 350;

        filterButtons.forEach(button => {
            const textElement = button.querySelector('.button-text');
            if (textElement) {
                const fullText = button.dataset.fullText;
                const shortText = button.dataset.shortText;
                textElement.textContent = useShortText ? shortText : fullText;
            }
        });
    }

    /**
     * Update navigation layout based on sidebar width
     * @param {number} width - Current sidebar width
     */
    updateNavigationLayout(width) {
        const navButtons = document.getElementById('nav-buttons');
        const navTexts = document.querySelectorAll('.nav-text');

        if (!navButtons) return;

        if (width < 350) {
            // Icon-only mode
            navTexts.forEach(text => {
                text.style.display = 'none';
            });
            navButtons.classList.add('justify-around');
            navButtons.classList.remove('gap-2');
        } else {
            // Full mode with text
            navTexts.forEach(text => {
                text.style.display = '';
            });
            navButtons.classList.remove('justify-around');
            navButtons.classList.add('gap-2');
        }
    }

    /**
     * Update header layout based on sidebar width
     * @param {number} width - Current sidebar width
     */
    updateHeaderLayout(width) {
        const headerTitle = document.querySelector('#sidebar h1');
        const headerSubtitle = document.querySelector('#sidebar .text-indigo-100');

        if (width < 350) {
            if (headerTitle) headerTitle.classList.add('text-base');
            if (headerTitle) headerTitle.classList.remove('text-lg');
            if (headerSubtitle) headerSubtitle.style.display = 'none';
        } else {
            if (headerTitle) headerTitle.classList.remove('text-base');
            if (headerTitle) headerTitle.classList.add('text-lg');
            if (headerSubtitle) headerSubtitle.style.display = '';
        }
    }

    /**
     * Get current sidebar width
     * @returns {number} Current sidebar width in pixels
     */
    getSidebarWidth() {
        return parseInt(this.sidebar?.style.width) || this.defaultWidth;
    }

    /**
     * Check if sidebar is currently visible
     * @returns {boolean} True if sidebar is visible
     */
    isSidebarVisible() {
        return this.sidebarVisible;
    }
}