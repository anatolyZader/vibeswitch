/**
 * X (Twitter) publish adapter - implements IReportPublishPort for X.com.
 * Truncates content to 280 chars; uses injected fetch for HTTP.
 */

const IReportPublishPort = require('../../domain/ports/IReportPublishPort');

const X_MAX_LEN = 280;

function truncateForX(text) {
    if (typeof text !== 'string') return text;
    if (text.length <= X_MAX_LEN) return text;
    return text.slice(0, X_MAX_LEN - 1) + '…';
}

class ReportXAdapter extends IReportPublishPort {
    constructor(deps = {}) {
        super();
        this.fetch = deps.fetch || (typeof globalThis.fetch === 'function' ? globalThis.fetch : null);
    }

    async publish(content, opts) {
        const fetchFn = this.fetch;
        if (!fetchFn) {
            return { success: false, error: 'X adapter: fetch not configured' };
        }
        const truncated = truncateForX(content);
        try {
            const res = await fetchFn('https://api.twitter.com/2/tweets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: truncated })
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                return { success: false, error: body.error || body.detail || res.statusText || String(res.status) };
            }
            const postId = body.data && body.data.id != null ? String(body.data.id) : (body.id != null ? String(body.id) : undefined);
            const url = body.url != null ? String(body.url) : (postId ? `https://x.com/i/status/${postId}` : undefined);
            return {
                success: true,
                postId: postId || undefined,
                url: url || undefined
            };
        } catch (err) {
            return { success: false, error: err.message || String(err) };
        }
    }
}

module.exports = ReportXAdapter;
