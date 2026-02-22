/**
 * Value object: shape of the research ingest payload.
 * Built by gatherResearchPayload(state); stored and sent to the agent.
 *
 * @typedef {Object} ResearchPayload
 * @property {number} timestamp - Unix ms (e.g. Date.now())
 * @property {string} source - e.g. 'vibeswitch-extension'
 * @property {Object|null} [scoreData] - awarenessEngine.getScore()
 * @property {Object|null} [antipatternBreakdown] - getAntipatternBreakdownAsync() or getAntipatternBreakdown()
 * @property {Object|null} [tokenUsage]
 * @property {Object|null} [sonarMeasures]
 * @property {Object|null} [eslintMeasures]
 * @property {Object|null} [projectProgressMeasures]
 * @property {string} [currentMode] - e.g. 'dev', 'vibe'
 */

const RESEARCH_PAYLOAD_SOURCE = 'vibeswitch-extension';

/**
 * Default field values for an empty payload (e.g. when state is null).
 * @returns {ResearchPayload}
 */
function createEmptyResearchPayload() {
    return {
        timestamp: Date.now(),
        source: RESEARCH_PAYLOAD_SOURCE,
        scoreData: null,
        antipatternBreakdown: null,
        tokenUsage: null,
        sonarMeasures: null,
        eslintMeasures: null,
        projectProgressMeasures: null,
        currentMode: 'dev'
    };
}

module.exports = {
    RESEARCH_PAYLOAD_SOURCE,
    createEmptyResearchPayload
};
