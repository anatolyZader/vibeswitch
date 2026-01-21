// @ai
// Command Pattern (GoF) - JavaScript realization
// Goal: Encapsulate a request as an object, allowing parameterization, queuing, logging, and undo.

// @ai - Receiver
class ModeService {
    constructor() {
        this.mode = 'dev';
    }

    // @ai
    setMode(mode) {
        if (!['dev', 'vibe'].includes(mode)) throw new Error('Invalid mode');
        this.mode = mode;
        console.log(`[ModeService] mode=${this.mode}`);
    }
}

// @ai - Command interface
class Command {
    execute() {
        throw new Error('Command.execute() must be implemented');
    }
    undo() {
        throw new Error('Command.undo() must be implemented');
    }
}

// @ai - Concrete Command
class SetModeCommand extends Command {
    constructor(receiver, nextMode) {
        super();
        this.receiver = receiver;
        this.nextMode = nextMode;
        this.prevMode = receiver.mode;
    }

    execute() {
        this.prevMode = this.receiver.mode;
        this.receiver.setMode(this.nextMode);
    }

    undo() {
        this.receiver.setMode(this.prevMode);
    }
}

// @ai - Invoker
class CommandBus {
    constructor() {
        this.history = [];
    }

    // @ai
    run(cmd) {
        cmd.execute();
        this.history.push(cmd);
    }

    // @ai
    undoLast() {
        const cmd = this.history.pop();
        if (cmd) cmd.undo();
    }
}

// @ai - Demo
console.log('Command demo:');
const modeService = new ModeService();
const bus = new CommandBus();
bus.run(new SetModeCommand(modeService, 'vibe'));
bus.run(new SetModeCommand(modeService, 'dev'));
bus.undoLast(); // back to vibe

// Utility function for calculating hash
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}
