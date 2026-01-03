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

// @ai
const MODULE_VERSION = '1.0.0';
const MODULE_NAME = 'AwarenessMonitor';

// @ai
function getModuleInfo() {
    return {
        name: MODULE_NAME,
        version: MODULE_VERSION,
        timestamp: Date.now()
    };
}

module.exports = require('./awarenessMonitor');
