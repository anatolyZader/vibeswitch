/**
 * Research module domain contracts.
 *
 * @typedef {Object} TimeSeriesRow
 * @property {string} timestamp - ISO 8601
 * @property {string|null} session_id
 * @property {string} measure_name
 * @property {number} value
 *
 * @typedef {Object} AnalysisResult
 * @property {string} method - e.g. "correlation", "regression"
 * @property {string} [design]
 * @property {string} [equations]
 * @property {string} [findings]
 * @property {Object} [pValues]
 */

module.exports = {};
