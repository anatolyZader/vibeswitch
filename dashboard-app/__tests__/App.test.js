/**
 * Unit tests for App: default payload, sections present.
 */
const React = require('react');
const ReactTestRenderer = require('react-test-renderer');
const App = require('../src/App').default;

describe('App', () => {
    test('renders without crashing with no vscode', () => {
        const tree = ReactTestRenderer.create(React.createElement(App, { vscode: null }));
        expect(tree.toJSON()).toBeDefined();
    });

    test('renders header with title and mode', () => {
        const tree = ReactTestRenderer.create(React.createElement(App, { vscode: null }));
        const json = tree.toJSON();
        const str = JSON.stringify(json);
        expect(str).toContain('VibeSwitch Dashboard');
        expect(str).toContain('Meters');
        expect(str).toContain('Output');
        expect(str).toContain('Chat');
    });

    test('renders Files section with unopened and unreviewed heading', () => {
        const tree = ReactTestRenderer.create(React.createElement(App, { vscode: null }));
        const json = tree.toJSON();
        const str = JSON.stringify(json);
        expect(str).toContain('dashboard-files');
        expect(str).toContain('Unopened files');
        expect(str).toContain('unreviewed changes');
    });

    test('merge of init/update payload does not crash', () => {
        const postMessage = jest.fn();
        const tree = ReactTestRenderer.create(React.createElement(App, { vscode: { postMessage } }));
        expect(tree.toJSON()).toBeDefined();
        const event = { data: { type: 'update', payload: { currentMode: 'prod', scoreData: { total: 50, components: {} } } } };
        if (typeof window !== 'undefined' && typeof MessageEvent !== 'undefined') {
            window.dispatchEvent(new MessageEvent('message', event));
        }
        expect(tree.toJSON()).toBeDefined();
    });
});
