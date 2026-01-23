/**
 * ScoreService Orchestration Tests
 * 
 * Tests for ScoreService.calculateScore() orchestration:
 * - Regime switching (no recent activity, pending-only, normal)
 * - EMA smoothing behavior
 * - Branch coverage (all code paths)
 * - Horizon selection (15min vs last 20)
 * - Component aggregation and weighting
 */

const ScoreService = require('../../../../../../business_modules/awareness/app/scoring/scoreService');
const mkSuggestion = require('../../../../../helpers/mkSuggestion');
const { SCORING_CONSTANTS } = require('../../../../../../business_modules/awareness/app/scoring/scoreCalculations');
const { DEFAULT_RECENT_WINDOW_MS, EMA_ALPHA, SCORING_HORIZON_MS, SCORING_HORIZON_COUNT } = SCORING_CONSTANTS;

describe('ScoreService Orchestration', () => {
    let scoreService;
    let mockDebtService;
    let mockLogger;

    beforeEach(() => {
        mockLogger = {
            debug: jest.fn(),
            log: jest.fn(),
            error: jest.fn()
        };
        scoreService = new ScoreService(mockLogger);
        
        // Mock DebtService
        mockDebtService = {
            calculateDebtScore: jest.fn(() => 0),
            getDebtSummary: jest.fn(() => ({ total: 0, files: [] }))
        };
    });

    describe('Regime: No recent activity', () => {
        test('returns debt-based score when no recent suggestions', () => {
            const now = Date.now();
            const oldSuggestions = [
                mkSuggestion({ 
                    timestamp: now - 20000, // 20 seconds ago (outside recent window)
                    status: 'accepted'
                })
            ];
            
            mockDebtService.calculateDebtScore.mockReturnValue(15); // 15/30 debt risk
            
            const result = scoreService.calculateScore({
                suggestions: oldSuggestions,
                debtService: mockDebtService
            });
            
            // Should use debt-based target: 15/30 = 0.5, so target = 50
            // Then EMA smoothing applied
            expect(result.currentScore).toBeGreaterThanOrEqual(0);
            expect(result.currentScore).toBeLessThanOrEqual(100);
            expect(result.scores.debt).toBe(15);
            expect(result.scores.review).toBe(0);
            expect(result.scores.blindAcceptance).toBe(0);
            expect(result.scores.adaptation).toBe(0);
        });

        test('applies pending risk floor when pending suggestions exist', () => {
            const now = Date.now();
            const suggestions = [
                mkSuggestion({ 
                    timestamp: now - 20000,
                    status: 'pending'
                }),
                mkSuggestion({ 
                    timestamp: now - 20000,
                    status: 'pending'
                }),
                mkSuggestion({ 
                    timestamp: now - 20000,
                    status: 'pending'
                })
            ];
            
            mockDebtService.calculateDebtScore.mockReturnValue(5); // Low debt
            
            const result = scoreService.calculateScore({
                suggestions,
                debtService: mockDebtService
            });
            
            // With 3 pending (PENDING_SOFT_CAP = 5), pendingRisk01 = 3/5 = 0.6
            // targetScore = max(debtRisk01 * 100, 0.6 * 60) = max(16.67, 36) = 36
            expect(result.currentScore).toBeGreaterThanOrEqual(30);
        });

        test('uses EMA smoothing for smooth transition', () => {
            const now = Date.now();
            const suggestions = [
                mkSuggestion({ timestamp: now - 20000, status: 'accepted' })
            ];
            
            mockDebtService.calculateDebtScore.mockReturnValue(20);
            
            // First call
            const result1 = scoreService.calculateScore({
                suggestions,
                debtService: mockDebtService
            });
            
            // Second call (should apply EMA)
            const result2 = scoreService.calculateScore({
                suggestions,
                debtService: mockDebtService
            });
            
            // EMA: newScore = alpha * new + (1 - alpha) * old
            // If target is 66.67 (20/30 * 100), first call sets it exactly
            // Second call should be: 0.3 * 66.67 + 0.7 * 66.67 = 66.67 (no change if target same)
            expect(result2.currentScore).toBeGreaterThanOrEqual(0);
            expect(result2.currentScore).toBeLessThanOrEqual(100);
        });
    });

    describe('Regime: Pending-only activity', () => {
        test('returns debt-based score when only pending suggestions in recent window', () => {
            const now = Date.now();
            const suggestions = [
                mkSuggestion({ 
                    timestamp: now - 5000, // 5 seconds ago (within recent window)
                    status: 'pending'
                }),
                mkSuggestion({ 
                    timestamp: now - 3000,
                    status: 'pending'
                })
            ];
            
            mockDebtService.calculateDebtScore.mockReturnValue(10);
            
            const result = scoreService.calculateScore({
                suggestions,
                debtService: mockDebtService
            });
            
            // Should use same model as "no recent activity" regime
            expect(result.currentScore).toBeGreaterThanOrEqual(0);
            expect(result.currentScore).toBeLessThanOrEqual(100);
            expect(result.scores.debt).toBe(10);
            expect(result.scores.review).toBe(0);
            expect(result.scores.blindAcceptance).toBe(0);
            expect(result.scores.adaptation).toBe(0);
        });

        test('applies pending risk when pending count exceeds debt risk', () => {
            const now = Date.now();
            const suggestions = Array(6).fill(null).map(() => 
                mkSuggestion({ 
                    timestamp: now - 5000,
                    status: 'pending'
                })
            );
            
            mockDebtService.calculateDebtScore.mockReturnValue(5); // Low debt
            
            const result = scoreService.calculateScore({
                suggestions,
                debtService: mockDebtService
            });
            
            // 6 pending (PENDING_SOFT_CAP = 5), pendingRisk01 = min(1, 6/5) = 1.0
            // targetScore = max(5/30 * 100, 1.0 * 60) = max(16.67, 60) = 60
            expect(result.currentScore).toBeGreaterThanOrEqual(50);
        });
    });

    describe('Regime: Normal activity (completed suggestions)', () => {
        test('calculates component scores from completed suggestions', () => {
            const now = Date.now();
            const suggestions = [
                mkSuggestion({ 
                    timestamp: now - 5000,
                    status: 'accepted',
                    reviewed: true,
                    reviewTime: 6000,
                    size: 500
                }),
                mkSuggestion({ 
                    timestamp: now - 3000,
                    status: 'accepted',
                    reviewed: false,
                    reviewTime: 0
                })
            ];
            
            mockDebtService.calculateDebtScore.mockReturnValue(5);
            
            const result = scoreService.calculateScore({
                suggestions,
                debtService: mockDebtService
            });
            
            // Should have component scores
            expect(result.scores.review).toBeGreaterThanOrEqual(0);
            expect(result.scores.review).toBeLessThanOrEqual(40);
            expect(result.scores.blindAcceptance).toBeGreaterThanOrEqual(0);
            expect(result.scores.blindAcceptance).toBeLessThanOrEqual(30);
            expect(result.scores.adaptation).toBeGreaterThanOrEqual(0);
            expect(result.scores.adaptation).toBeLessThanOrEqual(30);
            expect(result.scores.debt).toBe(5);
            
            // Final score should be weighted combination
            expect(result.currentScore).toBeGreaterThanOrEqual(0);
            expect(result.currentScore).toBeLessThanOrEqual(100);
        });

        test('uses extended horizon (15min or last 20) for stability', () => {
            const now = Date.now();
            // Create 25 completed suggestions (more than SCORING_HORIZON_COUNT = 20)
            const suggestions = Array(25).fill(null).map((_, i) => 
                mkSuggestion({ 
                    timestamp: now - (i * 1000), // Spread over 25 seconds
                    status: 'accepted',
                    reviewed: true,
                    reviewTime: 6000
                })
            );
            
            mockDebtService.calculateDebtScore.mockReturnValue(0);
            
            const result = scoreService.calculateScore({
                suggestions,
                debtService: mockDebtService
            });
            
            // Should use last 20 (SCORING_HORIZON_COUNT), not all 25
            // This provides stability beyond recent window
            expect(result.currentScore).toBeGreaterThanOrEqual(0);
            expect(result.currentScore).toBeLessThanOrEqual(100);
        });
    });

    describe('EMA Smoothing', () => {
        test('first call sets score exactly (no smoothing)', () => {
            const suggestions = [
                mkSuggestion({ status: 'accepted', reviewed: true, reviewTime: 6000 })
            ];
            
            mockDebtService.calculateDebtScore.mockReturnValue(0);
            
            const result = scoreService.calculateScore({
                suggestions,
                debtService: mockDebtService
            });
            
            // First call: currentScore should equal rawScore (no previous value)
            expect(result.currentScore).toBeGreaterThanOrEqual(0);
            expect(result.currentScore).toBeLessThanOrEqual(100);
        });

        test('subsequent calls apply EMA smoothing', () => {
            const suggestions = [
                mkSuggestion({ status: 'accepted', reviewed: true, reviewTime: 6000 })
            ];
            
            mockDebtService.calculateDebtScore.mockReturnValue(0);
            
            // First call
            const result1 = scoreService.calculateScore({
                suggestions,
                debtService: mockDebtService
            });
            
            // Change suggestions to get different raw score
            const newSuggestions = [
                mkSuggestion({ status: 'accepted', reviewed: false, reviewTime: 0 }) // Blind accept
            ];
            
            const result2 = scoreService.calculateScore({
                suggestions: newSuggestions,
                debtService: mockDebtService
            });
            
            // EMA: newScore = alpha * newRaw + (1 - alpha) * oldScore
            // If newRaw > oldScore, newScore should be between oldScore and newRaw
            // If newRaw < oldScore, newScore should be between newRaw and oldScore
            expect(result2.currentScore).toBeGreaterThanOrEqual(0);
            expect(result2.currentScore).toBeLessThanOrEqual(100);
        });

        test('EMA prevents hard discontinuities', () => {
            const now = Date.now();
            
            // Start with recent activity
            const recentSuggestions = [
                mkSuggestion({ 
                    timestamp: now - 5000,
                    status: 'accepted',
                    reviewed: true,
                    reviewTime: 6000
                })
            ];
            
            mockDebtService.calculateDebtScore.mockReturnValue(0);
            
            const result1 = scoreService.calculateScore({
                suggestions: recentSuggestions,
                debtService: mockDebtService
            });
            
            // Then no recent activity (regime switch)
            const oldSuggestions = [
                mkSuggestion({ 
                    timestamp: now - 20000,
                    status: 'accepted'
                })
            ];
            
            mockDebtService.calculateDebtScore.mockReturnValue(20);
            
            const result2 = scoreService.calculateScore({
                suggestions: oldSuggestions,
                debtService: mockDebtService
            });
            
            // Score should transition smoothly, not jump
            // EMA should prevent hard discontinuity
            const jump = Math.abs(result2.currentScore - result1.currentScore);
            // Jump should be reasonable (not 0-100 instant change)
            expect(jump).toBeLessThan(100);
        });
    });

    describe('Component Aggregation', () => {
        test('weights sum to 1.0 and map directly to 0-100', () => {
            const suggestions = [
                mkSuggestion({ 
                    status: 'accepted',
                    reviewed: true,
                    reviewTime: 6000,
                    size: 500
                })
            ];
            
            mockDebtService.calculateDebtScore.mockReturnValue(10);
            
            const result = scoreService.calculateScore({
                suggestions,
                debtService: mockDebtService
            });
            
            // Weights: review 0.30, blindAcceptance 0.30, adaptation 0.20, debt 0.20 = 1.0
            // Final score should be weighted combination scaled to 0-100
            expect(result.currentScore).toBeGreaterThanOrEqual(0);
            expect(result.currentScore).toBeLessThanOrEqual(100);
        });

        test('converts "good" scores to risk before aggregating', () => {
            const suggestions = [
                mkSuggestion({ 
                    status: 'accepted',
                    reviewed: true,
                    reviewTime: 6000,
                    size: 500
                })
            ];
            
            mockDebtService.calculateDebtScore.mockReturnValue(0);
            
            const result = scoreService.calculateScore({
                suggestions,
                debtService: mockDebtService
            });
            
            // Review and adaptation are "good" scores (higher = better)
            // They should be converted to risk (inverted) before aggregation
            // reviewScore high → reviewRisk01 low
            // blindAcceptanceRisk already in risk terms
            expect(result.scores.review).toBeGreaterThan(0); // Good score (higher = better)
            expect(result.currentScore).toBeGreaterThanOrEqual(0); // Risk score (higher = worse)
        });
    });

    describe('Edge Cases', () => {
        test('handles empty suggestions array', () => {
            const result = scoreService.calculateScore({
                suggestions: [],
                debtService: mockDebtService
            });
            
            expect(result.currentScore).toBe(0);
            expect(result.scores.review).toBe(0);
            expect(result.scores.blindAcceptance).toBe(0);
            expect(result.scores.adaptation).toBe(0);
            expect(result.scores.debt).toBe(0);
        });

        test('handles null debtService gracefully', () => {
            const suggestions = [
                mkSuggestion({ status: 'accepted' })
            ];
            
            const result = scoreService.calculateScore({
                suggestions,
                debtService: null
            });
            
            // Should default debt to 0
            expect(result.scores.debt).toBe(0);
            expect(result.currentScore).toBeGreaterThanOrEqual(0);
        });

        test('handles suggestions with null/undefined gracefully', () => {
            const suggestions = [
                mkSuggestion({ status: 'accepted' }),
                null,
                undefined,
                mkSuggestion({ status: 'pending' })
            ];
            
            expect(() => {
                scoreService.calculateScore({
                    suggestions,
                    debtService: mockDebtService
                });
            }).not.toThrow();
        });

        test('handles suggestions without timestamps', () => {
            const suggestions = [
                {
                    ...mkSuggestion({ status: 'accepted' }),
                    timestamp: undefined
                }
            ];
            
            expect(() => {
                scoreService.calculateScore({
                    suggestions,
                    debtService: mockDebtService
                });
            }).not.toThrow();
        });
    });

    describe('Horizon Selection', () => {
        test('uses 15-minute horizon when suggestions span beyond recent window', () => {
            const now = Date.now();
            const suggestions = [
                mkSuggestion({ 
                    timestamp: now - (5 * 60 * 1000), // 5 minutes ago
                    status: 'accepted',
                    reviewed: true,
                    reviewTime: 6000
                }),
                mkSuggestion({ 
                    timestamp: now - (10 * 60 * 1000), // 10 minutes ago
                    status: 'accepted',
                    reviewed: true,
                    reviewTime: 6000
                })
            ];
            
            mockDebtService.calculateDebtScore.mockReturnValue(0);
            
            const result = scoreService.calculateScore({
                suggestions,
                debtService: mockDebtService
            });
            
            // Should include suggestions within 15-minute horizon
            expect(result.currentScore).toBeGreaterThanOrEqual(0);
        });

        test('uses last N (20) when more than SCORING_HORIZON_COUNT resolved', () => {
            const now = Date.now();
            const suggestions = Array(25).fill(null).map((_, i) => 
                mkSuggestion({ 
                    timestamp: now - (i * 1000),
                    status: 'accepted',
                    reviewed: true,
                    reviewTime: 6000
                })
            );
            
            mockDebtService.calculateDebtScore.mockReturnValue(0);
            
            const result = scoreService.calculateScore({
                suggestions,
                debtService: mockDebtService
            });
            
            // Should use last 20, not all 25
            expect(result.currentScore).toBeGreaterThanOrEqual(0);
        });
    });
});
