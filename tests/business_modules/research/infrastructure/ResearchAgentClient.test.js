/**
 * Tests: ResearchAgentClient send (URL, method, body, auth, response handling).
 */
const { createResearchAgentClient } = require('../../../../business_modules/research/infrastructure/ResearchAgentClient');

describe('ResearchAgentClient', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test('send returns ok: false when baseUrl is empty', async () => {
        const client = createResearchAgentClient({ baseUrl: '' });
        const result = await client.send({ current: {}, history: [] });
        expect(result.ok).toBe(false);
        expect(result.error).toBe('Research agent URL not configured');
    });

    test('send POSTs to baseUrl/ingest with JSON body', async () => {
        let capturedUrl;
        let capturedOpts;
        global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
        const client = createResearchAgentClient({ baseUrl: 'https://agent.run.app' });
        const payload = { current: { timestamp: 1 }, history: [] };
        await client.send(payload);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        capturedUrl = global.fetch.mock.calls[0][0];
        capturedOpts = global.fetch.mock.calls[0][1];
        expect(capturedUrl).toBe('https://agent.run.app/ingest');
        expect(capturedOpts.method).toBe('POST');
        expect(capturedOpts.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(capturedOpts.body)).toEqual(payload);
    });

    test('send strips trailing slash from baseUrl', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
        const client = createResearchAgentClient({ baseUrl: 'https://agent.run.app/' });
        await client.send({ current: {}, history: [] });
        expect(global.fetch).toHaveBeenCalledWith('https://agent.run.app/ingest', expect.any(Object));
    });

    test('send adds Authorization Bearer when getApiKey returns a key', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
        const getApiKey = jest.fn().mockResolvedValue('secret-key');
        const client = createResearchAgentClient({ baseUrl: 'https://x.run.app', getApiKey });
        await client.send({ current: {}, history: [] });
        const opts = global.fetch.mock.calls[0][1];
        expect(opts.headers.Authorization).toBe('Bearer secret-key');
    });

    test('send returns ok: true on 200', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });
        const client = createResearchAgentClient({ baseUrl: 'https://x.run.app' });
        const result = await client.send({ current: {}, history: [] });
        expect(result.ok).toBe(true);
        expect(result.status).toBe(200);
    });

    test('send returns ok: false on 4xx', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, statusText: 'Bad Request' });
        const client = createResearchAgentClient({ baseUrl: 'https://x.run.app' });
        const result = await client.send({ current: {}, history: [] });
        expect(result.ok).toBe(false);
        expect(result.status).toBe(400);
        expect(result.error).toBeDefined();
    });

    test('send returns ok: false on 5xx', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502, statusText: 'Bad Gateway' });
        const client = createResearchAgentClient({ baseUrl: 'https://x.run.app' });
        const result = await client.send({ current: {}, history: [] });
        expect(result.ok).toBe(false);
        expect(result.status).toBe(502);
    });

    test('send returns ok: false on network error', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
        const client = createResearchAgentClient({ baseUrl: 'https://x.run.app' });
        const result = await client.send({ current: {}, history: [] });
        expect(result.ok).toBe(false);
        expect(result.error).toContain('Network error');
    });
});
