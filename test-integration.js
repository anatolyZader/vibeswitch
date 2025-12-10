/**
 * Automated Integration Test for Awareness Monitor
 * Simulates VS Code events to test the monitor without manual interaction
 */

const AwarenessMonitor = require('./awareness-monitor');

// Mock VS Code API
const vscode = {
    workspace: {
        onDidChangeTextDocument: (handler) => ({ dispose: () => {} }),
    },
    window: {
        onDidChangeTextEditorSelection: (handler) => ({ dispose: () => {} }),
        onDidChangeActiveTextEditor: (handler) => ({ dispose: () => {} })
    }
};

class IntegrationTest {
    constructor() {
        this.monitor = new AwarenessMonitor();
        this.passed = 0;
        this.failed = 0;
    }
    
    assert(condition, message) {
        if (condition) {
            console.log(`✅ PASS: ${message}`);
            this.passed++;
        } else {
            console.log(`❌ FAIL: ${message}`);
            this.failed++;
        }
    }
    
    // Test 1: Initialization
    testInitialization() {
        console.log('\n=== TEST 1: Initialization ===');
        
        this.assert(
            this.monitor.aiSuggestions.length === 0,
            'Starts with empty suggestions array'
        );
        
        this.assert(
            this.monitor.currentScore === 0,
            'Starts with score of 0'
        );
        
        this.assert(
            this.monitor.maxSuggestions === 10,
            'Max suggestions set to 10'
        );
        
        this.assert(
            this.monitor.updateTimer === null,
            'Update timer initially null'
        );
    }
    
    // Test 2: Start/Stop
    testStartStop() {
        console.log('\n=== TEST 2: Start/Stop Monitoring ===');
        
        const mockContext = { subscriptions: [] };
        
        // Start monitoring
        this.monitor.start(mockContext);
        
        this.assert(
            this.monitor.disposables.length === 3,
            'Registers 3 event listeners on start'
        );
        
        this.assert(
            this.monitor.updateTimer !== null,
            'Update timer created on start'
        );
        
        // Stop monitoring
        this.monitor.stop();
        
        this.assert(
            this.monitor.disposables.length === 0,
            'Cleans up disposables on stop'
        );
        
        this.assert(
            this.monitor.updateTimer === null,
            'Clears update timer on stop'
        );
        
        this.assert(
            this.monitor.aiSuggestions.length === 0,
            'Resets suggestions on stop'
        );
    }
    
    // Test 3: Record AI Suggestion
    testRecordSuggestion() {
        console.log('\n=== TEST 3: Recording AI Suggestions ===');
        
        const mockDocument = { uri: { toString: () => 'file:///test.js' } };
        const mockChange = {
            range: { start: { line: 10, character: 0 }, end: { line: 15, character: 1 } },
            text: 'function test() {\n  return 42;\n}',
            rangeLength: 0
        };
        
        this.monitor.recordAISuggestion(mockDocument, mockChange);
        
        this.assert(
            this.monitor.aiSuggestions.length === 1,
            'Adds suggestion to array'
        );
        
        const suggestion = this.monitor.aiSuggestions[0];
        
        this.assert(
            suggestion.status === 'pending',
            'Initial status is pending'
        );
        
        this.assert(
            suggestion.reviewed === false,
            'Not reviewed initially'
        );
        
        this.assert(
            suggestion.reviewTime === 0,
            'Review time starts at 0'
        );
        
        this.assert(
            suggestion.userEdited === false,
            'Not edited initially'
        );
        
        this.assert(
            suggestion.editCount === 0,
            'Edit count starts at 0'
        );
    }
    
    // Test 4: Rolling Window
    testRollingWindow() {
        console.log('\n=== TEST 4: Rolling Window (Max 10) ===');
        
        this.monitor.aiSuggestions = [];
        const mockDocument = { uri: { toString: () => 'file:///test.js' } };
        
        // Add 15 suggestions
        for (let i = 0; i < 15; i++) {
            const mockChange = {
                range: { start: { line: i, character: 0 }, end: { line: i+1, character: 0 } },
                text: `function test${i}() { return ${i}; }`,
                rangeLength: 0
            };
            this.monitor.recordAISuggestion(mockDocument, mockChange);
        }
        
        this.assert(
            this.monitor.aiSuggestions.length === 10,
            'Keeps only 10 suggestions (evicts oldest 5)'
        );
        
        this.assert(
            this.monitor.aiSuggestions[0].text.includes('test5'),
            'First suggestion is #5 (oldest evicted)'
        );
        
        this.assert(
            this.monitor.aiSuggestions[9].text.includes('test14'),
            'Last suggestion is #14 (most recent)'
        );
    }
    
