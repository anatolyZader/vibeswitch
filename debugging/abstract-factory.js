// @ai
// Abstract Factory Pattern (GoF) - JavaScript realization
// Goal: Provide an interface for creating families of related objects
//       without specifying their concrete classes.

// @ai - Product interfaces (conceptual)
class Logger {
    info(_msg) { throw new Error('Logger.info() not implemented'); }
    warn(_msg) { throw new Error('Logger.warn() not implemented'); }
}

class Notifier {
    notify(_msg) { throw new Error('Notifier.notify() not implemented'); }
}

// @ai - Concrete products (DEV family)
class DevLogger extends Logger {
    info(msg) { console.log(`[DEV][info] ${msg}`); }
    warn(msg) { console.log(`[DEV][warn] ${msg}`); }
}
class DevNotifier extends Notifier {
    notify(msg) { console.log(`[DEV][notify] ${msg}`); }
}

// @ai - Concrete products (VIBE family)
class VibeLogger extends Logger {
    info(msg) { console.log(`[VIBE] ${msg}`); }
    warn(msg) { console.log(`[VIBE][!] ${msg}`); }
}
class VibeNotifier extends Notifier {
    notify(msg) { console.log(`[VIBE][notify] ${msg}`); }
}

// @ai - Abstract factory (conceptual)
class UIFactory {
    createLogger() { throw new Error('UIFactory.createLogger() not implemented'); }
    createNotifier() { throw new Error('UIFactory.createNotifier() not implemented'); }
}

// @ai - Concrete factories
class DevUIFactory extends UIFactory {
    createLogger() { return new DevLogger(); }
    createNotifier() { return new DevNotifier(); }
}
class VibeUIFactory extends UIFactory {
    createLogger() { return new VibeLogger(); }
    createNotifier() { return new VibeNotifier(); }
}

// @ai - Client code only depends on the factory + product interfaces
function runModeWorkflow(factory) {
    const logger = factory.createLogger();
    const notifier = factory.createNotifier();
    logger.info('Starting awareness workflow');
    notifier.notify('AI changes detected: review recommended');
    logger.warn('Debt accumulating');
}

// @ai - Demo
console.log('Abstract Factory demo:');
runModeWorkflow(new DevUIFactory());
runModeWorkflow(new VibeUIFactory());

// Utility function for formatting timestamps
function formatTimestamp(date = new Date()) {
    return date.toISOString().replace('T', ' ').substring(0, 19);
}
