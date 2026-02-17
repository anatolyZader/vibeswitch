/**
 * Research Analysis Agent - Fastify server for Google Cloud Run.
 * Stateless: receives payload from extension (current + history from extension SQLite).
 * Performs analysis on the provided data; no persistence.
 */

const fastify = require('fastify')({ logger: true });
const { runAnalysis } = require('./analysis');

const INGEST_PATH = '/ingest';

fastify.post(INGEST_PATH, async (request, reply) => {
    const payload = request.body || {};
    const current = payload.current || payload;
    request.log.info(
        { timestamp: current.timestamp, source: current.source, historyLength: Array.isArray(payload.history) ? payload.history.length : 0 },
        'Research ingest received'
    );
    const result = runAnalysis(payload);
    return reply.code(200).send(result);
});

fastify.get('/health', async (_request, reply) => {
    return reply.code(200).send({ status: 'ok' });
});

const port = parseInt(process.env.PORT || '8080', 10);
const host = process.env.HOST || '0.0.0';

fastify.listen({ port, host }, (err) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
});

