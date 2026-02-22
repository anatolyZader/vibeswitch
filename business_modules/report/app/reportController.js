/**
 * App layer: accept request/message, extract data, call report service.
 * No HTTP or framework APIs; receives raw message and delegates to reportService.
 */
class ReportController {
    constructor({ reportService: svc }) {
        this.reportService = svc;
    }

    async publishReport(requestOrInput) {
        const input = requestOrInput && typeof requestOrInput === 'object' && requestOrInput.content !== undefined
            ? requestOrInput
            : (requestOrInput && requestOrInput.body) || requestOrInput;
        return this.reportService.publishReport(input || {});
    }
}

module.exports = { ReportController };
