/**
 * Rule Assembler unit tests
 * Ensures common + mode rules are assembled with correct header and sections
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const ruleAssembler = require('../../app/ruleAssembler');

describe('ruleAssembler', () => {
    let cursorDir;

    beforeEach(async () => {
        const tmp = path.join(os.tmpdir(), `ruleAssembler-${Date.now()}`);
        cursorDir = path.join(tmp, '.cursor');
        await fs.mkdir(cursorDir, { recursive: true });
        await fs.writeFile(path.join(cursorDir, 'rules.common.md'), '# COMMON RULES\n- Invariant one.\n', 'utf8');
        await fs.writeFile(path.join(cursorDir, 'rules.dev.md'), '# DEV MODE\n- Approval required.\n', 'utf8');
        await fs.writeFile(path.join(cursorDir, 'rules.vibe.md'), '# VIBE MODE\n- Auto-apply.\n', 'utf8');
    });

    afterEach(() => {
        ruleAssembler.clearCache();
    });

    test('assembleRules(dev) includes header and common + DEV MODE sections', async () => {
        const out = await ruleAssembler.assembleRules({ cursorDir, mode: 'dev' });
        expect(out).toContain('EFFECTIVE RULES');
        expect(out).toContain('mode: DEV');
        expect(out).toContain('layers: common -> dev');
        expect(out).toContain('--- BEGIN COMMON ---');
        expect(out).toContain('# COMMON RULES');
        expect(out).toContain('--- END COMMON ---');
        expect(out).toContain('--- BEGIN DEV MODE ---');
        expect(out).toContain('# DEV MODE');
        expect(out).toContain('--- END DEV MODE ---');
    });

    test('assembleRules(vibe) includes header and common + VIBE MODE sections', async () => {
        const out = await ruleAssembler.assembleRules({ cursorDir, mode: 'vibe' });
        expect(out).toContain('EFFECTIVE RULES');
        expect(out).toContain('mode: VIBE');
        expect(out).toContain('layers: common -> vibe');
        expect(out).toContain('--- BEGIN COMMON ---');
        expect(out).toContain('--- BEGIN VIBE MODE ---');
        expect(out).toContain('# VIBE MODE');
        expect(out).toContain('--- END VIBE MODE ---');
    });

    test('assembleRules throws if rules.common.md is missing', async () => {
        await fs.unlink(path.join(cursorDir, 'rules.common.md'));
        await expect(ruleAssembler.assembleRules({ cursorDir, mode: 'dev' }))
            .rejects.toThrow(/Rule file not found.*rules\.common\.md/);
    });

    test('assembleRules throws for invalid mode', async () => {
        await expect(ruleAssembler.assembleRules({ cursorDir, mode: 'invalid' }))
            .rejects.toThrow(/invalid mode/);
    });

    test('clearCache allows re-reading updated file content', async () => {
        await ruleAssembler.assembleRules({ cursorDir, mode: 'dev' });
        await fs.writeFile(path.join(cursorDir, 'rules.common.md'), '# COMMON UPDATED\n', 'utf8');
        ruleAssembler.clearCache();
        const out = await ruleAssembler.assembleRules({ cursorDir, mode: 'dev' });
        expect(out).toContain('# COMMON UPDATED');
    });
});
