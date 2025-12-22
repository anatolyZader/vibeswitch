/**
 * ============================================================================
 * AWARENESS MONITOR - MODULE HUB
 * ============================================================================
 * 
 * This is the entry point for the awareness monitor module.
 * It re-exports the AwarenessMonitor class from awarenessMonitor.js
 * 
 * Usage:
 *   const AwarenessMonitor = require('./awarenessMonitor');
 *   const monitor = new AwarenessMonitor(usageStats, onScoreUpdate);
 * 
 * ============================================================================
 */

module.exports = require('./awarenessMonitor');
