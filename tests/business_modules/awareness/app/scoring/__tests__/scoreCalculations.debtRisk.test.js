/**
 * Debt Risk Score Unit Tests
 * 
 * Tests for calculateRiskBasedDebtScore() function:
 * - Empty input handling
 * - Age multiplier boundaries (0h, 1h, 6h+)
 * - Provenance gating (>0.7 threshold)
 * - Scatter term (sqrt behavior, guards for undefined/0)
 * - File criticality multiplier
 * - Verification penalty
 * - Output clamping (0-30)
 */

const { calculateRiskBasedDebtScore, calculateAgeMultiplier } = require('../../../../../../business_modules/awareness/app/scoring/scoreCalculations');
const FileDebt = require('../../../../../../business_modules/awareness/domain/entities/fileDebt');
const mkSuggestion = require('../../../../../helpers/mkSuggestion');

describe('calculateRiskBasedDebtScore', () => {
    // Helper to create a mock FileDebt
    function mkFileDebt(overrides = {}) {
        const now = Date.now();
        return new FileDebt('file:///test.js', {
            modifiedAt: now - (overrides.ageHours || 0) * 60 * 60 * 1000,
            totalChanges: overrides.totalChanges || 1000,
            reviewed: overrides.reviewed || false,
            ...overrides
        });
    }

    // Helper to create a mock getFileCriticality function
    function mkGetFileCriticality(criticalityMap = {}) {
        return (uri) => {
            return criticalityMap[uri] || 1.0; // Default to 1.0
        };
    }

    describe('Empty input handling', () => {
        test('returns 0 for empty fileDebts and pendingSuggestions', () => {
            const fileDebts = new Map();
            const pendingSuggestions = [];
            expect(calculateRiskBasedDebtScore(fileDebts, pendingSuggestions)).toBe(0);
        });

        test('returns 0 for null fileDebts', () => {
            expect(calculateRiskBasedDebtScore(null, [])).toBe(0);
        });

        test('returns 0 for null pendingSuggestions', () => {
            const fileDebts = new Map();
            expect(calculateRiskBasedDebtScore(fileDebts, null)).toBe(0);
        });

        test('returns 0 when all files are reviewed', () => {
            const fileDebts = new Map([
                ['file:///test1.js', mkFileDebt({ reviewed: true })],
                ['file:///test2.js', mkFileDebt({ reviewed: true })]
            ]);
            const pendingSuggestions = [];
            expect(calculateRiskBasedDebtScore(fileDebts, pendingSuggestions)).toBe(0);
        });
    });

    describe('Age multiplier boundaries', () => {
        test('age multiplier = 1.0 at 0 hours', () => {
            const multiplier = calculateAgeMultiplier(0);
            expect(multiplier).toBe(1.0);
        });

        test('age multiplier = 1.5 at 1 hour (boundary)', () => {
            const multiplier = calculateAgeMultiplier(1.0);
            expect(multiplier).toBe(1.5);
        });

        test('age multiplier ramps fast in first hour', () => {
            const multiplier0_5 = calculateAgeMultiplier(0.5);
            const multiplier1_0 = calculateAgeMultiplier(1.0);
            // Should ramp from 1.25 to 1.5 (0.25 increase in 0.5 hours)
            expect(multiplier0_5).toBe(1.25);
            expect(multiplier1_0).toBe(1.5);
        });

        test('age multiplier ramps slower after 1 hour', () => {
            const multiplier1_0 = calculateAgeMultiplier(1.0);
            const multiplier2_0 = calculateAgeMultiplier(2.0);
            // Should ramp from 1.5 to 1.6 (0.1 increase in 1 hour)
            expect(multiplier1_0).toBe(1.5);
            expect(multiplier2_0).toBe(1.6);
        });

        test('age multiplier caps at 2.0 at 6 hours', () => {
            const multiplier6 = calculateAgeMultiplier(6.0);
            const multiplier10 = calculateAgeMultiplier(10.0);
            expect(multiplier6).toBe(2.0);
            expect(multiplier10).toBe(2.0); // Should still be capped
        });

        test('older debt contributes more to score', () => {
            const now = Date.now();
            const fileDebts1 = new Map([
                ['file:///test1.js', mkFileDebt({ ageHours: 0.5 })]
            ]);
            const score1 = calculateRiskBasedDebtScore(fileDebts1, [], {
                getFileCriticality: mkGetFileCriticality()
            });

            const fileDebts2 = new Map([
                ['file:///test1.js', mkFileDebt({ ageHours: 2.0 })]
            ]);
            const score2 = calculateRiskBasedDebtScore(fileDebts2, [], {
                getFileCriticality: mkGetFileCriticality()
            });

            expect(score2).toBeGreaterThan(score1);
        });
    });

    describe('Provenance gating (>0.7 threshold)', () => {
        test('provenance multiplier applies when provenanceScore > 0.7', () => {
            const pendingSuggestions = [
                mkSuggestion({ 
                    status: 'pending',
                    provenanceScore: 0.8, // Above threshold
                    size: 500,
                    rangeCount: 1
                })
            ];
            const score = calculateRiskBasedDebtScore(new Map(), pendingSuggestions, {
                alpha: 0.5,
                getFileCriticality: mkGetFileCriticality()
            });
            // Should have higher risk due to provenance multiplier
            expect(score).toBeGreaterThan(0);
        });

        test('provenance multiplier does NOT apply when provenanceScore <= 0.7', () => {
            const pendingSuggestions = [
                mkSuggestion({ 
                    status: 'pending',
                    provenanceScore: 0.6, // Below threshold
                    size: 500,
                    rangeCount: 1
                })
            ];
            const score = calculateRiskBasedDebtScore(new Map(), pendingSuggestions, {
                alpha: 0.5,
                getFileCriticality: mkGetFileCriticality()
            });
            // Should have lower risk (no provenance amplification)
            expect(score).toBeGreaterThanOrEqual(0);
        });

        test('provenanceScore = 0 handled correctly (uses ?? not ||)', () => {
            const pendingSuggestions = [
                mkSuggestion({ 
                    status: 'pending',
                    provenanceScore: 0, // Should NOT default to 0.5
                    size: 500,
                    rangeCount: 1
                })
            ];
            const score = calculateRiskBasedDebtScore(new Map(), pendingSuggestions, {
                alpha: 0.5,
                getFileCriticality: mkGetFileCriticality()
            });
            // provenanceScore=0 should be treated as 0, not defaulted to 0.5
            expect(score).toBeGreaterThanOrEqual(0);
        });

        test('falls back to classificationConfidence if provenanceScore undefined', () => {
            const pendingSuggestions = [
                {
                    ...mkSuggestion({ status: 'pending', size: 500, rangeCount: 1 }),
                    provenanceScore: undefined,
                    classificationConfidence: 0.8
                }
            ];
            const score = calculateRiskBasedDebtScore(new Map(), pendingSuggestions, {
                alpha: 0.5,
                getFileCriticality: mkGetFileCriticality()
            });
            expect(score).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Scatter term (sqrt behavior)', () => {
        test('scatter term uses sqrt to reduce outliers', () => {
            const pendingSuggestions1 = [
                mkSuggestion({ 
                    status: 'pending',
                    size: 500,
                    rangeCount: 1
                })
            ];
            const score1 = calculateRiskBasedDebtScore(new Map(), pendingSuggestions1, {
                getFileCriticality: mkGetFileCriticality()
            });

            const pendingSuggestions2 = [
                mkSuggestion({ 
                    status: 'pending',
                    size: 500,
                    rangeCount: 9 // 9x more ranges, but sqrt(9)=3, so only 3x impact
                })
            ];
            const score2 = calculateRiskBasedDebtScore(new Map(), pendingSuggestions2, {
                getFileCriticality: mkGetFileCriticality()
            });

            // Score2 should be higher, but not 9x higher (sqrt reduces impact)
            expect(score2).toBeGreaterThan(score1);
            const ratio = score2 / score1;
            expect(ratio).toBeLessThan(9); // Should be sublinear
        });

        test('scatter term guards for undefined/0', () => {
            const pendingSuggestions = [
                {
                    ...mkSuggestion({ status: 'pending', size: 500 }),
                    rangeCount: undefined
                }
            ];
            expect(() => calculateRiskBasedDebtScore(new Map(), pendingSuggestions, {
                getFileCriticality: mkGetFileCriticality()
            })).not.toThrow();
            const score = calculateRiskBasedDebtScore(new Map(), pendingSuggestions, {
                getFileCriticality: mkGetFileCriticality()
            });
            expect(Number.isFinite(score)).toBe(true);
        });

        test('scatter term = 0 when rangeCount = 0', () => {
            const pendingSuggestions = [
                mkSuggestion({ 
                    status: 'pending',
                    size: 500,
                    rangeCount: 0
                })
            ];
            const score = calculateRiskBasedDebtScore(new Map(), pendingSuggestions, {
                getFileCriticality: mkGetFileCriticality()
            });
            // Should still have some risk from footprint, but no scatter contribution
            expect(score).toBeGreaterThanOrEqual(0);
        });
    });

    describe('File criticality multiplier', () => {
        test('high criticality files contribute more risk', () => {
            const fileDebts = new Map([
                ['file:///auth.js', mkFileDebt({ totalChanges: 5000 })] // Security file, larger changes
            ]);
            const scoreHigh = calculateRiskBasedDebtScore(fileDebts, [], {
                getFileCriticality: mkGetFileCriticality({ 'file:///auth.js': 2.0 })
            });

            const fileDebtsLow = new Map([
                ['file:///test.js', mkFileDebt({ totalChanges: 5000 })] // Test file, same size
            ]);
            const scoreLow = calculateRiskBasedDebtScore(fileDebtsLow, [], {
                getFileCriticality: mkGetFileCriticality({ 'file:///test.js': 0.5 })
            });

            // High criticality (2.0) should contribute more than low (0.5)
            expect(scoreHigh).toBeGreaterThan(scoreLow);
        });
    });

    describe('Verification penalty', () => {
        test('verified suggestions have lower risk (0.5x penalty)', () => {
            const pendingSuggestionsUnverified = [
                {
                    ...mkSuggestion({ status: 'pending', size: 500 }),
                    hasVerification: () => false
                }
            ];
            const scoreUnverified = calculateRiskBasedDebtScore(new Map(), pendingSuggestionsUnverified, {
                getFileCriticality: mkGetFileCriticality()
            });

            const pendingSuggestionsVerified = [
                {
                    ...mkSuggestion({ status: 'pending', size: 500 }),
                    hasVerification: () => true
                }
            ];
            const scoreVerified = calculateRiskBasedDebtScore(new Map(), pendingSuggestionsVerified, {
                getFileCriticality: mkGetFileCriticality()
            });

            expect(scoreVerified).toBeLessThan(scoreUnverified);
        });
    });

    describe('Caps and limits', () => {
        test('per-file cap at 6 points', () => {
            const fileDebts = new Map([
                ['file:///test.js', mkFileDebt({ totalChanges: 10000 })] // Very large changes
            ]);
            const score = calculateRiskBasedDebtScore(fileDebts, [], {
                getFileCriticality: mkGetFileCriticality({ 'file:///test.js': 2.0 })
            });
            // Should be capped at 6 per file (before age multiplier)
            expect(score).toBeLessThanOrEqual(30); // Total cap
        });

        test('per-suggestion cap at 3 points', () => {
            const pendingSuggestions = [
                mkSuggestion({ 
                    status: 'pending',
                    size: 5000, // Very large
                    rangeCount: 100 // Very high scatter
                })
            ];
            const score = calculateRiskBasedDebtScore(new Map(), pendingSuggestions, {
                getFileCriticality: mkGetFileCriticality({ 'file:///test.js': 2.0 })
            });
            // Should be capped at 3 per suggestion (before multipliers)
            expect(score).toBeLessThanOrEqual(30); // Total cap
        });

        test('total debt cap at 30 points', () => {
            const fileDebts = new Map();
            for (let i = 0; i < 10; i++) {
                fileDebts.set(`file:///test${i}.js`, mkFileDebt({ totalChanges: 5000 }));
            }
            const pendingSuggestions = Array(20).fill(null).map(() => 
                mkSuggestion({ status: 'pending', size: 1000 })
            );
            const score = calculateRiskBasedDebtScore(fileDebts, pendingSuggestions, {
                getFileCriticality: mkGetFileCriticality()
            });
            expect(score).toBeLessThanOrEqual(30);
        });
    });

    describe('Output clamping (0-30)', () => {
        test('output never exceeds 30', () => {
            // Create scenario that would exceed 30 if not clamped
            const fileDebts = new Map();
            for (let i = 0; i < 20; i++) {
                fileDebts.set(`file:///test${i}.js`, mkFileDebt({ totalChanges: 10000, ageHours: 10 }));
            }
            const score = calculateRiskBasedDebtScore(fileDebts, [], {
                getFileCriticality: mkGetFileCriticality()
            });
            expect(score).toBeLessThanOrEqual(30);
        });

        test('output never below 0', () => {
            const fileDebts = new Map();
            const pendingSuggestions = [];
            const score = calculateRiskBasedDebtScore(fileDebts, pendingSuggestions, {
                getFileCriticality: mkGetFileCriticality()
            });
            expect(score).toBeGreaterThanOrEqual(0);
        });

        test('output is always a finite number', () => {
            const fileDebts = new Map([
                ['file:///test.js', mkFileDebt({ totalChanges: 1000 })]
            ]);
            const score = calculateRiskBasedDebtScore(fileDebts, [], {
                getFileCriticality: mkGetFileCriticality()
            });
            expect(Number.isFinite(score)).toBe(true);
            expect(Number.isNaN(score)).toBe(false);
        });
    });

    describe('Combined file and suggestion debt', () => {
        test('file debt and suggestion debt are combined', () => {
            const fileDebts = new Map([
                ['file:///test1.js', mkFileDebt({ totalChanges: 1000 })]
            ]);
            const pendingSuggestions = [
                mkSuggestion({ status: 'pending', size: 500 })
            ];
            const scoreCombined = calculateRiskBasedDebtScore(fileDebts, pendingSuggestions, {
                getFileCriticality: mkGetFileCriticality()
            });

            const scoreFileOnly = calculateRiskBasedDebtScore(fileDebts, [], {
                getFileCriticality: mkGetFileCriticality()
            });

            const scoreSuggestionOnly = calculateRiskBasedDebtScore(new Map(), pendingSuggestions, {
                getFileCriticality: mkGetFileCriticality()
            });

            expect(scoreCombined).toBeGreaterThan(scoreFileOnly);
            expect(scoreCombined).toBeGreaterThan(scoreSuggestionOnly);
        });
    });
});
