/**
 * Tests: gatherResearchPayload includes projectProgressMeasures.
 */
const { gatherResearchPayload } = require('../../../../business_modules/research/app/ResearchDataService');

describe('gatherResearchPayload projectProgressMeasures', () => {
    test('payload has projectProgressMeasures key', async () => {
        const payload = await gatherResearchPayload(null);
        expect(payload).toHaveProperty('projectProgressMeasures');
    });

    test('projectProgressMeasures when client returns data', async () => {
        const measures = { planDeviation: 20, scheduleDeviation: null, acceptanceTestsDeviation: 0 };
        const state = {
            getMode: () => 'dev',
            projectProgressClient: { fetchMeasures: jest.fn().mockResolvedValue(measures) }
        };
        const payload = await gatherResearchPayload(state);
        expect(payload.projectProgressMeasures).toEqual(measures);
    });

    test('projectProgressMeasures null when client throws', async () => {
        const state = {
            getMode: () => 'dev',
            projectProgressClient: { fetchMeasures: jest.fn().mockRejectedValue(new Error('fail')) }
        };
        const payload = await gatherResearchPayload(state);
        expect(payload.projectProgressMeasures).toBeNull();
    });
});
