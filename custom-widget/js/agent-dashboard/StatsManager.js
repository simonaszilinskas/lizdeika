export class StatsManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.container = document.getElementById('dashboard-stats');
        this.refreshButton = document.getElementById('refresh-stats-button');
        this.rangeLabel = document.getElementById('stats-range-label');
        this.lastUpdatedLabel = document.getElementById('stats-last-updated');
        this.errorBanner = document.getElementById('stats-error');
        this.summaryElements = {
            totalConversationsValue: document.getElementById('stats-total-conversations-value'),
            totalConversationsSubtext: document.getElementById('stats-total-conversations-subtext'),
            aiSuggestionsValue: document.getElementById('stats-ai-suggestions-value'),
            aiSuggestionsSubtext: document.getElementById('stats-ai-suggestions-subtext'),
            agentResponsesValue: document.getElementById('stats-agent-responses-value'),
            agentResponsesSubtext: document.getElementById('stats-agent-responses-subtext'),
            activeAgentsValue: document.getElementById('stats-active-agents-value'),
            activeAgentsSubtext: document.getElementById('stats-active-agents-subtext')
        };
        this.leaderboardContainer = document.getElementById('stats-agent-leaderboard');
        this.leaderboardTotal = document.getElementById('stats-agent-total-responses');
        this.suggestionUsageContainer = document.getElementById('stats-suggestion-usage');
        this.suggestionUsageTotal = document.getElementById('stats-suggestion-total');
        this.templateUsageContainer = document.getElementById('stats-template-usage');
        this.templateUsageRate = document.getElementById('stats-template-usage-rate');
        this.activityContainer = document.getElementById('stats-activity-summary');

        this.numberFormatter = new Intl.NumberFormat('lt-LT');
        this.percentFormatter = new Intl.NumberFormat('lt-LT', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

        this.refreshThrottleMs = 30000;
        this.lastRefresh = 0;
        this.pendingRefresh = null;
    }

    async init() {
        if (!this.container) {
            return;
        }

        this.attachEvents();
        await this.refreshStats(false);
    }

    attachEvents() {
        if (this.refreshButton) {
            this.refreshButton.addEventListener('click', () => {
                this.refreshStats(true);
            });
        }
    }

    async refreshStats(showToast = false) {
        if (!this.container) {
            return;
        }

        try {
            this.setLoadingState(true);
            const response = await this.dashboard.apiManager.fetchDashboardStats();
            const stats = response?.success ? response.data : response;

            if (!stats) {
                throw new Error('Gauta tuščia statistikos informacija');
            }

            this.renderStats(stats);
            this.lastRefresh = Date.now();
            if (showToast) {
                this.dashboard.showToast('Statistika atnaujinta', 'success');
            }
        } catch (error) {
            console.error('Failed to load dashboard statistics:', error);
            this.showErrorState('Nepavyko įkelti statistikos. Pabandykite dar kartą.');
            if (showToast) {
                this.dashboard.showToast('Nepavyko atnaujinti statistikos', 'error');
            }
        } finally {
            this.setLoadingState(false);
            if (this.pendingRefresh) {
                clearTimeout(this.pendingRefresh);
                this.pendingRefresh = null;
            }
        }
    }

    requestRefresh(reason = 'auto') {
        if (!this.container) {
            return;
        }

        const now = Date.now();
        if (now - this.lastRefresh >= this.refreshThrottleMs) {
            this.refreshStats(false);
        } else if (!this.pendingRefresh) {
            const delay = Math.max(this.refreshThrottleMs - (now - this.lastRefresh), 5000);
            this.pendingRefresh = setTimeout(() => {
                this.pendingRefresh = null;
                this.refreshStats(false);
            }, delay);
        }
    }

    setLoadingState(isLoading) {
        if (!this.container) return;
        this.container.classList.toggle('opacity-60', isLoading);
        if (this.refreshButton) {
            this.refreshButton.disabled = isLoading;
            this.refreshButton.classList.toggle('cursor-not-allowed', isLoading);
        }
    }

    renderStats(stats) {
        this.clearErrorState();
        this.updateHeader(stats);
        this.updateSummaryCards(stats);
        this.renderAgentLeaderboard(stats.agentLeaderboard || []);
        this.renderSuggestionUsage(stats.suggestionUsage || {});
        this.renderTemplateUsage(stats.templateUsage || {});
        this.renderActivity(stats.activity || {}, stats.totals || {});
    }

    updateHeader(stats) {
        if (this.rangeLabel) {
            const range = stats.range || {};
            if (range.start && range.end) {
                const formatter = new Intl.DateTimeFormat('lt-LT', { year: 'numeric', month: 'short', day: 'numeric' });
                const start = formatter.format(new Date(range.start));
                const end = formatter.format(new Date(range.end));
                this.rangeLabel.textContent = `Laikotarpis: ${start} – ${end}`;
            } else {
                const days = range.days || 30;
                this.rangeLabel.textContent = `Laikotarpis: paskutinės ${days} dienos`;
            }
        }

        if (this.lastUpdatedLabel) {
            const updatedAt = stats.generatedAt ? new Date(stats.generatedAt) : new Date();
            const timeFormatter = new Intl.DateTimeFormat('lt-LT', { hour: '2-digit', minute: '2-digit' });
            this.lastUpdatedLabel.textContent = `Atnaujinta: ${timeFormatter.format(updatedAt)}`;
        }
    }

    updateSummaryCards(stats) {
        const totals = stats.totals || {};
        const activity = stats.activity || {};
        const suggestionUsage = stats.suggestionUsage?.aiSuggestions || {};

        if (this.summaryElements.totalConversationsValue) {
            this.summaryElements.totalConversationsValue.textContent = this.formatNumber(totals.conversations || 0);
        }
        if (this.summaryElements.totalConversationsSubtext) {
            const open = this.formatNumber(totals.openConversations || 0);
            const last7 = this.formatNumber(totals.conversationsLast7Days || 0);
            this.summaryElements.totalConversationsSubtext.textContent = `Atviri: ${open} · 7 d.: ${last7}`;
        }

        if (this.summaryElements.aiSuggestionsValue) {
            const range = suggestionUsage.range ?? totals.suggestionsGeneratedInRange ?? 0;
            this.summaryElements.aiSuggestionsValue.textContent = this.formatNumber(range);
        }
        if (this.summaryElements.aiSuggestionsSubtext) {
            const last24 = this.formatNumber(suggestionUsage.last24Hours || 0);
            const last7 = this.formatNumber(suggestionUsage.last7Days || 0);
            this.summaryElements.aiSuggestionsSubtext.textContent = `24 val.: ${last24} · 7 d.: ${last7}`;
        }

        if (this.summaryElements.agentResponsesValue) {
            this.summaryElements.agentResponsesValue.textContent = this.formatNumber(totals.agentResponsesInRange || 0);
        }
        if (this.summaryElements.agentResponsesSubtext) {
            const last24 = this.formatNumber(activity.agentResponsesLast24Hours || 0);
            const avgPerConversation = Number.isFinite(totals.agentResponsesPerConversationInRange)
                ? this.percentFormatter.format(totals.agentResponsesPerConversationInRange)
                : '0';
            this.summaryElements.agentResponsesSubtext.textContent = `24 val.: ${last24} · Vid. pokalbiui: ${avgPerConversation}`;
        }

        if (this.summaryElements.activeAgentsValue) {
            this.summaryElements.activeAgentsValue.textContent = this.formatNumber(totals.activeAgents || 0);
        }
        if (this.summaryElements.activeAgentsSubtext) {
            const newConversations = this.formatNumber(activity.newConversationsLast24Hours || 0);
            this.summaryElements.activeAgentsSubtext.textContent = `Nauji pokalbiai (24 val.): ${newConversations}`;
        }

        if (this.leaderboardTotal) {
            this.leaderboardTotal.textContent = `Iš viso atsakymų: ${this.formatNumber(totals.agentResponsesInRange || 0)}`;
        }

        if (this.suggestionUsageTotal) {
            const recorded = stats.suggestionUsage?.totals?.recorded || 0;
            this.suggestionUsageTotal.textContent = `Įrašyta atsakymų: ${this.formatNumber(recorded)}`;
        }

        if (this.templateUsageRate) {
            const rate = stats.templateUsage?.rate || 0;
            this.templateUsageRate.textContent = `${this.percentFormatter.format(rate)}% atsakymų`;
        }
    }

    renderAgentLeaderboard(leaderboard) {
        if (!this.leaderboardContainer) return;

        this.leaderboardContainer.innerHTML = '';

        if (!leaderboard.length) {
            const li = document.createElement('li');
            li.className = 'text-gray-500 text-sm';
            li.textContent = 'Dar nėra agentų aktyvumo duomenų.';
            this.leaderboardContainer.appendChild(li);
            return;
        }

        leaderboard.slice(0, 6).forEach((agent) => {
            const item = document.createElement('li');
            item.className = 'space-y-2';
            const percentage = Math.min(agent.percentage || 0, 100);
            item.innerHTML = `
                <div class="flex items-center justify-between">
                    <div>
                        <p class="font-semibold text-gray-900">${agent.name}</p>
                        ${agent.email ? `<p class="text-xs text-gray-500">${agent.email}</p>` : ''}
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-semibold text-gray-900">${this.formatNumber(agent.count || 0)}</p>
                        <p class="text-xs text-gray-500">${this.percentFormatter.format(percentage)}%</p>
                    </div>
                </div>
                <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full bg-indigo-500 rounded-full" style="width: ${percentage}%;"></div>
                </div>
            `;
            this.leaderboardContainer.appendChild(item);
        });
    }

    renderSuggestionUsage(usage) {
        if (!this.suggestionUsageContainer) return;

        this.suggestionUsageContainer.innerHTML = '';

        const totals = usage.totals || {};
        const percentages = usage.percentages || {};

        const segments = [
            {
                key: 'asIs',
                label: 'Siųsta kaip yra',
                color: 'bg-indigo-500'
            },
            {
                key: 'edited',
                label: 'Redaguota prieš siunčiant',
                color: 'bg-emerald-500'
            },
            {
                key: 'fromScratch',
                label: 'Rašyta nuo pradžių',
                color: 'bg-gray-500'
            }
        ];

        segments.forEach((segment) => {
            const value = totals[segment.key] || 0;
            const percent = Math.min(percentages[segment.key] || 0, 100);
            const wrapper = document.createElement('div');
            wrapper.innerHTML = `
                <div class="flex items-center justify-between text-sm">
                    <span class="text-gray-700">${segment.label}</span>
                    <span class="text-gray-900 font-medium">${this.formatNumber(value)} · ${this.percentFormatter.format(percent)}%</span>
                </div>
                <div class="mt-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full ${segment.color} rounded-full" style="width: ${percent}%;"></div>
                </div>
            `;
            this.suggestionUsageContainer.appendChild(wrapper);
        });

        const adoptionRate = usage.adoptionRate || 0;
        const adoptionNote = document.createElement('p');
        adoptionNote.className = 'text-xs text-gray-500 mt-3';
        adoptionNote.textContent = `AI pasiūlymų pritaikymas: ${this.percentFormatter.format(adoptionRate)}%`;
        this.suggestionUsageContainer.appendChild(adoptionNote);

        if ((totals.withoutMetadata || 0) > 0) {
            const note = document.createElement('p');
            note.className = 'text-xs text-amber-600 mt-1';
            note.textContent = `Be žymos: ${this.formatNumber(totals.withoutMetadata)} ats.`;
            this.suggestionUsageContainer.appendChild(note);
        }
    }

    renderTemplateUsage(templateUsage) {
        if (!this.templateUsageContainer) return;

        this.templateUsageContainer.innerHTML = '';
        const breakdown = templateUsage.breakdown || [];

        if (!breakdown.length) {
            const p = document.createElement('p');
            p.className = 'text-gray-500 text-sm';
            p.textContent = 'Šablonai dar nenaudoti.';
            this.templateUsageContainer.appendChild(p);
            return;
        }

        breakdown.slice(0, 6).forEach((entry) => {
            const percent = Math.min(entry.percentageOfAgentMessages || 0, 100);
            const block = document.createElement('div');
            block.className = 'space-y-2';
            block.innerHTML = `
                <div class="flex items-center justify-between">
                    <div>
                        <p class="font-semibold text-gray-900">${entry.templateName}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-semibold text-gray-900">${this.formatNumber(entry.count || 0)}</p>
                        <p class="text-xs text-gray-500">${this.percentFormatter.format(percent)}% ats.</p>
                    </div>
                </div>
                <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500 rounded-full" style="width: ${percent}%;"></div>
                </div>
            `;
            this.templateUsageContainer.appendChild(block);
        });
    }

    renderActivity(activity, totals) {
        if (!this.activityContainer) return;

        const map = {
            'conversations-24h': activity.newConversationsLast24Hours,
            'conversations-7d': activity.newConversationsLast7Days,
            'messages-24h': activity.messagesLast24Hours,
            'customer-messages-24h': activity.customerMessagesLast24Hours,
            'agent-responses-24h': activity.agentResponsesLast24Hours,
            'suggestions-24h': activity.aiSuggestionsGeneratedLast24Hours
        };

        const nodes = this.activityContainer.querySelectorAll('[data-activity]');
        nodes.forEach((node) => {
            const key = node.getAttribute('data-activity');
            const value = map[key] ?? 0;
            node.textContent = this.formatNumber(value);
        });
    }

    showErrorState(message) {
        if (!this.errorBanner) return;
        this.errorBanner.textContent = message;
        this.errorBanner.classList.remove('hidden');
    }

    clearErrorState() {
        if (!this.errorBanner) return;
        this.errorBanner.classList.add('hidden');
    }

    formatNumber(value) {
        const safeValue = Number.isFinite(value) ? value : 0;
        return this.numberFormatter.format(safeValue);
    }
}
