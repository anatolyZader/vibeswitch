/**
 * Reads report content from the filesystem. Implements IReportContentSourcePort.
 * Used when reportInput.reportPath is provided; keeps fs I/O out of app layer.
 */
const { promises: fs } = require('fs');
const IReportContentSourcePort = require('../../domain/ports/IReportContentSourcePort');

class ReportFsContentSourceAdapter extends IReportContentSourcePort {
    async read(path) {
        const content = await fs.readFile(path, 'utf8');
        return content;
    }
}

module.exports = ReportFsContentSourceAdapter;
