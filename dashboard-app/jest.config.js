module.exports = {
    testEnvironment: 'jsdom',
    testMatch: ['**/__tests__/**/*.test.js', '**/__tests__/**/*.test.jsx'],
    transform: { '\\.jsx?$': 'babel-jest' },
    moduleFileExtensions: ['js', 'jsx']
};
