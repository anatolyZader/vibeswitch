/**
 * Unit tests for MetersSection: gauges from payload, risk computation.
 */
const React = require('react');
const ReactTestRenderer = require('react-test-renderer');
const MetersSection = require('../src/MetersSection').default;

function findNodes(root, predicate) {
    const out = [];
    function walk(node) {
        if (!node) return;
        if (predicate(node)) out.push(node);
        if (node.children) node.children.forEach(walk);
        if (node.props && node.props.children) {
            const c = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
            c.forEach(ch => ch && typeof ch === 'object' && walk(ch));
        }
    }
    walk(root);
    return out;
}

describe('MetersSection', () => {
    test('renders without crashing with empty payload', () => {
        const tree = ReactTestRenderer.create(React.createElement(MetersSection, { payload: {} }));
        expect(tree.toJSON()).toBeDefined();
    });

    test('renders four gauge cells', () => {
        const tree = ReactTestRenderer.create(React.createElement(MetersSection, { payload: {} }));
        const json = tree.toJSON();
        expect(json.type).toBe('div');
        expect(json.props.className).toBe('gauges');
        expect(json.children).toHaveLength(4);
    });

    test('renders gauge labels from payload', () => {
        const payload = {
            scoreData: { components: { blindAcceptance: 10, review: 20, adaptation: 15, debt: 5 } },
            antipatternBreakdown: {}
        };
        const tree = ReactTestRenderer.create(React.createElement(MetersSection, { payload }));
        const json = tree.toJSON();
        const labels = findNodes(json, n => n.type === 'div' && n.props && n.props.className === 'gauge-label');
        expect(labels.length).toBe(4);
        expect(labels.map(n => (n.children && n.children[0]) || '').join(' ')).toContain('Ownership');
    });

    test('handles null payload gracefully', () => {
        const tree = ReactTestRenderer.create(React.createElement(MetersSection, { payload: null }));
        expect(tree.toJSON()).toBeDefined();
    });
});
