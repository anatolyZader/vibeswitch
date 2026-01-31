/**
 * Mode-Enforcement Module
 *
 * Provides hard enforcement of DEV/VIBE mode through:
 * - ModeManager: Secure mode storage with filesystem mirror for hooks
 * - HooksJsonGuard: Tamper detection and restoration of hooks.json
 * - CapabilitySelfTest: Integrity verification of the setup
 * - WorkspaceAllowlist: Trusted workspace management
 * - AlertFileEditDetector: Detection of unapproved built-in editor writes
 * - KeypairManager: Ed25519 keypair for token signing
 * - ApprovalManager: MCP patch request approval workflow
 */

const ModeManager = require('./app/modeManager');
const HooksJsonGuard = require('./app/hooksJsonGuard');
const CapabilitySelfTest = require('./app/capabilitySelfTest');
const WorkspaceAllowlist = require('./app/workspaceAllowlist');
const AlertFileEditDetector = require('./app/alertFileEditDetector');
const KeypairManager = require('./app/keypairManager');
const ApprovalManager = require('./app/approvalManager');

module.exports = {
    ModeManager,
    HooksJsonGuard,
    CapabilitySelfTest,
    WorkspaceAllowlist,
    AlertFileEditDetector,
    KeypairManager,
    ApprovalManager
};
