/**
 * CapabilitySelfTest - Verifies the integrity of the capability enforcement setup
 * 
 * Runs on activation and periodically to ensure:
 * - Hook scripts exist and are executable
 * - Critical config files exist (mode.json, mcp-server.json, workspaces.json)
 * - jq is installed (required for hook scripts)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const VIBESWITCH_DIR = path.join(os.homedir(), '.vibeswitch');
const HOOKS_DIR = path.join(VIBESWITCH_DIR, 'hooks');
const STATE_DIR = path.join(VIBESWITCH_DIR, 'state');

const REQUIRED_HOOKS = [
    'gate-shell.sh',
    'gate-mcp.sh',
    'inject-context.sh',
    'detect-edit.sh'
];

const REQUIRED_CONFIG = [
    'mode.json',
    'mcp-server.json',
    'workspaces.json'
];

class CapabilitySelfTest {
    constructor() {
        this._lastResult = null;
        this._intervalId = null;
    }

    /**
     * Check if a file exists and is executable
     */
    _isExecutable(filePath) {
        try {
            fs.accessSync(filePath, fs.constants.X_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Check if jq is installed
     */
    _isJqInstalled() {
        try {
            execSync('which jq', { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Run all checks
     * @returns {{passed: boolean, errors: string[], warnings: string[]}}
     */
    run() {
        const errors = [];
        const warnings = [];

        // Check jq
        if (!this._isJqInstalled()) {
            errors.push('jq is not installed. Hook scripts will fail-closed to DEV mode.');
        }

        // Check hook scripts
        for (const hook of REQUIRED_HOOKS) {
            const hookPath = path.join(HOOKS_DIR, hook);
            if (!fs.existsSync(hookPath)) {
                errors.push(`Missing hook script: ${hook}`);
            } else if (!this._isExecutable(hookPath)) {
                errors.push(`Hook script not executable: ${hook}`);
            }
        }

        // Check config files
        for (const config of REQUIRED_CONFIG) {
            const configPath = path.join(STATE_DIR, config);
            if (!fs.existsSync(configPath)) {
                warnings.push(`Missing config file: ${config} (will be created on first use)`);
            }
        }

        // Check directories exist
        if (!fs.existsSync(HOOKS_DIR)) {
            errors.push(`Missing hooks directory: ${HOOKS_DIR}`);
        }
        if (!fs.existsSync(STATE_DIR)) {
            errors.push(`Missing state directory: ${STATE_DIR}`);
        }

        const passed = errors.length === 0;
        this._lastResult = { passed, errors, warnings };
        
        return this._lastResult;
    }

    /**
     * Get last test result
     */
    getLastResult() {
        return this._lastResult;
    }

    /**
     * Start periodic self-test (every 5 minutes)
     * @param {Function} onFailure - Callback when test fails
     */
    startPeriodic(onFailure) {
        if (this._intervalId) {
            clearInterval(this._intervalId);
        }

        const runAndReport = () => {
            const result = this.run();
            if (!result.passed && onFailure) {
                onFailure(result);
            }
        };

        // Run immediately
        runAndReport();

        // Then every 5 minutes
        this._intervalId = setInterval(runAndReport, 5 * 60 * 1000);
    }

    /**
     * Stop periodic testing
     */
    stop() {
        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
    }

    /**
     * Cleanup
     */
    dispose() {
        this.stop();
    }
}

module.exports = CapabilitySelfTest;
