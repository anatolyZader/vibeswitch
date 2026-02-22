/**
 * Publishes content to X (Twitter). Implements IReportPublishPort.
 */
const { IReportPublishPort } = require('../../domain/ports/IReportPublishPort');

const X_API_TWEETS_URL = 'https://api.twitter.com/2/tweets';

class ReportXAdapter extends IReportPublishPort {
    constructor(opts = {}) {
        super();
        this.getBearerToken = opts.getBearerToken || (async () => null);
        this.fetchFn = opts.fetchFn || globalThis.fetch;
    }

    async publish(content, _options) {
        const token = await this.getBearerToken();
        if (!token || typeof token !== 'string') {
            return { ok: false, error: 'Missing or invalid X bearer token' };
        }
        try {
            const res = await this.fetchFn(X_API_TWEETS_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: content })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                return { ok: false, error: (data.detail || data.error || res.statusText) || String(res.status) };
            }
            const id = data.data && data.data.id;
            return { ok: true, ...(id && { publishedId: id }) };
        } catch (err) {
            return { ok: false, error: (err && err.message) || String(err) };
        }
    }
}

module.exports = { ReportXAdapter };
