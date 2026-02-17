/**
 * GoF Builder: separate construction of a complex object from its representation.
 * Used to build debug report configs (filters, format, destinations) step by step.
 */

/**
 * Product: debug report configuration.
 */
class DebugReportConfig {
    constructor() {
        this.levels = ['info', 'warn', 'error'];
        this.since = 0;
        this.limit = 100;
        this.format = 'text';
        this.includeTimestamp = true;
    }
}

/**
 * Builder: constructs DebugReportConfig with fluent interface.
 */
class DebugReportBuilder {
    constructor() {
        this._config = new DebugReportConfig();
    }

    levels(...levels) {
        this._config.levels = levels;
        return this;
    }

    since(timestamp) {
        this._config.since = timestamp;
        return this;
    }

    limit(n) {
        this._config.limit = n;
        return this;
    }

    format(fmt) {
        this._config.format = fmt;
        return this;
    }

    includeTimestamp(include = true) {
        this._config.includeTimestamp = include;
        return this;
    }

    build() {
        const config = this._config;
        this._config = new DebugReportConfig();
        return config;
    }
}

/**
 * Director: builds common preset configs.
 */
class DebugReportPresets {
    static minimal() {
        return new DebugReportBuilder()
            .levels('error')
            .limit(10)
            .includeTimestamp(false)
            .build();
    }

    static full() {
        return new DebugReportBuilder()
            .levels('info', 'warn', 'error')
            .since(Date.now() - 24 * 60 * 60 * 1000)
            .limit(1000)
            .format('text')
            .build();
    }

    static jsonExport() {
        return new DebugReportBuilder()
            .levels('info', 'warn', 'error')
            .format('json')
            .limit(500)
            .build();
    }
}

module.exports = {
    DebugReportConfig,
    DebugReportBuilder,
    DebugReportPresets
};
