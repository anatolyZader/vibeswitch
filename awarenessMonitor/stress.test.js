/**
 * Stress Tests for Awareness Monitor
 * Tests for production readiness: rapid events, memory growth, edge cases
 */

// Mock vscode module before requiring other modules
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(...args) {
    if (args[0] === 'vscode') {
        return {
            Range: class Range {
                constructor(startLine, startChar, endLine, endChar) {
                    this.start = { line: startLine, character: startChar };
                    this.end = { line: endLine, character: endChar };
                }
                isBefore(other) {
                    return this.start.line < other.start.line || 
                           (this.start.line === other.start.line && this.start.character < other.start.character);
                }
                isAfter(other) {
                    return this.start.line > other.start.line || 
                           (this.start.line === other.start.line && this.start.character > other.start.character);
                }
            },
            Position: class Position {
                constructor(line, char) {
                    this.line = line;
                    this.character = char;
                }
            },
            workspace: {
                asRelativePath: (uri) => uri.toString().split('/').pop()
            }
        };
    }
    return originalRequire.apply(this, args);
};

const ChangeClassifier = require('./changeClassifier');
const AgentSuggestionHandler = require('./agentSuggestionHandler');
const ChangeLedger = require('./changeLedger');

// Mock vscode for testing
const vscode = {
    Range: class Range {
        constructor(startLine, startChar, endLine, endChar) {
            if (typeof startLine === 'object' && startLine.line !== undefined) {
                // Constructor with Position objects
                this.start = startLine;
                this.end = startChar;
            } else {
                // Constructor with line/char numbers
                this.start = { line: startLine, character: startChar };
                this.end = { line: endLine, character: endChar };
            }
        }
        isBefore(other) {
            return this.start.line < other.start.line || 
                   (this.start.line === other.start.line && this.start.character < other.start.character);
        }
        isAfter(other) {
            return this.start.line > other.start.line || 
                   (this.start.line === other.start.line && this.start.character > other.start.character);
        }
    },
    Position: class Position {
        constructor(line, char) {
            this.line = line;
            this.character = char;
        }
        isBefore(other) {
            return this.line < other.line || 
                   (this.line === other.line && this.character < other.character);
        }
        isAfter(other) {
            return this.line > other.line || 
                   (this.line === other.line && this.character > other.character);
        }
    },
    workspace: {
        asRelativePath: (uri) => uri.toString().split('/').pop()
    }
};

function createChange(text, startLine, startChar, endLine, endChar) {
    const start = new vscode.Position(startLine, startChar);
    const end = new vscode.Position(endLine, endChar);
    return {
        text: text,
        range: new vscode.Range(start, end),
        rangeLength: 0
    };
}

function createMockDoc(uri, version = 1) {
    return {
        uri: { toString: () => uri },
        version: version,
        getText: () => 'content'
    };
}

/**
 * Stress Test 1: 5-10k rapid change events (AI refactor simulation)
 */
