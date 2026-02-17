/**
 * Unit tests for acceptanceTestsDeviationClient: parseTestOutput.
 */
const { parseTestOutput, createAcceptanceTestsDeviationClient, DEFAULT_COMMAND, DEFAULT_TIMEOUT_MS } = require('../../../../../business_modules/awareness/app/usage/acceptanceTestsDeviationClient');

describe('parseTestOutput', () => {
    test('returns null for empty or non-string', () => {
        expect(parseTestOutput('')).toBeNull();
        expect(parseTestOutput(null)).toBeNull();
        expect(parseTestOutput(123)).toBeNull();
    });

    test('parses Jest-style passed, failed, total', () => {
        const out = parseTestOutput('Tests:       12 passed, 2 failed, 14 total');
        expect(out).toEqual({ passed: 12, failed: 2, total: 14 });
    });

    test('parses passed and failed without total', () => {
        const out = parseTestOutput('  10 passed, 1 failed');
        expect(out).toEqual({ passed: 10, failed: 1, total: 11 });
    });

    test('parses passed and total when no failed', () => {
        const out = parseTestOutput('Tests:       5 passed, 5 total');
        expect(out).toEqual({ passed: 5, failed: 0, total: 5 });
    });

    test('returns null when no parseable numbers', () => {
        expect(parseTestOutput('No tests found')).toBeNull();
    });

    test('deviation = 100 * (failed / total)', () => {
        const out = parseTestOutput('8 passed, 2 failed, 10 total');
        expect(out.total).toBe(10);
        expect(out.failed).toBe(2);
        expect(Math.round(100 * (out.failed / out.total))).toBe(20);
    });
});

describe('createAcceptanceTestsDeviationClient', () => {
    test('DEFAULT_COMMAND and DEFAULT_TIMEOUT_MS', () => {
        expect(DEFAULT_COMMAND).toBe('npm test');
        expect(DEFAULT_TIMEOUT_MS).toBe(60000);
    });

    test('fetchMeasures returns null when no workspace root', async () => {
        const client = createAcceptanceTestsDeviationClient({ getWorkspaceRoot: () => '' });
        const result = await client.fetchMeasures();
        expect(result).toBeNull();
    });
});
