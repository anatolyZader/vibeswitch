/**
 * Publishes content to Medium. Implements IReportPublishPort.
 */
const { IReportPublishPort } = require('../../domain/ports/IReportPublishPort');

const MEDIUM_API_POSTS_URL = 'https://api.medium.com/v1/users/me/posts';

class ReportMediumAdapter extends IReportPublishPort {
    constructor(opts = {}) {
        super();
        this.getIntegrationToken = opts.getIntegrationToken || (async () => null);
        this.fetchFn = opts.fetchFn || globalThis.fetch;
    }

    async publish(content, _options) {
        const token = await this.getIntegrationToken();
        if (!token || typeof token !== 'string') {
            return { ok: false, error: 'Missing or invalid Medium integration token' };
        }
        try {
            const res = await this.fetchFn(MEDIUM_API_POSTS_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: 'Report',
                    contentFormat: 'markdown',
                    content
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                return { ok: false, error: (data.errors && data.errors[0] && data.errors[0].message) || data.message || res.statusText || String(res.status) };
            }
            const id = data.data && data.data.id;
            return { ok: true, ...(id && { publishedId: id }) };
        } catch (err) {
            return { ok: false, error: (err && err.message) || String(err) };
        }
    }
}

module.exports = { ReportMediumAdapter };
