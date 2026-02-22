/**
 * Adapter: implements IResearchReportWriterPort using reportGenerator (FS).
 */
const { generateReportMarkdown, writeReportFile } = require('../../researchReview/reportGenerator');

/**
 * Create a report writer adapter that implements IResearchReportWriterPort.
 * @returns {{ generateReportMarkdown: Function, writeReportFile: Function }}
 */
function createResearchReportWriterAdapter() {
    return {
        generateReportMarkdown(items, dateStr) {
            return generateReportMarkdown(items, dateStr);
        },
        writeReportFile(reportsDir, dateStr, content, opts) {
            return writeReportFile(reportsDir, dateStr, content, opts);
        }
    };
}

module.exports = {
    createResearchReportWriterAdapter
};
