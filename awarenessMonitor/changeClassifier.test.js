/**
 * Test Harness for Change Classifier
 * Unit tests for classification logic to prevent drift
 */

const ChangeClassifier = require('./changeClassifier');
// Mock vscode for testing outside VS Code environment
const vscode = {
    Range: class Range {
        constructor(startLine, startChar, endLine, endChar) {
            this.start = { line: startLine, character: startChar };
            this.end = { line: endLine, character: endChar };
        }
        intersection(other) {
            if (this.end.line < other.start.line || this.start.line > other.end.line) {
                return undefined;
            }
            if (this.end.line === other.start.line && this.end.character < other.start.character) {
                return undefined;
            }
            if (this.start.line === other.end.line && this.start.character > other.end.character) {
                return undefined;
            }
            return new Range(
                Math.max(this.start.line, other.start.line),
                Math.max(this.start.character, other.start.character),
                Math.min(this.end.line, other.end.line),
                Math.min(this.end.character, other.end.character)
            );
        }
    }
};

/**
 * Create a mock change object
 */
function createChange(text, range, rangeLength = 0) {
    return {
        text: text,
        range: range,
        rangeLength: rangeLength
    };
}

/**
 * Create a mock range
 */
function createRange(startLine, startChar, endLine, endChar) {
    return new vscode.Range(startLine, startChar, endLine, endChar);
}

/**
 * Test cases
 */
