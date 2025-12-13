// ============================================
// OBSERVER PATTERN - Behavioral
// ============================================
// Defines a one-to-many dependency so when one object changes state,
// all its dependents are notified and updated automatically

class Subject {
    constructor() {
        this.observers = [];
    }
    
    subscribe(observer) {
        this.observers.push(observer);
    }
    
    unsubscribe(observer) {
        this.observers = this.observers.filter(obs => obs !== observer);
    }
    
    notify(data) {
        this.observers.forEach(observer => observer.update(data));
    }
}

class Observer {
    constructor(name) {
        this.name = name;
    }
    
    update(data) {
        console.log(`${this.name} received: ${data}`);
    }
}

// Usage
const subject = new Subject();
const observer1 = new Observer('Observer 1');
const observer2 = new Observer('Observer 2');

subject.subscribe(observer1);
subject.subscribe(observer2);
subject.notify('State changed!');

// ============================================
// MEDIATOR PATTERN - Behavioral
// ============================================
// Defines an object that encapsulates how a set of objects interact

class ChatMediator {
    constructor() {
        this.users = [];
    }
    
    addUser(user) {
        this.users.push(user);
        user.setMediator(this);
    }
    
    sendMessage(message, sender) {
        this.users.forEach(user => {
            if (user !== sender) {
                user.receive(message, sender.name);
            }
        });
    }
}

class User {
    constructor(name) {
        this.name = name;
        this.mediator = null;
    }
    
    setMediator(mediator) {
        this.mediator = mediator;
    }
    
    send(message) {
        console.log(`${this.name} sends: ${message}`);
        this.mediator.sendMessage(message, this);
    }
    
    receive(message, senderName) {
        console.log(`${this.name} received from ${senderName}: ${message}`);
    }
}

// Usage
const mediator = new ChatMediator();
const user1 = new User('Alice');
const user2 = new User('Bob');
const user3 = new User('Charlie');

mediator.addUser(user1);
mediator.addUser(user2);
mediator.addUser(user3);

user1.send('Hello everyone!');

// ============================================
// CHAIN OF RESPONSIBILITY PATTERN - Behavioral
// ============================================
// Passes requests along a chain of handlers until one handles it

class Handler {
    constructor() {
        this.next = null;
    }
    
    setNext(handler) {
        this.next = handler;
        return handler;
    }
    
    handle(request) {
        if (this.next) {
            return this.next.handle(request);
        }
        return null;
    }
}

class AuthenticationHandler extends Handler {
    handle(request) {
        if (request.type === 'auth' && request.credentials) {
            console.log('AuthenticationHandler: User authenticated');
            return { success: true, message: 'Authenticated' };
        }
        return super.handle(request);
    }
}

class AuthorizationHandler extends Handler {
    handle(request) {
        if (request.type === 'auth' && request.role === 'admin') {
            console.log('AuthorizationHandler: Admin access granted');
            return { success: true, message: 'Authorized as admin' };
        }
        return super.handle(request);
    }
}

class ValidationHandler extends Handler {
    handle(request) {
        if (request.type === 'data' && request.data) {
            console.log('ValidationHandler: Data validated');
            return { success: true, message: 'Data valid' };
        }
        return super.handle(request);
    }
}

// Usage
const authHandler = new AuthenticationHandler();
const authzHandler = new AuthorizationHandler();
const validationHandler = new ValidationHandler();

authHandler.setNext(authzHandler).setNext(validationHandler);

const request1 = { type: 'auth', credentials: 'token123', role: 'admin' };
authHandler.handle(request1);

const request2 = { type: 'data', data: { name: 'John', age: 30 } };
authHandler.handle(request2);


