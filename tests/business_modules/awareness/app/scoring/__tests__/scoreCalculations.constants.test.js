/**
 * Constant Scoping Tests
 * 
 * Verifies that all constants referenced in scoreCalculations.js are properly defined
 * and accessible. This prevents "works in extension host due to global const" bugs.
 */

const {
    calculateReviewScore,
    calculateBlindAcceptanceScore,
    calculateAdaptationScore,
    calculateRiskBasedDebtScore,
    SCORING_CONSTANTS,
    EFFECTIVE_REVIEW_HELPER
} = require('../../../../../../business_modules/awareness/app/scoring/scoreCalculations');

describe('ScoreCalculations Constants Scoping', () => {
    test('all constants are defined and exported', () => {
        expect(SCORING_CONSTANTS).toBeDefined();
        expect(SCORING_CONSTANTS.DEFAULT_RECENT_WINDOW_MS).toBe(10 * 1000);
        expect(SCORING_CONSTANTS.SCORING_HORIZON_MS).toBe(15 * 60 * 1000);
        expect(SCORING_CONSTANTS.SCORING_HORIZON_COUNT).toBe(20);
        expect(SCORING_CONSTANTS.EMA_ALPHA).toBe(0.3);
        expect(SCORING_CONSTANTS.TARGET_SEC_PER_KCHAR).toBe(12);
        expect(SCORING_CONSTANTS.MINIMUM_REVIEW_TIME_MS).toBe(5000);
        expect(SCORING_CONSTANTS.MIN_REVIEWED_SIZE).toBe(200);
        expect(SCORING_CONSTANTS.PENDING_MAX_AGE_MS).toBe(30 * 1000);
    });

    test('effective review helper is exported', () => {
        expect(EFFECTIVE_REVIEW_HELPER).toBeDefined();
        expect(typeof EFFECTIVE_REVIEW_HELPER.isEffectivelyReviewed).toBe('function');
    });

    test('calculateReviewScore does not throw ReferenceError with minimal fixture', () => {
        const suggestions = [
            { reviewed: true, reviewTime: 6000, size: 500, status: 'accepted' }
        ];
        expect(() => calculateReviewScore(suggestions)).not.toThrow();
        const score = calculateReviewScore(suggestions);
        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(40);
    });

    test('calculateBlindAcceptanceScore does not throw ReferenceError with minimal fixture', () => {
        const suggestions = [
            { status: 'accepted', reviewed: false, reviewTime: 0 }
        ];
        expect(() => calculateBlindAcceptanceScore(suggestions)).not.toThrow();
        const score = calculateBlindAcceptanceScore(suggestions);
        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(30);
    });

    test('calculateAdaptationScore does not throw ReferenceError with minimal fixture', () => {
        const suggestions = [
            { status: 'adapted', editCount: 2 }
        ];
        expect(() => calculateAdaptationScore(suggestions)).not.toThrow();
        const score = calculateAdaptationScore(suggestions);
        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(30);
    });

    test('calculateRiskBasedDebtScore does not throw ReferenceError with minimal fixture', () => {
        const fileDebts = new Map();
        const pendingSuggestions = [];
        expect(() => calculateRiskBasedDebtScore(fileDebts, pendingSuggestions)).not.toThrow();
        const score = calculateRiskBasedDebtScore(fileDebts, pendingSuggestions);
        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(30);
    });
});
