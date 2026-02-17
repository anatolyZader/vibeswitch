/**
 * Unit tests for ProjectProcessSection: three deviation gauges from projectProgressMeasures.
 */
const React = require('react');
const ReactTestRenderer = require('react-test-renderer');
const ProjectProcessSection = require('../src/ProjectProcessSection').default;

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

describe('ProjectProcessSection', () => {
    test('renders without crashing with empty payload', () => {
        const tree = ReactTestRenderer.create(React.createElement(ProjectProcessSection, { payload: {} }));
        expect(tree.toJSON()).toBeDefined();
    });

    test('renders three gauge cells', () => {
        const tree = ReactTestRenderer.create(React.createElement(ProjectProcessSection, { payload: {} }));
        const json = tree.toJSON();
        expect(json.type).toBe('div');
        expect(json.props.className).toBe('project-process-section');
        const gauges = json.children && json.children[0];
        expect(gauges && gauges.type).toBe('div');
        expect(gauges && gauges.props.className).toBe('gauges');
        expect(gauges && gauges.children).toHaveLength(3);
    });

    test('renders Plan, Schedule, Acceptance tests labels', () => {
        const tree = ReactTestRenderer.create(React.createElement(ProjectProcessSection, { payload: {} }));
        const json = tree.toJSON();
        const labels = findNodes(json, n => n.type === 'div' && n.props && n.props.className === 'gauge-label');
        expect(labels.length).toBe(3);
        const text = labels.map(n => (n.children && n.children[0]) || '').join(' ');
        expect(text).toContain('Plan');
        expect(text).toContain('Schedule');
        expect(text).toContain('Acceptance');
    });

    test('shows N/A for null deviation values', () => {
        const payload = { projectProgressMeasures: { planDeviation: null, scheduleDeviation: null, acceptanceTestsDeviation: null } };
        const tree = ReactTestRenderer.create(React.createElement(ProjectProcessSection, { payload }));
        const json = tree.toJSON();
        const pctNodes = findNodes(json, n => n.type === 'div' && n.props && n.props.className === 'gauge-pct');
        expect(pctNodes.length).toBe(3);
        pctNodes.forEach(n => expect((n.children && n.children[0]) || '').toBe('N/A'));
    });

    test('shows numeric percentage when deviation provided', () => {
        const payload = { projectProgressMeasures: { planDeviation: 25, scheduleDeviation: 0, acceptanceTestsDeviation: 100 } };
        const tree = ReactTestRenderer.create(React.createElement(ProjectProcessSection, { payload }));
        const json = tree.toJSON();
        const pctNodes = findNodes(json, n => n.type === 'div' && n.props && n.props.className === 'gauge-pct');
        expect(pctNodes.length).toBe(3);
        const values = pctNodes.map(n => (n.children && n.children[0]) || '');
        expect(values).toContain('25%');
        expect(values).toContain('0%');
        expect(values).toContain('100%');
    });

    test('handles missing projectProgressMeasures gracefully', () => {
        const tree = ReactTestRenderer.create(React.createElement(ProjectProcessSection, { payload: { scoreData: {} } }));
        expect(tree.toJSON()).toBeDefined();
    });
});
