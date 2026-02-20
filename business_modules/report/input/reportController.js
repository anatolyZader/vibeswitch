const ReportService = require('../app/reportService');
function createReportController(deps) {
    const reportService = (deps && deps.reportService) || new ReportService(deps || {});
    return {
        async publishReport(reportInput, options) {
            return reportService.publishReport(reportInput, options);
        }
    };
}
module.exports = { createReportController };
