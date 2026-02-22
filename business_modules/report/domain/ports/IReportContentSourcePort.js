/**
 * Port: read report content from a source (e.g. file path).
 * Implemented by reportFsContentSourceAdapter.
 * @abstract
 */
class IReportContentSourcePort {
    /**
     * @param {string} path
     * @returns {Promise<string>}
     */
    async read(path) {
        if (new.target === IReportContentSourcePort) {
            throw new Error('IReportContentSourcePort is abstract');
        }
        throw new Error('read() must be implemented');
    }
}

module.exports = { IReportContentSourcePort };
