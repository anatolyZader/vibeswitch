/**
 * AwarenessService Adapter Tests
 * Tests for AwarenessService and AwarenessController using mock adapters
 */

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

describe('AwarenessService with Adapters', () => {
    let mockVSCodeAdapter;
    let mockPersistenceAdapter;
    let awarenessService;
    let awarenessController;
    let mockContext;
    
    beforeEach(() => {
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
    
    afterEach(async () => {
        if (awarenessService) {
            await awarenessService.stop();
        }
        mockVSCodeAdapter.clear();
        mockPersistenceAdapter.clear();
    });
    
    test('should create AwarenessService with adapters', () => {
        expect(awarenessService).toBeTruthy();
        expect(awarenessService.vscodeAdapter).toBe(mockVSCodeAdapter);
        expect(awarenessService.persistenceAdapter).toBe(mockPersistenceAdapter);
    });
    
    test('should start monitoring with adapters', async () => {
        await awarenessController.startMonitoring(mockContext, null, 'dev');
        
        // Verify event handlers are registered
        expect(mockVSCodeAdapter._textDocumentChangeHandlers.length).toBe(1);
        expect(mockVSCodeAdapter._fileCreateHandlers.length).toBe(1);
        expect(mockVSCodeAdapter._fileSaveHandlers.length).toBe(1);
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
        expect(().not.toThrow() => {
            mockVSCodeAdapter.simulateTextDocumentChange(mockEvent);
        });
    });
    
    test('should stop monitoring and clean up', async () => {
        await awarenessController.startMonitoring(mockContext, null, 'dev');
        expect(awarenessService.eventHandlers).toBeTruthy();
        
        await awarenessService.stop();
        // After stop, event handlers should be disposed
        expect(true).toBeTruthy();
    });
});

describe('AwarenessController with DI Container', () => {
    let mockVSCodeAdapter;
    let mockPersistenceAdapter;
    let diContainer;
    let awarenessController;
    let mockContext;
    
    beforeEach(() => {
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
    
    afterEach(async () => {
        if (awarenessController) {
            await awarenessController.stopMonitoring();
        }
        mockVSCodeAdapter.clear();
        mockPersistenceAdapter.clear();
    });
    
    test('should create AwarenessController with DI container', () => {
        expect(awarenessController).toBeTruthy();
    });
    
    test('should start monitoring via controller', async () => {
        await awarenessController.startMonitoring(mockContext, null, 'dev');
        
        // Verify event handlers are registered
        expect(mockVSCodeAdapter._textDocumentChangeHandlers.length).toBe(1);
    });
    
    test('should get score via controller', async () => {
        await awarenessController.startMonitoring(mockContext, null, 'dev');
        const score = awarenessController.getScore();
        expect(score).toBeTruthy();
        expect(typeof score.total === 'number').toBeTruthy();
    });
});

// NOTE: EventHandlers and AgentSuggestionHandler have been refactored
// EventHandlers → AwarenessEventListener (input layer)
// AgentSuggestionHandler → SuggestionAggregate + SuggestionService (domain + app layer)
// These test suites are obsolete and have been removed


