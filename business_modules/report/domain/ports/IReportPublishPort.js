/**
 * Port: publish text content to one platform.
 * Implemented by reportXAdapter, reportLinkedInAdapter, reportMediumAdapter (each bound to one platform).
 * @abstract
 */
class IReportPublishPort {
    /**
     * @param {string} content
     * @param {{ platform?: 'x'|'linkedin'|'medium' }} [options]
     * @returns {Promise<{ ok: boolean, publishedId?: string, error?: string }>}
     */
    async publish(content, options) {
        if (new.target === IReportPublishPort) {
            throw new Error('IReportPublishPort is abstract');
        }
        throw new Error('publish() must be implemented');
    }
}

module.exports = { IReportPublishPort };
