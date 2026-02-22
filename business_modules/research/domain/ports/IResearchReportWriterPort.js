/**
 * Port: generate report Markdown and write report file to disk.
 * Implemented by research report writer adapter (FS).
 * @abstract
 */
class IResearchReportWriterPort {
    /**
     * @param {Array<{ title?: string, link?: string, summary?: string, source: string, date?: string }>} items - NormalizedItem[]
     * @param {string} dateStr - YYYY-MM-DD
     * @returns {string} Markdown content
     */
    generateReportMarkdown(items, dateStr) {
        if (new.target === IResearchReportWriterPort) {
            throw new Error('IResearchReportWriterPort is abstract');
        }
        throw new Error('generateReportMarkdown() must be implemented');
    }

    /**
     * @param {string} reportsDir
     * @param {string} dateStr - YYYY-MM-DD
     * @param {string} content - Markdown content
     * @param {Object} [opts] - e.g. fsSync for testing
     * @returns {string} Full path of written file
     */
    writeReportFile(reportsDir, dateStr, content, opts) {
        if (new.target === IResearchReportWriterPort) {
            throw new Error('IResearchReportWriterPort is abstract');
        }
        throw new Error('writeReportFile() must be implemented');
    }
}

module.exports = { IResearchReportWriterPort };
