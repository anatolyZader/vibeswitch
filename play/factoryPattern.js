/**
 * GoF Factory Method: define an interface for creating objects, let subclasses decide which class to instantiate.
 * Used for creating different debug sinks (console, file, remote) without coupling to concrete types.
 */

/**
 * Base product: debug sink interface.
 */
class DebugSink {
    write(message, meta) {
        throw new Error('Subclass must implement write()');
    }
}

/**
 * Concrete product: console sink.
 */
class ConsoleDebugSink extends DebugSink {
    write(message, meta = {}) {
        const line = meta.level ? `[${meta.level}] ${message}` : message;
        if (meta.level === 'error') console.error(line);
        else if (meta.level === 'warn') console.warn(line);
        else console.log(line);
    }
}

/**
 * Concrete product: in-memory buffer sink.
 */
class BufferDebugSink extends DebugSink {
    constructor() {
        super();
        this.buffer = [];
    }

    write(message, meta = {}) {
        this.buffer.push({ message, meta, at: Date.now() });
    }

    clear() {
        this.buffer.length = 0;
    }
}

/**
 * Creator: factory method for debug sinks.
 */
class DebugSinkFactory {
    createSink() {
        return new ConsoleDebugSink();
    }
}

/**
 * Concrete creator: produces buffer sink (e.g. for tests).
 */
class BufferSinkFactory extends DebugSinkFactory {
    createSink() {
        return new BufferDebugSink();
    }
}

/**
 * Concrete creator: produces console sink (default).
 */
class ConsoleSinkFactory extends DebugSinkFactory {
    createSink() {
        return new ConsoleDebugSink();
    }
}

/**
 * Client: uses the factory to get a sink and write.
 */
function createDebugWriter(factory = new ConsoleSinkFactory()) {
    const sink = factory.createSink();
    return {
        write: (msg, meta) => sink.write(msg, meta),
        sink
    };
}

module.exports = {
    DebugSink,
    ConsoleDebugSink,
    BufferDebugSink,
    DebugSinkFactory,
    ConsoleSinkFactory,
    BufferSinkFactory,
    createDebugWriter
};
