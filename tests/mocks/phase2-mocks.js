/**
 * Phase 2 Module Mocks
 * 
 * Provides mock implementations of core services for testing Phase 2 modules
 * Includes APIManager, StateManager, and ConnectionManager mocks
 */

class MockAPIManager {
    constructor(apiUrl = 'http://localhost:3002', stateManager = null) {
        this.apiUrl = apiUrl;
        this.stateManager = stateManager;
        this.mockResponses = new Map();
        this.requestHistory = [];
        this.authHeaders = { 'Authorization': 'Bearer mock-token' };
    }

    // Mock response configuration
    setMockResponse(endpoint, response, shouldFail = false) {
        this.mockResponses.set(endpoint, { response, shouldFail });
    }

    getAuthHeaders() {
        return this.authHeaders;
    }

    async apiRequest(endpoint, options = {}) {
        this.requestHistory.push({ endpoint, options });
        
        const mockConfig = this.mockResponses.get(endpoint);
        if (!mockConfig) {
            throw new Error(`No mock response configured for ${endpoint}`);
        }

        if (mockConfig.shouldFail) {
            throw new Error(mockConfig.response.error || 'API request failed');
        }

        return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockConfig.response)
        });
    }

    // System mode methods
    async loadSystemMode() {
        const response = await this.apiRequest('/api/system/mode');
        const data = await response.json();
        if (this.stateManager) {
            this.stateManager.setSystemMode(data.data.mode);
        }
    }

    async saveSystemMode(mode) {
        const response = await this.apiRequest('/api/system/mode', {
            method: 'POST',
            body: JSON.stringify({ mode })
        });
        if (this.stateManager) {
            this.stateManager.setSystemMode(mode);
        }
    }

    // Widget configuration methods
    async loadWidgetConfiguration() {
        const response = await this.apiRequest('/api/widget/config');
        const data = await response.json();
        if (this.stateManager) {
            this.stateManager.setWidgetConfiguration(data.data);
        }
    }

    // Agent methods
    async loadConnectedAgents() {
        const response = await this.apiRequest('/api/agents/connected');
        const data = await response.json();
        if (this.stateManager) {
            this.stateManager.setConnectedAgents(data.data);
        }
        return data.data;
    }

    // User management methods
    async loadUsers() {
        const response = await this.apiRequest('/api/users');
        const data = await response.json();
        if (this.stateManager) {
            this.stateManager.setUsers(data.data);
        }
    }

    // Test utilities
    clearRequestHistory() {
        this.requestHistory = [];
    }

    getLastRequest() {
        return this.requestHistory[this.requestHistory.length - 1];
    }

    getRequestCount(endpoint) {
        return this.requestHistory.filter(req => req.endpoint === endpoint).length;
    }

    async initialize() {
        // Mock initialization
        return Promise.resolve();
    }
}

class MockStateManager {
    constructor() {
        this.state = {
            currentUser: null,
            systemMode: null,
            connectedAgents: [],
            users: [],
            widgetConfiguration: null,
            uiPreferences: {
                activeTab: 'system',
                lastRefresh: null
            }
        };
        
        this.listeners = new Map();
        this.eventHistory = [];
    }

