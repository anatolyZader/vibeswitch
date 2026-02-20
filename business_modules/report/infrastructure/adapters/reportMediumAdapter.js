/**
 * Medium publish adapter - implements IReportPublishPort for Medium.
 * Uses injected fetch for HTTP (no real network in tests).
 */

const IReportPublishPort = require('../../domain/ports/IReportPublishPort');

class ReportMediumAdapter extends IReportPublishPort {
    constructor(deps = {}) {
        super();
        this.fetch = deps.fetch || (typeof globalThis.fetch === 'function' ? globalThis.fetch : null);
    }

    async publish(content, opts) {
        const fetchFn = this.fetch;
        if (!fetchFn) {
            return { success: false, error: 'Medium adapter: fetch not configured' };
        }
        try {
            const res = await fetchFn('https://api.medium.com/v1/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                return { success: false, error: body.message || body.error || res.statusText || String(res.status) };
            }
            return {
                success: true,
                postId: body.id != null ? String(body.id) : undefined,
                url: body.url != null ? String(body.url) : undefined
            };
        } catch (err) {
            return { success: false, error: err.message || String(err) };
        }
    }
}

module.exports = ReportMediumAdapter;
