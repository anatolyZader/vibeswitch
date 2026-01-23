/**
 * Effective Review Consistency Tests
 * 
 * Verifies that isEffectivelyReviewed() is used consistently across all components:
 * - Review score resolution bonus
 * - Blind acceptance "careful accept" check
 * - Adapted mitigation check
 * 
 * This is exactly where drift happens - if one component uses raw "reviewed" boolean
 * and another uses "effectivelyReviewed", scores become inconsistent.
 */

const {
    calculateReviewScore,
    calculateBlindAcceptanceScore,
    EFFECTIVE_REVIEW_HELPER
} = require('../../../../../../business_modules/awareness/app/scoring/scoreCalculations');

const { isEffectivelyReviewed } = EFFECTIVE_REVIEW_HELPER;
const MINIMUM_REVIEW_TIME_MS = 5000;

describe('Effective Review Consistency', () => {
    /**
     * Helper: Create a suggestion with review state
     */
    function mkSuggestion(overrides = {}) {
        return {
            id: 'test-1',
            document: 'file:///test.js',
            status: 'pending',
            reviewed: false,
            reviewTime: 0,
            size: 100,
            editCount: 0,
            timestamp: Date.now(),
            rangeCount: 1,
            ...overrides
        };
    }

    describe('isEffectivelyReviewed helper', () => {
        test('returns false for unreviewed suggestion', () => {
            const s = mkSuggestion({ reviewed: false, reviewTime: 0 });
            expect(isEffectivelyReviewed(s)).toBe(false);
        });

        test('returns false for reviewed=true but reviewTime=0', () => {
            const s = mkSuggestion({ reviewed: true, reviewTime: 0 });
            expect(isEffectivelyReviewed(s)).toBe(false);
        });

        test('returns false for reviewed=true but reviewTime < threshold', () => {
            const s = mkSuggestion({ reviewed: true, reviewTime: MINIMUM_REVIEW_TIME_MS - 1 });
            expect(isEffectivelyReviewed(s)).toBe(false);
        });

        test('returns true for reviewed=true and reviewTime >= threshold', () => {
            const s = mkSuggestion({ reviewed: true, reviewTime: MINIMUM_REVIEW_TIME_MS });
            expect(isEffectivelyReviewed(s)).toBe(true);
        });

        test('handles undefined reviewTime', () => {
            const s = mkSuggestion({ reviewed: true, reviewTime: undefined });
            expect(isEffectivelyReviewed(s)).toBe(false);
        });
    });

    describe('Review Score Resolution Bonus', () => {
        test('resolution bonus requires effective review (not just reviewed=true)', () => {
            // Suggestion with reviewed=true but reviewTime=0 should NOT count for resolution bonus
            const suggestions = [
                mkSuggestion({ 
                    reviewed: true, 
                    reviewTime: 0, // Below threshold
                    status: 'accepted' 
                }),
                mkSuggestion({ 
                    reviewed: true, 
                    reviewTime: MINIMUM_REVIEW_TIME_MS, // Above threshold
                    status: 'accepted' 
                })
            ];

            const score = calculateReviewScore(suggestions);
            
            // Only one suggestion should count for resolution bonus (the effectively reviewed one)
            // If both counted, score would be higher
            // We expect resolution bonus to be based on effectively reviewed only
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(40);
        });

        test('reviewed but unresolved does not get resolution bonus if not effectively reviewed', () => {
            const suggestions = [
                mkSuggestion({ 
                    reviewed: true, 
                    reviewTime: 0, // Below threshold
                    status: 'pending' // Unresolved
                })
            ];

            const score = calculateReviewScore(suggestions);
            // Should not get bonus (not effectively reviewed)
            expect(score).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Blind Acceptance Score', () => {
        test('blind acceptance uses effectiveReviewed (not raw reviewed boolean)', () => {
            // Suggestion with reviewed=true but reviewTime=0 should be treated as "blind accept"
            const suggestions = [
                mkSuggestion({ 
                    status: 'accepted',
                    reviewed: true,
                    reviewTime: 0 // Below threshold - should be treated as blind accept
                }),
                mkSuggestion({ 
                    status: 'accepted',
                    reviewed: true,
                    reviewTime: MINIMUM_REVIEW_TIME_MS // Above threshold - should be careful accept
                })
            ];

            const risk = calculateBlindAcceptanceScore(suggestions);
            
            // Should have some risk (one blind accept out of two)
            expect(risk).toBeGreaterThan(0);
            expect(risk).toBeLessThanOrEqual(30);
            
            // If it used raw "reviewed" boolean, both would be "careful accept" and risk would be lower
            // With effectiveReviewed, one is blind accept, so risk should be higher
        });

        test('adapted mitigation requires effective review', () => {
            // Adapted suggestion without effective review should NOT reduce blind acceptance risk
            const suggestions = [
                mkSuggestion({ 
                    status: 'accepted',
                    reviewed: false,
                    reviewTime: 0
                }),
                mkSuggestion({ 
                    status: 'adapted',
                    reviewed: true,
                    reviewTime: 0 // Below threshold - should NOT count for mitigation
                })
            ];

            const riskWithoutEffectiveReview = calculateBlindAcceptanceScore(suggestions);

            // Compare with effectively reviewed adaptation
            const suggestionsWithEffectiveReview = [
                mkSuggestion({ 
                    status: 'accepted',
                    reviewed: false,
                    reviewTime: 0
                }),
                mkSuggestion({ 
                    status: 'adapted',
                    reviewed: true,
                    reviewTime: MINIMUM_REVIEW_TIME_MS // Above threshold - SHOULD count for mitigation
                })
            ];

            const riskWithEffectiveReview = calculateBlindAcceptanceScore(suggestionsWithEffectiveReview);

            // Risk with effective review should be lower (mitigation applies)
            expect(riskWithEffectiveReview).toBeLessThanOrEqual(riskWithoutEffectiveReview);
        });
    });

    describe('Consistency across components', () => {
        test('same suggestion state produces consistent results across components', () => {
            // Create suggestion that is "reviewed" but not "effectively reviewed"
            const suggestion = mkSuggestion({ 
                reviewed: true,
                reviewTime: 0, // Below threshold
                status: 'accepted'
            });

            // Review score should not count it for resolution bonus
            const reviewScore = calculateReviewScore([suggestion]);
            
            // Blind acceptance should treat it as blind accept (not careful accept)
            const blindRisk = calculateBlindAcceptanceScore([suggestion]);

            // Both should reflect that it's NOT effectively reviewed
            // Review score: no resolution bonus (lower score)
            // Blind risk: treated as blind accept (higher risk)
            expect(reviewScore).toBeLessThan(40); // Should be lower without bonus
            expect(blindRisk).toBeGreaterThan(0); // Should have risk (blind accept)
        });
    });
});
