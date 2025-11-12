/**
 * Unit tests for Token Utilities
 * Tests real JWT generation and verification
 */
const jwt = require('jsonwebtoken');
const tokenUtils = require('../../src/utils/tokenUtils');

const TEST_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-unit-tests';

describe('TokenUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Access Token Verification', () => {
        test('should verify valid JWT access token', () => {
            const payload = {
                sub: 'user-123',
                email: 'user@test.com',
                role: 'agent',
            };

            const token = jwt.sign(payload, TEST_SECRET, {
                expiresIn: '15m',
                issuer: 'lizdeika',
                audience: 'lizdeika-users',
            });
            const decoded = tokenUtils.verifyAccessToken(token);

            expect(decoded).toBeDefined();
            expect(decoded.sub).toBe('user-123');
            expect(decoded.email).toBe('user@test.com');
            expect(decoded.role).toBe('agent');
            expect(decoded.iat).toBeDefined();
            expect(decoded.exp).toBeDefined();
        });

        test('should reject expired JWT token', () => {
            const payload = {
                sub: 'user-123',
                email: 'user@test.com',
                role: 'agent',
            };

            const expiredToken = jwt.sign(payload, TEST_SECRET, { expiresIn: '-1s' });

            expect(() => {
                tokenUtils.verifyAccessToken(expiredToken);
            }).toThrow();
        });

        test('should reject invalid JWT signature', () => {
            const payload = {
                sub: 'user-123',
                email: 'user@test.com',
                role: 'agent',
            };

            const tokenWithWrongSecret = jwt.sign(payload, 'wrong-secret', { expiresIn: '15m' });

            expect(() => {
                tokenUtils.verifyAccessToken(tokenWithWrongSecret);
            }).toThrow();
        });

        test('should reject malformed JWT token', () => {
            const malformedToken = 'this.is.not.a.valid.jwt';

            expect(() => {
                tokenUtils.verifyAccessToken(malformedToken);
            }).toThrow();
        });
    });

    describe('Token Generation', () => {
        test('should generate valid token pair', () => {
            const user = {
                id: 'user-123',
                email: 'user@test.com',
                role: 'agent',
            };

            const tokens = tokenUtils.generateTokenPair(user);

            expect(tokens).toBeDefined();
            expect(tokens.accessToken).toBeDefined();
            expect(tokens.refreshToken).toBeDefined();
            expect(typeof tokens.accessToken).toBe('string');
            expect(typeof tokens.refreshToken).toBe('string');
        });

        test('should generate access token with correct payload', () => {
            const user = {
                id: 'user-123',
                email: 'user@test.com',
                role: 'agent',
            };

            const accessToken = tokenUtils.generateAccessToken(user);
            const decoded = jwt.decode(accessToken);

            expect(decoded.sub).toBe('user-123');
            expect(decoded.email).toBe('user@test.com');
            expect(decoded.role).toBe('agent');
        });
    });
});
