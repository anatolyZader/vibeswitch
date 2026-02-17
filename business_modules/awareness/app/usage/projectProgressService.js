/**
 * Project progress service - Aggregates plan, schedule (Jira), and acceptance tests deviation
 * into a single projectProgressMeasures shape for dashboard and research.
 */

function emptyMeasures() {
    return {
        planDeviation: null,
        scheduleDeviation: null,
        acceptanceTestsDeviation: null
    };
}

/**
 * Create project progress service that aggregates up to three clients.
 * @param {Object} opts - { planDeviationClient?, jiraSprintDeviationClient?, acceptanceTestsDeviationClient?, loggerPort? }
 * @returns {{ fetchMeasures: () => Promise<{ planDeviation: number|null, scheduleDeviation: number|null, acceptanceTestsDeviation: number|null }> }}
 */
function createProjectProgressService(opts) {
    const planClient = opts && opts.planDeviationClient ? opts.planDeviationClient : null;
    const jiraClient = opts && opts.jiraSprintDeviationClient ? opts.jiraSprintDeviationClient : null;
    const atClient = opts && opts.acceptanceTestsDeviationClient ? opts.acceptanceTestsDeviationClient : null;
    const logger = opts && opts.loggerPort ? opts.loggerPort : null;

    async function fetchMeasures() {
        const out = emptyMeasures();

        if (planClient && typeof planClient.fetchMeasures === 'function') {
            try {
                const plan = await planClient.fetchMeasures();
                out.planDeviation = plan && typeof plan.deviation0To100 === 'number' ? plan.deviation0To100 : null;
            } catch (err) {
                if (logger && logger.error) logger.error('ProjectProgressService: plan fetch failed', err);
            }
        }

        if (jiraClient && typeof jiraClient.fetchMeasures === 'function') {
            try {
                const schedule = await jiraClient.fetchMeasures();
                out.scheduleDeviation = schedule && typeof schedule.deviation0To100 === 'number' ? schedule.deviation0To100 : null;
            } catch (err) {
                if (logger && logger.error) logger.error('ProjectProgressService: Jira schedule fetch failed', err);
            }
        }

        if (atClient && typeof atClient.fetchMeasures === 'function') {
            try {
                const at = await atClient.fetchMeasures();
                out.acceptanceTestsDeviation = at && typeof at.deviation0To100 === 'number' ? at.deviation0To100 : null;
            } catch (err) {
                if (logger && logger.error) logger.error('ProjectProgressService: acceptance tests fetch failed', err);
            }
        }

        return out;
    }

    return { fetchMeasures };
}

module.exports = {
    createProjectProgressService,
    emptyMeasures
};
