// @ai
// Decorator Pattern (GoF) - JavaScript realization
// Goal: Attach additional responsibilities to an object dynamically.

// @ai - Component interface
class Notifier {
    send(message) {
        throw new Error('Notifier.send() must be implemented');
    }
}

// @ai - Concrete component
class ConsoleNotifier extends Notifier {
    send(message) {
        console.log(`[Notify] ${message}`);
    }
}

// @ai - Base decorator
class NotifierDecorator extends Notifier {
    constructor(inner) {
        super();
        this.inner = inner;
    }
    send(message) {
        return this.inner.send(message);
    }
}

// @ai - Concrete decorators
class TimestampDecorator extends NotifierDecorator {
    send(message) {
        const stamped = `${new Date().toISOString()} ${message}`;
        return super.send(stamped);
    }
}

class DedupDecorator extends NotifierDecorator {
    constructor(inner) {
        super(inner);
        this._last = null;
    }
    send(message) {
        if (message === this._last) return;
        this._last = message;
        return super.send(message);
    }
}

class RedactDecorator extends NotifierDecorator {
    send(message) {
        const redacted = String(message).replace(/(token|secret|password)\s*=\s*[^ ]+/gi, '$1=[REDACTED]');
        return super.send(redacted);
    }
}

// @ai - Demo
console.log('Decorator demo:');
let notifier = new ConsoleNotifier();
notifier = new TimestampDecorator(notifier);
notifier = new RedactDecorator(notifier);
notifier = new DedupDecorator(notifier);

notifier.send('score=55 token=abc123');
notifier.send('score=55 token=abc123'); // deduped
notifier.send('score=60 token=abc123');
