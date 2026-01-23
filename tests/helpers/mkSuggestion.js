/**
 * Test Helper: Create a suggestion with sensible defaults
 */

function mkSuggestion(overrides = {}) {
    const now = Date.now();
    return {
        id: `test-${Math.random().toString(36).substr(2, 9)}`,
        document: 'file:///test.js',
        range: { 
            start: { line: 0, character: 0 }, 
            end: { line: 1, character: 0 } 
        },
        text: 'test code',
        size: 100,
        status: 'pending',
        reviewed: false,
        reviewTime: 0,
        editCount: 0,
        timestamp: now,
        rangeCount: 1,
        provenanceScore: 0.8,
        classificationConfidence: 0.7,
        userEdited: false,
        ...overrides
    };
}

module.exports = mkSuggestion;