    // Test 5: Score Calculation with No Data
    testScoreWithNoData() {
        console.log('\n=== TEST 5: Score Calculation (Empty State) ===');
        
        this.monitor.aiSuggestions = [];
        this.monitor.updateScore();
        
        this.assert(
            this.monitor.currentScore === 0,
            'Score is 0 when no suggestions'
        );
        
        this.assert(
            this.monitor.scores.review === 0 &&
            this.monitor.scores.critical === 0 &&
            this.monitor.scores.adaptation === 0,
            'All component scores are 0'
        );
    }
    
    // Test 6: getScore() API
    testGetScoreAPI() {
        console.log('\n=== TEST 6: getScore() API ===');
        
        this.monitor.aiSuggestions = [
            { status: 'accepted', reviewed: true, reviewTime: 10000, editCount: 0 },
            { status: 'adapted', reviewed: true, reviewTime: 8000, editCount: 2 },
            { status: 'pending', reviewed: false, reviewTime: 0, editCount: 0 }
        ];
        
        const scoreData = this.monitor.getScore();
        
        this.assert(
            scoreData.hasOwnProperty('total'),
            'Returns total score'
        );
        
        this.assert(
            scoreData.hasOwnProperty('components'),
            'Returns component scores'
        );
        
        this.assert(
            scoreData.hasOwnProperty('suggestions'),
            'Returns suggestion breakdown'
        );
        
        this.assert(
            scoreData.suggestions.total === 3,
            'Counts total suggestions correctly'
        );
        
        this.assert(
            scoreData.suggestions.accepted === 1,
            'Counts accepted correctly'
        );
        
        this.assert(
            scoreData.suggestions.adapted === 1,
            'Counts adapted correctly'
        );
        
        this.assert(
            scoreData.suggestions.pending === 1,
            'Counts pending correctly'
        );
    }
    
    // Test 7: Position in Range
    testPositionInRange() {
        console.log('\n=== TEST 7: Position Detection ===');
        
        const range = {
            start: { line: 10, character: 4 },
            end: { line: 15, character: 10 }
        };
        
        // Inside range
        const pos1 = { line: 12, character: 5 };
        this.assert(
            this.monitor.isPositionInRange(pos1, range),
            'Detects position inside range'
        );
        
        // Before range
        const pos2 = { line: 5, character: 0 };
        this.assert(
            !this.monitor.isPositionInRange(pos2, range),
            'Detects position before range'
        );
        
        // After range
        const pos3 = { line: 20, character: 0 };
        this.assert(
            !this.monitor.isPositionInRange(pos3, range),
            'Detects position after range'
        );
        
        // On start line, before character
        const pos4 = { line: 10, character: 2 };
        this.assert(
            !this.monitor.isPositionInRange(pos4, range),
            'Detects position on start line but before character'
        );
        
        // On end line, after character
        const pos5 = { line: 15, character: 15 };
        this.assert(
            !this.monitor.isPositionInRange(pos5, range),
            'Detects position on end line but after character'
        );
    }
    
    // Test 8: Ranges Overlap
    testRangesOverlap() {
        console.log('\n=== TEST 8: Range Overlap Detection ===');
        
        const range1 = { start: { line: 10, character: 0 }, end: { line: 20, character: 0 } };
        const range2 = { start: { line: 15, character: 0 }, end: { line: 25, character: 0 } };
        const range3 = { start: { line: 30, character: 0 }, end: { line: 40, character: 0 } };
        
        this.assert(
            this.monitor.rangesOverlap(range1, range2),
            'Detects overlapping ranges (10-20 and 15-25)'
        );
        
        this.assert(
            !this.monitor.rangesOverlap(range1, range3),
            'Detects non-overlapping ranges (10-20 and 30-40)'
        );
        
        this.assert(
            this.monitor.rangesOverlap(range1, range1),
            'Same range overlaps with itself'
        );
    }
    
    printSummary() {
        console.log('\n╔═══════════════════════════════════════════════════╗');
        console.log('║              TEST SUMMARY                         ║');
        console.log('╚═══════════════════════════════════════════════════╝');
        console.log(`\n✅ Passed: ${this.passed}`);
        console.log(`❌ Failed: ${this.failed}`);
        console.log(`📊 Success Rate: ${Math.round((this.passed / (this.passed + this.failed)) * 100)}%\n`);
        
        if (this.failed === 0) {
            console.log('🎉 ALL TESTS PASSED! The awareness monitor is ready for production.\n');
        } else {
            console.log(`⚠️  ${this.failed} test(s) failed. Review implementation.\n`);
        }
    }
    
    runAll() {
        console.log('╔═══════════════════════════════════════════════════╗');
        console.log('║   AWARENESS MONITOR - INTEGRATION TESTS          ║');
        console.log('╚═══════════════════════════════════════════════════╝');
        
        this.testInitialization();
        this.testStartStop();
        this.testRecordSuggestion();
        this.testRollingWindow();
        this.testScoreWithNoData();
        this.testGetScoreAPI();
        this.testPositionInRange();
        this.testRangesOverlap();
        
        this.printSummary();
    }
}

// Run integration tests
const test = new IntegrationTest();
test.runAll();








