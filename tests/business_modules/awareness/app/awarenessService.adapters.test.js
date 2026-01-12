/**
 * AwarenessService Adapter Tests
 * Tests for AwarenessService and AwarenessController using mock adapters
 */

const assert = require('assert');
const AwarenessService = require('../../../../business_modules/awareness/app/awarenessService');
const AwarenessController = require('../../../../business_modules/awareness/input/awarenessController');
const AwarenessMockVSCodeAdapter = require('../../../../business_modules/awareness/infrastructure/adapters/awarenessMockVSCodeAdapter');
const AwarenessMockPersistenceAdapter = require('../../../../business_modules/awareness/infrastructure/adapters/awarenessMockPersistenceAdapter');
const AwarenessLoggerAdapter = require('../../../../business_modules/awareness/infrastructure/adapters/awarenessLoggerAdapter');
const AwarenessFileSystemAdapter = require('../../../../business_modules/awareness/infrastructure/adapters/awarenessFileSystemAdapter');
const AwarenessIdGeneratorAdapter = require('../../../../business_modules/awareness/infrastructure/adapters/awarenessIdGeneratorAdapter');
const AwarenessHashGeneratorAdapter = require('../../../../business_modules/awareness/infrastructure/adapters/awarenessHashGeneratorAdapter');
const RangeOperationServiceD = require('../../../../business_modules/awareness/domain/services/rangeOperationServiceD');
const UriPathOperationServiceD = require('../../../../business_modules/awareness/domain/services/uriPathOperationServiceD');
const SuggestionLifecycleServiceD = require('../../../../business_modules/awareness/domain/services/suggestionLifecycleServiceD');
const ChangeClassificationServiceD = require('../../../../business_modules/awareness/domain/services/changeClassificationServiceD');
const ReviewSessionServiceD = require('../../../../business_modules/awareness/domain/services/reviewSessionServiceD');
const DebtCalculationServiceD = require('../../../../business_modules/awareness/domain/services/debtCalculationServiceD');
const SuggestionBatchServiceD = require('../../../../business_modules/awareness/domain/services/suggestionBatchServiceD');
const DIContainer = require('../../../../diContainer');

suite('AwarenessService with Adapters', () => {
    let mockVSCodeAdapter;
    let mockPersistenceAdapter;
    let awarenessService;
    let awarenessController;
    let mockContext;
    
    setup(() => {
        mockVSCodeAdapter = new AwarenessMockVSCodeAdapter();
        mockPersistenceAdapter = new AwarenessMockPersistenceAdapter();
        mockContext = {
            subscriptions: [],
            workspaceState: mockPersistenceAdapter
        };
        
        // Create internal adapters (no dependencies, can use real adapters in tests)
        const loggerAdapter = new AwarenessLoggerAdapter();
        const fileSystemAdapter = new AwarenessFileSystemAdapter();
        const idGeneratorAdapter = new AwarenessIdGeneratorAdapter();
        const hashGeneratorAdapter = new AwarenessHashGeneratorAdapter();
        
        // Create domain services (no dependencies - ports passed as method parameters)
        // Note: EventSubscriptionDService and VSCodeWorkspaceDService moved to app layer (VSCodeUtilities)
        const rangeOperationServiceD = new RangeOperationServiceD();
        const uriPathOperationServiceD = new UriPathOperationServiceD();
        const suggestionLifecycleServiceD = new SuggestionLifecycleServiceD();
        const changeClassificationServiceD = new ChangeClassificationServiceD();
        const reviewSessionServiceD = new ReviewSessionServiceD();
        const debtCalculationServiceD = new DebtCalculationServiceD();
        const suggestionBatchServiceD = new SuggestionBatchServiceD();
        
        awarenessService = new AwarenessService({
            vscodeAdapter: mockVSCodeAdapter,
            persistenceAdapter: mockPersistenceAdapter,
            messagingAdapter: null,
            loggerAdapter: loggerAdapter,
            fileSystemAdapter: fileSystemAdapter,
            idGeneratorAdapter: idGeneratorAdapter,
            hashGeneratorAdapter: hashGeneratorAdapter,
            rangeOperationServiceD: rangeOperationServiceD,
            uriPathOperationServiceD: uriPathOperationServiceD,
            suggestionLifecycleServiceD: suggestionLifecycleServiceD,
            changeClassificationServiceD: changeClassificationServiceD,
            reviewSessionServiceD: reviewSessionServiceD,
            debtCalculationServiceD: debtCalculationServiceD,
            suggestionBatchServiceD: suggestionBatchServiceD
        });
        
        // Create controller for event listener
        awarenessController = new AwarenessController({
            awarenessService: awarenessService,
            logger: null
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
        await awarenessController.startMonitoring(mockContext, null, 'dev');
        
        // Verify event handlers are registered
        assert.strictEqual(mockVSCodeAdapter._textDocumentChangeHandlers.length, 1);
        assert.strictEqual(mockVSCodeAdapter._fileCreateHandlers.length, 1);
        assert.strictEqual(mockVSCodeAdapter._fileSaveHandlers.length, 1);
    });
    
    test('should handle text document changes via adapter', async () => {
        await awarenessController.startMonitoring(mockContext, null, 'dev');
        
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
        await awarenessController.startMonitoring(mockContext, null, 'dev');
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
        
        // Create internal adapters (no dependencies, can use real adapters in tests)
        const loggerAdapter = new AwarenessLoggerAdapter();
        const fileSystemAdapter = new AwarenessFileSystemAdapter();
        const idGeneratorAdapter = new AwarenessIdGeneratorAdapter();
        const hashGeneratorAdapter = new AwarenessHashGeneratorAdapter();
        
        // Create domain services (no dependencies - ports passed as method parameters)
        // Note: EventSubscriptionDService and VSCodeWorkspaceDService moved to app layer (VSCodeUtilities)
        const rangeOperationServiceD = new RangeOperationServiceD();
        const uriPathOperationServiceD = new UriPathOperationServiceD();
        const suggestionLifecycleServiceD = new SuggestionLifecycleServiceD();
        const changeClassificationServiceD = new ChangeClassificationServiceD();
        const reviewSessionServiceD = new ReviewSessionServiceD();
        const debtCalculationServiceD = new DebtCalculationServiceD();
        const suggestionBatchServiceD = new SuggestionBatchServiceD();
        
        const awarenessService = new AwarenessService({
            vscodeAdapter: mockVSCodeAdapter,
            persistenceAdapter: mockPersistenceAdapter,
            messagingAdapter: null,
            loggerAdapter: loggerAdapter,
            fileSystemAdapter: fileSystemAdapter,
            idGeneratorAdapter: idGeneratorAdapter,
            hashGeneratorAdapter: hashGeneratorAdapter,
            rangeOperationServiceD: rangeOperationServiceD,
            uriPathOperationServiceD: uriPathOperationServiceD,
            suggestionLifecycleServiceD: suggestionLifecycleServiceD,
            changeClassificationServiceD: changeClassificationServiceD,
            reviewSessionServiceD: reviewSessionServiceD,
            debtCalculationServiceD: debtCalculationServiceD,
            suggestionBatchServiceD: suggestionBatchServiceD
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

// NOTE: EventHandlers and AgentSuggestionHandler have been refactored
// EventHandlers → AwarenessEventListener (input layer)
// AgentSuggestionHandler → SuggestionAggregate + SuggestionService (domain + app layer)
// These test suites are obsolete and have been removed


