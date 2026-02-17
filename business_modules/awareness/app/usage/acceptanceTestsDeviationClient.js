/**
 * Acceptance tests deviation client - Runs workspace test command and returns deviation (0-100).
 */
const { spawn } = require('child_process');
const DEFAULT_COMMAND = 'npm test';
const DEFAULT_TIMEOUT_MS = 60000;

function parseTestOutput(stdout) {
  if (!stdout || typeof stdout !== 'string') return null;
  let passed = 0, failed = 0;
  const passedMatch = stdout.match(/(\d+)\s+passed?/i) || stdout.match(/(\d+)\s+passing/i);
  const failedMatch = stdout.match(/(\d+)\s+failed?/i) || stdout.match(/(\d+)\s+failing/i);
  const totalMatch = stdout.match(/(\d+)\s+total/i) || stdout.match(/(\d+)\s+tests?/i);
  if (passedMatch) passed = parseInt(passedMatch[1], 10);
  if (failedMatch) failed = parseInt(failedMatch[1], 10);
  let total = totalMatch ? parseInt(totalMatch[1], 10) : passed + failed;
  if (total <= 0) total = passed + failed;
  if (total <= 0) return null;
  return { passed, failed, total };
}

function createAcceptanceTestsDeviationClient(opts) {
  const getWorkspaceRoot = opts && opts.getWorkspaceRoot ? opts.getWorkspaceRoot : () => '';
  const getCommand = opts && opts.getCommand ? opts.getCommand : () => DEFAULT_COMMAND;
  const getTimeoutMs = opts && opts.getTimeoutMs ? opts.getTimeoutMs : () => DEFAULT_TIMEOUT_MS;
  const logger = opts && opts.loggerPort ? opts.loggerPort : null;

  async function fetchMeasures() {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot || typeof workspaceRoot !== 'string' || !workspaceRoot.trim()) return null;
    const cmd = getCommand();
    const timeoutMs = Math.max(5000, getTimeoutMs());
    const parts = (cmd || DEFAULT_COMMAND).trim().split(/\s+/);
    const exec = parts[0];
    const args = parts.slice(1);
    return new Promise((resolve) => {
      const child = spawn(exec, args, { cwd: workspaceRoot, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      child.stdout.on('data', (d) => { out += d.toString(); });
      child.stderr.on('data', (d) => { out += d.toString(); });
      const t = setTimeout(() => {
        try { child.kill('SIGTERM'); } catch (_) {}
        const p = parseTestOutput(out);
        if (p && p.total > 0) {
          const d = Math.round(100 * (p.failed / p.total));
          resolve({ deviation0To100: Math.max(0, Math.min(100, d)), total: p.total, passed: p.passed, failed: p.failed });
        } else resolve(null);
      }, timeoutMs);
      child.on('close', () => {
        clearTimeout(t);
        const p = parseTestOutput(out);
        if (p && p.total > 0) {
          const d = Math.round(100 * (p.failed / p.total));
          resolve({ deviation0To100: Math.max(0, Math.min(100, d)), total: p.total, passed: p.passed, failed: p.failed });
        } else resolve(null);
      });
      child.on('error', (err) => { clearTimeout(t); if (logger && logger.error) logger.error('Acceptance tests deviation: spawn failed', err); resolve(null); });
    });
  }
  return { fetchMeasures };
}

module.exports = { createAcceptanceTestsDeviationClient, parseTestOutput, DEFAULT_COMMAND, DEFAULT_TIMEOUT_MS };
