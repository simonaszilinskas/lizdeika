module.exports = {
  "testEnvironment": "jsdom",
  "setupFilesAfterEnv": [
    "<rootDir>/test-config/jest.setup.js"
  ],
  "testMatch": [
    "<rootDir>/tests/unit/**/*.test.js",
    "<rootDir>/tests/integration/**/*.test.js"
  ],
  "collectCoverageFrom": [
    "custom-widget/js/**/*.js",
    "!custom-widget/js/modules/errorHandler.js",
    "!custom-widget/js/modules/errorMonitoring.js",
    "!custom-widget/js/modules/notificationSystem.js"
  ],
  "coverageDirectory": "coverage",
  "coverageReporters": [
    "text",
    "html",
    "lcov"
  ],
  "moduleNameMapping": {
    "^@/(.*)$": "<rootDir>/custom-widget/js/$1"
  },
  "globals": {
    "window": true,
    "document": true,
    "navigator": true,
    "localStorage": true,
    "sessionStorage": true
  }
};