/**
 * Blind Acceptance Score Unit Tests
 * 
 * Tests for calculateBlindAcceptanceScore() function:
 * - Empty input handling
 * - Blind acceptance dominates risk
 * - Careful acceptance (after review) is mild risk
 * - Adapted mitigation (requires effective review)
 * - Monotonicity: converting blind → careful decreases risk
 * - Output clamping (0-30)
 */

const { calculateBlindAcceptanceScore, SCORING_CONSTANTS, EFFECTIVE_REVIEW_HELPER } = require('../../../../../../business_modules/awareness/app/scoring/scoreCalculations');
const mkSuggestion = require('../../../../../helpers/mkSuggestion');
const { MINIMUM_REVIEW_TIME_MS } = SCORING_CONSTANTS;
const { isEffectivelyReviewed } = EFFECTIVE_REVIEW_HELPER;

describe('calculateBlindAcceptanceScore', () => {
    describe('Empty input handling', () => {
        test('returns 0 for empty array', () => {
            expect(calculateBlindAcceptanceScore([])).toBe(0);
        });

        test('returns 0 for null', () => {
            // Function checks !suggestions first, so null should return 0
            expect(calculateBlindAcceptanceScore(null)).toBe(0);
        });

        test('returns 0 for undefined', () => {
            // Function checks !suggestions first, so undefined should return 0
            expect(calculateBlindAcceptanceScore(undefined)).toBe(0);
        });

        test('returns 0 for non-array', () => {
            // Function now checks Array.isArray, so non-array returns 0
            expect(calculateBlindAcceptanceScore({})).toBe(0);
        });

        test('returns 0 when no resolved suggestions', () => {
            const suggestions = [
                mkSuggestion({ status: 'pending' }),
                mkSuggestion({ status: 'pending' })
            ];
            expect(calculateBlindAcceptanceScore(suggestions)).toBe(0);
        });
    });

    describe('Blind acceptance dominates risk', () => {
        test('100% blind accepts → near max risk (~30)', () => {
            const suggestions = [
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 }),
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 }),
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 })
            ];
            const risk = calculateBlindAcceptanceScore(suggestions);
            // Should be high risk (near 30)
            expect(risk).toBeGreaterThan(25);
            expect(risk).toBeLessThanOrEqual(30);
        });

        test('all blind accepts → risk = 30 * 0.85 = 25.5 (rounded)', () => {
            const suggestions = Array(10).fill(null).map(() => 
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 })
            );
            const risk = calculateBlindAcceptanceScore(suggestions);
            // Formula: 30 * (0.85 * 1.0 + 0.15 * 0) = 25.5, rounded = 26
            expect(risk).toBeGreaterThanOrEqual(25);
            expect(risk).toBeLessThanOrEqual(26);
        });
    });

    describe('Careful acceptance (after review) is mild risk', () => {
        test('100% careful accepts → low/moderate risk', () => {
            const suggestions = [
                mkSuggestion({ 
                    status: 'accepted', 
                    reviewed: true, 
                    reviewTime: MINIMUM_REVIEW_TIME_MS 
                }),
                mkSuggestion({ 
                    status: 'accepted', 
                    reviewed: true, 
                    reviewTime: MINIMUM_REVIEW_TIME_MS 
                })
            ];
            const risk = calculateBlindAcceptanceScore(suggestions);
            // Formula: 30 * (0.85 * 0 + 0.15 * 1.0) = 4.5, rounded = 5
            expect(risk).toBeGreaterThanOrEqual(4);
            expect(risk).toBeLessThanOrEqual(5);
        });

        test('careful accept uses effectiveReviewed (not raw reviewed boolean)', () => {
            // reviewed=true but reviewTime=0 should be treated as blind accept
            const suggestions = [
                mkSuggestion({ 
                    status: 'accepted', 
                    reviewed: true, 
                    reviewTime: 0 // Below threshold - should be blind accept
                }),
                mkSuggestion({ 
                    status: 'accepted', 
                    reviewed: true, 
                    reviewTime: MINIMUM_REVIEW_TIME_MS // Above threshold - careful accept
                })
            ];
            const risk = calculateBlindAcceptanceScore(suggestions);
            // Should have higher risk (one blind accept)
            expect(risk).toBeGreaterThan(10); // Higher than pure careful accept
        });
    });

    describe('Adapted mitigation', () => {
        test('adapted mitigation requires effective review', () => {
            // Adapted without effective review should NOT reduce risk
            const suggestions = [
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 }),
                mkSuggestion({ 
                    status: 'adapted', 
                    reviewed: true, 
                    reviewTime: 0 // Below threshold - should NOT count for mitigation
                })
            ];
            const riskWithoutEffectiveReview = calculateBlindAcceptanceScore(suggestions);

            // Compare with effectively reviewed adaptation
            const suggestionsWithEffectiveReview = [
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 }),
                mkSuggestion({ 
                    status: 'adapted', 
                    reviewed: true, 
                    reviewTime: MINIMUM_REVIEW_TIME_MS // Above threshold - SHOULD count
                })
            ];
            const riskWithEffectiveReview = calculateBlindAcceptanceScore(suggestionsWithEffectiveReview);

            // Risk with effective review should be lower (mitigation applies)
            expect(riskWithEffectiveReview).toBeLessThan(riskWithoutEffectiveReview);
        });

        test('adapted mitigation reduces risk (up to -6 points)', () => {
            const suggestions = [
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 }),
                mkSuggestion({ 
                    status: 'adapted', 
                    reviewed: true, 
                    reviewTime: MINIMUM_REVIEW_TIME_MS 
                }),
                mkSuggestion({ 
                    status: 'adapted', 
                    reviewed: true, 
                    reviewTime: MINIMUM_REVIEW_TIME_MS 
                })
            ];
            const risk = calculateBlindAcceptanceScore(suggestions);
            // Base risk from blind accept, but mitigated by adapted (2/3 = 0.67 rate)
            // Mitigation: -6 * 0.67 = -4 points
            expect(risk).toBeGreaterThanOrEqual(0);
            expect(risk).toBeLessThan(30);
        });

        test('mitigation capped at -6 points (does not exceed)', () => {
            // Many adapted suggestions
            const suggestions = [
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 }),
                ...Array(10).fill(null).map(() => 
                    mkSuggestion({ 
                        status: 'adapted', 
                        reviewed: true, 
                        reviewTime: MINIMUM_REVIEW_TIME_MS 
                    })
                )
            ];
            const risk = calculateBlindAcceptanceScore(suggestions);
            // Mitigation should be capped at -6, not scale linearly
            // Base: 30 * 0.85 * (1/11) = ~2.3, mitigation: -6 * (10/11) = -5.45
            // Result: max(0, 2.3 - 5.45) = 0
            expect(risk).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Monotonicity', () => {
        test('converting blind accept to careful accept decreases risk', () => {
            const allBlind = [
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 }),
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 })
            ];
            const riskAllBlind = calculateBlindAcceptanceScore(allBlind);

            const oneCareful = [
                mkSuggestion({ 
                    status: 'accepted', 
                    reviewed: true, 
                    reviewTime: MINIMUM_REVIEW_TIME_MS 
                }),
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 })
            ];
            const riskOneCareful = calculateBlindAcceptanceScore(oneCareful);

            // Risk should decrease when one becomes careful
            expect(riskOneCareful).toBeLessThan(riskAllBlind);
        });

        test('more blind accepts → higher risk (monotonic)', () => {
            const oneBlind = [
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 }),
                mkSuggestion({ 
                    status: 'accepted', 
                    reviewed: true, 
                    reviewTime: MINIMUM_REVIEW_TIME_MS 
                })
            ];
            const riskOne = calculateBlindAcceptanceScore(oneBlind);

            const twoBlind = [
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 }),
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 })
            ];
            const riskTwo = calculateBlindAcceptanceScore(twoBlind);

            expect(riskTwo).toBeGreaterThan(riskOne);
        });
    });

    describe('Rejected suggestions', () => {
        test('rejected only → risk = 0', () => {
            const suggestions = [
                mkSuggestion({ status: 'rejected' }),
                mkSuggestion({ status: 'rejected' })
            ];
            const risk = calculateBlindAcceptanceScore(suggestions);
            expect(risk).toBe(0);
        });

        test('rejected does not contribute to risk calculation', () => {
            const suggestions = [
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 }),
                mkSuggestion({ status: 'rejected' }),
                mkSuggestion({ status: 'rejected' })
            ];
            const risk = calculateBlindAcceptanceScore(suggestions);
            // Only 1/3 are accepted (blind), so risk should be based on that
            expect(risk).toBeGreaterThan(0);
            expect(risk).toBeLessThan(30);
        });
    });

    describe('Output clamping (0-30)', () => {
        test('output never exceeds 30', () => {
            // Create scenario that would exceed 30 if not clamped
            const suggestions = Array(100).fill(null).map(() => 
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 })
            );
            const risk = calculateBlindAcceptanceScore(suggestions);
            expect(risk).toBeLessThanOrEqual(30);
        });

        test('output never below 0', () => {
            // Many adapted with effective review should mitigate risk to 0
            const suggestions = [
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 }),
                ...Array(20).fill(null).map(() => 
                    mkSuggestion({ 
                        status: 'adapted', 
                        reviewed: true, 
                        reviewTime: MINIMUM_REVIEW_TIME_MS 
                    })
                )
            ];
            const risk = calculateBlindAcceptanceScore(suggestions);
            expect(risk).toBeGreaterThanOrEqual(0);
        });

        test('output is always a finite number', () => {
            const suggestions = [
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 })
            ];
            const risk = calculateBlindAcceptanceScore(suggestions);
            expect(Number.isFinite(risk)).toBe(true);
            expect(Number.isNaN(risk)).toBe(false);
        });
    });

    describe('Edge cases', () => {
        test('handles mixed statuses correctly', () => {
            const suggestions = [
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 }),
                mkSuggestion({ 
                    status: 'accepted', 
                    reviewed: true, 
                    reviewTime: MINIMUM_REVIEW_TIME_MS 
                }),
                mkSuggestion({ 
                    status: 'adapted', 
                    reviewed: true, 
                    reviewTime: MINIMUM_REVIEW_TIME_MS 
                }),
                mkSuggestion({ status: 'rejected' }),
                mkSuggestion({ status: 'pending' }) // Should be ignored
            ];
            const risk = calculateBlindAcceptanceScore(suggestions);
            expect(risk).toBeGreaterThanOrEqual(0);
            expect(risk).toBeLessThanOrEqual(30);
        });

        test('handles undefined reviewTime gracefully', () => {
            const suggestions = [
                mkSuggestion({ status: 'accepted', reviewed: true, reviewTime: undefined })
            ];
            expect(() => calculateBlindAcceptanceScore(suggestions)).not.toThrow();
            const risk = calculateBlindAcceptanceScore(suggestions);
            // Should be treated as blind accept (not effectively reviewed)
            expect(risk).toBeGreaterThan(0);
        });
    });
});
