/**
 * Reads report content from the file system. Implements IReportContentSourcePort.
 */
const { IReportContentSourcePort } = require('../../domain/ports/IReportContentSourcePort');
const fs = require('fs').promises;

class ReportFsContentSourceAdapter extends IReportContentSourcePort {
    async read(path) {
        const content = await fs.readFile(path, 'utf8');
        return content;
    }
}

module.exports = { ReportFsContentSourceAdapter };
