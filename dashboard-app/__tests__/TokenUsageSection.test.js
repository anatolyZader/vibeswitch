/**
 * Unit tests for TokenUsageSection.
 */
const React = require('react');
const ReactTestRenderer = require('react-test-renderer');
const TokenUsageSection = require('../src/TokenUsageSection').default;

describe('TokenUsageSection', () => {
    test('renders without crashing with empty payload', () => {
        const tree = ReactTestRenderer.create(React.createElement(TokenUsageSection, { payload: {} }));
        expect(tree.toJSON()).toBeDefined();
    });

    test('shows token unavailable when usageApiAvailable is false', () => {
        const payload = { tokenUsage: { usageApiAvailable: false } };
        const tree = ReactTestRenderer.create(React.createElement(TokenUsageSection, { payload }));
        const json = tree.toJSON();
        const str = JSON.stringify(json);
        expect(str).toContain('unavailable');
    });

    test('shows token counts when usageApiAvailable is true', () => {
        const payload = {
            tokenUsage: { usageApiAvailable: true, totalInput: 100, totalOutput: 50, totalTokens: 150 }
        };
        const tree = ReactTestRenderer.create(React.createElement(TokenUsageSection, { payload }));
        const json = tree.toJSON();
        const str = JSON.stringify(json);
        expect(str).toContain('100');
        expect(str).toContain('50');
        expect(str).toContain('150');
    });
});
