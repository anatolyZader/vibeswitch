// @ai
// Memento Pattern (GoF) - JavaScript realization
// Goal: Capture and externalize an object's internal state so it can be restored later,
//       without exposing implementation details.

// @ai - Originator
class ScoreModel {
    constructor() {
        this.total = 0;
        this.components = { review: 0, critical: 0, adaptation: 0, debt: 0 };
    }

    setScore({ total, components }) {
        this.total = Math.max(0, Math.min(100, Number(total) || 0));
        this.components = { ...this.components, ...(components || {}) };
    }

    createMemento() {
        return Object.freeze({
            total: this.total,
            components: { ...this.components },
            ts: Date.now()
        });
    }

    restore(memento) {
        if (!memento) return;
        this.total = memento.total;
        this.components = { ...memento.components };
    }
}

// @ai - Caretaker
class ScoreHistory {
    constructor() {
        this._stack = [];
    }
    push(memento) {
        this._stack.push(memento);
    }
    pop() {
        return this._stack.pop() || null;
    }
}

// @ai - Demo
console.log('Memento demo:');
const model = new ScoreModel();
const history = new ScoreHistory();

model.setScore({ total: 10, components: { debt: 3 } });
history.push(model.createMemento());
console.log('now:', model);

model.setScore({ total: 60, components: { debt: 15 } });
history.push(model.createMemento());
console.log('now:', model);

model.setScore({ total: 90, components: { debt: 25 } });
console.log('now:', model);

// undo twice
model.restore(history.pop());
console.log('undo1:', model);
model.restore(history.pop());
console.log('undo2:', model);
