// @ai
// Observer Pattern (GoF) - JavaScript realization
// Goal: Define a one-to-many dependency so when one object changes state,
//       all its dependents are notified automatically.

// @ai - Subject
class Subject {
    constructor() {
        this._observers = new Set();
    }

    // @ai
    subscribe(observer) {
        if (!observer || typeof observer.update !== 'function') {
            throw new Error('Observer must implement update(event)');
        }
        this._observers.add(observer);
        return () => this._observers.delete(observer); // unsubscribe function
    }

    // @ai
    notify(event) {
        for (const obs of this._observers) {
            try {
                obs.update(event);
            } catch (e) {
                // In real systems: handle/log observer errors without breaking others.
            }
        }
    }
}

// @ai - Concrete Subject
class AwarenessScore extends Subject {
    constructor() {
        super();
        this._score = 0;
    }

    // @ai
    setScore(nextScore) {
        const clamped = Math.max(0, Math.min(100, Number(nextScore) || 0));
        if (clamped === this._score) return;
        const prev = this._score;
        this._score = clamped;
        this.notify({ type: 'score_changed', prev, next: this._score, ts: Date.now() });
    }

    // @ai
    getScore() {
        return this._score;
    }
}

// @ai - Observers
class MeterUIObserver {
    update(event) {
        if (event.type === 'score_changed') {
            const state = event.next >= 60 ? '🟠/🔴 risk' : event.next >= 40 ? '🟡 caution' : '🟢 ok';
            console.log(`[MeterUI] score=${event.next} (${state})`);
        }
    }
}

class LoggerObserver {
    update(event) {
        console.log(`[Logger] ${event.type}`, event);
    }
}

// @ai - Demo
console.log('Observer demo:');
const score = new AwarenessScore();
const unsubLog = score.subscribe(new LoggerObserver());
score.subscribe(new MeterUIObserver());
score.setScore(10);
score.setScore(55);
unsubLog(); // stop logging observer
score.setScore(80);
