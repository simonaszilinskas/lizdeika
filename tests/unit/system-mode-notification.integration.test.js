const ModuleLoader = require('../utilities/module-loader');
const JSDOMEnvironment = require('../../test-config/jsdom.config');

describe('Dashboard Service Integration', () => {
    let jsdom;
    let SystemModeManager;
    let NotificationService;

    beforeAll(() => {
        jsdom = new JSDOMEnvironment().setup();
        const systemModeModule = ModuleLoader.loadModule('custom-widget/js/agent-dashboard/core/SystemModeManager.js');
        const notificationModule = ModuleLoader.loadModule('custom-widget/js/agent-dashboard/notifications/NotificationService.js');

        SystemModeManager = systemModeModule.SystemModeManager || systemModeModule;
        NotificationService = notificationModule.NotificationService || notificationModule;
    });

    afterAll(() => {
        jsdom.teardown();
    });

    describe('SystemModeManager', () => {
        test('updates UI elements and hides AI suggestions when autopilot enabled', () => {
            document.body.innerHTML = `
                <div id="system-mode"></div>
                <div id="system-status-dot"></div>
            `;

            const hideAISuggestion = jest.fn();
            const manager = new SystemModeManager({
                chatManager: { hideAISuggestion },
                documentRef: document
            });

            expect(() => manager.update('autopilot')).not.toThrow();
            expect(document.getElementById('system-mode').textContent).toBe('AUTOPILOT');
            expect(hideAISuggestion).toHaveBeenCalledTimes(1);
        });

        test('swallows UI errors and logs gracefully', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const manager = new SystemModeManager({
                chatManager: {},
                documentRef: null
            });

            expect(() => manager.update('hitl')).not.toThrow();
            expect(consoleSpy).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('NotificationService', () => {
        test('renders notification with reassignment copy', () => {
            document.body.innerHTML = '';
            const service = new NotificationService({ documentRef: document });

            expect(() => service.notifyReassignment({
                reason: 'agent_joined',
                reassignments: [
                    { toAgent: 'agent-1', fromAgent: 'agent-2' }
                ]
            }, 'agent-1')).not.toThrow();

            const notification = document.getElementById('agent-notification');
            expect(notification).toBeTruthy();
            expect(notification.textContent).toContain('You received 1 tickets');
        });

        test('does not throw when document is unavailable', () => {
            const service = new NotificationService({ documentRef: null });
            expect(() => service.show('hello')).not.toThrow();
        });
    });
});
