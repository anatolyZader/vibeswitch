/**
 * Report application service: publish report content to X, LinkedIn, Medium.
 * Receives content in-memory or path; resolves content via IReportContentSourcePort when path given;
 * publishes via IReportPublishPort per platform.
 */

const KNOWN_PLATFORMS = ['x', 'linkedin', 'medium'];

function createReportService(deps) {
    const { contentSourcePort, publishAdapters } = deps || {};

    async function publishReport(input) {
        const hasContent = input && typeof input.content === 'string';
        const hasPath = input && typeof input.contentPath === 'string' && input.contentPath.length > 0;
        if (!hasContent && !hasPath) {
            return { ok: false, results: [], error: 'Missing content or contentPath' };
        }
        if (input && input.content !== undefined && typeof input.content !== 'string') {
            return { ok: false, results: [], error: 'content must be a string' };
        }

        let content;
        if (hasContent) {
            content = input.content;
        } else {
            try {
                content = await contentSourcePort.read(input.contentPath);
            } catch (err) {
                return {
                    ok: false,
                    results: [],
                    error: (err && err.message) || String(err)
                };
            }
        }

        let platforms = Array.isArray(input.platforms) ? input.platforms : KNOWN_PLATFORMS;
        platforms = [...new Set(platforms)].filter((p) => KNOWN_PLATFORMS.includes(p));

        if (platforms.length === 0) {
            return { ok: true, results: [] };
        }

        const results = [];
        for (const platform of platforms) {
            const adapter = publishAdapters && publishAdapters[platform];
            if (!adapter) continue;
            try {
                const outcome = await adapter.publish(content, { platform });
                results.push({
                    platform,
                    ok: !!outcome.ok,
                    ...(outcome.publishedId != null && { publishedId: outcome.publishedId }),
                    ...(outcome.error != null && { error: outcome.error })
                });
            } catch (err) {
                results.push({
                    platform,
                    ok: false,
                    error: (err && err.message) || String(err)
                });
            }
        }

        const ok = results.every((r) => r.ok);
        const out = { ok, results };
        if (!ok) {
            const firstError = results.find((r) => r.error);
            out.error = firstError ? firstError.error : 'Partial failure';
        }
        return out;
    }

    return { publishReport };
}

module.exports = { createReportService };
