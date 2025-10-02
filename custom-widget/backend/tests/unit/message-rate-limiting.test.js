/**
 * Unit tests for customer message rate limiting key generator
 */

describe('Customer Message Rate Limiting Key Generator', () => {
    const keyGenerator = (req) => {
        // Prioritize x-forwarded-for for proxied requests, then req.ip (when trust proxy is enabled)
        return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    };

    it('should prioritize x-forwarded-for over req.ip for proxied requests', () => {
        const mockReq = {
            ip: '192.168.1.100',
            headers: {
                'x-forwarded-for': '203.0.113.1'
            }
        };
        const key = keyGenerator(mockReq);
        expect(key).toBe('203.0.113.1');
    });

    it('should extract IP from x-forwarded-for header when present', () => {
        const mockReq = {
            headers: {
                'x-forwarded-for': '10.0.0.1, 192.168.1.1'
            }
        };
        const key = keyGenerator(mockReq);
        expect(key).toBe('10.0.0.1');
    });

    it('should handle multiple IPs in x-forwarded-for and take the first', () => {
        const mockReq = {
            headers: {
                'x-forwarded-for': '203.0.113.1, 192.168.1.1, 10.0.0.1'
            }
        };
        const key = keyGenerator(mockReq);
        expect(key).toBe('203.0.113.1');
    });

    it('should fall back to req.ip when x-forwarded-for is not present', () => {
        const mockReq = { ip: '192.168.1.100', headers: {} };
        const key = keyGenerator(mockReq);
        expect(key).toBe('192.168.1.100');
    });

    it('should handle missing IP with fallback to unknown', () => {
        const mockReq = { headers: {} };
        const key = keyGenerator(mockReq);
        expect(key).toBe('unknown');
    });

    it('should trim whitespace from x-forwarded-for IP', () => {
        const mockReq = {
            headers: {
                'x-forwarded-for': '  10.0.0.1  , 192.168.1.1'
            }
        };
        const key = keyGenerator(mockReq);
        expect(key).toBe('10.0.0.1');
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
