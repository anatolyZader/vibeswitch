class IReportPublishPort {
    async publish(content, opts) {
        throw new Error('publish not implemented');
    }
}
module.exports = IReportPublishPort;
