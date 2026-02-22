/**
 * Agent response (value object) - job response from gateway.
 */

function createJobResponse(params) {
    return {
        jobId: params.jobId,
        status: params.status || 'pending',
        findings: params.findings || []
    };
}

module.exports = {
    createJobResponse
};
