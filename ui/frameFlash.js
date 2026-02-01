/**
 * 
 * Frame flash: when awareness score crosses a high threshold, show a cyan "flash"
 * using only themeable/in-process UI (no configuration.update).
 *
 * - Editor decoration: cyan background tint + overview ruler + border on top of file (first ~120 lines).
 * - Status bar pulse: StatusBarItem with text and foreground color.
 *
 * Outer-frame (window.border / workbench.colorCustomizations) is unsupported in
 * this Cursor build; all flash is extension-controlled and does not touch config.
 */

const vscode = require('vscode');

/** Default flash color (cyan). */
const DEFAULT_FLASH_COLOR = '#00FFFF';

/**
 * Sanitize to a strict hex color string (#RRGGBB).
 * @param {*} value - config value (may be string or object)
 * @returns {string} hex color
 */
function sanitizeHexColor(value) {
    const s = typeof value === 'string' ? value.trim() : '';
    if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s;
    return DEFAULT_FLASH_COLOR;
}

let lastScore = 0;
let cooldownUntil = 0;

// --- Decoration (background tint + overview ruler + border on top chunk) ---
/** @type {vscode.TextEditorDecorationType|null} */
let flashDecorationType = null;
/** @type {ReturnType<typeof setTimeout>|null} */
let flashDecorationTimer = null;
/** @type {vscode.TextEditor|null} */
let lastFlashedEditor = null;

/**
 * Flash active editor with cyan background tint, overview ruler, and border on first ~120 lines for durationMs.
 * Uses fixed literal strings for decoration options to avoid Cursor TrustedScript/TrustedString blocks.
 * No-op if no active text editor.
 */
function flashActiveEditorFrame(durationMs, _color) {
    const ed = vscode.window.activeTextEditor;
    if (!ed) return;

    if (!flashDecorationType) {
        flashDecorationType = vscode.window.createTextEditorDecorationType({
            isWholeLine: true,
            backgroundColor: 'rgba(0,255,255,0.18)',
            overviewRulerColor: '#00FFFF',
            overviewRulerLane: vscode.OverviewRulerLane.Full,
            border: '2px solid #00FFFF',
            borderRadius: '6px'
        });
    }

    const lineCount = ed.document.lineCount;
    const maxLine = lineCount === 0 ? 0 : Math.min(lineCount - 1, 120);
    const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(maxLine, 0));
    ed.setDecorations(flashDecorationType, [range]);
    lastFlashedEditor = ed;

    if (flashDecorationTimer) clearTimeout(flashDecorationTimer);
    flashDecorationTimer = setTimeout(() => {
        flashDecorationTimer = null;
        try {
            if (lastFlashedEditor && flashDecorationType) {
                lastFlashedEditor.setDecorations(flashDecorationType, []);
            }
        } catch (_) {}
        lastFlashedEditor = null;
    }, durationMs);
}

// --- Status bar pulse ---
/** @type {vscode.StatusBarItem|null} */
let flashStatusBarItem = null;
/** @type {ReturnType<typeof setTimeout>|null} */
let flashStatusBarTimer = null;

function ensureFlashStatusBarItem() {
    if (flashStatusBarItem) return;
    flashStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
}

/**
 * Show status bar item with text and theme color for durationMs.
 * Uses ThemeColor (no raw hex) to avoid Cursor TrustedScript/TrustedString blocks.
 */
function flashStatusBarPulse(text, durationMs, _color) {
    ensureFlashStatusBarItem();
    flashStatusBarItem.text = text;
    flashStatusBarItem.color = new vscode.ThemeColor('editorWarning.foreground');
    flashStatusBarItem.show();

    if (flashStatusBarTimer) clearTimeout(flashStatusBarTimer);
    flashStatusBarTimer = setTimeout(() => {
        flashStatusBarTimer = null;
        try {
            if (flashStatusBarItem) flashStatusBarItem.hide();
        } catch (_) {}
    }, durationMs);
}

/** Max flash duration (ms) so effect is visible even when host is laggy. */
const FLASH_DURATION_CAP_MS = 1000;

/**
 * Unified cyan flash: editor decoration + status bar pulse.
 * No config writes. Duration capped at FLASH_DURATION_CAP_MS for visibility.
 * @param {number} durationMs - how long to show (ms)
 * @param {Object} [options] - optional overrides
 * @param {string} [options.color] - hex color (default from config or DEFAULT_FLASH_COLOR)
 * @param {string} [options.statusBarText] - status bar message (default '⚠ High awareness')
 */
