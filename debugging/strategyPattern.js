/**
 * GoF Strategy: interchangeable algorithms.
 * Debug output can be sent via different strategies (console, buffer, silent).
 */

/**
 * Strategy interface: write a debug message.
 * @typedef {function(string, Object): void} WriteStrategy
 */

/**
 * Console strategy – logs to console with optional metadata.
 * @param {string} message
 * @param {Object} [meta]
 */
function consoleStrategy(message, meta = {}) {
    const line = meta.level ? `[${meta.level}] ${message}` : message;
    if (meta.level === 'error') {
        console.error(line, meta);
    } else if (meta.level === 'warn') {
        console.warn(line, meta);
    } else {
        console.log(line, meta);
    }
}

/**
 * Buffer strategy – collects messages for later inspection (e.g. tests).
 * @returns {{ buffer: string[], write: WriteStrategy, clear: function(): void }}
 */
function bufferStrategy() {
    const buffer = [];
    return {
        buffer,
        write(message, meta = {}) {
            buffer.push({ message, meta, at: Date.now() });
        },
        clear() {
            buffer.length = 0;
        }
    };
}

/**
 * Silent strategy – no-op for disabling debug output.
 */
function silentStrategy() {
    // no-op
}

/**
 * Context that uses the selected strategy.
 */
class DebugWriter {
    /**
     * @param {WriteStrategy} [strategy=consoleStrategy] – default: console
     */
    constructor(strategy = consoleStrategy) {
        this._strategy = strategy;
    }

    setStrategy(strategy) {
        this._strategy = strategy;
    }

    /**
     * @param {string} message
     * @param {Object} [meta]
     */
    write(message, meta = {}) {
        this._strategy(message, meta);
    }
}

// ---------------------------------------------------------------------------
// GoF Decorator: wrap a strategy to add behavior without changing the interface.
// Used to add timestamp, prefix, or filtering around any WriteStrategy.
// ---------------------------------------------------------------------------

/**
 * Decorator: wrap a WriteStrategy to add a timestamp to meta.
 * @param {WriteStrategy} inner – underlying strategy
 * @returns {WriteStrategy}
 */
function withTimestamp(inner) {
    return function write(message, meta = {}) {
        inner(message, { ...meta, timestamp: Date.now() });
    };
}

/**
 * Decorator: wrap a WriteStrategy to prefix every message.
 * @param {WriteStrategy} inner – underlying strategy
 * @param {string} prefix – e.g. "[VibeSwitch]"
 * @returns {WriteStrategy}
 */
function withPrefix(inner, prefix = '') {
    return function write(message, meta = {}) {
        inner(prefix ? `${prefix} ${message}` : message, meta);
    };
}

/**
 * Decorator: wrap a WriteStrategy to only forward messages when level matches (or meta.level is absent).
 * @param {WriteStrategy} inner – underlying strategy
 * @param {string} [minLevel] – 'error' | 'warn' | 'info'; only forward if meta.level is at least this severity
 * @returns {WriteStrategy}
 */
function withLevelFilter(inner, minLevel = 'info') {
    const order = { error: 0, warn: 1, info: 2 };
    return function write(message, meta = {}) {
        const level = meta.level || 'info';
        if (order[level] <= order[minLevel]) {
            inner(message, meta);
        }
    };
}

module.exports = {
    DebugWriter,
    consoleStrategy,
    bufferStrategy,
    silentStrategy,
    withTimestamp,
    withPrefix,
    withLevelFilter
};
