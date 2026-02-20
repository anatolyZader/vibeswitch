/**
 * IReportContentSourcePort - Interface for reading report content from a path (e.g. file).
 * Keeps ReportService orchestration-only; no direct fs I/O in app layer.
 */
class IReportContentSourcePort {
    /**
     * Read content from the given path (e.g. file path).
     * @param {string} path - Path to the report (e.g. absolute file path).
     * @returns {Promise<string>} Report content (e.g. markdown). Rejects if not found or read fails.
     */
    async read(path) {
        throw new Error('read not implemented');
    }
}
module.exports = IReportContentSourcePort;
