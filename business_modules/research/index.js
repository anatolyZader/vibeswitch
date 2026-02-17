/**
 * Research business module - Gathers objective code quality data (Sonar, ESLint, token usage, extension metrics)
 * and sends it to an external analysis service (Fastify/Cloud Run). Calculations and analysis are performed
 * by the external Claude code agent, not in the extension.
 */

const { createResearchDataService, gatherResearchPayload } = require('./app/ResearchDataService');
const { createResearchAgentClient } = require('./infrastructure/ResearchAgentClient');
const { createResearchStore, DEFAULT_DB_PATH } = require('./infrastructure/ResearchStore');

module.exports = {
    createResearchDataService,
    gatherResearchPayload,
    createResearchAgentClient,
    createResearchStore,
    DEFAULT_DB_PATH
};
