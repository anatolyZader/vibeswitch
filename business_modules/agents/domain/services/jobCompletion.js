/**
 * Domain service: aggregate findings from completed gateway jobs.
 * Pure logic; no ports or infrastructure.
 */

/**
 * Collect all findings from jobs that have a findings array.
 * @param {Object[]} jobs - Array of job objects from gateway (e.g. { status, findings? })
 * @returns {Object[]} Flattened array of findings
 */
function aggregateFindingsFromJobs(jobs) {
    if (!jobs || !Array.isArray(jobs)) return [];
    const allFindings = [];
    jobs.forEach(job => {
        if (job.findings && Array.isArray(job.findings)) {
            allFindings.push(...job.findings);
        }
    });
    return allFindings;
}

/**
 * Check if all jobs are in a terminal state (completed or failed).
 * @param {Object[]} jobs - Array of job objects with status
 * @returns {boolean}
 */
function allJobsTerminal(jobs) {
    if (!jobs || !Array.isArray(jobs)) return false;
    return jobs.length > 0 && jobs.every(job => job.status === 'completed' || job.status === 'failed');
}

module.exports = {
    aggregateFindingsFromJobs,
    allJobsTerminal
};
