/**
 * Value object: normalized insight item from research fetchers (arXiv, Medium, LinkedIn, X).
 * Each fetcher returns an array of NormalizedItem.
 *
 * @typedef {Object} NormalizedItem
 * @property {string} [title]
 * @property {string} [link]
 * @property {string} [summary]
 * @property {string} source - e.g. 'arxiv', 'medium', 'linkedin', 'x'
 * @property {string} [date]
 */

const SOURCES = ['arxiv', 'medium', 'linkedin', 'x'];

module.exports = {
    SOURCES
};
