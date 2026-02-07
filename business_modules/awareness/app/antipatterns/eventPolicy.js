/**
 * EventPolicy - Deterministic severity for antipattern events (Contract E)
 * Maps event type + optional context to 'info' | 'warn' | 'high'.
 */

function getSeverity(type, context) {
    context = context || {};
    const t = (type || '').toString();
    const highCriticality = context.criticality === 'high' || context.isCriticalModule === true;
    const inRequiredZone = context.inRequiredZone === true;

    if (t === 'boundary_violation' && highCriticality) return 'high';
    if (t === 'cargo_cult_session' && highCriticality) return 'high';
    if (t === 'boundary_violation') return 'warn';
    if (t === 'observability_missing' && inRequiredZone) return 'warn';
    if (t === 'observability_missing') return 'warn';
    if (t === 'git_unavailable') return 'info';
    if (t === 'drift_insufficient_signals') return 'info';
    if (t === 'candidate_surfaced') return 'info';
    if (t === 'thrash_loop') return 'warn';
    if (t === 'module_grew_no_consolidation') return 'warn';
    if (t === 'spec_debt') return 'info';
    if (t === 'silent_drift_detected' || t === 'ghost_process_detected') return 'warn';
    if (t === 'high_blind_accept_session') return 'warn';

    return 'info';
}

module.exports = { getSeverity };
