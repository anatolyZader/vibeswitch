/**
 * Publishes content to LinkedIn. Implements IReportPublishPort.
 */
const { IReportPublishPort } = require('../../domain/ports/IReportPublishPort');

const LINKEDIN_API_SHARES_URL = 'https://api.linkedin.com/v2/shares';

class ReportLinkedInAdapter extends IReportPublishPort {
    constructor(opts = {}) {
        super();
        this.getAccessToken = opts.getAccessToken || (async () => null);
        this.fetchFn = opts.fetchFn || globalThis.fetch;
    }

    async publish(content, _options) {
        const token = await this.getAccessToken();
        if (!token || typeof token !== 'string') {
            return { ok: false, error: 'Missing or invalid LinkedIn access token' };
        }
        try {
            const res = await this.fetchFn(LINKEDIN_API_SHARES_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: { text: content }
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                return { ok: false, error: (data.message || data.error || res.statusText) || String(res.status) };
            }
            const id = data.id;
            return { ok: true, ...(id && { publishedId: id }) };
        } catch (err) {
            return { ok: false, error: (err && err.message) || String(err) };
        }
    }
}

module.exports = { ReportLinkedInAdapter };
