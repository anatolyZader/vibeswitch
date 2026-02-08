/**
 * Unit tests for ChatSection: send flow, reply handling, placeholder.
 */
const React = require('react');
const ReactTestRenderer = require('react-test-renderer');
const { act } = require('react-test-renderer');
const ChatSection = require('../src/ChatSection').default;

describe('ChatSection', () => {
    test('renders without crashing with mock sendChat and no vscode', () => {
        const sendChat = () => {};
        const tree = ReactTestRenderer.create(
            React.createElement(ChatSection, { payload: {}, sendChat, vscode: null })
        );
        expect(tree.toJSON()).toBeDefined();
    });

    test('shows placeholder when no messages', () => {
        const sendChat = () => {};
        const tree = ReactTestRenderer.create(
            React.createElement(ChatSection, { payload: {}, sendChat, vscode: {} })
        );
        const json = tree.toJSON();
        const str = JSON.stringify(json);
        expect(str).toContain('No messages');
    });

    test('has input and Send button', () => {
        const sendChat = () => {};
        const tree = ReactTestRenderer.create(
            React.createElement(ChatSection, { payload: {}, sendChat, vscode: {} })
        );
        const json = tree.toJSON();
        const str = JSON.stringify(json);
        expect(str).toContain('placeholder');
        expect(str).toContain('Send');
    });

    test('sendChat called with id and text when onSend is triggered', () => {
        const sendChat = jest.fn();
        const tree = ReactTestRenderer.create(
            React.createElement(ChatSection, { payload: {}, sendChat, vscode: { postMessage: () => {} } })
        );
        const root = tree.root;
        act(() => {
            const input = root.findByProps({ className: 'chat-input' });
            input.props.onChange({ target: { value: 'hello' } });
        });
        act(() => {
            const sendBtn = root.findByProps({ className: 'chat-send' });
            sendBtn.props.onClick();
        });
        expect(sendChat).toHaveBeenCalled();
        const [id, text] = sendChat.mock.calls[0];
        expect(typeof id).toBe('string');
        expect(text).toBe('hello');
    });
});