async function testRapidChangeEvents() {
    console.log('\n=== Stress Test 1: 5-10k Rapid Change Events ===');
    
    const classifier = new ChangeClassifier(200, {
        multiLineThreshold: 30,
        aiMultiLineSize: 30
    });
    
    const mockDoc = createMockDoc('file:///test.js', 1);
    const eventCount = 5000;
    let classificationCount = 0;
    let lastPendingSize = 0;
    let maxPendingSize = 0;
    
    const startTime = Date.now();
    
    // Simulate rapid AI refactor: many small changes
    for (let i = 0; i < eventCount; i++) {
        const change = createChange(`function test${i}() {}`, i, 0, i, 0);
        const event = {
            document: { ...mockDoc, version: i + 1 },
            contentChanges: [change]
        };
        
        classifier.addEvent(event, (doc, classification, changes) => {
            classificationCount++;
        });
        
        // Check pending size periodically
        if (i % 100 === 0) {
            const pendingSize = classifier.pendingChanges.size;
            maxPendingSize = Math.max(maxPendingSize, pendingSize);
            if (pendingSize > lastPendingSize + 10) {
                console.log(`  ⚠️  Warning: Pending size grew from ${lastPendingSize} to ${pendingSize} at event ${i}`);
            }
            lastPendingSize = pendingSize;
        }
    }
    
    // Force flush all
    classifier.flushAll((doc, classification, changes) => {
        classificationCount++;
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Verify no unbounded growth
    const finalPendingSize = classifier.pendingChanges.size;
    const passed = finalPendingSize === 0 && 
                   maxPendingSize <= 1 && // Should only have 1 pending (single doc)
                   classificationCount > 0;
    
    console.log(`  Events: ${eventCount}`);
    console.log(`  Classifications: ${classificationCount}`);
    console.log(`  Max pending size: ${maxPendingSize}`);
    console.log(`  Final pending size: ${finalPendingSize}`);
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    
    return {
        name: 'Rapid change events: no unbounded growth',
        passed,
        result: {
            eventCount,
            classificationCount,
            maxPendingSize,
            finalPendingSize,
            duration
        },
        expected: 'pendingChanges.size <= 1, finalPendingSize === 0, classifications > 0'
    };
}

/**
 * Stress Test 2: Memory growth in AgentSuggestionHandler
 */
async function testSuggestionHandlerMemory() {
    console.log('\n=== Stress Test 2: Suggestion Handler Memory ===');
    
    const mockDebtManager = {
        addDebt: () => {},
        removeDebt: () => {},
        addToDebt: () => {},
        removeFromDebt: () => {}
    };
    const mockUpdateScore = () => {};
    const handler = new AgentSuggestionHandler(mockDebtManager, mockUpdateScore);
    
    const mockDoc = createMockDoc('file:///test.js');
    const suggestionCount = 1000;
    
    // Create many suggestions
    for (let i = 0; i < suggestionCount; i++) {
        const changes = [createChange(`function test${i}() {}`, i, 0, i, 0)];
        handler.recordAISuggestionBatch(mockDoc, changes);
    }
    
    const suggestionsSize = handler.suggestionsById.size;
    const recentIdsSize = handler.recentIds.length;
    const pendingByDocSize = handler.pendingByDocUri ? 
        Array.from(handler.pendingByDocUri.values()).reduce((sum, ids) => sum + ids.size, 0) : 0;
    
    // Verify bounded growth
    const passed = suggestionsSize === suggestionCount && // All suggestions stored
                   recentIdsSize <= handler.maxRecentSuggestions && // Recent capped
                   pendingByDocSize === suggestionCount; // All pending
    
    console.log(`  Suggestions created: ${suggestionCount}`);
    console.log(`  suggestionsById.size: ${suggestionsSize}`);
    console.log(`  recentIds.length: ${recentIdsSize} (max: ${handler.maxRecentSuggestions})`);
    console.log(`  pendingByDocUri total: ${pendingByDocSize}`);
    console.log(`  Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    
    handler.dispose();
    
    return {
        name: 'Suggestion handler: bounded memory growth',
        passed,
        result: {
            suggestionsSize,
            recentIdsSize,
            pendingByDocSize
        },
        expected: 'suggestionsById stores all, recentIds capped, pendingByDocUri tracks all'
    };
}

/**
 * Stress Test 3: ChangeLedger flush queueing under rapid appends
 */
async function testLedgerFlushQueueing() {
    console.log('\n=== Stress Test 3: Ledger Flush Queueing ===');
    
    const mockContext = {
        workspaceState: {
            _store: {},
            get: (key, defaultValue) => mockContext.workspaceState._store[key] || defaultValue,
            update: async (key, value) => {
                mockContext.workspaceState._store[key] = value;
            }
        }
    };
    
    const ledger = new ChangeLedger(mockContext, 2000, 100);
    
    const appendCount = 1000;
    const startTime = Date.now();
    
    // Rapid appends
    for (let i = 0; i < appendCount; i++) {
        ledger.append({
            ts: Date.now(),
            uri: `file:///test${i % 10}.js`,
            file: `test${i % 10}.js`,
            label: 'ai',
            confidence: 0.8,
            reasons: ['test'],
            changeCount: 1,
            inserted: 10,
            deleted: 0,
            lineSpan: 1,
            distinctRangeCount: 1,
            kind: 'batch',
            batchId: `batch-${i}`
        });
    }
    
    // Force flush
    await ledger.flush();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Verify all entries persisted
    const stored = mockContext.workspaceState._store[ledger.key] || [];
    const storedCount = stored.length;
    const passed = storedCount === appendCount;
    
    console.log(`  Appends: ${appendCount}`);
    console.log(`  Stored entries: ${storedCount}`);
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    
    await ledger.dispose();
    
    return {
        name: 'Ledger flush queueing: all entries persist',
        passed,
        result: {
            appendCount,
            storedCount,
            duration
        },
        expected: 'storedCount === appendCount'
    };
}

