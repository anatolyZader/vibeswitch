// ============================================
// STRATEGY PATTERN - Behavioral
// ============================================
// Defines a family of algorithms, encapsulates each one, and makes them interchangeable

class PaymentStrategy {
    pay(amount) {
        throw new Error('pay() must be implemented');
    }
}

class CreditCardStrategy extends PaymentStrategy {
    constructor(cardNumber, cvv) {
        super();
        this.cardNumber = cardNumber;
        this.cvv = cvv;
    }
    
    pay(amount) {
        console.log(`Paid $${amount} using Credit Card ending in ${this.cardNumber.slice(-4)}`);
    }
}

class PayPalStrategy extends PaymentStrategy {
    constructor(email) {
        super();
        this.email = email;
    }
    
    pay(amount) {
        console.log(`Paid $${amount} using PayPal account ${this.email}`);
    }
}

class PaymentProcessor {
    constructor(strategy) {
        this.strategy = strategy;
    }
    
    setStrategy(strategy) {
        this.strategy = strategy;
    }
    
    processPayment(amount) {
        this.strategy.pay(amount);
    }
}

// Usage
const processor = new PaymentProcessor(new CreditCardStrategy('1234567890123456', '123'));
processor.processPayment(100);

processor.setStrategy(new PayPalStrategy('user@example.com'));
processor.processPayment(50);

// ============================================
// COMMAND PATTERN - Behavioral
// ============================================
// Encapsulates a request as an object, allowing parameterization of clients
// with different requests, queuing, and logging of requests

class Command {
    execute() {
        throw new Error('execute() must be implemented');
    }
    
    undo() {
        throw new Error('undo() must be implemented');
    }
}

class Light {
    constructor() {
        this.isOn = false;
    }
    
    turnOn() {
        this.isOn = true;
        console.log('Light is ON');
    }
    
    turnOff() {
        this.isOn = false;
        console.log('Light is OFF');
    }
}

class TurnOnLightCommand extends Command {
    constructor(light) {
        super();
        this.light = light;
    }
    
    execute() {
        this.light.turnOn();
    }
    
    undo() {
        this.light.turnOff();
    }
}

class TurnOffLightCommand extends Command {
    constructor(light) {
        super();
        this.light = light;
    }
    
    execute() {
        this.light.turnOff();
    }
    
    undo() {
        this.light.turnOn();
    }
}

class RemoteControl {
    constructor() {
        this.commands = [];
        this.history = [];
    }
    
    setCommand(command) {
        this.commands.push(command);
    }
    
    pressButton() {
        const command = this.commands.pop();
        if (command) {
            command.execute();
            this.history.push(command);
        }
    }
    
    pressUndo() {
        const command = this.history.pop();
        if (command) {
            command.undo();
        }
    }
}

// Usage
const light = new Light();
const remote = new RemoteControl();

remote.setCommand(new TurnOnLightCommand(light));
remote.pressButton();

remote.setCommand(new TurnOffLightCommand(light));
remote.pressButton();

remote.pressUndo(); // Undo last command

// ============================================
// STATE PATTERN - Behavioral
// ============================================
// Allows an object to alter its behavior when its internal state changes

class State {
    handle(context) {
        throw new Error('handle() must be implemented');
    }
}

class LockedState extends State {
    handle(context) {
        console.log('VendingMachine: Machine is locked. Insert coin first.');
        return false;
    }
}

class HasCoinState extends State {
    handle(context) {
        console.log('VendingMachine: Coin inserted. You can select a product.');
        context.setState(new DispensingState());
        return true;
    }
}

class DispensingState extends State {
    handle(context) {
        console.log('VendingMachine: Dispensing product...');
        context.setState(new LockedState());
        return true;
    }
}

class VendingMachine {
    constructor() {
        this.state = new LockedState();
    }
    
    setState(state) {
        this.state = state;
    }
    
    insertCoin() {
        console.log('User: Inserting coin...');
        this.setState(new HasCoinState());
    }
    
    selectProduct() {
        console.log('User: Selecting product...');
        return this.state.handle(this);
    }
    
    dispense() {
        return this.state.handle(this);
    }
}

// Usage
const machine = new VendingMachine();
machine.selectProduct(); // Locked - won't work

machine.insertCoin();
machine.selectProduct(); // Now works
machine.dispense(); // Dispenses and locks again


