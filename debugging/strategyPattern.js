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

module.exports = {
    DebugWriter,
    consoleStrategy,
    bufferStrategy,
    silentStrategy
};
