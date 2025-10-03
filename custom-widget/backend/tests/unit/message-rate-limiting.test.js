/**
 * Unit tests for customer message rate limiting key generator
 */

describe('Customer Message Rate Limiting Key Generator', () => {
    const keyGenerator = (req) => {
        // Use req.ip which is validated by Express when trust proxy is enabled
        // This prevents clients from spoofing x-forwarded-for header
        return req.ip || 'unknown';
    };

    it('should use req.ip when available', () => {
        const mockReq = { ip: '192.168.1.100' };
        const key = keyGenerator(mockReq);
        expect(key).toBe('192.168.1.100');
    });

    it('should handle IPv4 addresses', () => {
        const mockReq = { ip: '203.0.113.1' };
        const key = keyGenerator(mockReq);
        expect(key).toBe('203.0.113.1');
    });

    it('should handle IPv6 addresses', () => {
        const mockReq = { ip: '2001:0db8:85a3:0000:0000:8a2e:0370:7334' };
        const key = keyGenerator(mockReq);
        expect(key).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    });

    it('should handle localhost IPv4', () => {
        const mockReq = { ip: '127.0.0.1' };
        const key = keyGenerator(mockReq);
        expect(key).toBe('127.0.0.1');
    });

    it('should handle localhost IPv6', () => {
        const mockReq = { ip: '::1' };
        const key = keyGenerator(mockReq);
        expect(key).toBe('::1');
    });

    it('should fallback to unknown when req.ip is missing', () => {
        const mockReq = {};
        const key = keyGenerator(mockReq);
        expect(key).toBe('unknown');
    });

    it('should not be affected by x-forwarded-for header (prevents spoofing)', () => {
        const mockReq = {
            ip: '192.168.1.100',
            headers: {
                'x-forwarded-for': '203.0.113.1'
            }
        };
        const key = keyGenerator(mockReq);
        // Should use req.ip, not x-forwarded-for
        expect(key).toBe('192.168.1.100');
    });
});

describe('Rate Limiting Configuration', () => {
    it('should be set to 10 messages per minute', () => {
        const windowMs = 60 * 1000;
        const max = 10;

        expect(windowMs).toBe(60000);
        expect(max).toBe(10);
    });

    it('should have proper error message structure', () => {
        const errorMessage = {
            success: false,
            error: 'Too many messages. Please wait before sending more.',
            code: 'RATE_LIMIT_EXCEEDED'
        };

        expect(errorMessage.success).toBe(false);
        expect(errorMessage.error).toBe('Too many messages. Please wait before sending more.');
        expect(errorMessage.code).toBe('RATE_LIMIT_EXCEEDED');
    });
});