    // Event system
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) callbacks.splice(index, 1);
        }
    }

    emit(event, data) {
        this.eventHistory.push({ event, data, timestamp: Date.now() });
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }

    // State getters
    getCurrentUser() {
        return this.state.currentUser;
    }

    getSystemMode() {
        return this.state.systemMode;
    }

    getConnectedAgents() {
        return this.state.connectedAgents;
    }

    getUsers() {
        return this.state.users;
    }

    getWidgetConfiguration() {
        return this.state.widgetConfiguration;
    }

    getUIPreferences() {
        return this.state.uiPreferences;
    }

    // State setters
    setCurrentUser(user) {
        const previous = this.state.currentUser;
        this.state.currentUser = user;
        const hasChanged = JSON.stringify(previous) !== JSON.stringify(user);
        if (hasChanged) {
            this.emit('currentUserChanged', user);
        }
    }

    setSystemMode(mode) {
        const previous = this.state.systemMode;
        this.state.systemMode = mode;
        if (previous !== mode) {
            this.emit('systemModeChanged', mode);
        }
    }

    setConnectedAgents(agents) {
        const previous = this.state.connectedAgents;
        this.state.connectedAgents = agents;
        const hasChanged = JSON.stringify(previous) !== JSON.stringify(agents);
        if (hasChanged) {
            this.emit('connectedAgentsChanged', agents);
        }
    }

    setUsers(users) {
        const previous = this.state.users;
        this.state.users = users;
        const hasChanged = JSON.stringify(previous) !== JSON.stringify(users);
        if (hasChanged) {
            this.emit('usersChanged', users);
        }
    }

    setWidgetConfiguration(config) {
        const previous = this.state.widgetConfiguration;
        this.state.widgetConfiguration = config;
        const hasChanged = JSON.stringify(previous) !== JSON.stringify(config);
        if (hasChanged) {
            this.emit('widgetConfigurationChanged', config);
        }
    }

    setUIPreferences(prefs) {
        this.state.uiPreferences = { ...this.state.uiPreferences, ...prefs };
        this.emit('uiPreferencesChanged', this.state.uiPreferences);
    }

    // Test utilities
    clearEventHistory() {
        this.eventHistory = [];
    }

    getEventHistory(eventType = null) {
        if (eventType) {
            return this.eventHistory.filter(event => event.event === eventType);
        }
        return this.eventHistory;
    }

    getLastEvent(eventType = null) {
        const events = this.getEventHistory(eventType);
        return events[events.length - 1];
    }

    reset() {
        this.state = {
            currentUser: null,
            systemMode: null,
            connectedAgents: [],
            users: [],
            widgetConfiguration: null,
            uiPreferences: {
                activeTab: 'system',
                lastRefresh: null
            }
        };
        this.eventHistory = [];
    }

    async initialize() {
        // Mock initialization
        return Promise.resolve();
    }
}

class MockConnectionManager {
    constructor(apiUrl = 'http://localhost:3002', stateManager = null) {
        this.apiUrl = apiUrl;
        this.stateManager = stateManager;
        this.listeners = new Map();
        this.isConnected = false;
        this.eventHistory = [];
    }

    // Event system
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) callbacks.splice(index, 1);
        }
    }

    emit(event, data) {
        this.eventHistory.push({ event, data, timestamp: Date.now() });
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }

    // Connection methods
    async initialize() {
        this.isConnected = true;
        this.emit('connected', { status: 'connected' });
        return Promise.resolve();
    }

    disconnect() {
        this.isConnected = false;
        this.emit('disconnected', { status: 'disconnected' });
    }

    // Mock WebSocket events
    simulateAgentUpdate(agents) {
        this.emit('agents-updated', { agents });
    }

    simulateSystemModeUpdate(mode) {
        this.emit('system-mode-updated', { mode });
    }

    // Test utilities
    clearEventHistory() {
        this.eventHistory = [];
    }

    getEventHistory(eventType = null) {
        if (eventType) {
            return this.eventHistory.filter(event => event.event === eventType);
        }
        return this.eventHistory;
    }

    destroy() {
        this.disconnect();
        this.listeners.clear();
    }
}

// Test data factories
class TestDataFactory {
    static createUser(overrides = {}) {
        return {
            id: 'user-' + Math.random().toString(36).substr(2, 9),
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            role: 'agent',
            isActive: true,
            lastLogin: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            ...overrides
        };
    }

    static createAgent(overrides = {}) {
        return {
            id: 'agent-' + Math.random().toString(36).substr(2, 9),
            name: 'Test Agent',
            personalStatus: 'online',
            lastSeen: new Date().toISOString(),
            connectedAt: new Date().toISOString(),
            ...overrides
        };
    }

