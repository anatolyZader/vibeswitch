/**
 * Finding (value object) - shape for agent findings (store and diagnostics).
 */

function createFinding(params) {
    if (!params) return null;
    return {
        category: params.category,
        severity: params.severity,
        message: params.message,
        ruleId: params.ruleId,
        evidence: params.evidence || {},
        recommendation: params.recommendation,
        correlationId: params.correlationId
    };
}

module.exports = {
    createFinding
};
