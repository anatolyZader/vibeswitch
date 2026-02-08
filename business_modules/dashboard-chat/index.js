/**
 * Dashboard-chat business module: read-only chat backend for the VibeSwitch dashboard.
 * Public API: reply(vscode, payload, userMessage, logger), getConfig(vscode).
 */

const { reply, getConfig } = require('./app/DashboardChatService');
const ContextBuilder = require('./app/ContextBuilder');

module.exports = {
    reply,
    getConfig,
    buildDashboardSummary: ContextBuilder.buildDashboardSummary
};
