/**
 * Hello World in JavaScript
 * A simple demonstration of the classic "Hello, World!" program
 */

console.log('Hello, World!');

// Alternative implementations:

// Using a function
function sayHello() {
    return 'Hello, World!';
}
console.log(sayHello());

// Using an arrow function
const greet = () => 'Hello, World!';
console.log(greet());

// Using a class
class HelloWorld {
    greet() {
        return 'Hello, World!';
    }
}
const hello = new HelloWorld();
console.log(hello.greet());

// Singleton Pattern Implementation
// Method 1: Using a class with static instance
class HelloWorldSingleton {
    constructor() {
        if (HelloWorldSingleton.instance) {
            return HelloWorldSingleton.instance;
        }
        this.message = 'Hello, World!';
        HelloWorldSingleton.instance = this;
        return this;
    }

    greet() {
        return this.message;
    }

    setMessage(msg) {
        this.message = msg;
    }
}

// Test singleton - both instances should be the same
const singleton1 = new HelloWorldSingleton();
const singleton2 = new HelloWorldSingleton();
console.log('Singleton test:', singleton1 === singleton2); // true
console.log(singleton1.greet());
singleton2.setMessage('Hello from Singleton!');
console.log(singleton1.greet()); // Should show the updated message

// Method 2: Using a module pattern (IIFE)
const HelloWorldSingletonIIFE = (function() {
    let instance;

    function createInstance() {
        return {
            message: 'Hello, World!',
            greet() {
                return this.message;
            },
            setMessage(msg) {
                this.message = msg;
            }
        };
    }

    return {
        getInstance() {
            if (!instance) {
                instance = createInstance();
            }
            return instance;
        }
    };
})();

// Test IIFE singleton
const singleton3 = HelloWorldSingletonIIFE.getInstance();
const singleton4 = HelloWorldSingletonIIFE.getInstance();
console.log('IIFE Singleton test:', singleton3 === singleton4); // true
console.log(singleton3.greet());
singleton4.setMessage('Hello from IIFE Singleton!');
console.log(singleton3.greet()); // Should show the updated message

// Method 3: Using ES6 class with static getInstance
class HelloWorldSingletonStatic {
    static instance = null;

    constructor() {
        if (HelloWorldSingletonStatic.instance) {
            return HelloWorldSingletonStatic.instance;
        }
        this.message = 'Hello, World!';
        HelloWorldSingletonStatic.instance = this;
    }

    static getInstance() {
        if (!HelloWorldSingletonStatic.instance) {
            HelloWorldSingletonStatic.instance = new HelloWorldSingletonStatic();
        }
        return HelloWorldSingletonStatic.instance;
    }

    greet() {
        return this.message;
    }

    setMessage(msg) {
        this.message = msg;
    }
}

// Test static getInstance singleton
const singleton5 = HelloWorldSingletonStatic.getInstance();
const singleton6 = HelloWorldSingletonStatic.getInstance();
console.log('Static Singleton test:', singleton5 === singleton6); // true
console.log(singleton5.greet());
singleton6.setMessage('Hello from Static Singleton!');
console.log(singleton5.greet()); // Should show the updated message

// Factory Pattern Implementation
// Goal: Create objects without exposing the instantiation logic to the caller.
// The caller asks for a "type" and receives a concrete greeter with a common interface: greet().

/**
 * "Product" interface (conceptual):
 * - greet(): string
 */

// Concrete Products
class EnglishGreeter {
    constructor({ name = null } = {}) {
        this.name = name;
    }
    greet() {
        return this.name ? `Hello, ${this.name}!` : 'Hello, World!';
    }
}

class SpanishGreeter {
    constructor({ name = null } = {}) {
        this.name = name;
    }
    greet() {
        return this.name ? `¡Hola, ${this.name}!` : '¡Hola, Mundo!';
    }
}

class FrenchGreeter {
    constructor({ name = null } = {}) {
        this.name = name;
    }
    greet() {
        return this.name ? `Bonjour, ${this.name}!` : 'Bonjour, le monde!';
    }
}

class PirateGreeter {
    constructor({ name = null } = {}) {
        this.name = name;
    }
    greet() {
        return this.name ? `Ahoy, ${this.name}!` : 'Ahoy, matey!';
    }
}

// Factory (Creator)
class GreeterFactory {
    /**
     * @param {string} type - Greeter type (e.g., 'en', 'es', 'fr', 'pirate')
     * @param {{name?: string|null}} options - Optional settings for the greeter
     * @returns {{greet: () => string}} Concrete greeter implementing greet()
     */
    static create(type, options = {}) {
        const normalized = String(type || '').trim().toLowerCase();

        switch (normalized) {
            case 'en':
            case 'english':
            case 'hello':
                return new EnglishGreeter(options);
            case 'es':
            case 'spanish':
            case 'hola':
                return new SpanishGreeter(options);
            case 'fr':
            case 'french':
            case 'bonjour':
                return new FrenchGreeter(options);
            case 'pirate':
                return new PirateGreeter(options);
            default:
                throw new Error(
                    `Unknown greeter type "${type}". Try one of: en, es, fr, pirate`
                );
        }
    }
}

// Demo: Factory in action
const greeters = [
    GreeterFactory.create('en'),
    GreeterFactory.create('es'),
    GreeterFactory.create('fr'),
    GreeterFactory.create('pirate'),
    GreeterFactory.create('en', { name: 'Ada' }),
    GreeterFactory.create('es', { name: 'Linus' }),
];

console.log('\nFactory Pattern demo:');
greeters.forEach((g, i) => {
    console.log(`  [${i}] ${g.greet()}`);
});

// Strategy Pattern Implementation (GoF)
// Goal: Define a family of algorithms (formatting), encapsulate each one, and make them interchangeable.
// Here, we generate a base greeting and vary ONLY how it's formatted/presented.

// Strategy interface (conceptual):
// - format(message: string): string

class PlainFormatStrategy {
    format(message) {
        return message;
    }
}

class ExcitedFormatStrategy {
    format(message) {
        return `${message.toUpperCase()}!!!`;
    }
}

class PoliteFormatStrategy {
    format(message) {
        return `Please, ${message}`;
    }
}

// Context
class GreetingContext {
    constructor(strategy = new PlainFormatStrategy()) {
        this.setStrategy(strategy);
    }

    setStrategy(strategy) {
        if (!strategy || typeof strategy.format !== 'function') {
            throw new Error('GreetingContext requires a strategy with a format(message) function');
        }
        this.strategy = strategy;
    }

    greet(name = null) {
        const base = name ? `Hello, ${name}` : 'Hello, World';
        return this.strategy.format(base);
    }
}

// Demo: Strategy in action (swap behavior at runtime)
console.log('\nStrategy Pattern demo:');
const ctx = new GreetingContext(new PlainFormatStrategy());
console.log('  Plain  :', ctx.greet('Grace'));
ctx.setStrategy(new PoliteFormatStrategy());
console.log('  Polite :', ctx.greet('Grace'));
ctx.setStrategy(new ExcitedFormatStrategy());
console.log('  Excited:', ctx.greet('Grace'));