    static createWidgetConfig(overrides = {}) {
        return {
            name: 'Test Widget',
            primaryColor: '#2c5530',
            allowedDomains: ['*'],
            serverUrl: 'http://localhost:3002',
            ...overrides
        };
    }

    static createSystemMode(mode = 'hitl') {
        return {
            mode,
            lastChanged: new Date().toISOString(),
            changedBy: 'test-user'
        };
    }
}

// DOM test utilities
class DOMTestUtils {
    static createMockDOM() {
        // Create essential DOM elements for testing
        document.body.innerHTML = `
            <!-- System Mode Elements -->
            <span id="current-mode">Loading...</span>
            <button id="save-mode">Save Mode</button>
            <input type="radio" name="systemMode" value="hitl" id="mode-hitl">
            <input type="radio" name="systemMode" value="autopilot" id="mode-autopilot">
            <input type="radio" name="systemMode" value="off" id="mode-off">
            
            <!-- Agent Status Elements -->
            <div id="agents-list"></div>
            <span id="total-connected">0</span>
            <span id="total-available">0</span>
            <span id="total-afk">0</span>
            
            <!-- Widget Config Elements -->
            <div id="current-widget-config">Loading...</div>
            <button id="generate-code">Generate Code</button>
            <button id="copy-code">Copy</button>
            <div id="integration-code-container" class="hidden">
                <textarea id="integration-code"></textarea>
            </div>
            
            <!-- User Management Elements -->
            <button id="add-user-btn">Add User</button>
            <tbody id="users-table-body"></tbody>
            <span id="total-users">0</span>
            
            <!-- Modals -->
            <div id="add-user-modal" class="hidden">
                <form id="add-user-form">
                    <input name="firstName" id="add-first-name">
                    <input name="lastName" id="add-last-name">
                    <input name="email" id="add-email">
                    <select name="role" id="add-role">
                        <option value="admin">Admin</option>
                        <option value="agent">Agent</option>
                    </select>
                </form>
            </div>
            
            <div id="edit-user-modal" class="hidden">
                <form id="edit-user-form">
                    <input type="hidden" id="edit-user-id">
                    <input name="firstName" id="edit-first-name">
                    <input name="lastName" id="edit-last-name">
                    <input name="email" id="edit-email">
                    <select name="role" id="edit-role">
                        <option value="admin">Admin</option>
                        <option value="agent">Agent</option>
                    </select>
                </form>
            </div>
            
            <div id="new-password-modal" class="hidden">
                <input id="generated-password" type="text" readonly>
                <button id="copy-password">Copy Password</button>
            </div>
        `;
    }

    static simulateClick(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.click();
            return true;
        }
        return false;
    }

    static simulateFormSubmit(formId, data = {}) {
        const form = document.getElementById(formId);
        if (!form) return false;

        // Populate form fields
        Object.entries(data).forEach(([key, value]) => {
            const field = form.querySelector(`[name="${key}"], #${key}`);
            if (field) {
                field.value = value;
            }
        });

        // Create and dispatch submit event
        const event = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(event);
        return true;
    }

    static simulateRadioChange(name, value) {
        const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
        if (radio) {
            radio.checked = true;
            // Create event using JSDOM's event system
            const event = radio.ownerDocument.createEvent('Event');
            event.initEvent('change', true, true);
            radio.dispatchEvent(event);
            return true;
        }
        return false;
    }

    static getElementText(elementId) {
        const element = document.getElementById(elementId);
        return element ? element.textContent || element.value : null;
    }

    static isElementHidden(elementId) {
        const element = document.getElementById(elementId);
        return element ? element.classList.contains('hidden') : true;
    }
}

module.exports = {
    MockAPIManager,
    MockStateManager,
    MockConnectionManager,
    TestDataFactory,
    DOMTestUtils
};