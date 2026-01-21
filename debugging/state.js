// @ai
// State Pattern (GoF) - JavaScript realization
// Goal: Allow an object to alter its behavior when its internal state changes.

// @ai - Context
class ReviewSession {
    constructor() {
        this.state = new IdleState(this);
    }

    // @ai
    setState(next) {
        this.state = next;
    }

    // @ai
    onOpenFile(file) {
        this.state.onOpenFile(file);
    }

    // @ai
    onEngage(seconds) {
        this.state.onEngage(seconds);
    }

    // @ai
    onCloseFile(file) {
        this.state.onCloseFile(file);
    }
}

// @ai - State interface
class SessionState {
    constructor(ctx) {
        this.ctx = ctx;
    }
    onOpenFile(_file) {}
    onEngage(_seconds) {}
    onCloseFile(_file) {}
}

// @ai - Concrete states
class IdleState extends SessionState {
    onOpenFile(file) {
        console.log(`[Idle] opened ${file}`);
        this.ctx.setState(new ReviewingState(this.ctx, file));
    }
}

class ReviewingState extends SessionState {
    constructor(ctx, file) {
        super(ctx);
        this.file = file;
        this.reviewSeconds = 0;
    }

    onEngage(seconds) {
        this.reviewSeconds += Math.max(0, Number(seconds) || 0);
        console.log(`[Reviewing] ${this.file} +${seconds}s (total=${this.reviewSeconds}s)`);
        if (this.reviewSeconds >= 10) {
            this.ctx.setState(new VerifiedState(this.ctx, this.file));
            console.log(`[Reviewing] threshold reached -> Verified`);
        }
    }

    onCloseFile(file) {
        console.log(`[Reviewing] closed ${file}`);
        this.ctx.setState(new IdleState(this.ctx));
    }
}

class VerifiedState extends SessionState {
    constructor(ctx, file) {
        super(ctx);
        this.file = file;
    }

    onEngage(seconds) {
        console.log(`[Verified] ${this.file} additional +${seconds}s (still verified)`);
    }

    onCloseFile(file) {
        console.log(`[Verified] closed ${file} (verified)`);
        this.ctx.setState(new IdleState(this.ctx));
    }
}

// @ai - Demo
console.log('State demo:');
const session = new ReviewSession();
session.onOpenFile('debugging/hello-world.js');
session.onEngage(3);
session.onEngage(4);
session.onEngage(5); // crosses 10s -> verified
session.onCloseFile('debugging/hello-world.js');
