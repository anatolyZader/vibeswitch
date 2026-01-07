/**
 * Adapter Tests
 * Tests for Ports and Adapters implementation
 */

const assert = require('assert');
const MockVSCodeAdapter = require('../../infrastructure/adapters/mockVSCodeAdapter');
const MockPersistenceAdapter = require('../../infrastructure/adapters/mockPersistenceAdapter');

suite('Adapter Tests', () => {
    
    suite('MockVSCodeAdapter', () => {
        let adapter;
        
        setup(() => {
            adapter = new MockVSCodeAdapter();
        });
        
        teardown(() => {
            adapter.clear();
        });
        
        test('should create adapter instance', () => {
            assert.ok(adapter);
        });
        
        test('should register text document change handler', () => {
            let called = false;
            const handler = () => { called = true; };
            const disposable = adapter.onDidChangeTextDocument(handler);
            assert.ok(disposable);
            assert.ok(disposable.dispose);
            
            adapter.simulateTextDocumentChange({ document: { uri: { toString: () => 'file:///test.js' } } });
            assert.strictEqual(called, true);
        });
        
        test('should unregister handler on dispose', () => {
            let callCount = 0;
            const handler = () => { callCount++; };
            const disposable = adapter.onDidChangeTextDocument(handler);
            
            adapter.simulateTextDocumentChange({});
            assert.strictEqual(callCount, 1);
            
            disposable.dispose();
            adapter.simulateTextDocumentChange({});
            assert.strictEqual(callCount, 1); // Should not increment
        });
        
        test('should expose Range type', () => {
            const Range = adapter.Range;
            const range = new Range(0, 0, 10, 20);
            assert.strictEqual(range.start.line, 0);
            assert.strictEqual(range.start.character, 0);
            assert.strictEqual(range.end.line, 10);
            assert.strictEqual(range.end.character, 20);
        });
        
        test('should expose Position type', () => {
            const Position = adapter.Position;
            const pos = new Position(5, 10);
            assert.strictEqual(pos.line, 5);
            assert.strictEqual(pos.character, 10);
        });
        
        test('should expose Uri type', () => {
            const Uri = adapter.Uri;
            const uri = Uri.file('/test/path.js');
            assert.strictEqual(uri.scheme, 'file');
            assert.strictEqual(uri.path, '/test/path.js');
            
            const parsed = Uri.parse('file:///test.js');
            assert.strictEqual(parsed.scheme, 'file');
        });
        
        test('should manage workspace folders', () => {
            adapter.setWorkspaceFolders([
                { uri: { fsPath: '/workspace' }, name: 'workspace' }
            ]);
            assert.strictEqual(adapter.workspaceFolders.length, 1);
        });
        
        test('should manage text documents', () => {
            const doc = { uri: { toString: () => 'file:///test.js' }, getText: () => 'test' };
            adapter.addTextDocument(doc);
            assert.strictEqual(adapter.textDocuments.length, 1);
            assert.strictEqual(adapter.textDocuments[0], doc);
        });
        
        test('should create output channel', () => {
            const channel = adapter.createOutputChannel('test');
            assert.ok(channel);
            channel.appendLine('test message');
            assert.ok(channel._lines.length > 0);
        });
        
        test('should create status bar item', () => {
            const item = adapter.createStatusBarItem(1, 100);
            assert.ok(item);
            assert.strictEqual(item.alignment, 1);
            assert.strictEqual(item.priority, 100);
        });
        
        test('should open text document', async () => {
            const doc = await adapter.openTextDocument('file:///test.js');
            assert.ok(doc);
            assert.ok(doc.uri);
            assert.ok(typeof doc.getText === 'function');
        });
        
        test('should convert URI to relative path', () => {
            const uri = adapter.Uri.file('/workspace/test.js');
            const relative = adapter.asRelativePath(uri);
            assert.ok(relative);
        });
    });
    
    suite('MockPersistenceAdapter', () => {
        let adapter;
        
        setup(() => {
            adapter = new MockPersistenceAdapter();
        });
        
        teardown(() => {
            adapter.clear();
        });
        
        test('should create adapter instance', () => {
            assert.ok(adapter);
        });
        
        test('should save and load synchronously', () => {
            adapter.saveSync('test-key', { value: 'test-data' });
            const loaded = adapter.loadSync('test-key');
            assert.deepStrictEqual(loaded, { value: 'test-data' });
        });
        
        test('should save and load asynchronously', async () => {
            await adapter.save('async-key', { value: 'async-data' });
            const loaded = await adapter.load('async-key');
            assert.deepStrictEqual(loaded, { value: 'async-data' });
        });
        
        test('should delete keys', async () => {
            adapter.saveSync('delete-key', 'data');
            assert.ok(adapter.has('delete-key'));
            
            await adapter.delete('delete-key');
            assert.strictEqual(adapter.has('delete-key'), false);
        });
        
        test('should return undefined for non-existent keys', () => {
            assert.strictEqual(adapter.loadSync('non-existent'), undefined);
        });
        
        test('should clear all storage', () => {
            adapter.saveSync('key1', 'value1');
            adapter.saveSync('key2', 'value2');
            assert.strictEqual(adapter._storage.size, 2);
            
            adapter.clear();
            assert.strictEqual(adapter._storage.size, 0);
        });
    });
});


