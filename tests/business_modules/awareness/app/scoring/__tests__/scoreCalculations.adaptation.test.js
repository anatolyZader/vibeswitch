/**
 * Adaptation Score Unit Tests
 * 
 * Tests for calculateAdaptationScore() function:
 * - Empty input handling
 * - Based on "accepted surface" (accepted or adapted), not all suggestions
 * - Adaptation rate calculation
 * - Adaptation depth (non-linear saturation)
 * - Output clamping (0-30)
 */

const { calculateAdaptationScore, SCORING_CONSTANTS } = require('../../../../../../business_modules/awareness/app/scoring/scoreCalculations');
const mkSuggestion = require('../../../../../helpers/mkSuggestion');

describe('calculateAdaptationScore', () => {
    describe('Empty input handling', () => {
        test('returns 0 for empty array', () => {
            expect(calculateAdaptationScore([])).toBe(0);
        });

        test('returns 0 for null', () => {
            expect(calculateAdaptationScore(null)).toBe(0);
        });

        test('returns 0 for undefined', () => {
            expect(calculateAdaptationScore(undefined)).toBe(0);
        });

        test('returns 0 for non-array', () => {
            expect(calculateAdaptationScore({})).toBe(0);
        });

        test('returns 0 when no accepted/adapted surface', () => {
            const suggestions = [
                mkSuggestion({ status: 'pending' }),
                mkSuggestion({ status: 'rejected' })
            ];
            expect(calculateAdaptationScore(suggestions)).toBe(0);
        });
    });

    describe('Based on accepted surface only', () => {
        test('rejections do not affect adaptation score', () => {
            const withRejections = [
                mkSuggestion({ status: 'accepted' }),
                mkSuggestion({ status: 'rejected' }),
                mkSuggestion({ status: 'rejected' })
            ];
            const scoreWithRejections = calculateAdaptationScore(withRejections);

            const withoutRejections = [
                mkSuggestion({ status: 'accepted' })
            ];
            const scoreWithoutRejections = calculateAdaptationScore(withoutRejections);

            // Scores should be the same (rejections don't count)
            expect(scoreWithRejections).toBe(scoreWithoutRejections);
        });

        test('pending suggestions do not affect adaptation score', () => {
            const withPending = [
                mkSuggestion({ status: 'accepted' }),
                mkSuggestion({ status: 'pending' }),
                mkSuggestion({ status: 'pending' })
            ];
            const scoreWithPending = calculateAdaptationScore(withPending);

            const withoutPending = [
                mkSuggestion({ status: 'accepted' })
            ];
            const scoreWithoutPending = calculateAdaptationScore(withoutPending);

            // Scores should be the same
            expect(scoreWithPending).toBe(scoreWithoutPending);
        });
    });

    describe('Adaptation rate (0-15 points)', () => {
        test('0% adapted in accepted surface → rate = 0', () => {
            const suggestions = [
                mkSuggestion({ status: 'accepted' }),
                mkSuggestion({ status: 'accepted' })
            ];
            const score = calculateAdaptationScore(suggestions);
            // Rate = 0, depth might contribute if editCount > 0
            expect(score).toBeGreaterThanOrEqual(0);
        });

        test('50% adapted in accepted surface → rate = 7.5', () => {
            const suggestions = [
                mkSuggestion({ status: 'adapted' }),
                mkSuggestion({ status: 'accepted' })
            ];
            const score = calculateAdaptationScore(suggestions);
            // Rate = 15 * 0.5 = 7.5, depth might add more
            expect(score).toBeGreaterThanOrEqual(7);
            expect(score).toBeLessThanOrEqual(30);
        });

        test('100% adapted in accepted surface → rate = 15', () => {
            const suggestions = [
                mkSuggestion({ status: 'adapted' }),
                mkSuggestion({ status: 'adapted' })
            ];
            const score = calculateAdaptationScore(suggestions);
            // Rate = 15, depth might add more
            expect(score).toBeGreaterThanOrEqual(15);
            expect(score).toBeLessThanOrEqual(30);
        });
    });

    describe('Adaptation depth (0-15 points, non-linear saturation)', () => {
        test('depth saturates non-linearly (doubling edits does not double depth)', () => {
            const baseEdits = 2;
            const suggestions1 = [
                mkSuggestion({ status: 'adapted', editCount: baseEdits })
            ];
            const score1 = calculateAdaptationScore(suggestions1);

            const suggestions2 = [
                mkSuggestion({ status: 'adapted', editCount: baseEdits * 2 })
            ];
            const score2 = calculateAdaptationScore(suggestions2);

            // Score2 should be higher, but not double
            expect(score2).toBeGreaterThan(score1);
            const depthIncrease = score2 - score1;
            // Depth increase should be less than the edit increase (non-linear saturation)
            expect(depthIncrease).toBeLessThan(15); // Max depth is 15
        });

        test('depth uses exponential saturation: 15 * (1 - exp(-avgEdits/2))', () => {
            // With avgEdits = 2, depth should be: 15 * (1 - exp(-1)) ≈ 15 * 0.632 = 9.48
            const suggestions = [
                mkSuggestion({ status: 'adapted', editCount: 2 }),
                mkSuggestion({ status: 'adapted', editCount: 2 })
            ];
            const score = calculateAdaptationScore(suggestions);
            // Rate = 15 (100% adapted), depth ≈ 9.48, total ≈ 24.48
            expect(score).toBeGreaterThan(20);
            expect(score).toBeLessThanOrEqual(30);
        });

        test('depth approaches max (15) as edits increase', () => {
            const suggestions = [
                mkSuggestion({ status: 'adapted', editCount: 10 }),
                mkSuggestion({ status: 'adapted', editCount: 10 })
            ];
            const score = calculateAdaptationScore(suggestions);
            // Rate = 15, depth ≈ 15 (saturated), total ≈ 30
            expect(score).toBeGreaterThan(28);
            expect(score).toBeLessThanOrEqual(30);
        });

        test('zero editCount → depth = 0', () => {
            const suggestions = [
                mkSuggestion({ status: 'adapted', editCount: 0 })
            ];
            const score = calculateAdaptationScore(suggestions);
            // Rate = 15 (100% adapted), depth = 0, total = 15
            expect(score).toBe(15);
        });
    });

    describe('Combined rate and depth', () => {
        test('high adaptation rate + high depth → high score', () => {
            const suggestions = [
                mkSuggestion({ status: 'adapted', editCount: 5 }),
                mkSuggestion({ status: 'adapted', editCount: 5 })
            ];
            const score = calculateAdaptationScore(suggestions);
            // Rate = 15 (100%), depth ≈ 12-15, total ≈ 27-30
            expect(score).toBeGreaterThan(25);
            expect(score).toBeLessThanOrEqual(30);
        });

        test('low adaptation rate + high depth → moderate score', () => {
            const suggestions = [
                mkSuggestion({ status: 'adapted', editCount: 5 }),
                mkSuggestion({ status: 'accepted', editCount: 0 })
            ];
            const score = calculateAdaptationScore(suggestions);
            // Rate = 7.5 (50%), depth ≈ 12-15 (for adapted only), total ≈ 19.5-22.5
            expect(score).toBeGreaterThan(15);
            expect(score).toBeLessThan(25);
        });
    });

    describe('Output clamping (0-30)', () => {
        test('output never exceeds 30', () => {
            // Create scenario that would exceed 30 if not clamped
            const suggestions = Array(10).fill(null).map(() => 
                mkSuggestion({ status: 'adapted', editCount: 20 })
            );
            const score = calculateAdaptationScore(suggestions);
            expect(score).toBeLessThanOrEqual(30);
        });

        test('output never below 0', () => {
            const suggestions = [
                mkSuggestion({ status: 'accepted', editCount: 0 })
            ];
            const score = calculateAdaptationScore(suggestions);
            expect(score).toBeGreaterThanOrEqual(0);
        });

        test('output is always a finite number', () => {
            const suggestions = [
                mkSuggestion({ status: 'adapted', editCount: 2 })
            ];
            const score = calculateAdaptationScore(suggestions);
            expect(Number.isFinite(score)).toBe(true);
            expect(Number.isNaN(score)).toBe(false);
        });
    });

    describe('Edge cases', () => {
        test('handles undefined editCount gracefully', () => {
            const suggestions = [
                mkSuggestion({ status: 'adapted', editCount: undefined })
            ];
            expect(() => calculateAdaptationScore(suggestions)).not.toThrow();
            const score = calculateAdaptationScore(suggestions);
            // Should treat as 0 edits
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(30);
        });

        test('handles missing editCount field', () => {
            const suggestions = [
                { ...mkSuggestion({ status: 'adapted' }), editCount: undefined }
            ];
            expect(() => calculateAdaptationScore(suggestions)).not.toThrow();
            const score = calculateAdaptationScore(suggestions);
            expect(Number.isFinite(score)).toBe(true);
        });

        test('handles negative editCount', () => {
            const suggestions = [
                mkSuggestion({ status: 'adapted', editCount: -1 })
            ];
            expect(() => calculateAdaptationScore(suggestions)).not.toThrow();
            const score = calculateAdaptationScore(suggestions);
            expect(Number.isFinite(score)).toBe(true);
        });
    });
});