function flashCyan(durationMs, options = {}) {
    const config = vscode.workspace.getConfiguration('vibeswitch');
    const configDuration = config.get('awarenessHighScoreFrameFlashDurationMs', 1500);
    const effectiveDuration = typeof durationMs === 'number' && durationMs > 0
        ? Math.min(durationMs, FLASH_DURATION_CAP_MS)
        : Math.min(configDuration, FLASH_DURATION_CAP_MS);
    const color = options.color !== undefined ? options.color : config.get('awarenessHighScoreFrameFlashColor', DEFAULT_FLASH_COLOR);
    const statusBarText = options.statusBarText || '⚠ High awareness';

    try {
        flashActiveEditorFrame(effectiveDuration, color);
    } catch (_) {}
    try {
        flashStatusBarPulse(statusBarText, effectiveDuration, color);
    } catch (_) {}
}

/**
 * Flash when score crosses the high threshold upward. Uses cooldown; reads config for enabled, threshold, duration, color.
 */
function flashCyanIfHighScore(score, options = {}) {
    const config = vscode.workspace.getConfiguration('vibeswitch');
    const enabled = options.enabled !== undefined ? options.enabled : config.get('awarenessHighScoreFrameFlash', true);
    const threshold = options.threshold !== undefined ? options.threshold : config.get('awarenessHighScoreFrameFlashThreshold', 60);
    const durationMs = options.durationMs !== undefined ? options.durationMs : config.get('awarenessHighScoreFrameFlashDurationMs', 1500);
    const cooldownMs = options.cooldownMs !== undefined ? options.cooldownMs : 10000;
    const color = options.color !== undefined ? options.color : config.get('awarenessHighScoreFrameFlashColor', DEFAULT_FLASH_COLOR);

    if (!enabled || typeof score !== 'number' || !Number.isFinite(score)) {
        lastScore = score;
        return;
    }

    const crossedUp = score >= threshold && lastScore < threshold;
    lastScore = score;

    if (!crossedUp) return;
    if (Date.now() < cooldownUntil) return;

    cooldownUntil = Date.now() + cooldownMs;

    flashCyan(Math.min(durationMs, FLASH_DURATION_CAP_MS), { color, statusBarText: '⚠ High awareness' });
}

/**
 * Trigger the cyan flash once (for manual testing). Reads config duration; capped at FLASH_DURATION_CAP_MS.
 */
function triggerFlashNow() {
    const config = vscode.workspace.getConfiguration('vibeswitch');
    const configDuration = config.get('awarenessHighScoreFrameFlashDurationMs', 1500);
    const color = config.get('awarenessHighScoreFrameFlashColor', DEFAULT_FLASH_COLOR);
    flashCyan(Math.min(configDuration, FLASH_DURATION_CAP_MS), { color, statusBarText: 'Flash (test)' });
}

/**
 * Cancel pending flash, clear decoration, hide status bar item, dispose resources.
 * No config restore (nothing was written).
 */
function disposeFrameFlash() {
    if (flashDecorationTimer) {
        clearTimeout(flashDecorationTimer);
        flashDecorationTimer = null;
    }
    try {
        if (lastFlashedEditor && flashDecorationType) {
            lastFlashedEditor.setDecorations(flashDecorationType, []);
        }
    } catch (_) {}
    lastFlashedEditor = null;

    if (flashDecorationType) {
        flashDecorationType.dispose();
        flashDecorationType = null;
    }

    if (flashStatusBarTimer) {
        clearTimeout(flashStatusBarTimer);
        flashStatusBarTimer = null;
    }
    try {
        if (flashStatusBarItem) flashStatusBarItem.hide();
    } catch (_) {}
    if (flashStatusBarItem) {
        flashStatusBarItem.dispose();
        flashStatusBarItem = null;
    }

    cooldownUntil = 0;
}

module.exports = {
    flashCyanIfHighScore,
    /** @deprecated Use flashCyanIfHighScore */
    flashWindowBorderIfHighScore: flashCyanIfHighScore,
    triggerFlashNow,
    disposeFrameFlash,
    flashCyan
};
