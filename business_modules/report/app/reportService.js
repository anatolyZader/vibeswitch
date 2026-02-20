/**
 * ReportService - Orchestrates publishing; no direct I/O (uses ports only).
 * Error style: never throw from publishReport for user input or adapter failures.
 * Return { [platform]: { success: false, error } } for validation and adapter errors.
 */

const KNOWN_PLATFORMS = ['medium', 'linkedin', 'x'];
const X_MAX_LEN = 280;

function truncateForX(text) {
    if (typeof text !== 'string') return text;
    if (text.length <= X_MAX_LEN) return text;
    return text.slice(0, X_MAX_LEN - 1) + '…';
}

class ReportService {
    constructor(deps) {
        this.publishAdapters = (deps && deps.publishAdapters) || {};
        /** @type {import('../domain/ports/IReportContentSourcePort')|null} */
        this.readReportPathPort = (deps && deps.readReportPathPort) || null;
    }

    async publishReport(reportInput, options) {
        const opts = options || {};
        const platforms = opts.platforms != null ? opts.platforms : Object.keys(this.publishAdapters).filter(p => KNOWN_PLATFORMS.includes(p));
        const result = {};

        // Resolve content from reportPath or content
        let content;
        if (reportInput.reportPath != null) {
            if (typeof reportInput.reportPath !== 'string') {
                for (const p of platforms) {
                    result[p] = { success: false, error: 'Invalid reportPath: must be a string' };
                }
                return result;
            }
            if (!this.readReportPathPort) {
                for (const p of platforms) {
                    result[p] = { success: false, error: 'Report path provided but readReportPathPort not configured' };
                }
                return result;
            }
            try {
                content = await this.readReportPathPort.read(reportInput.reportPath);
            } catch (err) {
                result.error = err.message || 'Report file not found';
                result.reportPath = reportInput.reportPath;
                return result;
            }
        } else if (reportInput.content != null) {
            if (typeof reportInput.content !== 'string') {
                for (const p of platforms) {
                    result[p] = { success: false, error: 'Invalid content: must be a string' };
                }
                return result;
            }
            content = reportInput.content;
        } else {
            for (const p of platforms) {
                result[p] = { success: false, error: 'Missing content or reportPath' };
            }
            return result;
        }

        if (content === '') {
            for (const p of platforms) {
                result[p] = { success: false, error: 'Empty content' };
            }
            return result;
        }

        for (const platform of platforms) {
            if (!KNOWN_PLATFORMS.includes(platform)) {
                result[platform] = { success: false, error: 'Unknown platform' };
                continue;
            }
            const adapter = this.publishAdapters[platform];
            const contentForPlatform = platform === 'x' ? truncateForX(content) : content;
            if (!adapter) {
                result[platform] = { success: false, error: 'Missing credentials' };
                continue;
            }
            try {
                const platformResult = await adapter.publish(contentForPlatform, opts);
                result[platform] = platformResult;
            } catch (err) {
                result[platform] = { success: false, error: err.message || String(err) };
            }
        }
        return result;
    }
}
module.exports = ReportService;
