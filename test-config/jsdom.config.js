const { JSDOM } = require('jsdom');

class JSDOMEnvironment {
    constructor(options = {}) {
        this.options = {
            url: 'http://localhost/',
            pretendToBeVisual: true,
            ...options
        };
        this.dom = null;
    }

    setup() {
        if (this.dom) {
            this.teardown();
        }

        // Add performance polyfill BEFORE creating JSDOM
        // JSDOM constructor internally uses performance API
        if (typeof global.performance === 'undefined') {
            global.performance = {
                now: () => Date.now(),
                timing: {
                    navigationStart: Date.now()
                },
                mark: () => {},
                measure: () => {},
                clearMarks: () => {},
                clearMeasures: () => {},
                getEntriesByName: () => [],
                getEntriesByType: () => []
            };
        }

        this.dom = new JSDOM('<!doctype html><html><body></body></html>', {
            url: this.options.url,
            pretendToBeVisual: this.options.pretendToBeVisual,
            runScripts: 'dangerously',
            resources: 'usable'
        });

        const { window } = this.dom;

        global.window = window;
        global.document = window.document;
        global.navigator = window.navigator;
        global.HTMLElement = window.HTMLElement;
        global.Node = window.Node;
        global.CustomEvent = window.CustomEvent;
        global.localStorage = window.localStorage;
        global.sessionStorage = window.sessionStorage;
        global.performance = window.performance;

        if (!window.matchMedia) {
            window.matchMedia = () => ({
                matches: false,
                addListener: () => {},
                removeListener: () => {},
                addEventListener: () => {},
                removeEventListener: () => {},
                dispatchEvent: () => {}
            });
        }

        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
        }

        if (!window.cancelAnimationFrame) {
            window.cancelAnimationFrame = (id) => clearTimeout(id);
        }

        if (!window.fetch) {
            window.fetch = () => Promise.resolve({ json: () => Promise.resolve({}) });
        }

        global.fetch = window.fetch.bind(window);

        return {
            window,
            document: window.document,
            teardown: () => this.teardown()
        };
    }

    teardown() {
        if (!this.dom) {
            return;
        }

        this.dom.window.close();
        this.dom = null;

        delete global.window;
        delete global.document;
        delete global.navigator;
        delete global.HTMLElement;
        delete global.Node;
        delete global.CustomEvent;
        delete global.localStorage;
        delete global.sessionStorage;
        delete global.performance;
        delete global.fetch;
    }
}

module.exports = JSDOMEnvironment;
