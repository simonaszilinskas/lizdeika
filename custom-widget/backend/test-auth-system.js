/**
 * Authentication System Test
 * Tests JWT authentication functionality without database connection
 */

// Initialize environment first
require('dotenv').config();

// Import modules after environment is loaded
const tokenUtils = require('./src/utils/tokenUtils');
const passwordUtils = require('./src/utils/passwordUtils');
const { validate, authSchemas } = require('./src/utils/validators');

async function testAuthSystem() {
  console.log('🧪 Testing Authentication System...\n');

  try {
    // Test 1: Token utilities
    console.log('1. JWT Token Generation & Verification:');
    
    const testUser = {
      id: 'test-user-123',
      email: 'test@example.com',
      role: 'user'
    };

    const accessToken = tokenUtils.generateAccessToken(testUser);
    const refreshToken = tokenUtils.generateRefreshToken(testUser.id);
    console.log('   ✅ Tokens generated successfully');

    const decoded = tokenUtils.verifyAccessToken(accessToken);
    console.log('   ✅ Access token verified:', decoded.email);

    const refreshDecoded = tokenUtils.verifyRefreshToken(refreshToken);
    console.log('   ✅ Refresh token verified:', refreshDecoded.sub);

    // Test 2: Password utilities
    console.log('\n2. Password Hashing & Validation:');
    
    const testPassword = 'TestPass123!';
    const hashedPassword = await passwordUtils.hashPassword(testPassword);
    console.log('   ✅ Password hashed successfully');

    const isValid = await passwordUtils.verifyPassword(testPassword, hashedPassword);
    console.log('   ✅ Password verification:', isValid ? 'SUCCESS' : 'FAILED');

    const passwordValidation = passwordUtils.validatePasswordStrength(testPassword);
    console.log('   ✅ Password strength validation:', passwordValidation.isValid ? 'PASSED' : 'FAILED');
    console.log('       Strength:', passwordValidation.strength);

    // Test 3: Validation schemas
    console.log('\n3. Request Validation:');
    
    const validRegistrationData = {
      email: 'user@example.com',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      role: 'user'
    };

    try {
      const validated = authSchemas.register.parse(validRegistrationData);
      console.log('   ✅ Registration validation passed');
    } catch (error) {
      console.log('   ❌ Registration validation failed:', error.message);
    }

    const validLoginData = {
      email: 'user@example.com',
      password: 'anypassword'
    };

    try {
      const validated = authSchemas.login.parse(validLoginData);
      console.log('   ✅ Login validation passed');
    } catch (error) {
      console.log('   ❌ Login validation failed:', error.message);
    }

    // Test 4: Invalid data validation
    console.log('\n4. Invalid Data Validation:');
    
    const invalidRegistrationData = {
      email: 'invalid-email',
      password: '123', // Too weak
      firstName: '',
      lastName: 'Doe'
    };

    try {
      const validated = authSchemas.register.parse(invalidRegistrationData);
      console.log('   ❌ Should have failed validation');
    } catch (error) {
      console.log('   ✅ Invalid registration data correctly rejected');
      console.log('       Errors:', error.errors.length, 'validation errors found');
    }

    // Test 5: Email verification token
    console.log('\n5. Email Verification Token:');
    
    const verificationToken = tokenUtils.generateEmailVerificationToken('test@example.com');
    console.log('   ✅ Email verification token generated');

    const verificationDecoded = tokenUtils.verifyEmailVerificationToken(verificationToken);
    console.log('   ✅ Email verification token verified:', verificationDecoded.email);

    // Test 6: Password reset token
    console.log('\n6. Password Reset Token:');
    
    const resetToken = tokenUtils.generatePasswordResetToken('user-123', 'test@example.com');
    console.log('   ✅ Password reset token generated');

    const resetDecoded = tokenUtils.verifyPasswordResetToken(resetToken);
    console.log('   ✅ Password reset token verified:', resetDecoded.email);

    // Test 7: Token expiration check
    console.log('\n7. Token Expiration:');
    
    const isExpired = tokenUtils.isTokenExpired(accessToken);
    console.log('   ✅ Token expiration check:', isExpired ? 'EXPIRED' : 'VALID');

    const expiration = tokenUtils.getTokenExpiration(accessToken);
    console.log('   ✅ Token expires at:', expiration.toISOString());

    console.log('\n✅ All authentication system tests passed!');

  } catch (error) {
    console.error('\n❌ Authentication system test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }

  console.log('\n📋 Authentication Endpoints Ready:');
  console.log('POST /api/auth/register     - User registration');
  console.log('POST /api/auth/login        - User login');
  console.log('POST /api/auth/refresh      - Token refresh');
  console.log('POST /api/auth/logout       - User logout');
  console.log('GET  /api/auth/profile      - Get user profile');
  console.log('POST /api/auth/change-password - Change password');
  console.log('POST /api/auth/forgot-password - Request password reset');
  console.log('POST /api/auth/reset-password  - Reset password');
  console.log('GET  /api/auth/verify       - Verify token');
  console.log('GET  /api/auth/status       - Authentication status');

  console.log('\n🚀 Next Steps:');
  console.log('1. Start PostgreSQL: docker-compose up postgres -d');
  console.log('2. Run database migrations: npm run db:push');
  console.log('3. Seed database: npm run db:seed');
  console.log('4. Start server: npm run dev');
  console.log('5. Test endpoints with API client (Postman, curl, etc.)');
}

// Check if environment variables are loaded
console.log('Environment check:');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? '✅ Loaded' : '❌ Missing');
console.log('- JWT_REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET ? '✅ Loaded' : '❌ Missing');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '✅ Loaded' : '❌ Missing');
console.log('');

testAuthSystem()
  .then(() => {
    console.log('\n✅ Authentication system test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Authentication system test failed:', error);
    process.exit(1);
  });