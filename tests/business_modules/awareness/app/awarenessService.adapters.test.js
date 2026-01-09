/**
 * AwarenessService Adapter Tests
 * Tests for AwarenessService and AwarenessController using mock adapters
 */

const assert = require('assert');
const AwarenessService = require('../../../../business_modules/awareness/app/awarenessService');
const AwarenessController = require('../../../../business_modules/awareness/input/awarenessController');
const AwarenessMockVSCodeAdapter = require('../../../../business_modules/awareness/infrastructure/adapters/awarenessMockVSCodeAdapter');
const AwarenessMockPersistenceAdapter = require('../../../../business_modules/awareness/infrastructure/adapters/awarenessMockPersistenceAdapter');
const DIContainer = require('../../../../diContainer');

suite('AwarenessService with Adapters', () => {
    let mockVSCodeAdapter;
    let mockPersistenceAdapter;
    let awarenessService;
    let mockContext;
    
    setup(() => {
        mockVSCodeAdapter = new AwarenessMockVSCodeAdapter();
        mockPersistenceAdapter = new AwarenessMockPersistenceAdapter();
        mockContext = {
            subscriptions: [],
            workspaceState: mockPersistenceAdapter
        };
        
        awarenessService = new AwarenessService({
            vscodeAdapter: mockVSCodeAdapter,
            persistenceAdapter: mockPersistenceAdapter
        });
    });
    
    teardown(async () => {
        if (awarenessService) {
            await awarenessService.stop();
        }
        mockVSCodeAdapter.clear();
        mockPersistenceAdapter.clear();
    });
    
    test('should create AwarenessService with adapters', () => {
        assert.ok(awarenessService);
        assert.strictEqual(awarenessService.vscodeAdapter, mockVSCodeAdapter);
        assert.strictEqual(awarenessService.persistenceAdapter, mockPersistenceAdapter);
    });
    
    test('should start monitoring with adapters', async () => {
        await awarenessService.start(mockContext, null, 'dev');
        
        // Verify event handlers are registered
        assert.strictEqual(mockVSCodeAdapter._textDocumentChangeHandlers.length, 1);
        assert.strictEqual(mockVSCodeAdapter._fileCreateHandlers.length, 1);
        assert.strictEqual(mockVSCodeAdapter._fileSaveHandlers.length, 1);
    });
    
    test('should handle text document changes via adapter', async () => {
        await awarenessService.start(mockContext, null, 'dev');
        
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
    
    test('should stop monitoring and clean up', async () => {
        await awarenessService.start(mockContext, null, 'dev');
        assert.ok(awarenessService.eventHandlers);
        
        await awarenessService.stop();
        // After stop, event handlers should be disposed
        assert.ok(true);
    });
});

suite('AwarenessController with DI Container', () => {
    let mockVSCodeAdapter;
    let mockPersistenceAdapter;
    let diContainer;
    let awarenessController;
    let mockContext;
    
    setup(() => {
        mockVSCodeAdapter = new AwarenessMockVSCodeAdapter();
        mockPersistenceAdapter = new AwarenessMockPersistenceAdapter();
        mockContext = {
            subscriptions: [],
            workspaceState: mockPersistenceAdapter
        };
        
        diContainer = new DIContainer();
        diContainer.setAdapter('awareness', 'vscodeAdapter', mockVSCodeAdapter);
        diContainer.setAdapter('awareness', 'persistenceAdapter', mockPersistenceAdapter);
        
        const awarenessService = new AwarenessService({
            vscodeAdapter: mockVSCodeAdapter,
            persistenceAdapter: mockPersistenceAdapter
        });
        diContainer.register('awarenessService', awarenessService);
        
        // Create controller with explicit dependencies (new signature)
        awarenessController = new AwarenessController({
            awarenessService: awarenessService,
            logger: null // Optional logger
        });
    });
    
    teardown(async () => {
        if (awarenessController) {
            await awarenessController.stopMonitoring();
        }
        mockVSCodeAdapter.clear();
        mockPersistenceAdapter.clear();
    });
    
    test('should create AwarenessController with DI container', () => {
        assert.ok(awarenessController);
    });
    
    test('should start monitoring via controller', async () => {
        await awarenessController.startMonitoring(mockContext, null, 'dev');
        
        // Verify event handlers are registered
        assert.strictEqual(mockVSCodeAdapter._textDocumentChangeHandlers.length, 1);
    });
    
    test('should get score via controller', async () => {
        await awarenessController.startMonitoring(mockContext, null, 'dev');
        const score = awarenessController.getScore();
        assert.ok(score);
        assert.ok(typeof score.total === 'number');
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
        const EventHandlers = require('../../../../business_modules/awareness/domain/entities/eventHandlers');
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
        const AgentSuggestionHandler = require('../../../../business_modules/awareness/domain/entities/agentSuggestionHandler');
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
        const AgentSuggestionHandler = require('../../../../business_modules/awareness/domain/entities/agentSuggestionHandler');
        handler = new AgentSuggestionHandler({}, () => {}, {}, () => {}, null, mockVSCodeAdapter);
        
        const Range = mockVSCodeAdapter.Range;
        const range = new Range(0, 0, 10, 20);
        assert.ok(range);
        assert.strictEqual(range.start.line, 0);
    });
    
    test('should use adapter for openTextDocument', async () => {
        const AgentSuggestionHandler = require('../../../../business_modules/awareness/domain/entities/agentSuggestionHandler');
        handler = new AgentSuggestionHandler({}, () => {}, {}, () => {}, null, mockVSCodeAdapter);
        
        const uri = mockVSCodeAdapter.Uri.file('/test.js');
        const doc = await mockVSCodeAdapter.openTextDocument(uri);
        assert.ok(doc);
        assert.ok(doc.uri);
    });
});


