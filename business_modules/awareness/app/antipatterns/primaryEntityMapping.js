/**
 * primaryEntity mapping per event type (Contract F).
 * Dedupe key is (type, primaryEntity, ruleId?).
 */

const TYPE_TO_PRIMARY_ENTITY = {
    boundary_violation: 'filePath',
    cargo_cult_session: 'sessionId',
    high_blind_accept_session: 'sessionId',
    git_unavailable: 'repoId',
    observability_missing: 'filePath',
    drift_insufficient_signals: 'repoId',
    thrash_loop: 'sessionId',
    module_grew_no_consolidation: 'modulePath',
    candidate_surfaced: 'candidateId',
    spec_debt: 'sessionId',
    silent_drift_detected: 'repoId',
    ghost_process_detected: 'repoId',
    llm_smell: 'filePath'
};

const DEFAULT_PRIMARY_ENTITY = 'sessionId';

function getPrimaryEntityFieldForType(type) {
    return TYPE_TO_PRIMARY_ENTITY[type] || DEFAULT_PRIMARY_ENTITY;
}

function dedupeKey(event) {
    const type = (event.type || '').toString();
    const primary = event.primaryEntity != null ? String(event.primaryEntity) : '';
    const ruleId = event.ruleId != null ? String(event.ruleId) : '';
    return type + '\n' + primary + '\n' + ruleId;
}

module.exports = {
    getPrimaryEntityFieldForType,
    dedupeKey,
    TYPE_TO_PRIMARY_ENTITY
};
