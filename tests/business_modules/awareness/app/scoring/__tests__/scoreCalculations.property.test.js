/**
 * Property-based / Fuzz Tests
 * 
 * Tests invariants and robustness with random inputs using fast-check.
 * Catches future drift when formulas change.
 */

const fc = require('fast-check');
const {
    calculateReviewScore,
    calculateBlindAcceptanceScore,
    calculateAdaptationScore,
    calculateRiskBasedDebtScore,
    SCORING_CONSTANTS
} = require('../../../../../../business_modules/awareness/app/scoring/scoreCalculations');
const FileDebt = require('../../../../../../business_modules/awareness/domain/entities/fileDebt');
const mkSuggestion = require('../../../../../helpers/mkSuggestion');

describe('Property-based / Fuzz Tests', () => {
    describe('Invariants (must always hold)', () => {
        test('all calculators return finite numbers for any input', () => {
            fc.assert(fc.property(
                fc.array(fc.record({
                    reviewed: fc.boolean(),
                    reviewTime: fc.nat(),
                    size: fc.nat(),
                    status: fc.constantFrom('pending', 'accepted', 'rejected', 'adapted'),
                    editCount: fc.nat(),
                    timestamp: fc.nat(),
                    rangeCount: fc.nat(),
                    provenanceScore: fc.float({ min: 0, max: 1 })
                })),
                (suggestions) => {
                    const reviewScore = calculateReviewScore(suggestions);
                    const blindScore = calculateBlindAcceptanceScore(suggestions);
                    const adaptScore = calculateAdaptationScore(suggestions);

                    expect(Number.isFinite(reviewScore)).toBe(true);
                    expect(Number.isFinite(blindScore)).toBe(true);
                    expect(Number.isFinite(adaptScore)).toBe(true);
                    expect(Number.isNaN(reviewScore)).toBe(false);
                    expect(Number.isNaN(blindScore)).toBe(false);
                    expect(Number.isNaN(adaptScore)).toBe(false);
                }
            ));
        });

        test('all calculators return values within expected ranges', () => {
            fc.assert(fc.property(
                fc.array(fc.record({
                    reviewed: fc.boolean(),
                    reviewTime: fc.nat(),
                    size: fc.nat(),
                    status: fc.constantFrom('pending', 'accepted', 'rejected', 'adapted'),
                    editCount: fc.nat(),
                    timestamp: fc.nat(),
                    rangeCount: fc.nat(),
                    provenanceScore: fc.float({ min: 0, max: 1 })
                })),
                (suggestions) => {
                    const reviewScore = calculateReviewScore(suggestions);
                    const blindScore = calculateBlindAcceptanceScore(suggestions);
                    const adaptScore = calculateAdaptationScore(suggestions);

                    expect(reviewScore).toBeGreaterThanOrEqual(0);
                    expect(reviewScore).toBeLessThanOrEqual(40);
                    expect(blindScore).toBeGreaterThanOrEqual(0);
                    expect(blindScore).toBeLessThanOrEqual(30);
                    expect(adaptScore).toBeGreaterThanOrEqual(0);
                    expect(adaptScore).toBeLessThanOrEqual(30);
                }
            ));
        });

        test('empty input always returns 0', () => {
            expect(calculateReviewScore([])).toBe(0);
            expect(calculateBlindAcceptanceScore([])).toBe(0);
            expect(calculateAdaptationScore([])).toBe(0);
        });
    });

    describe('Monotonicity Properties', () => {
        test('more blind accepts → higher blind acceptance risk', () => {
            fc.assert(fc.property(
                fc.array(fc.record({
                    reviewed: fc.boolean(),
                    reviewTime: fc.nat(),
                    size: fc.nat(),
                    status: fc.constantFrom('accepted', 'rejected', 'adapted'),
                    timestamp: fc.nat()
                }), { minLength: 1, maxLength: 10 }),
                (baseSuggestions) => {
                    // Create base set
                    const baseRisk = calculateBlindAcceptanceScore(baseSuggestions);

                    // Add one more blind accept
                    const withBlindAccept = [
                        ...baseSuggestions,
                        { ...baseSuggestions[0], reviewed: false, reviewTime: 0, status: 'accepted' }
                    ];
                    const newRisk = calculateBlindAcceptanceScore(withBlindAccept);

                    // Risk should not decrease
                    expect(newRisk).toBeGreaterThanOrEqual(baseRisk);
                }
            ));
        });

        test('converting blind accept to careful accept decreases risk', () => {
            fc.assert(fc.property(
                fc.array(fc.record({
                    reviewed: fc.boolean(),
                    reviewTime: fc.nat(),
                    size: fc.nat({ min: 200 }), // Ensure MIN_REVIEWED_SIZE
                    status: fc.constant('accepted'),
                    timestamp: fc.nat()
                }), { minLength: 1, maxLength: 5 }),
                (suggestions) => {
                    // All blind accepts
                    const blindSuggestions = suggestions.map(s => ({
                        ...s,
                        reviewed: false,
                        reviewTime: 0
                    }));
                    const blindRisk = calculateBlindAcceptanceScore(blindSuggestions);

                    // Convert one to careful accept
                    const carefulSuggestions = [
                        { ...blindSuggestions[0], reviewed: true, reviewTime: 6000 },
                        ...blindSuggestions.slice(1)
                    ];
                    const carefulRisk = calculateBlindAcceptanceScore(carefulSuggestions);

                    // Risk should decrease
                    expect(carefulRisk).toBeLessThanOrEqual(blindRisk);
                }
            ));
        });
    });

    describe('Edge Case Robustness', () => {
        test('handles extreme values without crashing', () => {
            const extremeSuggestions = [
                {
                    reviewed: true,
                    reviewTime: Number.MAX_SAFE_INTEGER,
                    size: Number.MAX_SAFE_INTEGER,
                    status: 'accepted',
                    timestamp: Date.now()
                },
                {
                    reviewed: false,
                    reviewTime: 0,
                    size: 0,
                    status: 'pending',
                    timestamp: 0
                },
                {
                    reviewed: undefined,
                    reviewTime: undefined,
                    size: undefined,
                    status: 'accepted',
                    timestamp: undefined
                }
            ];

            expect(() => {
                calculateReviewScore(extremeSuggestions);
                calculateBlindAcceptanceScore(extremeSuggestions);
                calculateAdaptationScore(extremeSuggestions);
            }).not.toThrow();
        });

        test('handles null/undefined fields gracefully', () => {
            fc.assert(fc.property(
                fc.array(fc.record({
                    reviewed: fc.oneof(fc.boolean(), fc.constant(undefined), fc.constant(null)),
                    reviewTime: fc.oneof(fc.nat(), fc.constant(undefined), fc.constant(null)),
                    size: fc.oneof(fc.nat(), fc.constant(undefined), fc.constant(null)),
                    status: fc.constantFrom('pending', 'accepted', 'rejected', 'adapted'),
                    editCount: fc.oneof(fc.nat(), fc.constant(undefined), fc.constant(null)),
                    timestamp: fc.oneof(fc.nat(), fc.constant(undefined), fc.constant(null))
                })),
                (suggestions) => {
                    expect(() => {
                        calculateReviewScore(suggestions);
                        calculateBlindAcceptanceScore(suggestions);
                        calculateAdaptationScore(suggestions);
                    }).not.toThrow();
                }
            ));
        });
    });

    describe('Debt Risk Properties', () => {
        test('older debt contributes more (age monotonicity)', () => {
            fc.assert(fc.property(
                fc.nat({ max: 1000 }),
                fc.nat({ max: 1000 }),
                (age1Hours, age2Hours) => {
                    if (age1Hours >= age2Hours) {
                        const now = Date.now();
                        const fileDebts1 = new Map([
                            ['file:///test.js', new FileDebt('file:///test.js', {
                                modifiedAt: now - (age1Hours * 60 * 60 * 1000),
                                totalChanges: 1000
                            })]
                        ]);
                        const score1 = calculateRiskBasedDebtScore(fileDebts1, [], {
                            getFileCriticality: () => 1.0
                        });

                        const fileDebts2 = new Map([
                            ['file:///test.js', new FileDebt('file:///test.js', {
                                modifiedAt: now - (age2Hours * 60 * 60 * 1000),
                                totalChanges: 1000
                            })]
                        ]);
                        const score2 = calculateRiskBasedDebtScore(fileDebts2, [], {
                            getFileCriticality: () => 1.0
                        });

                        // Older debt should contribute more (or equal)
                        expect(score1).toBeGreaterThanOrEqual(score2);
                    }
                }
            ));
        });
    });
});
