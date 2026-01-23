/**
 * Jest configuration for VibeSwitch extension
 * 
 * Follows TDD rules: fast tests, no IO in domain tests, proper mocking
 */

module.exports = {
    testEnvironment: 'node',
    clearMocks: true,
    restoreMocks: true,
    testMatch: [
        '**/tests/**/*.test.js'
    ],
    collectCoverageFrom: [
        'business_modules/**/*.js',
        '!**/node_modules/**',
        '!**/tests/**',
        '!**/infrastructure/legacy/**'
    ],
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/tests/',
        '/infrastructure/legacy/'
    ],
    // Mock vscode module for tests
    moduleNameMapper: {
        '^vscode$': '<rootDir>/tests/__mocks__/vscode.js'
    },
    // Don't run tests that require VS Code API by default
    testPathIgnorePatterns: [
        '/node_modules/',
        '/tests/extension.test.js',
        '/tests/business_modules/awareness/app/awarenessService.adapters.test.js',
        '/tests/business_modules/awareness/domain/entities/agentSuggestionHandler.batch.test.js', // Module removed during refactoring
        '/tests/business_modules/awareness/domain/entities/sessionTracker.reviewSession.test.js' // Module removed during refactoring
    ],
    // Use fake timers per test, not globally
    fakeTimers: {
        enableGlobally: false
    }
};
