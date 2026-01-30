'use strict';

/**
 * 30 golden behavior scenarios with explicit expected subscores and meter.
 * Each scenario corresponds to real user/agent behaviors; failures are meaningful.
 * expected.scores: review (0-40), blindAcceptance (0-30), adaptation (0-30), debt (0-30).
 * expected.totalScoreRange: [min, max] for risk score 0-100 (EMA may vary slightly).
 * expected.meterSegments: 7-char string ▰/▱; meterEmoji: 🟢/🟡/🟠/🔴.
 */
const baseTs = 1000000;

function created(doc, size, ts, id, provenanceScore = 0.8) {
    return { type: 'suggestion_created', document: doc || 'file:///core.js', size: size || 200, timestamp: ts, suggestionId: id, provenanceScore };
}
function reviewed(id, reviewTime) {
    return { type: 'suggestion_reviewed', suggestionId: id, reviewTime: reviewTime || 6000 };
}
function status(id, s) {
    return { type: 'suggestion_status_changed', suggestionId: id, status: s };
}
function tick(ms) {
    return { type: 'tick', advanceMs: ms };
}
function debt(uri, size) {
    return { type: 'debt_added', fileUri: uri || 'file:///x.js', size: size || 100 };
}

const scenarios = [
    {
        name: 'empty_trace',
        description: 'No events; score should be zero',
        events: [],
        expected: {
            totalScoreRange: [0, 5],
            scores: { review: 0, blindAcceptance: 0, adaptation: 0, debt: 0 },
            meterEmoji: '🟢',
            exact: { totalScore: 0, scores: { review: 0, blindAcceptance: 0, adaptation: 0, debt: 0 } }
        }
    },
    {
        name: 'blind_accept_core_file',
        description: 'Single suggestion accepted without review on core file',
        events: [
            created('file:///src/core.js', 300, baseTs, 's1'),
            status('s1', 'accepted')
        ],
        expected: {
            totalScoreRange: [40, 100],
            scores: { blindAcceptance: [10, 30], debt: [0, 15] },
            exact: { totalScore: 45, scores: { review: 0, blindAcceptance: 26, adaptation: 0, debt: 0 } }
        }
    },
    {
        name: 'slow_careful_review_then_accept',
        description: 'User reviews thoroughly then accepts',
        events: [
            created('file:///src/core.js', 500, baseTs, 's1'),
            reviewed('s1', 12000),
            status('s1', 'accepted')
        ],
        expected: {
            totalScoreRange: [0, 45],
            scores: { review: [15, 40], blindAcceptance: [0, 15] },
            meterEmoji: '🟢',
            exact: { totalScore: 19, scores: { review: 40, blindAcceptance: 5, adaptation: 0, debt: 0 } }
        }
    },
    {
        name: 'reject_without_review',
        description: 'Suggestion rejected without review',
        events: [
            created('file:///f.js', 100, baseTs, 's1'),
            status('s1', 'rejected')
        ],
        expected: {
            totalScoreRange: [0, 50],
            scores: { review: [0, 20], blindAcceptance: [0, 15] },
            meterEmoji: '🟢',
            exact: { totalScore: 31, scores: { review: 0, blindAcceptance: 0, adaptation: 0, debt: 0 } }
        }
    },
    {
        name: 'adapted_after_review',
        description: 'User reviews and adapts the suggestion',
        events: [
            created('file:///f.js', 400, baseTs, 's1'),
            reviewed('s1', 8000),
            status('s1', 'adapted')
        ],
        expected: { totalScoreRange: [0, 50], scores: { review: [10, 40], adaptation: [10, 30] }, meterEmoji: '🟢' }
    },
    {
        name: 'pending_only',
        description: 'One suggestion left pending (debt risk)',
        events: [
            created('file:///f.js', 200, baseTs, 's1')
        ],
        expected: {
            totalScoreRange: [0, 60],
            scores: { debt: [0, 30] },
            exact: { totalScore: 12, scores: { review: 0, blindAcceptance: 0, adaptation: 0, debt: 1 } }
        }
    },
    {
        name: 'rapid_scattered_edits',
        description: 'Multiple small suggestions across files, mixed outcomes',
        events: [
            created('file:///f1.js', 50, baseTs, 's1'),
            status('s1', 'accepted'),
            created('file:///f2.js', 50, baseTs + 100, 's2'),
            status('s2', 'rejected'),
            created('file:///f3.js', 50, baseTs + 200, 's3'),
            status('s3', 'accepted')
        ],
        expected: { totalScoreRange: [25, 85], scores: { blindAcceptance: [5, 30] }, meterSegments: [3, 7] }
    },
    {
        name: 'checkpoint_restore_style',
        description: 'Burst of accepts then one careful review',
        events: [
            created('file:///a.js', 100, baseTs, 's1'),
            status('s1', 'accepted'),
            created('file:///b.js', 100, baseTs + 500, 's2'),
            status('s2', 'accepted'),
            created('file:///c.js', 300, baseTs + 1000, 's3'),
            reviewed('s3', 10000),
            status('s3', 'accepted')
        ],
        expected: { totalScoreRange: [20, 75], scores: { review: [5, 40], blindAcceptance: [5, 25] } }
    },
    {
        name: 'debt_added_unreviewed_file',
        description: 'File-level debt added (unreviewed changes)',
        events: [
            debt('file:///legacy.js', 500),
            created('file:///legacy.js', 200, baseTs, 's1')
        ],
        expected: { totalScoreRange: [0, 90], scores: { debt: [0, 30] } }
    },
    {
        name: 'find_issues_then_reject',
        description: 'User finds issues and rejects',
        events: [
            created('file:///src/handler.js', 600, baseTs, 's1'),
            reviewed('s1', 15000),
            status('s1', 'rejected')
        ],
        expected: {
            totalScoreRange: [0, 40],
            scores: { review: [20, 40] },
            meterEmoji: '🟢',
            exact: { totalScore: 16, scores: { review: 40, blindAcceptance: 0, adaptation: 0, debt: 0 } }
        }
    },
    {
        name: 'two_blind_accepts',
        description: 'Two suggestions accepted without review',
        events: [
            created('file:///x.js', 150, baseTs, 's1'),
            status('s1', 'accepted'),
            created('file:///x.js', 150, baseTs + 200, 's2'),
            status('s2', 'accepted')
        ],
        expected: {
            totalScoreRange: [40, 100],
            scores: { blindAcceptance: [15, 30] },
            exact: { totalScore: 61, scores: { review: 0, blindAcceptance: 26, adaptation: 0, debt: 0 } }
        }
    },
    {
        name: 'two_careful_reviews',
        description: 'Two suggestions both reviewed then accepted',
        events: [
            created('file:///x.js', 200, baseTs, 's1'),
            reviewed('s1', 8000),
            status('s1', 'accepted'),
            created('file:///x.js', 200, baseTs + 500, 's2'),
            reviewed('s2', 8000),
            status('s2', 'accepted')
        ],
        expected: {
            totalScoreRange: [0, 50],
            scores: { review: [20, 40] },
            meterEmoji: '🟢',
            exact: { totalScore: 23, scores: { review: 40, blindAcceptance: 5, adaptation: 0, debt: 0 } }
        }
    },
    {
        name: 'pending_plus_resolved',
        description: 'One pending, one accepted (mixed debt and blind)',
        events: [
            created('file:///f.js', 100, baseTs, 's1'),
            created('file:///f.js', 100, baseTs + 300, 's2'),
            status('s2', 'accepted')
        ],
        expected: { totalScoreRange: [25, 90], scores: { debt: [0, 30], blindAcceptance: [0, 30] } }
    },
    {
        name: 'large_batch_blind',
        description: 'Single large suggestion accepted without review',
        events: [
            created('file:///core.js', 2000, baseTs, 's1'),
            status('s1', 'accepted')
        ],
        expected: { totalScoreRange: [40, 100], scores: { blindAcceptance: [15, 30] } }
    },
    {
        name: 'large_batch_reviewed',
        description: 'Large suggestion reviewed then accepted',
        events: [
            created('file:///core.js', 2000, baseTs, 's1'),
            reviewed('s1', 30000),
            status('s1', 'accepted')
        ],
        expected: { totalScoreRange: [0, 45], scores: { review: [25, 40] }, meterEmoji: '🟢' }
    },
    {
        name: 'all_rejected',
        description: 'Three suggestions all rejected',
        events: [
            created('file:///a.js', 100, baseTs, 's1'),
            status('s1', 'rejected'),
            created('file:///b.js', 100, baseTs + 100, 's2'),
            status('s2', 'rejected'),
            created('file:///c.js', 100, baseTs + 200, 's3'),
            status('s3', 'rejected')
        ],
        expected: {
            totalScoreRange: [0, 60],
            scores: { blindAcceptance: [0, 20] },
            exact: { totalScore: 46, scores: { review: 0, blindAcceptance: 0, adaptation: 0, debt: 0 } }
        }
    },
    {
        name: 'all_adapted',
        description: 'Three suggestions all adapted after review',
        events: [
            created('file:///a.js', 200, baseTs, 's1'),
            reviewed('s1', 6000),
            status('s1', 'adapted'),
            created('file:///b.js', 200, baseTs + 200, 's2'),
            reviewed('s2', 6000),
            status('s2', 'adapted'),
            created('file:///c.js', 200, baseTs + 400, 's3'),
            reviewed('s3', 6000),
            status('s3', 'adapted')
        ],
        expected: {
            totalScoreRange: [0, 45],
            scores: { review: [15, 40], adaptation: [15, 30] },
            meterEmoji: '🟢',
            exact: { totalScore: 10, scores: { review: 40, adaptation: 15, blindAcceptance: 0, debt: 0 } }
        }
    },
    {
        name: 'time_decay_old_activity',
        description: 'Old suggestions only (outside recent window)',
        events: [
            created('file:///f.js', 200, baseTs - 60000, 's1'),
            status('s1', 'accepted'),
            tick(65000)
        ],
        expected: { totalScoreRange: [0, 60], scores: { review: [0, 40], blindAcceptance: [0, 30] } }
    },
    {
        name: 'recent_plus_old',
        description: 'One recent careful accept, one old blind accept',
        events: [
            created('file:///f.js', 200, baseTs - 60000, 's1'),
            status('s1', 'accepted'),
            created('file:///f.js', 200, baseTs, 's2'),
            reviewed('s2', 7000),
            status('s2', 'accepted'),
            tick(1000)
        ],
        expected: { totalScoreRange: [10, 70], scores: { review: [5, 40], blindAcceptance: [5, 30] } }
    },
    {
        name: 'single_pending_high_debt',
        description: 'One large pending suggestion (high debt)',
        events: [
            created('file:///critical.js', 800, baseTs, 's1')
        ],
        expected: { totalScoreRange: [0, 70], scores: { debt: [0, 30] } }
    },
    {
        name: 'file_write_suggestion',
        description: 'File write (full file) suggestion accepted',
        events: [
            { type: 'suggestion_created', document: 'file:///new.js', size: 500, timestamp: baseTs, suggestionId: 's1', isFileWrite: true, provenanceScore: 0.9 },
            status('s1', 'accepted')
        ],
        expected: { totalScoreRange: [40, 100], scores: { blindAcceptance: [10, 30] } }
    },
    {
        name: 'file_creation_suggestion',
        description: 'New file creation suggestion',
        events: [
            { type: 'suggestion_created', document: 'file:///new.js', size: 300, timestamp: baseTs, suggestionId: 's1', isFileCreation: true, provenanceScore: 0.85 },
            reviewed('s1', 5000),
            status('s1', 'accepted')
        ],
        expected: { totalScoreRange: [10, 60], scores: { review: [5, 40] } }
    },
    {
        name: 'low_provenance_accept',
        description: 'Low provenance score suggestion accepted',
        events: [
            created('file:///f.js', 100, baseTs, 's1', 0.3),
            status('s1', 'accepted')
        ],
        expected: { totalScoreRange: [30, 95], scores: { blindAcceptance: [0, 30] } }
    },
    {
        name: 'high_provenance_blind',
        description: 'High provenance (strong AI signal) accepted without review',
        events: [
            created('file:///f.js', 400, baseTs, 's1', 0.95),
            status('s1', 'accepted')
        ],
        expected: { totalScoreRange: [40, 100], scores: { blindAcceptance: [15, 30] } }
    },
    {
        name: 'mixed_three_outcomes',
        description: 'Accept, reject, adapt in sequence',
        events: [
            created('file:///f.js', 150, baseTs, 's1'),
            status('s1', 'accepted'),
            created('file:///f.js', 150, baseTs + 200, 's2'),
            status('s2', 'rejected'),
            created('file:///f.js', 150, baseTs + 400, 's3'),
            reviewed('s3', 5000),
            status('s3', 'adapted')
        ],
        expected: { totalScoreRange: [15, 65], scores: { review: [5, 25], adaptation: [5, 20], blindAcceptance: [5, 15] } }
    },
    {
        name: 'five_pending',
        description: 'Five suggestions all left pending',
        events: [
            created('file:///f1.js', 100, baseTs, 's1'),
            created('file:///f2.js', 100, baseTs + 100, 's2'),
            created('file:///f3.js', 100, baseTs + 200, 's3'),
            created('file:///f4.js', 100, baseTs + 300, 's4'),
            created('file:///f5.js', 100, baseTs + 400, 's5')
        ],
        expected: { totalScoreRange: [0, 95], scores: { debt: [0, 30] } }
    },
    {
        name: 'debt_cleared_style',
        description: 'Debt added then suggestion resolved (reduces debt)',
        events: [
            debt('file:///old.js', 300),
            created('file:///old.js', 300, baseTs, 's1'),
            reviewed('s1', 8000),
            status('s1', 'accepted')
        ],
        expected: { totalScoreRange: [10, 60], scores: { review: [10, 40], debt: [0, 20] } }
    },
    {
        name: 'minimal_review_time',
        description: 'Reviewed but minimal time (borderline effective review)',
        events: [
            created('file:///f.js', 300, baseTs, 's1'),
            reviewed('s1', 5000),
            status('s1', 'accepted')
        ],
        expected: { totalScoreRange: [10, 70], scores: { review: [5, 40], blindAcceptance: [0, 20] } }
    },
    {
        name: 'deep_review_small_change',
        description: 'Small change with long review time (depth)',
        events: [
            created('file:///f.js', 100, baseTs, 's1'),
            reviewed('s1', 15000),
            status('s1', 'accepted')
        ],
        expected: { totalScoreRange: [0, 40], scores: { review: [15, 40] }, meterEmoji: '🟢' }
    },
    {
        name: 'scatter_files',
        description: 'Suggestions across many files',
        events: [
            created('file:///a.js', 50, baseTs, 's1'),
            created('file:///b.js', 50, baseTs + 50, 's2'),
            created('file:///c.js', 50, baseTs + 100, 's3'),
            created('file:///d.js', 50, baseTs + 150, 's4'),
            status('s1', 'accepted'),
            status('s2', 'rejected'),
            status('s3', 'accepted'),
            status('s4', 'pending')
        ],
        expected: { totalScoreRange: [25, 95], scores: { debt: [0, 30], blindAcceptance: [0, 25] } }
    },
];

module.exports = { scenarios, baseTs };
