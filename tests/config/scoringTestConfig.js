/**
 * Scoring Test Configuration
 */

const SCORING_TEST_CONFIG = {
    DEFAULT_RECENT_WINDOW_MS: 10 * 1000,
    SCORING_HORIZON_MS: 15 * 60 * 1000,
    SCORING_HORIZON_COUNT: 20,
    EMA_ALPHA: 0.3,
    TARGET_SEC_PER_KCHAR: 12,
    MINIMUM_REVIEW_TIME_MS: 5000,
    MIN_REVIEWED_SIZE: 200,
    PENDING_MAX_AGE_MS: 30 * 1000,
    RISK_WEIGHTS: {
        review: 0.30,
        blindAcceptance: 0.30,
        adaptation: 0.20,
        debt: 0.20
    },
    RANGES: {
        review: { min: 0, max: 40 },
        blindAcceptance: { min: 0, max: 30 },
        adaptation: { min: 0, max: 30 },
        debt: { min: 0, max: 30 },
        final: { min: 0, max: 100 }
    }
};

module.exports = SCORING_TEST_CONFIG;
