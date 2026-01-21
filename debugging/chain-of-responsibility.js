// @ai
// Chain of Responsibility Pattern (GoF) - JavaScript realization
// Goal: Avoid coupling sender to receiver by giving multiple objects a chance to handle a request.

// @ai - Request
class ChangeEvent {
    constructor({ inserted, deleted, hasAIMarker = false }) {
        this.inserted = inserted;
        this.deleted = deleted;
        this.hasAIMarker = hasAIMarker;
        this.label = 'unknown';
        this.reasons = [];
    }
}

// @ai - Handler base
class Handler {
    setNext(next) {
        this.next = next;
        return next;
    }

    handle(event) {
        if (this.next) return this.next.handle(event);
        return event;
    }
}

// @ai - Concrete handlers
class MarkerHandler extends Handler {
    handle(event) {
        if (event.hasAIMarker) {
            event.label = 'ai';
            event.reasons.push('@ai marker');
            return event; // stop chain early (strong signal)
        }
        return super.handle(event);
    }
}

class LargeChangeHandler extends Handler {
    handle(event) {
        const size = (Number(event.inserted) || 0) + (Number(event.deleted) || 0);
        if (size >= 800) {
            event.label = 'ai';
            event.reasons.push(`large change (${size})`);
            // Continue chain in case something wants to override (optional)
        }
        return super.handle(event);
    }
}

class DefaultUserHandler extends Handler {
    handle(event) {
        if (event.label === 'unknown') {
            event.label = 'user';
            event.reasons.push('default');
        }
        return super.handle(event);
    }
}

// @ai - Demo
console.log('Chain of Responsibility demo:');
const chain = new MarkerHandler();
chain.setNext(new LargeChangeHandler()).setNext(new DefaultUserHandler());

console.log(chain.handle(new ChangeEvent({ inserted: 20, deleted: 0, hasAIMarker: false })));
console.log(chain.handle(new ChangeEvent({ inserted: 900, deleted: 10, hasAIMarker: false })));
console.log(chain.handle(new ChangeEvent({ inserted: 5, deleted: 0, hasAIMarker: true })));
