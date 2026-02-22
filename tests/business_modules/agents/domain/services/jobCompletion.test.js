const { aggregateFindingsFromJobs, allJobsTerminal } = require('../../../../../business_modules/agents/domain/services/jobCompletion');

describe('jobCompletion', () => {
    describe('aggregateFindingsFromJobs', () => {
        test('returns empty array for null or non-array', () => {
            expect(aggregateFindingsFromJobs(null)).toEqual([]);
            expect(aggregateFindingsFromJobs(undefined)).toEqual([]);
        });

        test('flattens findings from jobs that have findings array', () => {
            const jobs = [
                { status: 'completed', findings: [{ message: 'a' }] },
                { status: 'completed', findings: [{ message: 'b' }, { message: 'c' }] }
            ];
            expect(aggregateFindingsFromJobs(jobs)).toHaveLength(3);
        });

        test('skips jobs without findings or with non-array findings', () => {
            const jobs = [
                { status: 'completed' },
                { status: 'completed', findings: 'not-array' },
                { status: 'completed', findings: [{ message: 'ok' }] }
            ];
            expect(aggregateFindingsFromJobs(jobs)).toHaveLength(1);
        });
    });

    describe('allJobsTerminal', () => {
        test('returns false for null or empty jobs', () => {
            expect(allJobsTerminal(null)).toBe(false);
            expect(allJobsTerminal([])).toBe(false);
        });

        test('returns true when all jobs are completed or failed', () => {
            expect(allJobsTerminal([{ status: 'completed' }, { status: 'failed' }])).toBe(true);
        });

        test('returns false when any job is not terminal', () => {
            expect(allJobsTerminal([{ status: 'completed' }, { status: 'running' }])).toBe(false);
        });
    });
});
