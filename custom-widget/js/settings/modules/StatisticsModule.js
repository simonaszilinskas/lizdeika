/**
 * STATISTICS MODULE
 *
 * Manages statistics dashboard for support operations
 * Displays conversation metrics, agent performance, AI usage, and template analytics
 */

export default class StatisticsModule {
    constructor(apiManager, stateManager) {
        this.apiManager = apiManager;
        this.stateManager = stateManager;

        this.dateRange = {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
            end: new Date()
        };

        this.currentView = 'dashboard'; // dashboard, conversations, agents, ai, templates, trends
        this.isLoading = false;
        this.error = null;
        this.data = null;
    }

    /**
     * Initialize the statistics module
     */
    async initialize() {
        this.renderStatisticsSection();
        this.attachEventListeners();
        await this.loadDashboard();
    }

    /**
     * Render the statistics section HTML
     */
    renderStatisticsSection() {
        const container = document.getElementById('statistics-section');
        if (!container) return;

        container.innerHTML = `
            <div class="bg-white rounded-lg shadow-md p-6">
                <div class="statistics-container">
                    <div class="statistics-header">
                        <h3>📊 Support Statistics</h3>
                        <div class="statistics-controls">
                            <div class="date-range-picker">
                                <label>From:</label>
                                <input type="date" id="stats-start-date" value="${this.formatDateForInput(this.dateRange.start)}">
                                <label>To:</label>
                                <input type="date" id="stats-end-date" value="${this.formatDateForInput(this.dateRange.end)}">
                                <button id="refresh-stats-btn" class="btn-primary">Refresh</button>
                            </div>
                            <div class="view-selector">
                                <button class="view-btn active" data-view="dashboard">Dashboard</button>
                                <button class="view-btn" data-view="conversations">Conversations</button>
                                <button class="view-btn" data-view="agents">Agents</button>
                                <button class="view-btn" data-view="ai">AI Usage</button>
                                <button class="view-btn" data-view="templates">Templates</button>
                            </div>
                        </div>
                    </div>

                    <div class="statistics-content">
                        <div id="stats-loading" class="loading-state" style="display: none;">
                            <div class="spinner"></div>
                            <p>Loading statistics...</p>
                        </div>

                        <div id="stats-error" class="error-state" style="display: none;">
                            <p class="error-message"></p>
                            <button id="retry-stats-btn" class="btn-secondary">Retry</button>
                        </div>

                        <div id="stats-data" class="stats-display"></div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        const refreshBtn = document.getElementById('refresh-stats-btn');
        const retryBtn = document.getElementById('retry-stats-btn');
        const startDateInput = document.getElementById('stats-start-date');
        const endDateInput = document.getElementById('stats-end-date');
        const viewBtns = document.querySelectorAll('.view-btn');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.handleRefresh());
        }

        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.handleRefresh());
        }

        if (startDateInput) {
            startDateInput.addEventListener('change', (e) => {
                this.dateRange.start = new Date(e.target.value);
            });
        }

        if (endDateInput) {
            endDateInput.addEventListener('change', (e) => {
                this.dateRange.end = new Date(e.target.value);
            });
        }

        viewBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                viewBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentView = e.target.dataset.view;
                this.loadView(this.currentView);
            });
        });
    }

    /**
     * Load statistics view
     */
    async loadView(view) {
        switch (view) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'conversations':
                await this.loadConversations();
                break;
            case 'agents':
                await this.loadAgents();
                break;
            case 'ai':
                await this.loadAIUsage();
                break;
            case 'templates':
                await this.loadTemplates();
                break;
        }
    }

    /**
     * Load dashboard overview
     */
    async loadDashboard() {
        this.showLoading();

        try {
            const params = new URLSearchParams({
                startDate: this.dateRange.start.toISOString(),
                endDate: this.dateRange.end.toISOString()
            });

            const response = await this.apiManager.get(`/api/statistics/dashboard?${params}`);

            if (response.success) {
                this.data = response.data;
                this.renderDashboard(response.data);
                this.hideLoading();
            } else {
                throw new Error(response.error || 'Failed to load dashboard');
            }
        } catch (error) {
            this.showError(error.message);
        }
    }

    /**
     * Load conversation statistics
     */
    async loadConversations() {
        this.showLoading();

        try {
            const params = new URLSearchParams({
                startDate: this.dateRange.start.toISOString(),
                endDate: this.dateRange.end.toISOString()
            });

            const response = await this.apiManager.get(`/api/statistics/conversations?${params}`);

            if (response.success) {
                this.data = response.data;
                this.renderConversations(response.data);
                this.hideLoading();
            } else {
                throw new Error(response.error || 'Failed to load conversation statistics');
            }
        } catch (error) {
            this.showError(error.message);
        }
    }

    /**
     * Load agent statistics
     */
    async loadAgents() {
        this.showLoading();

        try {
            const params = new URLSearchParams({
                startDate: this.dateRange.start.toISOString(),
                endDate: this.dateRange.end.toISOString()
            });

            const response = await this.apiManager.get(`/api/statistics/agents?${params}`);

            if (response.success) {
                this.data = response.data;
                this.renderAgents(response.data);
                this.hideLoading();
            } else {
                throw new Error(response.error || 'Failed to load agent statistics');
            }
        } catch (error) {
            this.showError(error.message);
        }
    }

    /**
     * Load AI usage statistics
     */
    async loadAIUsage() {
        this.showLoading();

        try {
            const params = new URLSearchParams({
                startDate: this.dateRange.start.toISOString(),
                endDate: this.dateRange.end.toISOString()
            });

            const response = await this.apiManager.get(`/api/statistics/ai-suggestions?${params}`);

            if (response.success) {
                this.data = response.data;
                this.renderAIUsage(response.data);
                this.hideLoading();
            } else {
                throw new Error(response.error || 'Failed to load AI usage statistics');
            }
        } catch (error) {
            this.showError(error.message);
        }
    }

    /**
     * Load template statistics
     */
    async loadTemplates() {
        this.showLoading();

        try {
            const params = new URLSearchParams({
                startDate: this.dateRange.start.toISOString(),
                endDate: this.dateRange.end.toISOString()
            });

            const response = await this.apiManager.get(`/api/statistics/templates?${params}`);

            if (response.success) {
                this.data = response.data;
                this.renderTemplates(response.data);
                this.hideLoading();
            } else {
                throw new Error(response.error || 'Failed to load template statistics');
            }
        } catch (error) {
            this.showError(error.message);
        }
    }

    /**
     * Render dashboard view
     */
    renderDashboard(data) {
        const container = document.getElementById('stats-data');
        if (!container) return;

        container.innerHTML = `
            <div class="dashboard-grid">
                <div class="stat-card stat-card-conversations">
                    <div class="stat-header">
                        <div class="stat-icon-wrapper stat-icon-blue">
                            <i class="fas fa-comments"></i>
                        </div>
                        <h4>Conversations</h4>
                    </div>
                    <div class="stat-body">
                        <div class="stat-main-value">${data.conversations?.total || 0}</div>
                        <div class="stat-breakdown">
                            <span class="stat-badge stat-badge-success">${data.conversations?.active || 0} active</span>
                            <span class="stat-badge stat-badge-gray">${data.conversations?.archived || 0} archived</span>
                        </div>
                    </div>
                </div>

                <div class="stat-card stat-card-messages">
                    <div class="stat-header">
                        <div class="stat-icon-wrapper stat-icon-purple">
                            <i class="fas fa-envelope"></i>
                        </div>
                        <h4>Messages</h4>
                    </div>
                    <div class="stat-body">
                        <div class="stat-main-value">${data.messages?.total || 0}</div>
                        <div class="stat-subtext">
                            <i class="fas fa-chart-line"></i> Avg ${data.messages?.averagePerConversation?.toFixed(1) || 0} per conversation
                        </div>
                    </div>
                </div>

                <div class="stat-card stat-card-agents">
                    <div class="stat-header">
                        <div class="stat-icon-wrapper stat-icon-green">
                            <i class="fas fa-users"></i>
                        </div>
                        <h4>Active Agents</h4>
                    </div>
                    <div class="stat-body">
                        <div class="stat-main-value">${data.agents?.activeAgents || 0}</div>
                        <div class="stat-subtext">
                            <i class="fas fa-trophy"></i> Top: <strong>${data.agents?.topAgent?.agentId || 'N/A'}</strong> (${data.agents?.topAgent?.messageCount || 0})
                        </div>
                    </div>
                </div>

                <div class="stat-card stat-card-ai">
                    <div class="stat-header">
                        <div class="stat-icon-wrapper stat-icon-indigo">
                            <i class="fas fa-robot"></i>
                        </div>
                        <h4>AI Suggestions</h4>
                    </div>
                    <div class="stat-body">
                        <div class="stat-main-value">${data.aiSuggestions?.totalSuggestions || 0}</div>
                        <div class="stat-breakdown">
                            <span class="stat-badge stat-badge-success">${data.aiSuggestions?.sentAsIsPercentage?.toFixed(0) || 0}% sent as-is</span>
                            <span class="stat-badge stat-badge-warning">${data.aiSuggestions?.editedPercentage?.toFixed(0) || 0}% edited</span>
                        </div>
                    </div>
                </div>

                <div class="stat-card stat-card-templates">
                    <div class="stat-header">
                        <div class="stat-icon-wrapper stat-icon-orange">
                            <i class="fas fa-file-alt"></i>
                        </div>
                        <h4>Templates</h4>
                    </div>
                    <div class="stat-body">
                        <div class="stat-main-value">${data.templates?.totalUsed || 0}</div>
                        <div class="stat-subtext">
                            <i class="fas fa-percentage"></i> ${data.templates?.usagePercentage?.toFixed(1) || 0}% of all messages
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render conversations view
     */
    renderConversations(data) {
        const container = document.getElementById('stats-data');
        if (!container) return;

        const byCategory = data.byCategory || [];
        const categoryRows = byCategory.map(cat => `
            <tr>
                <td>${cat.categoryName || 'Uncategorized'}</td>
                <td>${cat.count || 0}</td>
                <td>${cat.percentage?.toFixed(1) || 0}%</td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="conversations-stats">
                <div class="stat-section">
                    <h4>Overview</h4>
                    <p>Total: <strong>${data.total || 0}</strong> conversations</p>
                    <p>Active: <strong>${data.status?.active || 0}</strong></p>
                    <p>Archived: <strong>${data.status?.archived || 0}</strong></p>
                </div>

                <div class="stat-section">
                    <h4>By Category</h4>
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th>Count</th>
                                <th>Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${categoryRows || '<tr><td colspan="3">No data</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Render agents view
     */
    renderAgents(data) {
        const container = document.getElementById('stats-data');
        if (!container) return;

        const agentCounts = data.agentMessageCounts || [];
        const agentRows = agentCounts.map((agent, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${agent.agentName || agent.agentId}</td>
                <td>${agent.messageCount || 0}</td>
                <td>${agent.conversationCount || 0}</td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="agents-stats">
                <h4>Agent Performance</h4>
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Agent</th>
                            <th>Messages</th>
                            <th>Conversations</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${agentRows || '<tr><td colspan="4">No data</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Render AI usage view
     */
    renderAIUsage(data) {
        const container = document.getElementById('stats-data');
        if (!container) return;

        container.innerHTML = `
            <div class="ai-usage-stats">
                <div class="stat-section">
                    <h4>AI Suggestions (HITL Mode Only)</h4>
                    <p>Total Suggestions: <strong>${data.totalSuggestions || 0}</strong></p>

                    <div class="usage-breakdown">
                        <div class="usage-item">
                            <span class="usage-label">Sent As-Is</span>
                            <div class="usage-bar">
                                <div class="usage-fill" style="width: ${data.sentAsIsPercentage || 0}%"></div>
                            </div>
                            <span class="usage-value">${data.sentAsIs || 0} (${data.sentAsIsPercentage?.toFixed(1) || 0}%)</span>
                        </div>

                        <div class="usage-item">
                            <span class="usage-label">Edited</span>
                            <div class="usage-bar">
                                <div class="usage-fill" style="width: ${data.editedPercentage || 0}%"></div>
                            </div>
                            <span class="usage-value">${data.edited || 0} (${data.editedPercentage?.toFixed(1) || 0}%)</span>
                        </div>

                        <div class="usage-item">
                            <span class="usage-label">From Scratch</span>
                            <div class="usage-bar">
                                <div class="usage-fill" style="width: ${data.fromScratchPercentage || 0}%"></div>
                            </div>
                            <span class="usage-value">${data.fromScratch || 0} (${data.fromScratchPercentage?.toFixed(1) || 0}%)</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render templates view
     */
    renderTemplates(data) {
        const container = document.getElementById('stats-data');
        if (!container) return;

        const popularTemplates = data.popularTemplates || [];
        const templateRows = popularTemplates.map((template, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${template.templateName || 'Unnamed'}</td>
                <td>${template.usageCount || 0}</td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="templates-stats">
                <div class="stat-section">
                    <h4>Template Usage Overview</h4>
                    <p>Total Used: <strong>${data.totalUsed || 0}</strong></p>
                    <p>Usage Rate: <strong>${data.usagePercentage?.toFixed(1) || 0}%</strong> of all messages</p>
                </div>

                <div class="stat-section">
                    <h4>Most Popular Templates</h4>
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Template</th>
                                <th>Uses</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${templateRows || '<tr><td colspan="3">No data</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /**
     * Show loading state
     */
    showLoading() {
        this.isLoading = true;
        const loading = document.getElementById('stats-loading');
        const error = document.getElementById('stats-error');
        const data = document.getElementById('stats-data');

        if (loading) loading.style.display = 'block';
        if (error) error.style.display = 'none';
        if (data) data.style.display = 'none';
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        this.isLoading = false;
        const loading = document.getElementById('stats-loading');
        const data = document.getElementById('stats-data');

        if (loading) loading.style.display = 'none';
        if (data) data.style.display = 'block';
    }

    /**
     * Show error state
     */
    showError(message) {
        this.error = message;
        this.isLoading = false;

        const loading = document.getElementById('stats-loading');
        const error = document.getElementById('stats-error');
        const data = document.getElementById('stats-data');
        const errorMessage = error?.querySelector('.error-message');

        if (loading) loading.style.display = 'none';
        if (error) error.style.display = 'block';
        if (data) data.style.display = 'none';
        if (errorMessage) errorMessage.textContent = message;
    }

    /**
     * Handle refresh button click
     */
    async handleRefresh() {
        await this.loadView(this.currentView);
    }

    /**
     * Format date for input field
     */
    formatDateForInput(date) {
        return date.toISOString().split('T')[0];
    }

    /**
     * Cleanup
     */
    destroy() {
        // Remove event listeners if needed
    }
}
