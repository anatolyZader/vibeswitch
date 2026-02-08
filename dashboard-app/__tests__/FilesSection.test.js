/**
 * Unit tests for FilesSection: unopened files and unreviewed suggestions lists.
 */
const React = require('react');
const ReactTestRenderer = require('react-test-renderer');
const FilesSection = require('../src/FilesSection').default;

describe('FilesSection', () => {
    test('renders without crashing with empty payload', () => {
        const tree = ReactTestRenderer.create(React.createElement(FilesSection, { payload: {} }));
        expect(tree.toJSON()).toBeDefined();
    });

    test('shows empty states when no files', () => {
        const payload = { scoreData: { unopenedFiles: { count: 0, files: [] }, unreviewedSuggestions: { count: 0, files: [] } } };
        const tree = ReactTestRenderer.create(React.createElement(FilesSection, { payload }));
        const json = tree.toJSON();
        const str = JSON.stringify(json);
        expect(str).toContain('No unopened files');
        expect(str).toContain('No unreviewed suggestions');
    });

    test('renders unopened files list with path and age', () => {
        const payload = {
            scoreData: {
                unopenedFiles: { count: 2, files: [{ path: 'src/foo.js', fullPath: '/proj/src/foo.js', ageMinutes: 5 }, { path: 'lib/bar.js', ageMinutes: 90 }] },
                unreviewedSuggestions: { count: 0, files: [] }
            }
        };
        const tree = ReactTestRenderer.create(React.createElement(FilesSection, { payload }));
        const json = tree.toJSON();
        const str = JSON.stringify(json);
        expect(str).toContain('src/foo.js');
        expect(str).toContain('lib/bar.js');
        expect(str).toContain('5m ago');
        expect(str).toContain('h ago');
    });

    test('renders unreviewed suggestions list', () => {
        const payload = {
            scoreData: {
                unopenedFiles: { count: 0, files: [] },
                unreviewedSuggestions: { count: 1, files: [{ path: 'test/baz.js', fullPath: '/proj/test/baz.js' }] }
            }
        };
        const tree = ReactTestRenderer.create(React.createElement(FilesSection, { payload }));
        const json = tree.toJSON();
        const str = JSON.stringify(json);
        expect(str).toContain('test/baz.js');
        expect(str).toContain('Unreviewed suggestions:');
    });
});
