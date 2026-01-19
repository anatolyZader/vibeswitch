/**
 * IRateLimiterPort (interface)
 *
 * Enforces budgets/throttling (per-minute, per-day, etc).
 */
class IRateLimiterPort {
    // eslint-disable-next-line no-unused-vars
    async tryConsume({ key, cost = 1, now = Date.now() }) {
        throw new Error('IRateLimiterPort.tryConsume not implemented');
    }
}

module.exports = IRateLimiterPort;

