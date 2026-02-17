/**
 * Unit tests for projectProgressService.
 */
const { createProjectProgressService, emptyMeasures } = require('../../../../../business_modules/awareness/app/usage/projectProgressService');

describe('projectProgressService', () => {
    test('emptyMeasures returns all null', () => {
        const m = emptyMeasures();
        expect(m.planDeviation).toBeNull();
        expect(m.scheduleDeviation).toBeNull();
        expect(m.acceptanceTestsDeviation).toBeNull();
    });

    test('fetchMeasures with no clients returns all null', async () => {
        const service = createProjectProgressService({});
        const out = await service.fetchMeasures();
        expect(out.planDeviation).toBeNull();
        expect(out.scheduleDeviation).toBeNull();
        expect(out.acceptanceTestsDeviation).toBeNull();
    });

    test('fetchMeasures with plan client returns planDeviation', async () => {
        const planClient = { fetchMeasures: jest.fn().mockResolvedValue({ deviation0To100: 25 }) };
        const service = createProjectProgressService({ planDeviationClient: planClient });
        const out = await service.fetchMeasures();
        expect(out.planDeviation).toBe(25);
        expect(out.scheduleDeviation).toBeNull();
        expect(out.acceptanceTestsDeviation).toBeNull();
    });

    test('fetchMeasures with all three clients returns all', async () => {
        const planClient = { fetchMeasures: jest.fn().mockResolvedValue({ deviation0To100: 10 }) };
        const jiraClient = { fetchMeasures: jest.fn().mockResolvedValue({ deviation0To100: 40 }) };
        const atClient = { fetchMeasures: jest.fn().mockResolvedValue({ deviation0To100: 0 }) };
        const service = createProjectProgressService({
            planDeviationClient: planClient,
            jiraSprintDeviationClient: jiraClient,
            acceptanceTestsDeviationClient: atClient
        });
        const out = await service.fetchMeasures();
        expect(out.planDeviation).toBe(10);
        expect(out.scheduleDeviation).toBe(40);
        expect(out.acceptanceTestsDeviation).toBe(0);
    });

    test('fetchMeasures sets null when client returns null', async () => {
        const planClient = { fetchMeasures: jest.fn().mockResolvedValue(null) };
        const service = createProjectProgressService({ planDeviationClient: planClient });
        const out = await service.fetchMeasures();
        expect(out.planDeviation).toBeNull();
    });

    test('fetchMeasures catches client errors', async () => {
        const planClient = { fetchMeasures: jest.fn().mockRejectedValue(new Error('fail')) };
        const jiraClient = { fetchMeasures: jest.fn().mockResolvedValue({ deviation0To100: 50 }) };
        const service = createProjectProgressService({
            planDeviationClient: planClient,
            jiraSprintDeviationClient: jiraClient
        });
        const out = await service.fetchMeasures();
        expect(out.planDeviation).toBeNull();
        expect(out.scheduleDeviation).toBe(50);
    });
});
