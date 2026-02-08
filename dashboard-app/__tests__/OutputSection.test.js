/**
 * Unit tests for OutputSection: antipattern messages, capabilities.
 */
const React = require('react');
const ReactTestRenderer = require('react-test-renderer');
const OutputSection = require('../src/OutputSection').default;

describe('OutputSection', () => {
    test('renders without crashing with empty payload', () => {
        const tree = ReactTestRenderer.create(React.createElement(OutputSection, { payload: {} }));
        expect(tree.toJSON()).toBeDefined();
    });

    test('renders short antipattern messages with severity class', () => {
        const payload = {
            events: [
                { label: 'Boundary violation', detail: 'src/foo.js', severity: 'high' },
                { type: 'other', detail: 'detail' }
            ],
            capabilities: {}
        };
        const tree = ReactTestRenderer.create(React.createElement(OutputSection, { payload }));
        const json = tree.toJSON();
        const str = JSON.stringify(json);
        expect(str).toContain('Boundary violation');
        expect(str).toContain('event-sev-high');
    });

    test('shows empty state when no messages', () => {
        const payload = { events: [], capabilities: {} };
        const tree = ReactTestRenderer.create(React.createElement(OutputSection, { payload }));
        const json = tree.toJSON();
        const str = JSON.stringify(json);
        expect(str).toContain('No antipattern messages');
    });

    test('capabilities note shows git/ast/usageApi state', () => {
        const payload = {
            tokenUsage: {},
            events: [],
            capabilities: { git: true, ast: false, usageApiAvailable: true }
        };
        const tree = ReactTestRenderer.create(React.createElement(OutputSection, { payload }));
        const json = tree.toJSON();
        const str = JSON.stringify(json);
        expect(str).toContain('git');
        expect(str).toContain('ast');
    });
});
