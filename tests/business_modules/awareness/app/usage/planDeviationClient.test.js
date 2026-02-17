/**
 * Unit tests for planDeviationClient: parseCheckboxes and createPlanDeviationClient fetchMeasures.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createPlanDeviationClient, parseCheckboxes, DEFAULT_PLAN_PATH } = require('../../../../../business_modules/awareness/app/usage/planDeviationClient');

describe('parseCheckboxes', () => {
    test('returns zero total for empty content', () => {
        expect(parseCheckboxes('')).toEqual({ total: 0, done: 0 });
        expect(parseCheckboxes(null)).toEqual({ total: 0, done: 0 });
    });

    test('counts unchecked only', () => {
        const content = '- [ ] item one\n- [ ] item two';
        expect(parseCheckboxes(content)).toEqual({ total: 2, done: 0 });
    });

    test('counts checked [x] and [X]', () => {
        const content = '- [x] done\n- [X] also done';
        expect(parseCheckboxes(content)).toEqual({ total: 2, done: 2 });
    });

    test('mixed checkboxes', () => {
        const content = '- [ ] todo\n- [x] done\n- [ ] another\n- [X] done2';
        expect(parseCheckboxes(content)).toEqual({ total: 4, done: 2 });
    });

    test('deviation formula: 100 * (1 - done/total)', () => {
        const { total, done } = parseCheckboxes('- [ ] a\n- [x] b\n- [ ] c');
        expect(total).toBe(3);
        expect(done).toBe(1);
        expect(Math.round(100 * (1 - done / total))).toBe(67);
    });
});

describe('createPlanDeviationClient', () => {
    test('DEFAULT_PLAN_PATH is PLAN.md', () => {
        expect(DEFAULT_PLAN_PATH).toBe('PLAN.md');
    });

    test('fetchMeasures returns null when no workspace root', async () => {
        const client = createPlanDeviationClient({ getWorkspaceRoot: () => '' });
        const result = await client.fetchMeasures();
        expect(result).toBeNull();
    });

    test('fetchMeasures returns null when plan file has no checkboxes', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-test-'));
        try {
            fs.writeFileSync(path.join(dir, 'PLAN.md'), '# My Plan\n\nNo checkboxes here.', 'utf8');
            const client = createPlanDeviationClient({
                getWorkspaceRoot: () => dir,
                getPlanPath: () => 'PLAN.md'
            });
            const result = await client.fetchMeasures();
            expect(result).toBeNull();
        } finally {
            fs.rmSync(dir, { recursive: true });
        }
    });

    test('fetchMeasures returns deviation when plan has checkboxes', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-test-'));
        try {
            fs.writeFileSync(path.join(dir, 'PLAN.md'), '- [ ] a\n- [x] b\n- [ ] c\n', 'utf8');
            const client = createPlanDeviationClient({
                getWorkspaceRoot: () => dir,
                getPlanPath: () => 'PLAN.md'
            });
            const result = await client.fetchMeasures();
            expect(result).not.toBeNull();
            expect(result.total).toBe(3);
            expect(result.done).toBe(1);
            expect(result.deviation0To100).toBe(67);
            expect(result.path).toBe('PLAN.md');
        } finally {
            fs.rmSync(dir, { recursive: true });
        }
    });

    test('fetchMeasures returns 0 when all checked, 100 when none checked', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-test-'));
        try {
            fs.writeFileSync(path.join(dir, 'PLAN.md'), '- [x] a\n- [X] b\n', 'utf8');
            const client = createPlanDeviationClient({
                getWorkspaceRoot: () => dir,
                getPlanPath: () => 'PLAN.md'
            });
            const result = await client.fetchMeasures();
            expect(result.deviation0To100).toBe(0);
            fs.writeFileSync(path.join(dir, 'PLAN.md'), '- [ ] a\n- [ ] b\n', 'utf8');
            const result2 = await client.fetchMeasures();
            expect(result2.deviation0To100).toBe(100);
        } finally {
            fs.rmSync(dir, { recursive: true });
        }
    });

    test('fetchMeasures returns null when file does not exist', async () => {
        const client = createPlanDeviationClient({
            getWorkspaceRoot: () => os.tmpdir(),
            getPlanPath: () => 'nonexistent-PLAN-12345.md'
        });
        const result = await client.fetchMeasures();
        expect(result).toBeNull();
    });
});
