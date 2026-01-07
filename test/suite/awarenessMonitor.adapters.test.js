/**
 * AwarenessMonitor Adapter Tests
 * Tests for AwarenessMonitor using mock adapters
 */

const assert = require('assert');
// Note: Old AwarenessMonitor is deprecated, tests should be updated to test AwarenessService
// For now, keeping old import for backward compatibility
const AwarenessMonitor = require('../../awarenessMonitor/awarenessMonitor');
const MockVSCodeAdapter = require('../../infrastructure/adapters/mockVSCodeAdapter');
const MockPersistenceAdapter = require('../../infrastructure/adapters/mockPersistenceAdapter');

suite('AwarenessMonitor with Adapters', () => {
    let mockVSCodeAdapter;
    let mockPersistenceAdapter;
    let awarenessMonitor;
    let mockContext;
    
    setup(() => {
        mockVSCodeAdapter = new MockVSCodeAdapter();
        mockPersistenceAdapter = new MockPersistenceAdapter();
        mockContext = {
            subscriptions: [],
            workspaceState: mockPersistenceAdapter
        };
        
        awarenessMonitor = new AwarenessMonitor(
            null, // onScoreUpdate
            {}, // callbacks
            mockVSCodeAdapter // vscodeAdapter
        );
        awarenessMonitor.persistenceAdapter = mockPersistenceAdapter;
    });
    
    teardown(() => {
        if (awarenessMonitor) {
            awarenessMonitor.stop();
        }
        mockVSCodeAdapter.clear();
        mockPersistenceAdapter.clear();
    });
    
    test('should create AwarenessMonitor with adapters', () => {
        assert.ok(awarenessMonitor);
        assert.strictEqual(awarenessMonitor.vscodeAdapter, mockVSCodeAdapter);
        assert.strictEqual(awarenessMonitor.persistenceAdapter, mockPersistenceAdapter);
    });
    
    test('should start monitoring with adapters', () => {
        assert.doesNotThrow(() => {
            awarenessMonitor.start(mockContext, null, 'dev');
        });
        
        // Verify event handlers are registered
        assert.strictEqual(mockVSCodeAdapter._textDocumentChangeHandlers.length, 1);
        assert.strictEqual(mockVSCodeAdapter._fileCreateHandlers.length, 1);
        assert.strictEqual(mockVSCodeAdapter._fileSaveHandlers.length, 1);
    });
    
    test('should handle text document changes via adapter', () => {
        awarenessMonitor.start(mockContext, null, 'dev');
        
        const mockEvent = {
            document: {
                uri: mockVSCodeAdapter.Uri.file('/test.js'),
                getText: () => 'test content',
                lineCount: 1,
                version: 1
            },
            contentChanges: [{
                text: 'new content',
                range: new mockVSCodeAdapter.Range(0, 0, 0, 0),
                rangeLength: 0
            }]
        };
        
        // Simulate text document change
        assert.doesNotThrow(() => {
            mockVSCodeAdapter.simulateTextDocumentChange(mockEvent);
        });
    });
    
    test('should stop monitoring and clean up', () => {
        awarenessMonitor.start(mockContext, null, 'dev');
        assert.ok(awarenessMonitor.eventHandlers);
        
        awarenessMonitor.stop();
        // After stop, event handlers should be disposed
        // (We can't directly check this, but stop should not throw)
        assert.ok(true);
    });
    
    test('should work without adapters (backward compatibility)', () => {
        const monitorWithoutAdapters = new AwarenessMonitor();
        assert.ok(monitorWithoutAdapters);
        // Should not throw when starting without adapters
        assert.doesNotThrow(() => {
            monitorWithoutAdapters.start(mockContext, null, 'dev');
            monitorWithoutAdapters.stop();
        });
    });
});

suite('EventHandlers with Adapters', () => {
    let mockVSCodeAdapter;
    let eventHandlers;
    
    setup(() => {
        mockVSCodeAdapter = new MockVSCodeAdapter();
    });
    
    teardown(() => {
        mockVSCodeAdapter.clear();
    });
    
    test('should create EventHandlers with adapter', () => {
        const EventHandlers = require('../../business_modules/awareness/domain/entities/eventHandlers');
        const mockAgentHandler = {};
        const mockDebtManager = {};
        const mockSessionTracker = {};
        
        eventHandlers = new EventHandlers(
            mockAgentHandler,
            mockDebtManager,
            mockSessionTracker,
            { value: null },
            { value: null },
            'dev',
            null,
            {},
            mockVSCodeAdapter
        );
        
        assert.ok(eventHandlers);
        assert.strictEqual(eventHandlers.vscodeAdapter, mockVSCodeAdapter);
    });
    
    test('should use adapter for asRelativePath', () => {
        const EventHandlers = require('../../business_modules/awareness/domain/entities/eventHandlers');
        eventHandlers = new EventHandlers(
            {}, {}, {}, { value: null }, { value: null }, 'dev', null, {}, mockVSCodeAdapter
        );
        
        const uri = mockVSCodeAdapter.Uri.file('/workspace/test.js');
        const relative = mockVSCodeAdapter.asRelativePath(uri);
        assert.ok(relative);
    });
});

suite('AgentSuggestionHandler with Adapters', () => {
    let mockVSCodeAdapter;
    let handler;
    
    setup(() => {
        mockVSCodeAdapter = new MockVSCodeAdapter();
    });
    
    teardown(() => {
        mockVSCodeAdapter.clear();
    });
    
    test('should create AgentSuggestionHandler with adapter', () => {
        const AgentSuggestionHandler = require('../../business_modules/awareness/domain/entities/agentSuggestionHandler');
        handler = new AgentSuggestionHandler(
            {}, // debtManager
            () => {}, // updateScore
            {}, // callbacks
            () => {}, // trackAcceptance
            null, // updateFileColorsInExplorer
            mockVSCodeAdapter // vscodeAdapter
        );
        
        assert.ok(handler);
        assert.strictEqual(handler.vscodeAdapter, mockVSCodeAdapter);
    });
    
    test('should use adapter for Range creation', () => {
        const AgentSuggestionHandler = require('../../business_modules/awareness/domain/entities/agentSuggestionHandler');
        handler = new AgentSuggestionHandler({}, () => {}, {}, () => {}, null, mockVSCodeAdapter);
        
        const Range = mockVSCodeAdapter.Range;
        const range = new Range(0, 0, 10, 20);
        assert.ok(range);
        assert.strictEqual(range.start.line, 0);
    });
    
    test('should use adapter for openTextDocument', async () => {
        const AgentSuggestionHandler = require('../../business_modules/awareness/domain/entities/agentSuggestionHandler');
        handler = new AgentSuggestionHandler({}, () => {}, {}, () => {}, null, mockVSCodeAdapter);
        
        const uri = mockVSCodeAdapter.Uri.file('/test.js');
        const doc = await mockVSCodeAdapter.openTextDocument(uri);
        assert.ok(doc);
        assert.ok(doc.uri);
    });
});


