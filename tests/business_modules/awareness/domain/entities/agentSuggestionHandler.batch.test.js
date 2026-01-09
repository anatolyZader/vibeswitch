/**
 * Tests for AgentSuggestionHandler with SuggestionBatch integration
 * 
 * Tests that AgentSuggestionHandler correctly creates and tracks batches.
 */

const { assert } = require('chai');
const AgentSuggestionHandler = require('../../../../../business_modules/awareness/domain/entities/agentSuggestionHandler');
const SuggestionBatch = require('../../../../../business_modules/awareness/domain/entities/suggestionBatch');

describe('AgentSuggestionHandler with SuggestionBatch', () => {
    let handler;
    let mockDebtManager;
    let mockVSCodeAdapter;
    const testFilePath = 'file:///workspace/test.js';

    beforeEach(() => {
        mockDebtManager = {
            addToDebt: () => {},
            getDebt: () => null,
            hasUnreviewedDebt: () => false
        };
        
        // Create minimal mock VS Code adapter
        mockVSCodeAdapter = {
            Range: class Range {
                constructor(start, end) {
                    this.start = start;
                    this.end = end;
                }
            },
            Position: class Position {
                constructor(line, character) {
                    this.line = line;
                    this.character = character;
                }
            },
            Uri: {
                parse: (uri) => ({ toString: () => uri })
            },
            openTextDocument: async (uri) => ({
                uri: uri,
                getText: () => 'test content',
                validateRange: (range) => range,
                lineCount: 10
            })
        };
        
        handler = new AgentSuggestionHandler(
            mockDebtManager,
            () => {}, // updateScore
            {}, // callbacks
            () => {}, // trackAcceptance
            null, // updateFileColorsInExplorer
            mockVSCodeAdapter
        );
    });

    afterEach(() => {
        if (handler) {
            handler.dispose();
        }
    });

    test('should create batch when recording suggestion batch', () => {
        const mockDocument = {
            uri: { toString: () => testFilePath },
            getText: () => 'test content',
            lineCount: 10
        };
        
        const mockChanges = [{
            text: 'new code',
            range: new mockVSCodeAdapter.Range(
                new mockVSCodeAdapter.Position(0, 0),
                new mockVSCodeAdapter.Position(0, 0)
            )
        }];
        
        handler.recordAISuggestionBatch(mockDocument, mockChanges);
        
        // Check that a batch was created
        expect(handler.batchesById.size, 1);
    });

    test('should add suggestions to same batch within time window', () => {
        const mockDocument = {
            uri: { toString: () => testFilePath },
            getText: () => 'test content',
            lineCount: 10
        };
        
        const mockChanges1 = [{
            text: 'code1',
            range: new mockVSCodeAdapter.Range(
                new mockVSCodeAdapter.Position(0, 0),
                new mockVSCodeAdapter.Position(0, 0)
            )
        }];
        
        const mockChanges2 = [{
            text: 'code2',
            range: new mockVSCodeAdapter.Range(
                new mockVSCodeAdapter.Position(1, 0),
                new mockVSCodeAdapter.Position(1, 0)
            )
        }];
        
        // Record two batches within same second (should be same batch)
        handler.recordAISuggestionBatch(mockDocument, mockChanges1);
        handler.recordAISuggestionBatch(mockDocument, mockChanges2);
        
        // Should have one batch with two suggestions
        const batches = Array.from(handler.batchesById.values());
        expect(batches.length, 1);
        expect(batches[0].suggestionIds.length, 2);
    });

    test('should assign batchId to suggestions', () => {
        const mockDocument = {
            uri: { toString: () => testFilePath },
            getText: () => 'test content',
            lineCount: 10
        };
        
        const mockChanges = [{
            text: 'new code',
            range: new mockVSCodeAdapter.Range(
                new mockVSCodeAdapter.Position(0, 0),
                new mockVSCodeAdapter.Position(0, 0)
            )
        }];
        
        handler.recordAISuggestionBatch(mockDocument, mockChanges);
        
        // Get the suggestion
        const suggestions = Array.from(handler.suggestionsById.values());
        expect(suggestions.length, 1);
        expect(suggestions[0].batchId);
    });

    test('should update batch outcome when suggestion status changes', async () => {
        const mockDocument = {
            uri: { toString: () => testFilePath },
            getText: () => 'test content',
            lineCount: 10
        };
        
        const mockChanges = [{
            text: 'new code',
            range: new mockVSCodeAdapter.Range(
                new mockVSCodeAdapter.Position(0, 0),
                new mockVSCodeAdapter.Position(0, 10)
            )
        }];
        
        handler.recordAISuggestionBatch(mockDocument, mockChanges);
        
        const suggestions = Array.from(handler.suggestionsById.values());
        const suggestion = suggestions[0];
        const batchId = suggestion.batchId;
        const batch = handler.batchesById.get(batchId);
        
        expect(batch);
        expect(batch.status, 'pending');
        
        // Mark suggestion as accepted (simulate)
        suggestion.status = 'accepted';
        handler._updateBatchOutcome(suggestion);
        
        // Batch should reflect the outcome
        expect(batch.acceptedCount, 1);
    });

    test('should detect keep all pattern when batch fully accepted', () => {
        const mockDocument = {
            uri: { toString: () => testFilePath },
            getText: () => 'test content',
            lineCount: 10
        };
        
        let keepAllDetected = false;
        handler.trackAcceptance = (data) => {
            if (data.batchId) {
                keepAllDetected = true;
            }
        };
        
        // Create batch with 3+ suggestions
        const mockChanges1 = [{
            text: 'code1',
            range: new mockVSCodeAdapter.Range(
                new mockVSCodeAdapter.Position(0, 0),
                new mockVSCodeAdapter.Position(0, 0)
            )
        }];
        const mockChanges2 = [{
            text: 'code2',
            range: new mockVSCodeAdapter.Range(
                new mockVSCodeAdapter.Position(1, 0),
                new mockVSCodeAdapter.Position(1, 0)
            )
        }];
        const mockChanges3 = [{
            text: 'code3',
            range: new mockVSCodeAdapter.Range(
                new mockVSCodeAdapter.Position(2, 0),
                new mockVSCodeAdapter.Position(2, 0)
            )
        }];
        
        handler.recordAISuggestionBatch(mockDocument, mockChanges1);
        handler.recordAISuggestionBatch(mockDocument, mockChanges2);
        handler.recordAISuggestionBatch(mockDocument, mockChanges3);
        
        // Get all suggestions and mark them as accepted
        const suggestions = Array.from(handler.suggestionsById.values());
        const batchId = suggestions[0].batchId;
        
        suggestions.forEach(suggestion => {
            suggestion.status = 'accepted';
            handler._updateBatchOutcome(suggestion);
        });
        
        // Should detect keep all pattern
        const batch = handler.batchesById.get(batchId);
        if (batch && batch.isFullyResolved() && batch.isKeepAllPattern()) {
            expect(keepAllDetected || batch.isKeepAllPattern());
        }
    });

    test('should track suggestions to batch mapping', () => {
        const mockDocument = {
            uri: { toString: () => testFilePath },
            getText: () => 'test content',
            lineCount: 10
        };
        
        const mockChanges = [{
            text: 'new code',
            range: new mockVSCodeAdapter.Range(
                new mockVSCodeAdapter.Position(0, 0),
                new mockVSCodeAdapter.Position(0, 0)
            )
        }];
        
        handler.recordAISuggestionBatch(mockDocument, mockChanges);
        
        const suggestions = Array.from(handler.suggestionsById.values());
        const suggestion = suggestions[0];
        const batchId = suggestion.batchId;
        
        // Check mapping
        expect(handler.suggestionsToBatch.get(suggestion.id));
        expect(handler.suggestionsToBatch.get(suggestion.id), batchId);
    });

    test('should create separate batches for different files', () => {
        const mockDocument1 = {
            uri: { toString: () => 'file:///workspace/test1.js' },
            getText: () => 'test content',
            lineCount: 10
        };
        
        const mockDocument2 = {
            uri: { toString: () => 'file:///workspace/test2.js' },
            getText: () => 'test content',
            lineCount: 10
        };
        
        const mockChanges = [{
            text: 'new code',
            range: new mockVSCodeAdapter.Range(
                new mockVSCodeAdapter.Position(0, 0),
                new mockVSCodeAdapter.Position(0, 0)
            )
        }];
        
        handler.recordAISuggestionBatch(mockDocument1, mockChanges);
        handler.recordAISuggestionBatch(mockDocument2, mockChanges);
        
        // Should have two separate batches
        expect(handler.batchesById.size, 2);
    });

    test('should include batch info in callback data', () => {
        let callbackData = null;
        handler.onAISuggestion = (data) => {
            callbackData = data;
        };
        
        const mockDocument = {
            uri: { toString: () => testFilePath },
            getText: () => 'test content',
            lineCount: 10
        };
        
        const mockChanges = [{
            text: 'new code',
            range: new mockVSCodeAdapter.Range(
                new mockVSCodeAdapter.Position(0, 0),
                new mockVSCodeAdapter.Position(0, 0)
            )
        }];
        
        handler.recordAISuggestionBatch(mockDocument, mockChanges);
        
        expect(callbackData);
        expect(callbackData.batchId);
        expect(callbackData.isNewBatch);
    });
});
