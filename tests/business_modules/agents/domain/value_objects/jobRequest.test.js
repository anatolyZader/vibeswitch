const { createJobRequest } = require('../../../../../business_modules/agents/domain/value_objects/jobRequest');

describe('createJobRequest', () => {
  test('returns object with schemaVersion 1.0.0 and all params', () => {
    const params = {
      correlationId: 'cid-1',
      repoId: 'repo-1',
      branch: 'main',
      commit: 'abc123',
      changedFiles: [{ path: 'a.js', patch: '', language: 'js', size: 0 }],
      context: { mode: 'dev', riskLevel: 'medium', userSettings: {} },
      capabilities: { canSuggestFixes: true, maxTokens: 4000, timeBudgetMs: 30000 }
    };
    const out = createJobRequest(params);
    expect(out.schemaVersion).toBe('1.0.0');
    expect(out.correlationId).toBe('cid-1');
    expect(out.metadata).toEqual({});
  });
  test('metadata omitted sets metadata to empty object', () => {
    const params = {
      correlationId: 'c', repoId: 'r', branch: 'b', commit: 'c2',
      changedFiles: [], context: {}, capabilities: {}
    };
    const out = createJobRequest(params);
    expect(out.metadata).toEqual({});
  });
  test('metadata provided is included', () => {
    const params = {
      correlationId: 'c', repoId: 'r', branch: 'b', commit: 'c2',
      changedFiles: [], context: {}, capabilities: {},
      metadata: { packageJson: { name: 'foo' } }
    };
    const out = createJobRequest(params);
    expect(out.metadata).toEqual({ packageJson: { name: 'foo' } });
  });
});
