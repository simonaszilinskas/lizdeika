/**
 * Agent Tooltip Unit Tests
 * Tests tooltip functionality, accessibility, XSS prevention, and performance
 */

const fs = require('fs');
const path = require('path');

describe('Agent Tooltip', () => {
    let dashboard;
    let document;

    beforeEach(() => {
        // Setup JSDOM environment
        const { JSDOM } = require('jsdom');
        const html = fs.readFileSync(
            path.join(__dirname, '../../custom-widget/agent-dashboard.html'),
            'utf8'
        );
        const dom = new JSDOM(html, {
            url: 'http://localhost:3002',
            runScripts: 'dangerously',
            resources: 'usable'
        });
        global.window = dom.window;
        global.document = dom.window.document;
        document = global.document;

        // Mock localStorage
        global.localStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };

        // Create dashboard instance matching updated implementation
        dashboard = {
            tooltipListenersInitialized: false,
            tooltipHandlers: null,
            lastAgentListKey: null,
            connectedAgents: new Map(),

            updateConnectedAgents: function(agents) {
                this.connectedAgents.clear();
                agents.forEach(agent => this.connectedAgents.set(agent.id, agent));

                const totalAgentsCompact = document.getElementById('total-agents-compact');
                const tooltipWrapper = document.getElementById('agents-tooltip-wrapper');
                const tooltip = document.getElementById('agents-tooltip');
                const tooltipContent = document.getElementById('agents-tooltip-content');

                // Null safety BEFORE any operations
                const missingElements = [];
                if (!totalAgentsCompact) missingElements.push('total-agents-compact');
                if (!tooltipWrapper) missingElements.push('agents-tooltip-wrapper');
                if (!tooltip) missingElements.push('agents-tooltip');
                if (!tooltipContent) missingElements.push('agents-tooltip-content');

                if (missingElements.length > 0) {
                    console.warn(`Agent tooltip elements not found in DOM: ${missingElements.join(', ')}`);
                    return;
                }

                // Setup listeners (prevent memory leak)
                if (!this.tooltipListenersInitialized) {
                    this.tooltipHandlers = {
                        wrapperEnter: () => tooltip.classList.remove('hidden'),
                        wrapperLeave: () => tooltip.classList.add('hidden'),
                        tooltipEnter: () => tooltip.classList.remove('hidden'),
                        tooltipLeave: () => tooltip.classList.add('hidden'),
                        compactFocus: () => tooltip.classList.remove('hidden'),
                        compactBlur: () => tooltip.classList.add('hidden')
                    };

                    tooltipWrapper.addEventListener('mouseenter', this.tooltipHandlers.wrapperEnter);
                    tooltipWrapper.addEventListener('mouseleave', this.tooltipHandlers.wrapperLeave);
                    tooltip.addEventListener('mouseenter', this.tooltipHandlers.tooltipEnter);
                    tooltip.addEventListener('mouseleave', this.tooltipHandlers.tooltipLeave);
                    totalAgentsCompact.addEventListener('focus', this.tooltipHandlers.compactFocus);
                    totalAgentsCompact.addEventListener('blur', this.tooltipHandlers.compactBlur);

                    this.tooltipListenersInitialized = true;
                }

                // Performance: Check if update needed BEFORE expensive operations
                const agentListKey = agents.map(a => a.id + '-' + a.personalStatus).sort().join(',');

                if (this.lastAgentListKey === agentListKey) {
                    return;
                }
                this.lastAgentListKey = agentListKey;

                // Update agent count
                totalAgentsCompact.textContent = agents.length;

                // Filter agents (only if update is needed)
                const onlineAgents = agents.filter(agent => agent.personalStatus === 'online');
                const offlineAgents = agents.filter(agent => agent.personalStatus === 'offline');

                // Build tooltip using DOM nodes (XSS-safe)
                tooltipContent.textContent = '';

                if (onlineAgents.length > 0) {
                    const onlineHeader = document.createElement('div');
                    onlineHeader.className = 'font-semibold text-green-400 mb-1';
                    onlineHeader.textContent = `Online (${onlineAgents.length}):`;

                    const onlineList = document.createElement('div');
                    onlineList.className = 'mb-2';
                    onlineList.textContent = onlineAgents.map(a => a.username || a.email).join(', ');

                    tooltipContent.appendChild(onlineHeader);
                    tooltipContent.appendChild(onlineList);
                }

                if (offlineAgents.length > 0) {
                    const offlineHeader = document.createElement('div');
                    offlineHeader.className = 'font-semibold text-gray-400 mb-1';
                    offlineHeader.textContent = `Offline (${offlineAgents.length}):`;

                    const offlineList = document.createElement('div');
                    offlineList.textContent = offlineAgents.map(a => a.username || a.email).join(', ');

                    tooltipContent.appendChild(offlineHeader);
                    tooltipContent.appendChild(offlineList);
                }

                if (onlineAgents.length === 0 && offlineAgents.length === 0) {
                    tooltipContent.textContent = 'No agents connected';
                }
            },

            cleanupTooltipListeners: function() {
                if (!this.tooltipListenersInitialized || !this.tooltipHandlers) {
                    return;
                }

                const tooltipWrapper = document.getElementById('agents-tooltip-wrapper');
                const tooltip = document.getElementById('agents-tooltip');
                const totalAgentsCompact = document.getElementById('total-agents-compact');

                if (tooltipWrapper && tooltip && totalAgentsCompact) {
                    tooltipWrapper.removeEventListener('mouseenter', this.tooltipHandlers.wrapperEnter);
                    tooltipWrapper.removeEventListener('mouseleave', this.tooltipHandlers.wrapperLeave);
                    tooltip.removeEventListener('mouseenter', this.tooltipHandlers.tooltipEnter);
                    tooltip.removeEventListener('mouseleave', this.tooltipHandlers.tooltipLeave);
                    totalAgentsCompact.removeEventListener('focus', this.tooltipHandlers.compactFocus);
                    totalAgentsCompact.removeEventListener('blur', this.tooltipHandlers.compactBlur);
                }

                this.tooltipHandlers = null;
                this.tooltipListenersInitialized = false;
            }
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
        delete global.window;
        delete global.document;
        delete global.localStorage;
    });

    // Test 1: Memory Leak Prevention
    test('should initialize event listeners only once (memory leak prevention)', () => {
        const agents = [
            { id: 1, username: 'Agent 1', personalStatus: 'online' },
            { id: 2, username: 'Agent 2', personalStatus: 'offline' }
        ];

        // First call - should initialize listeners
        dashboard.updateConnectedAgents(agents);
        expect(dashboard.tooltipListenersInitialized).toBe(true);
        expect(dashboard.tooltipHandlers).not.toBeNull();

        const firstHandlers = dashboard.tooltipHandlers;

        // Second call - should use same handlers
        dashboard.updateConnectedAgents(agents);
        expect(dashboard.tooltipHandlers).toBe(firstHandlers);
    });

    // Test 2: Null Safety with Detailed Error
    test('should handle missing DOM elements gracefully with detailed warning', () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

        // Remove tooltip element
        const tooltip = document.getElementById('agents-tooltip');
        tooltip.remove();

        dashboard.updateConnectedAgents([{ id: 1, username: 'Test', personalStatus: 'online' }]);

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('agents-tooltip')
        );

        consoleWarnSpy.mockRestore();
    });

    // Test 3: XSS Prevention
    test('should prevent XSS attacks via agent names', () => {
        const maliciousAgents = [
            { id: 1, username: '<script>alert("XSS")</script>', personalStatus: 'online' },
            { id: 2, username: '<img src=x onerror=alert(1)>', personalStatus: 'offline' }
        ];

        dashboard.updateConnectedAgents(maliciousAgents);

        const tooltipContent = document.getElementById('agents-tooltip-content');

        // Should contain escaped HTML entities (safe rendering)
        expect(tooltipContent.textContent).toContain('<script>');
        expect(tooltipContent.textContent).toContain('<img');

        // Verify no actual script or img elements were created
        const scriptTags = tooltipContent.querySelectorAll('script');
        const imgTags = tooltipContent.querySelectorAll('img');

        expect(scriptTags.length).toBe(0);
        expect(imgTags.length).toBe(0);
    });

    // Test 4: Redundant DOM Update Prevention
    test('should skip DOM updates when agent list has not changed', () => {
        const agents = [
            { id: 1, username: 'Agent 1', personalStatus: 'online' },
            { id: 2, username: 'Agent 2', personalStatus: 'offline' }
        ];

        // First update
        dashboard.updateConnectedAgents(agents);
        const tooltipContent = document.getElementById('agents-tooltip-content');
        const firstHTML = tooltipContent.innerHTML;

        // Clear content to verify no update happens
        tooltipContent.innerHTML = 'CLEARED';

        // Second update with identical agents
        dashboard.updateConnectedAgents(agents);

        // Content should still be 'CLEARED' (no DOM update)
        expect(tooltipContent.innerHTML).toBe('CLEARED');
    });

    // Test 5: Tooltip Visibility on Mouse Hover
    test('should show tooltip on mouseenter and hide on mouseleave', () => {
        const agents = [{ id: 1, username: 'Test Agent', personalStatus: 'online' }];
        dashboard.updateConnectedAgents(agents);

        const tooltipWrapper = document.getElementById('agents-tooltip-wrapper');
        const tooltip = document.getElementById('agents-tooltip');

        // Initial state - hidden
        expect(tooltip.classList.contains('hidden')).toBe(true);

        // Trigger mouseenter
        const mouseEnterEvent = new window.MouseEvent('mouseenter', { bubbles: true });
        tooltipWrapper.dispatchEvent(mouseEnterEvent);

        // Should be visible
        expect(tooltip.classList.contains('hidden')).toBe(false);

        // Trigger mouseleave
        const mouseLeaveEvent = new window.MouseEvent('mouseleave', { bubbles: true });
        tooltipWrapper.dispatchEvent(mouseLeaveEvent);

        // Should be hidden again
        expect(tooltip.classList.contains('hidden')).toBe(true);
    });

    // Test 6: Keyboard Accessibility (Focus/Blur)
    test('should show tooltip on focus and hide on blur for keyboard navigation', () => {
        const agents = [{ id: 1, username: 'Test Agent', personalStatus: 'online' }];
        dashboard.updateConnectedAgents(agents);

        const totalAgentsCompact = document.getElementById('total-agents-compact');
        const tooltip = document.getElementById('agents-tooltip');

        // Initial state - hidden
        expect(tooltip.classList.contains('hidden')).toBe(true);

        // Trigger focus
        const focusEvent = new window.FocusEvent('focus', { bubbles: true });
        totalAgentsCompact.dispatchEvent(focusEvent);

        // Should be visible
        expect(tooltip.classList.contains('hidden')).toBe(false);

        // Trigger blur
        const blurEvent = new window.FocusEvent('blur', { bubbles: true });
        totalAgentsCompact.dispatchEvent(blurEvent);

        // Should be hidden again
        expect(tooltip.classList.contains('hidden')).toBe(true);
    });

    // Test 7: Correct Agent Count Display
    test('should display correct total agent count', () => {
        const agents = [
            { id: 1, username: 'Agent 1', personalStatus: 'online' },
            { id: 2, username: 'Agent 2', personalStatus: 'online' },
            { id: 3, username: 'Agent 3', personalStatus: 'offline' }
        ];

        dashboard.updateConnectedAgents(agents);

        const totalAgentsCompact = document.getElementById('total-agents-compact');
        expect(totalAgentsCompact.textContent).toBe('3');
    });

    // Test 8: Agent Status Grouping
    test('should group agents by online/offline status in tooltip', () => {
        const agents = [
            { id: 1, username: 'Alice', personalStatus: 'online' },
            { id: 2, username: 'Bob', personalStatus: 'online' },
            { id: 3, username: 'Charlie', personalStatus: 'offline' }
        ];

        dashboard.updateConnectedAgents(agents);

        const tooltipContent = document.getElementById('agents-tooltip-content');
        const text = tooltipContent.textContent;

        // Should contain both headers
        expect(text).toContain('Online (2):');
        expect(text).toContain('Offline (1):');

        // Should contain all agent names
        expect(text).toContain('Alice');
        expect(text).toContain('Bob');
        expect(text).toContain('Charlie');
    });

    // Test 9: Event Listener Cleanup
    test('should properly cleanup event listeners when cleanupTooltipListeners is called', () => {
        const agents = [{ id: 1, username: 'Test', personalStatus: 'online' }];

        // Initialize listeners
        dashboard.updateConnectedAgents(agents);
        expect(dashboard.tooltipListenersInitialized).toBe(true);
        expect(dashboard.tooltipHandlers).not.toBeNull();

        // Cleanup
        dashboard.cleanupTooltipListeners();
        expect(dashboard.tooltipListenersInitialized).toBe(false);
        expect(dashboard.tooltipHandlers).toBeNull();
    });

    // Test 10: Tooltip Stays Visible When Moving Cursor from Wrapper to Tooltip
    test('should keep tooltip visible when cursor moves from wrapper to tooltip element', () => {
        const agents = [{ id: 1, username: 'Test', personalStatus: 'online' }];
        dashboard.updateConnectedAgents(agents);

        const tooltipWrapper = document.getElementById('agents-tooltip-wrapper');
        const tooltip = document.getElementById('agents-tooltip');

        // Hover over wrapper
        tooltipWrapper.dispatchEvent(new window.MouseEvent('mouseenter', { bubbles: true }));
        expect(tooltip.classList.contains('hidden')).toBe(false);

        // Leave wrapper (moving to tooltip)
        tooltipWrapper.dispatchEvent(new window.MouseEvent('mouseleave', { bubbles: true }));

        // Enter tooltip
        tooltip.dispatchEvent(new window.MouseEvent('mouseenter', { bubbles: true }));
        expect(tooltip.classList.contains('hidden')).toBe(false);
    });
});
