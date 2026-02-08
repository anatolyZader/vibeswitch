/**
 * Dashboard-chat domain: request/response shapes and read-only policy.
 *
 * Read-only policy: This module must not perform writes, run terminal commands,
 * or call git. No tools/functions are passed to the LLM. Only read APIs are used
 * (getText, findFiles, openTextDocument, workspace.textDocuments).
 */

/**
 * @typedef {Object} DashboardChatRequest
 * @property {Object} payload - Current dashboard payload (scoreData, events, antipatternBreakdown, tokenUsage, capabilities)
 * @property {string} userMessage - User's message
 */

/**
 * @typedef {Object} DashboardChatResponse
 * @property {string|null} text - Assistant reply text, or null if disabled/error
 * @property {string} [error] - Error message when request failed
 */

module.exports = {
    // Request/response are implicit in reply(payload, userMessage) -> { text, error? }
};
