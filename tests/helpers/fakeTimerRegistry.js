/**
 * Fake Timer Registry for Testing
 * 
 * Provides deterministic time control for testing lifecycle and time-based rules.
 */

class FakeTimerRegistry {
    constructor(initialTime = Date.now()) {
        this.timers = new Map();
        this.now = initialTime;
        this.nextId = 1;
    }
    
    schedule(callback, delay, id = null) {
        const timerId = id || `timer-${this.nextId++}`;
        this.timers.set(timerId, {
            callback,
            fireAt: this.now + delay,
            id: timerId
        });
        return timerId;
    }
    
    tick(ms) {
        this.now += ms;
        const toFire = [];
        
        for (const [id, timer] of this.timers) {
            if (this.now >= timer.fireAt) {
                toFire.push(timer);
                this.timers.delete(id);
            }
        }
        
        for (const timer of toFire) {
            timer.callback();
        }
    }
    
    getNow() {
        return this.now;
    }
    
    clear() {
        this.timers.clear();
    }
    
    getPendingCount() {
        return this.timers.size;
    }
}

module.exports = FakeTimerRegistry;
