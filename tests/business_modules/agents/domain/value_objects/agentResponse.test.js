/**
 * Unit tests: createJobResponse (spec-agents)
 */

const { createJobResponse } = require('../../../../../business_modules/agents/domain/value_objects/agentResponse');

describe('createJobResponse', () => {
    test('returns object with jobId, status, findings', () => {
        const params = { jobId: 'job-1', status: 'completed', findings: [{ message: 'f1' }] };
        const out = createJobResponse(params);
        expect(out.jobId).toBe('job-1');
        expect(out.status).toBe('completed');
        expect(out.findings).toEqual([{ message: 'f1' }]);
    });

    test('status omitted defaults to pending', () => {
        const out = createJobResponse({ jobId: 'j' });
        expect(out.status).toBe('pending');
    });

    test('findings omitted defaults to empty array', () => {
        const out = createJobResponse({ jobId: 'j', status: 'failed' });
        expect(out.findings).toEqual([]);
    });
});