/**
 * Stress Test 4: Timer cleanup on dispose
 */
async function testTimerCleanup() {
    console.log('\n=== Stress Test 4: Timer Cleanup ===');
    
    const mockDebtManager = {
        addDebt: () => {},
        removeDebt: () => {},
        addToDebt: () => {},
        removeFromDebt: () => {}
    };
    const mockUpdateScore = () => {};
    const handler = new AgentSuggestionHandler(mockDebtManager, mockUpdateScore);
    
    const mockDoc = createMockDoc('file:///test.js');
    
    // Create suggestions that trigger timers
    for (let i = 0; i < 100; i++) {
        const changes = [createChange(`function test${i}() {}`, i, 0, i, 0)];
        handler.recordAISuggestionBatch(mockDoc, changes);
    }
    
    const activeTimersBefore = handler.activeTimers.size;
    handler.isActive = false; // Simulate dispose
    
    // Dispose
    handler.dispose();
    
    const activeTimersAfter = handler.activeTimers.size;
    const passed = activeTimersAfter === 0;
    
    console.log(`  Active timers before: ${activeTimersBefore}`);
    console.log(`  Active timers after: ${activeTimersAfter}`);
    console.log(`  isActive: ${handler.isActive}`);
    console.log(`  Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    
    return {
        name: 'Timer cleanup: all timers cleared on dispose',
        passed,
        result: {
            activeTimersBefore,
            activeTimersAfter,
            isActive: handler.isActive
        },
        expected: 'activeTimersAfter === 0, isActive === false'
    };
}

/**
 * Stress Test 5: Scattered edits with range capping
 */
async function testScatteredEditsCapping() {
    console.log('\n=== Stress Test 5: Scattered Edits Range Capping ===');
    
    const mockDebtManager = {
        addDebt: () => {},
        removeDebt: () => {},
        addToDebt: () => {},
        removeFromDebt: () => {}
    };
    const mockUpdateScore = () => {};
    const handler = new AgentSuggestionHandler(mockDebtManager, mockUpdateScore);
    
    const mockDoc = createMockDoc('file:///test.js');
    
    // Create scattered edits: 200 lines apart, tiny inserts
    const changes = [];
    for (let i = 0; i < 10; i++) {
        changes.push(createChange('x', i * 200, 0, i * 200, 0));
    }
    
    // This should trigger range capping (lineSpan > 100, avgInsertedPerLine < 5)
    handler.recordAISuggestionBatch(mockDoc, changes);
    
    // Verify suggestion was created with reasonable size
    const suggestions = Array.from(handler.suggestionsById.values());
    const suggestion = suggestions[0];
    
    const lineSpan = suggestion.range.end.line - suggestion.range.start.line;
    const size = suggestion.size;
    const passed = suggestion && size < 1000; // Should be capped, not huge
    
    console.log(`  Changes: ${changes.length}`);
    console.log(`  Line span: ${lineSpan}`);
    console.log(`  Suggestion size: ${size}`);
    console.log(`  Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    
    handler.dispose();
    
    return {
        name: 'Scattered edits: range capping prevents huge sizes',
        passed,
        result: {
            lineSpan,
            size,
            changeCount: changes.length
        },
        expected: 'size < 1000 (capped for scattered edits)'
    };
}

/**
 * Stress Test 6: Overlapping edits in same region
 */
async function testOverlappingEdits() {
    console.log('\n=== Stress Test 6: Overlapping Edits ===');
    
    const mockDebtManager = {
        addDebt: () => {},
        removeDebt: () => {},
        addToDebt: () => {},
        removeFromDebt: () => {}
    };
    const mockUpdateScore = () => {};
    const handler = new AgentSuggestionHandler(mockDebtManager, mockUpdateScore);
    
    const mockDoc = createMockDoc('file:///test.js');
    
    // Create overlapping edits in same region
    const changes = [
        createChange('function a() {}', 10, 0, 10, 0),
        createChange('function b() {}', 10, 5, 10, 5),
        createChange('function c() {}', 10, 10, 10, 10)
    ];
    
    handler.recordAISuggestionBatch(mockDoc, changes);
    
    // Verify suggestion was created
    const suggestions = Array.from(handler.suggestionsById.values());
    const suggestion = suggestions[0];
    
    const passed = suggestion && suggestion.range && suggestion.size > 0;
    
    console.log(`  Overlapping changes: ${changes.length}`);
    console.log(`  Suggestion created: ${!!suggestion}`);
    console.log(`  Suggestion size: ${suggestion ? suggestion.size : 0}`);
    console.log(`  Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    
    handler.dispose();
    
    return {
        name: 'Overlapping edits: handled correctly',
        passed,
        result: {
            changeCount: changes.length,
            suggestionCreated: !!suggestion,
            size: suggestion ? suggestion.size : 0
        },
        expected: 'suggestion created with valid range and size'
    };
}

/**
 * Run all stress tests
 */
async function runStressTests() {
    console.log('\n' + '='.repeat(60));
    console.log('STRESS TEST SUITE: Production Readiness Verification');
    console.log('='.repeat(60));
    
    const tests = [
        testRapidChangeEvents(),
        testSuggestionHandlerMemory(),
        testLedgerFlushQueueing(),
        testTimerCleanup(),
        testScatteredEditsCapping(),
        testOverlappingEdits()
    ];
    
    const results = await Promise.all(tests);
    
    console.log('\n' + '='.repeat(60));
    console.log('STRESS TEST RESULTS');
    console.log('='.repeat(60));
    
    let passed = 0;
    let failed = 0;
    
    for (const result of results) {
        if (result.passed) {
            console.log(`✅ ${result.name}`);
            passed++;
        } else {
            console.log(`❌ ${result.name}`);
            console.log(`   Expected: ${result.expected}`);
            console.log(`   Got: ${JSON.stringify(result.result, null, 2)}`);
            failed++;
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`Total: ${results.length} tests, ${passed} passed, ${failed} failed`);
    console.log('='.repeat(60));
    
    return {
        total: results.length,
        passed,
        failed,
        results
    };
}

// Run if called directly
if (require.main === module) {
    runStressTests().then(summary => {
        process.exit(summary.failed > 0 ? 1 : 0);
    }).catch(err => {
        console.error('Stress test error:', err);
        process.exit(1);
    });
}

module.exports = {
    runStressTests,
    testRapidChangeEvents,
    testSuggestionHandlerMemory,
    testLedgerFlushQueueing,
    testTimerCleanup,
    testScatteredEditsCapping,
    testOverlappingEdits
};

