// ============================================
// ADAPTER PATTERN - Structural
// ============================================
// Allows incompatible interfaces to work together

// Legacy system - incompatible interface
class LegacyLogger {
    logMessage(level, message) {
        console.log(`[${level.toUpperCase()}] ${message}`);
    }
}

// Modern system - expected interface
class ModernLogger {
    info(message) {
        console.log(`[INFO] ${message}`);
    }
    
    warn(message) {
        console.log(`[WARN] ${message}`);
    }
    
    error(message) {
        console.log(`[ERROR] ${message}`);
    }
}

// Adapter - makes LegacyLogger compatible with ModernLogger interface
class LoggerAdapter extends ModernLogger {
    constructor(legacyLogger) {
        super();
        this.legacyLogger = legacyLogger;
    }
    
    info(message) {
        this.legacyLogger.logMessage('info', message);
    }
    
    warn(message) {
        this.legacyLogger.logMessage('warn', message);
    }
    
    error(message) {
        this.legacyLogger.logMessage('error', message);
    }
}

// Application that expects ModernLogger interface
class Application {
    constructor(logger) {
        this.logger = logger;
    }
    
    run() {
        this.logger.info('Application started');
        this.logger.warn('This is a warning');
        this.logger.error('An error occurred');
    }
}

// Usage
const legacyLogger = new LegacyLogger();
const adapter = new LoggerAdapter(legacyLogger);
const app = new Application(adapter);
app.run();

// ============================================
// FACADE PATTERN - Structural
// ============================================
// Provides a simplified interface to a complex subsystem

// Complex subsystem classes
class CPU {
    start() {
        console.log('CPU: Starting...');
    }
    
    execute() {
        console.log('CPU: Executing instructions...');
    }
    
    shutdown() {
        console.log('CPU: Shutting down...');
    }
}

class Memory {
    load() {
        console.log('Memory: Loading data...');
    }
    
    allocate() {
        console.log('Memory: Allocating memory...');
    }
    
    free() {
        console.log('Memory: Freeing memory...');
    }
}

class HardDrive {
    read() {
        console.log('HardDrive: Reading data...');
    }
    
    write() {
        console.log('HardDrive: Writing data...');
    }
    
    spinDown() {
        console.log('HardDrive: Spinning down...');
    }
}

// Facade - simplified interface
class ComputerFacade {
    constructor() {
        this.cpu = new CPU();
        this.memory = new Memory();
        this.hardDrive = new HardDrive();
    }
    
    start() {
        console.log('=== Starting Computer ===');
        this.cpu.start();
        this.memory.load();
        this.hardDrive.read();
        this.memory.allocate();
        this.cpu.execute();
        console.log('=== Computer Started ===\n');
    }
    
    shutdown() {
        console.log('=== Shutting Down Computer ===');
        this.cpu.shutdown();
        this.memory.free();
        this.hardDrive.spinDown();
        console.log('=== Computer Shut Down ===\n');
    }
    
    saveWork() {
        console.log('=== Saving Work ===');
        this.memory.load();
        this.hardDrive.write();
        console.log('=== Work Saved ===\n');
    }
}

// Usage
const computer = new ComputerFacade();
computer.start();
computer.saveWork();
computer.shutdown();

