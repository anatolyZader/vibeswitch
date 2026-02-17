/**
 * Tests for .cursor/hooks/grind.js (stop-hook script for long-running agent loops).
 * Spawns the script with stdin JSON and asserts stdout and exit code.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const GRIND_JS = path.join(REPO_ROOT, '.cursor', 'hooks', 'grind.js');

function runGrind(stdinJson, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [GRIND_JS], {
      cwd: REPO_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.stderr.on('data', (chunk) => { stderr += chunk; });
    proc.on('error', reject);
    proc.on('close', (code) => {
      try {
        const out = stdout.trim();
        const parsed = out ? JSON.parse(out) : {};
        resolve({ code, stdout: out, parsed, stderr });
      } catch (e) {
        resolve({ code, stdout, parsed: null, stderr, parseError: e });
      }
    });
    proc.stdin.write(typeof stdinJson === 'string' ? stdinJson : JSON.stringify(stdinJson || {}));
    proc.stdin.end();
  });
}

describe('grind.js stop hook', () => {
  describe('invalid or empty stdin', () => {
    it('outputs {} and exits 0 for empty stdin', async () => {
      const { code, parsed } = await runGrind('');
      expect(code).toBe(0);
      expect(parsed).toEqual({});
    });

    it('outputs {} and exits 0 for invalid JSON', async () => {
      const { code, parsed } = await runGrind('not json');
      expect(code).toBe(0);
      expect(parsed).toEqual({});
    });
  });

  describe('status', () => {
    it('outputs {} when status is aborted', async () => {
      const { code, parsed } = await runGrind({
        conversation_id: 'c1',
        status: 'aborted',
        loop_count: 0,
      });
      expect(code).toBe(0);
      expect(parsed).toEqual({});
    });

    it('outputs {} when status is error', async () => {
      const { code, parsed } = await runGrind({
        conversation_id: 'c1',
        status: 'error',
        loop_count: 0,
      });
      expect(code).toBe(0);
      expect(parsed).toEqual({});
    });
  });

  describe('loop_count >= MAX_ITERATIONS', () => {
    it('outputs {} when loop_count >= GRIND_MAX_ITERATIONS', async () => {
      const { code, parsed } = await runGrind(
        { conversation_id: 'c1', status: 'completed', loop_count: 3 },
        { GRIND_MAX_ITERATIONS: '3' }
      );
      expect(code).toBe(0);
      expect(parsed).toEqual({});
    });

    it('outputs followup_message when loop_count < max', async () => {
      const scratchpadPath = path.join(os.tmpdir(), `grind-test-${Date.now()}-no-done.md`);
      const { code, parsed } = await runGrind(
        { conversation_id: 'c1', status: 'completed', loop_count: 1 },
        { GRIND_MAX_ITERATIONS: '5', GRIND_SCRATCHPAD: scratchpadPath }
      );
      expect(code).toBe(0);
      expect(parsed).toHaveProperty('followup_message');
      expect(parsed.followup_message).toMatch(/Iteration 2\/5/);
    });
  });

  describe('scratchpad', () => {
    it('outputs followup_message when no scratchpad file exists', async () => {
      const scratchpadPath = path.join(os.tmpdir(), `grind-test-${Date.now()}-missing.md`);
      const { code, parsed } = await runGrind(
        { conversation_id: 'c1', status: 'completed', loop_count: 0 },
        { GRIND_SCRATCHPAD: scratchpadPath }
      );
      expect(code).toBe(0);
      expect(parsed).toHaveProperty('followup_message');
      expect(parsed.followup_message).toMatch(/DONE/);
    });

    it('outputs {} when scratchpad contains DONE', async () => {
      const tmpDir = path.join(os.tmpdir(), `grind-test-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      const scratchpadPath = path.join(tmpDir, 'scratchpad.md');
      fs.writeFileSync(scratchpadPath, 'DONE\n', 'utf8');
      const { code, parsed } = await runGrind(
        { conversation_id: 'c1', status: 'completed', loop_count: 0 },
        { GRIND_SCRATCHPAD: scratchpadPath }
      );
      expect(code).toBe(0);
      expect(parsed).toEqual({});
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('outputs followup_message when scratchpad exists but does not contain DONE', async () => {
      const tmpDir = path.join(os.tmpdir(), `grind-test-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      const scratchpadPath = path.join(tmpDir, 'scratchpad.md');
      fs.writeFileSync(scratchpadPath, 'still working\n', 'utf8');
      const { code, parsed } = await runGrind(
        { conversation_id: 'c1', status: 'completed', loop_count: 2 },
        { GRIND_MAX_ITERATIONS: '5', GRIND_SCRATCHPAD: scratchpadPath }
      );
      expect(code).toBe(0);
      expect(parsed).toHaveProperty('followup_message');
      expect(parsed.followup_message).toMatch(/Iteration 3\/5/);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
