/**
 * Input layer: receives the message entering the module and delegates to app-layer controller.
 * No extraction, no business logic; resolve app ReportController from DI and call it.
 */
class ReportInput {
    constructor({ reportController: appController }) {
        this.appController = appController;
    }

    async publishReport(requestOrInput) {
        return this.appController.publishReport(requestOrInput);
    }
}

module.exports = { ReportInput };
