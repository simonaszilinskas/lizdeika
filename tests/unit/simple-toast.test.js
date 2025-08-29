/**
 * SimpleToast Test Suite
 * Tests the simplified toast notification system
 */

// Mock DOM environment
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

// Load the SimpleToast module
const SimpleToast = require('../../custom-widget/js/modules/simpleToast.js');

describe('SimpleToast', () => {
    beforeEach(() => {
        // Clear the DOM
        document.body.innerHTML = '';
        document.head.innerHTML = '';
    });

    test('creates toast element with correct structure', () => {
        const toast = SimpleToast.show('Test message', 'info');
        
        expect(toast.classList.contains('simple-toast')).toBe(true);
        expect(toast.classList.contains('toast-info')).toBe(true);
        expect(toast.querySelector('.toast-message').textContent).toBe('Test message');
        expect(toast.querySelector('.toast-close')).toBeTruthy();
    });

    test('success method works correctly', () => {
        const toast = SimpleToast.success('Success message', 'Success');
        
        expect(toast.classList.contains('toast-success')).toBe(true);
        expect(toast.querySelector('.toast-message').textContent).toBe('Success: Success message');
    });

    test('error method works correctly', () => {
        const toast = SimpleToast.error('Error message', 'Error');
        
        expect(toast.classList.contains('toast-error')).toBe(true);
        expect(toast.querySelector('.toast-message').textContent).toBe('Error: Error message');
    });

    test('warning method works correctly', () => {
        const toast = SimpleToast.warning('Warning message', 'Warning');
        
        expect(toast.classList.contains('toast-warning')).toBe(true);
        expect(toast.querySelector('.toast-message').textContent).toBe('Warning: Warning message');
    });

    test('info method works correctly', () => {
        const toast = SimpleToast.info('Info message', 'Info');
        
        expect(toast.classList.contains('toast-info')).toBe(true);
        expect(toast.querySelector('.toast-message').textContent).toBe('Info: Info message');
    });

    test('escapes HTML in messages', () => {
        const toast = SimpleToast.show('<script>alert("xss")</script>', 'info');
        
        expect(toast.querySelector('.toast-message').textContent).toBe('<script>alert("xss")</script>');
        expect(toast.querySelector('.toast-message').innerHTML).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    test('adds styles to document head', () => {
        SimpleToast.show('Test message');
        
        const styles = document.getElementById('simple-toast-styles');
        expect(styles).toBeTruthy();
        expect(styles.tagName).toBe('STYLE');
    });

    test('hide method removes toast', (done) => {
        const toast = SimpleToast.show('Test message');
        
        expect(document.body.contains(toast)).toBe(true);
        
        SimpleToast.hide(toast);
        
        // Check that hiding class is added
        expect(toast.classList.contains('hiding')).toBe(true);
        
        // Check that element is removed after animation
        setTimeout(() => {
            expect(document.body.contains(toast)).toBe(false);
            done();
        }, 350);
    });

    test('auto-hides after duration', (done) => {
        const toast = SimpleToast.show('Test message', 'info', 100);
        
        expect(document.body.contains(toast)).toBe(true);
        
        setTimeout(() => {
            expect(toast.classList.contains('hiding')).toBe(true);
            done();
        }, 150);
    });

    test('does not auto-hide when duration is 0', (done) => {
        const toast = SimpleToast.show('Test message', 'info', 0);
        
        setTimeout(() => {
            expect(document.body.contains(toast)).toBe(true);
            expect(toast.classList.contains('hiding')).toBe(false);
            done();
        }, 100);
    });

    test('multiple toasts can coexist', () => {
        const toast1 = SimpleToast.show('Message 1');
        const toast2 = SimpleToast.show('Message 2');
        
        expect(document.body.contains(toast1)).toBe(true);
        expect(document.body.contains(toast2)).toBe(true);
        expect(document.querySelectorAll('.simple-toast').length).toBe(2);
    });

    test('handles missing title parameter gracefully', () => {
        const toast = SimpleToast.success('Just message');
        
        expect(toast.querySelector('.toast-message').textContent).toBe('Just message');
    });
});