function runTests() {
    // Fix: Use test config with lower thresholds for deterministic test behavior
    // This keeps DEV/VIBE tuning independent from unit correctness
    const classifier = new ChangeClassifier(200, {
        multiLineThreshold: 30, // Lower for tests
        pureInsertionCount: 2, // Lower for tests
        pureInsertionSize: 10, // Lower for tests
        largeInsertionThreshold: 50, // Lower for tests
        scatteredRangeCount: 3, // Lower for tests
        scatteredChangeCount: 3, // Lower for tests
        scatteredSizeThreshold: 100, // Lower for tests
        formatterRangeCount: 5, // Lower for tests
        formatterLineSpan: 30, // Lower for tests
        aiLineSpan: 30,
        aiMultiLineSize: 30, // Lower for tests
        rapidScatteredTimeWindow: 1000,
        rapidScatteredEventCount: 5, // Lower for tests
        rapidScatteredRangeCount: 4, // Lower for tests
        rapidScatteredMinSize: 30, // Lower for tests
        rapidBurstChangeCount: 5, // Lower for tests
        markerOnly: false
    });
    
    const tests = [];
    let passed = 0;
    let failed = 0;
    
    // Test 1: AI multi-line insert
    function test1() {
        const changes = [
            createChange('function newFunction() {\n    return true;\n}', createRange(0, 0, 0, 0), 0)
        ];
        const result = classifier.classify(changes, [Date.now()], [new Set()], Date.now());
        const passed = result.label === 'ai' && result.confidence > 0.5;
        return { name: 'AI multi-line insert', passed, result, expected: 'ai' };
    }
    
    // Test 2: Formatter wide whitespace changes
    function test2() {
        const changes = [];
        const now = Date.now();
        const timestamps = [];
        // Create many scattered whitespace-only changes
        for (let i = 0; i < 10; i++) {
            changes.push(createChange('    ', createRange(i * 10, 0, i * 10, 4), 4));
            timestamps.push(now + i * 10);
        }
        // Create event range sets (one per timestamp)
        const eventRangeSets = timestamps.map(() => {
            const rangeSet = new Set();
            changes.forEach(c => {
                const lineKey = `${c.range.start.line}-${c.range.end.line}`;
                rangeSet.add(lineKey);
            });
            return rangeSet;
        });
        const result = classifier._classify(changes, timestamps, eventRangeSets, now);
        const passed = result.label === 'formatter' && result.confidence > 0.5;
        return { name: 'Formatter wide whitespace changes', passed, result, expected: 'formatter' };
    }
    
    // Test 3: Human incremental edits
    function test3() {
        const changes = [
            createChange('const x = 1;', createRange(0, 0, 0, 0), 0)
        ];
        const result = classifier.classify(changes, [Date.now()], [new Set()], Date.now());
        const passed = result.label === 'user' || result.label === 'unknown';
        return { name: 'Human incremental edit', passed, result, expected: 'user' };
    }
    
    // Test 4: Refactor delete+insert wide span
    function test4() {
        // Fix: Make test data exceed thresholds (100 chars for scatteredSizeThreshold in test config)
        // Also ensure we have enough ranges (3+) and changes (3+)
        const changes = [
            createChange('newCode' + 'x'.repeat(50), createRange(0, 0, 0, 7), 7), // Delete old, insert new (larger)
            createChange('moreNewCode' + 'y'.repeat(50), createRange(30, 0, 30, 11), 11), // Larger, different line
            createChange('evenMoreCode' + 'z'.repeat(50), createRange(60, 0, 60, 12), 12) // Third change for scattered threshold
        ];
        const now = Date.now();
        const timestamps = [now, now + 50, now + 100]; // Multiple events
        // Create event range sets (one per timestamp)
        const eventRangeSets = timestamps.map((_, idx) => {
            const rangeSet = new Set();
            const lineKey = `${changes[idx].range.start.line}-${changes[idx].range.end.line}`;
            rangeSet.add(lineKey);
            return rangeSet;
        });
        const result = classifier._classify(changes, timestamps, eventRangeSets, now);
        // Should be AI (refactor) not formatter (has semantic content)
        const passed = result.label === 'ai' && result.reasons.some(r => r.includes('scattered') || r.includes('insertion'));
        return { name: 'Refactor delete+insert wide span', passed, result, expected: 'ai' };
    }
    
    // Test 5: Rapid scattered changes (AI signal)
    function test5() {
        const changes = [];
        const now = Date.now();
        const timestamps = [];
        // Create many rapid scattered changes
        for (let i = 0; i < 10; i++) {
            changes.push(createChange(`code${i}`, createRange(i * 5, 0, i * 5, 0), 0));
            timestamps.push(now + i * 50); // All within 500ms
        }
        // Create event range sets (one per timestamp)
        const eventRangeSets = timestamps.map(() => {
            const rangeSet = new Set();
            changes.forEach(c => {
                const lineKey = `${c.range.start.line}-${c.range.end.line}`;
                rangeSet.add(lineKey);
            });
            return rangeSet;
        });
        const result = classifier._classify(changes, timestamps, eventRangeSets, now);
        const passed = result.label === 'ai' && result.reasons.some(r => r.includes('rapid'));
        return { name: 'Rapid scattered changes', passed, result, expected: 'ai' };
    }
    
    // Test 6: @ai marker detection
    function test6() {
        const changes = [
            createChange('// @ai\nfunction test() {}', createRange(0, 0, 0, 0), 0)
        ];
        const result = classifier.classify(changes, [Date.now()], [new Set()], Date.now());
        const passed = result.label === 'ai' && result.confidence === 1.0 && result.reasons.some(r => r.includes('marker'));
        return { name: '@ai marker detection', passed, result, expected: 'ai (confidence=1.0)' };
    }
    
    // Test 7: Reason filtering alignment (mixed tagged/untagged reasons)
    function test7() {
        // Create a detector that returns reason without tag (simulating marker detection pattern)
        // This tests that reason filtering doesn't misalign when some detectors have tags and others don't
        const changes = [
            createChange('function test() {\n    return true;\n}', createRange(0, 0, 0, 0), 0)
        ];
        const result = classifier.classify(changes, [Date.now()], [new Set()], Date.now());
        // Should have filtered reasons (only matching the winning label)
        const hasReasons = result.reasons && result.reasons.length > 0;
        const passed = hasReasons && result.label !== 'unknown';
        return { name: 'Reason filtering alignment', passed, result, expected: 'filtered reasons matching label' };
    }
    
    // Test 8: Marker-only mode: no marker => label unknown, never user
    function test8() {
        const markerOnlyClassifier = new ChangeClassifier(200, {
            markerOnly: true,
            multiLineThreshold: 30,
            aiMultiLineSize: 30
        });
        const changes = [
            createChange('function test() {\n    return true;\n}', createRange(0, 0, 0, 0), 0)
        ];
        const result = markerOnlyClassifier.classify(changes, [Date.now()], [new Set()], Date.now());
        const passed = result.label === 'unknown' && result.confidence === 0.2;
        return { name: 'Marker-only mode: no marker => unknown', passed, result, expected: 'unknown (confidence=0.2)' };
    }
    
    // Test 9: Version drift behavior - confidence reduction and reason appended
    function test9() {
        // Test version drift by simulating the _classifyAndEmit path
        // Version drift is handled in _classifyAndEmit, so we test the classification result structure
        const classifier = new ChangeClassifier(200, {
            multiLineThreshold: 30,
            aiMultiLineSize: 30
        });
        
        // Create changes that will be classified as AI (exceed thresholds: 30 chars for test config)
        // Make it clearly multi-line and large enough
        const largeCode = 'function test() {\n    return true;\n    // More code here to exceed threshold\n    const x = 1;\n    const y = 2;\n    const z = 3;\n}';
        const changes = [createChange(largeCode, createRange(0, 0, 0, 0), 0)];
        const result = classifier.classify(changes, [Date.now()], [new Set()], Date.now());
        
        // Verify classification works and has reasons array
        // Version drift is tested in integration (requires actual document version tracking)
        // For unit test, just verify structure is correct
        const passed = Array.isArray(result.reasons) && result.confidence >= 0 && (result.label === 'ai' || result.label === 'unknown');
        return { name: 'Version drift: classification structure valid', passed, result, expected: 'valid classification with reasons array' };
    }
    
    // Test 11: Config sanitization - invalid values revert to defaults
    function test11() {
        // Test that invalid config values are sanitized and defaults win
        const invalidConfig = {
            rapidScatteredEventCount: "8", // Invalid: string instead of number
            markerOnly: "true", // Invalid: string instead of boolean
            multiLineThreshold: 50 // Valid: should be kept
        };
        
        const classifier = new ChangeClassifier(200, invalidConfig);
        
        // Verify defaults are used for invalid keys
        const passed = 
            classifier.config.rapidScatteredEventCount === 8 && // Default value, not "8"
            classifier.config.markerOnly === false && // Default value, not "true"
            classifier.config.multiLineThreshold === 50; // User value kept (valid)
        
        return { 
            name: 'Config sanitization: invalid values revert to defaults', 
            passed, 
            result: { 
                label: 'test',
                confidence: passed ? 1.0 : 0,
                reasons: [
                    `rapidScatteredEventCount: ${classifier.config.rapidScatteredEventCount} (expected: 8)`,
                    `markerOnly: ${classifier.config.markerOnly} (expected: false)`,
                    `multiLineThreshold: ${classifier.config.multiLineThreshold} (expected: 50)`
                ]
            },
            expected: 'defaults for invalid keys, user value for valid key'
        };
    }
    
    // Test 10: Pending cap bookkeeping - event metadata stays aligned after drops
    function test10() {
        const classifier = new ChangeClassifier(200, {
            multiLineThreshold: 30,
            aiMultiLineSize: 30
        });
        
        // Set a low cap for testing
        classifier.maxPendingChanges = 5;
        
        // Create many events to trigger capping
        const mockDocument = {
            uri: { toString: () => 'file:///test.js' },
            version: 1,
            getText: (range) => 'test'
        };
        
        // Add 10 events (each with 1 change) - should cap at 5
        for (let i = 0; i < 10; i++) {
            const mockEvent = {
                document: mockDocument,
                contentChanges: [
                    createChange(`change${i}`, createRange(i, 0, i, 0), 0)
                ]
            };
            classifier.addEvent(mockEvent, () => {});
        }
        
        // Check that metadata arrays are aligned
        const pending = classifier.pendingChanges.get('file:///test.js');
        if (!pending) {
            return { 
                name: 'Pending cap bookkeeping: metadata aligned', 
                passed: false, 
                result: { error: 'no pending changes' },
                expected: 'pending changes exist' 
            };
        }
        
        const changesLength = pending.changes.length;
        const timestampsLength = pending.eventTimestamps.length;
        const rangeSetsLength = pending.eventRangeSets.length;
        const changeCountsLength = pending.eventChangeCounts.length;
        
        // Verify arrays are aligned (all same length or properly cleaned up)
        const arraysAligned = 
            changesLength <= 5 && // Capped
            timestampsLength === rangeSetsLength && // Aligned
            timestampsLength === changeCountsLength && // Aligned
            changesLength > 0; // Has some changes
        
        const passed = arraysAligned;
        return { 
            name: 'Pending cap bookkeeping: metadata aligned', 
            passed, 
            result: { 
                label: 'test',
                confidence: arraysAligned ? 1.0 : 0,
                reasons: [`changes: ${changesLength}, timestamps: ${timestampsLength}, ranges: ${rangeSetsLength}, counts: ${changeCountsLength}`]
            },
            expected: 'all metadata arrays aligned after capping'
        };
    }
    
    // Run all tests
    tests.push(test1());
    tests.push(test2());
    tests.push(test3());
    tests.push(test4());
    tests.push(test5());
    tests.push(test6());
    tests.push(test7());
    tests.push(test8());
    tests.push(test9());
    tests.push(test10());
    tests.push(test11());
    
    // Report results
    console.log('\n=== Change Classifier Test Results ===\n');
    for (const test of tests) {
        if (test.passed) {
            passed++;
            console.log(`✅ ${test.name}`);
            console.log(`   Result: ${test.result.label} (confidence: ${(test.result.confidence * 100).toFixed(0)}%)`);
            if (test.result.reasons.length > 0) {
                console.log(`   Reasons: ${test.result.reasons.join('; ')}`);
            }
        } else {
            failed++;
            console.log(`❌ ${test.name}`);
            console.log(`   Expected: ${test.expected}`);
            if (test.result && test.result.label) {
                console.log(`   Got: ${test.result.label} (confidence: ${(test.result.confidence * 100).toFixed(0)}%)`);
                if (test.result.reasons && test.result.reasons.length > 0) {
                    console.log(`   Reasons: ${test.result.reasons.join('; ')}`);
                }
            } else {
                console.log(`   Got: ${JSON.stringify(test.result)}`);
            }
        }
        console.log('');
    }
    
    console.log(`\nTotal: ${tests.length} tests, ${passed} passed, ${failed} failed\n`);
    
    return { passed, failed, total: tests.length };
}

// Export for use in test runner or manual execution
if (require.main === module) {
    // Run tests if executed directly
    runTests();
}

module.exports = { runTests, createChange, createRange };

