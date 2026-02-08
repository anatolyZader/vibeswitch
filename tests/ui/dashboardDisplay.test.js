/**
 * Tests for dashboard display: React HTML builder and payload delivery.
 */

const vscode = require('vscode');
const {
    buildReactDashboardHtml,
    sendPayloadToWebview,
    getDashboardUri,
    DashboardContentProvider
} = require('../../ui/dashboardDisplay');

describe('dashboardDisplay', () => {
    describe('getDashboardUri', () => {
        test('returns vibeswitch-dashboard URI', () => {
            const uri = getDashboardUri();
            expect(uri).toBeDefined();
            expect(uri.scheme).toBe('http');
            expect(uri.toString()).toContain('vibeswitch-dashboard');
        });
    });

    describe('DashboardContentProvider', () => {
        test('provides initial loading content', () => {
            const p = new DashboardContentProvider();
            const content = p.provideTextDocumentContent({});
            expect(content).toContain('VibeSwitch Dashboard');
            expect(content).toContain('Loading');
        });
        test('updateContent updates provided content', () => {
            const p = new DashboardContentProvider();
            p.updateContent('# Updated');
            expect(p.provideTextDocumentContent({})).toContain('Updated');
        });
    });

    describe('buildReactDashboardHtml', () => {
        let joinPathOrig;
        beforeEach(() => {
            joinPathOrig = vscode.Uri.joinPath;
            vscode.Uri.joinPath = jest.fn((base, ...segments) => ({
                toString: () => 'vscode-resource:///out/dashboard-app.js'
            }));
        });
        afterEach(() => {
            vscode.Uri.joinPath = joinPathOrig;
        });

        test('returns HTML with DOCTYPE and root div', () => {
            const webview = { cspSource: 'https://vscode-cdn.net', asWebviewUri: jest.fn(uri => (uri && uri.toString ? uri.toString() : 'script.js')) };
            const extensionUri = {};
            const html = buildReactDashboardHtml(webview, extensionUri);
            expect(html).toMatch(/<!DOCTYPE html>/i);
            expect(html).toContain('<div id="root"></div>');
        });
        test('includes CSP with script-src and style-src', () => {
            const webview = { cspSource: 'https://vscode-cdn.net', asWebviewUri: jest.fn(uri => (uri && uri.toString ? uri.toString() : 'x')) };
            const extensionUri = {};
            const html = buildReactDashboardHtml(webview, extensionUri);
            expect(html).toContain('Content-Security-Policy');
            expect(html).toContain("script-src ");
            expect(html).toContain("style-src ");
        });
        test('includes script tag with asWebviewUri result', () => {
            const scriptUri = 'https://vscode-cdn.net/out/dashboard-app.js';
            const webview = { cspSource: 'x', asWebviewUri: jest.fn(() => scriptUri) };
            const extensionUri = {};
            const html = buildReactDashboardHtml(webview, extensionUri);
            expect(html).toContain(scriptUri);
            expect(html).toMatch(/<script src=/);
        });
    });

    describe('sendPayloadToWebview', () => {
        test('does nothing when panel is null', () => {
            expect(() => sendPayloadToWebview(null, {})).not.toThrow();
        });
        test('does nothing when panel has no webview', () => {
            expect(() => sendPayloadToWebview({}, { type: 'update' })).not.toThrow();
        });
        test('calls postMessage when panel has webview', () => {
            const postMessage = jest.fn();
            const panel = { webview: { postMessage } };
            sendPayloadToWebview(panel, { a: 1 });
            expect(postMessage).toHaveBeenCalledWith({ type: 'update', payload: { a: 1 } });
        });
    });
});
