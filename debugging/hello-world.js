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

// Method 4: Using globalThis + Symbol.for (JS-idiomatic, shared across modules)
// Useful when you want exactly one instance even if the module is imported multiple times.
const HELLO_SINGLETON_KEY = Symbol.for('vibeswitch.debug.helloWorldSingleton');

class HelloWorldSingletonGlobal {
    constructor() {
        this.message = 'Hello, World!';
    }

    greet() {
        return this.message;
    }

    setMessage(msg) {
        this.message = msg;
    }
}

function getHelloWorldSingleton() {
    if (!globalThis[HELLO_SINGLETON_KEY]) {
        // Store the instance on the global object under a symbol key (non-colliding).
        globalThis[HELLO_SINGLETON_KEY] = new HelloWorldSingletonGlobal();
    }
    return globalThis[HELLO_SINGLETON_KEY];
}

// Test global singleton
const singleton7 = getHelloWorldSingleton();
const singleton8 = getHelloWorldSingleton();
console.log('Global Singleton test:', singleton7 === singleton8); // true
console.log(singleton7.greet());
singleton8.setMessage('Hello from Global Singleton!');
console.log(singleton7.greet()); // Should show the updated message

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

// Factory Method Pattern (GoF) - separate from "Factory" above
// Goal: Define an interface for creating an object (factoryMethod),
// but let subclasses decide which class to instantiate.

// Product interface (conceptual):
// - greet(): string

class SimpleHelloProduct {
    constructor(message) {
        this.message = message;
    }
    greet() {
        return this.message;
    }
}

// Creator
class HelloCreator {
    // Factory Method: subclasses override this to change the created product.
    factoryMethod() {
        return new SimpleHelloProduct('Hello, World!');
    }

    // "Business logic" that uses the product without knowing its concrete type.
    render() {
        const product = this.factoryMethod();
        return product.greet();
    }
}

// Concrete Creators
class EnglishHelloCreator extends HelloCreator {
    factoryMethod() {
        return new SimpleHelloProduct('Hello, World!');
    }
}

class SpanishHelloCreator extends HelloCreator {
    factoryMethod() {
        return new SimpleHelloProduct('¡Hola, Mundo!');
    }
}

class PirateHelloCreator extends HelloCreator {
    factoryMethod() {
        return new SimpleHelloProduct('Ahoy, matey!');
    }
}

// Demo: Factory Method in action
console.log('\nFactory Method Pattern demo:');
const creators = [
    new EnglishHelloCreator(),
    new SpanishHelloCreator(),
    new PirateHelloCreator()
];
creators.forEach((c, i) => {
    console.log(`  [${i}] ${c.render()}`);
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

// @ai
// Bridge Pattern (GoF) Implementation
// Goal: Decouple an abstraction from its implementation so the two can vary independently.
//
// In this example:
// - Abstraction: "Notification" (what we want to do: notify)
// - Implementor: "MessageSender" (how we do it: send via Email/SMS/Slack)
//
// We can mix-and-match Notifications and Senders without creating a subclass explosion.

// @ai - Implementor interface (conceptual)
class MessageSender {
    // @ai
    send({ to, subject, body }) {
        throw new Error('MessageSender.send() must be implemented');
    }
}

// @ai - Concrete Implementors
class EmailSender extends MessageSender {
    // @ai
    send({ to, subject, body }) {
        console.log(`[Email] to=${to} subject="${subject}" body="${body}"`);
    }
}

class SmsSender extends MessageSender {
    // @ai
    send({ to, subject, body }) {
        // SMS typically has no subject; we keep the same interface for the bridge.
        console.log(`[SMS] to=${to} body="${body}"`);
    }
}

class SlackSender extends MessageSender {
    // @ai
    send({ to, subject, body }) {
        // `to` can represent a channel/user in Slack-like systems.
        console.log(`[Slack] channel=${to} text="${subject}: ${body}"`);
    }
}

// @ai - Abstraction
class Notification {
    // @ai
    constructor(sender) {
        if (!sender || typeof sender.send !== 'function') {
            throw new Error('Notification requires a sender implementing send({to, subject, body})');
        }
        this.sender = sender;
    }

    // @ai
    notify({ to, subject, body }) {
        // Delegates the "how" to the implementor.
        this.sender.send({ to, subject, body });
    }
}

// @ai - Refined Abstractions (vary the "what" without changing the sender)
class SystemAlertNotification extends Notification {
    // @ai
    notify({ to, subject, body }) {
        const taggedSubject = `[ALERT] ${subject}`;
        const taggedBody = `${body} (severity=high)`;
        this.sender.send({ to, subject: taggedSubject, body: taggedBody });
    }
}

class MarketingNotification extends Notification {
    // @ai
    notify({ to, subject, body }) {
        const taggedSubject = `[Promo] ${subject}`;
        const taggedBody = `${body}\n\nUnsubscribe: https://example.com/unsubscribe`;
        this.sender.send({ to, subject: taggedSubject, body: taggedBody });
    }
}

// @ai - Demo: Bridge in action (mix-and-match)
console.log('\nBridge Pattern demo:');
const email = new EmailSender();
const sms = new SmsSender();
const slack = new SlackSender();

const alertViaEmail = new SystemAlertNotification(email);
const alertViaSlack = new SystemAlertNotification(slack);
const promoViaEmail = new MarketingNotification(email);
const promoViaSms = new MarketingNotification(sms);

alertViaEmail.notify({
    to: 'ops@example.com',
    subject: 'CPU spike detected',
    body: 'Instance i-123 is over 90% CPU'
});

alertViaSlack.notify({
    to: '#oncall-alerts',
    subject: 'Latency regression',
    body: 'p95 latency increased by 35% in the last 10 minutes'
});

promoViaEmail.notify({
    to: 'user@example.com',
    subject: 'New features',
    body: 'Check out what’s new in VibeSwitch!'
});

promoViaSms.notify({
    to: '+15551234567',
    subject: 'ignored-for-sms',
    body: 'New: VibeSwitch now supports quieter logs by default.'
});

// @ai
// Adapter Pattern (GoF) Implementation
// Goal: Convert the interface of a class into another interface clients expect.
//
// In this example:
// - Target: AnalyticsClient.track(eventName, properties)
// - Adaptee: LegacyAnalytics.sendEvent(name, payloadJson)
// - Adapter: LegacyAnalyticsAdapter implements Target using Adaptee

// @ai - Adaptee (existing/legacy API we cannot change)
class LegacyAnalytics {
    // @ai
    sendEvent(name, payloadJson) {
        // Pretend this calls a legacy SDK that only accepts JSON strings.
        console.log(`[LegacyAnalytics] name="${name}" payload=${payloadJson}`);
    }
}

// @ai - Target interface (conceptual)
class AnalyticsClient {
    // @ai
    track(eventName, properties = {}) {
        throw new Error('AnalyticsClient.track() must be implemented');
    }
}

// @ai - Adapter (wraps the legacy API to match the Target interface)
class LegacyAnalyticsAdapter extends AnalyticsClient {
    // @ai
    constructor(legacyAnalytics) {
        super();
        if (!legacyAnalytics || typeof legacyAnalytics.sendEvent !== 'function') {
            throw new Error('LegacyAnalyticsAdapter requires a LegacyAnalytics instance');
        }
        this.legacy = legacyAnalytics;
    }

    // @ai
    track(eventName, properties = {}) {
        const safeName = String(eventName || '').trim();
        if (!safeName) {
            throw new Error('track(eventName) requires a non-empty eventName');
        }

        // Convert object payload into the legacy JSON-string format.
        const payload = {
            ts: Date.now(),
            properties: properties || {}
        };
        this.legacy.sendEvent(safeName, JSON.stringify(payload));
    }
}

// @ai - Client code depends on the Target interface, not the legacy one
function runAnalyticsDemo(analyticsClient) {
    if (!analyticsClient || typeof analyticsClient.track !== 'function') {
        throw new Error('runAnalyticsDemo requires an AnalyticsClient');
    }
    analyticsClient.track('app_started', { version: '1.0.0', env: 'dev' });
    analyticsClient.track('pattern_demo', { pattern: 'Adapter', language: 'JavaScript' });
}

// @ai - Demo: Adapter in action
console.log('\nAdapter Pattern demo:');
const legacySdk = new LegacyAnalytics();
const analytics = new LegacyAnalyticsAdapter(legacySdk);
runAnalyticsDemo(analytics);

// @ai
// Builder Pattern (GoF) Implementation
// Goal: Separate construction of a complex object from its representation.
//
// In this example:
// - Product: HttpRequest (method, url, headers, query, body, timeout)
// - Builder: HttpRequestBuilder (fluent API)
// - Director: RequestDirector (optional helper for common presets)

// @ai - Product
class HttpRequest {
    // @ai
    constructor({ method, url, headers = {}, query = {}, body = null, timeoutMs = 10000 }) {
        this.method = method;
        this.url = url;
        this.headers = headers;
        this.query = query;
        this.body = body;
        this.timeoutMs = timeoutMs;
    }

    // @ai
    toString() {
        const qs = Object.entries(this.query)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
            .join('&');
        const fullUrl = qs ? `${this.url}?${qs}` : this.url;
        return `${this.method} ${fullUrl} (timeout=${this.timeoutMs}ms)`;
    }
}

// @ai - Builder
class HttpRequestBuilder {
    // @ai
    constructor() {
        this._method = 'GET';
        this._url = '';
        this._headers = {};
        this._query = {};
        this._body = null;
        this._timeoutMs = 10000;
    }

    // @ai
    method(method) {
        this._method = String(method || '').toUpperCase();
        return this;
    }

    // @ai
    url(url) {
        this._url = String(url || '').trim();
        return this;
    }

    // @ai
    header(name, value) {
        const key = String(name || '').trim();
        if (!key) return this;
        this._headers[key] = String(value);
        return this;
    }

    // @ai
    headers(headersObj = {}) {
        for (const [k, v] of Object.entries(headersObj || {})) {
            this.header(k, v);
        }
        return this;
    }

    // @ai
    queryParam(name, value) {
        const key = String(name || '').trim();
        if (!key) return this;
        this._query[key] = value;
        return this;
    }

    // @ai
    queryParams(queryObj = {}) {
        for (const [k, v] of Object.entries(queryObj || {})) {
            this.queryParam(k, v);
        }
        return this;
    }

    // @ai
    jsonBody(obj) {
        this._body = obj;
        this.header('Content-Type', 'application/json');
        return this;
    }

    // @ai
    timeoutMs(timeoutMs) {
        const n = Number(timeoutMs);
        this._timeoutMs = Number.isFinite(n) && n > 0 ? n : this._timeoutMs;
        return this;
    }

    // @ai
    build() {
        if (!this._url) {
            throw new Error('HttpRequestBuilder.build() requires a url()');
        }
        if (!this._method) {
            throw new Error('HttpRequestBuilder.build() requires a method()');
        }
        return new HttpRequest({
            method: this._method,
            url: this._url,
            headers: { ...this._headers },
            query: { ...this._query },
            body: this._body,
            timeoutMs: this._timeoutMs
        });
    }
}

// @ai - Director (optional)
class RequestDirector {
    // @ai
    constructor(builder) {
        this.builder = builder;
    }

    // @ai
    buildJsonPost(url, json, { authToken = null, timeoutMs = 10000 } = {}) {
        const b = this.builder
            .method('POST')
            .url(url)
            .timeoutMs(timeoutMs)
            .jsonBody(json)
            .header('Accept', 'application/json');
        if (authToken) b.header('Authorization', `Bearer ${authToken}`);
        return b.build();
    }
}

// @ai - Demo: Builder in action
console.log('\nBuilder Pattern demo:');
const req1 = new HttpRequestBuilder()
    .method('GET')
    .url('https://api.example.com/search')
    .queryParam('q', 'vibeswitch')
    .queryParam('limit', 5)
    .header('X-Request-Id', 'demo-1')
    .timeoutMs(3000)
    .build();
console.log(req1.toString());

const director = new RequestDirector(new HttpRequestBuilder());
const req2 = director.buildJsonPost(
    'https://api.example.com/events',
    { type: 'pattern_demo', pattern: 'Builder', language: 'JavaScript' },
    { authToken: 'redacted', timeoutMs: 5000 }
);
console.log(req2.toString());

// @ai
// Prototype Pattern (GoF) Implementation
// Goal: Create new objects by copying existing objects (prototypes),
//       without coupling code to their concrete classes.

// @ai - Small deep-clone helper for demo purposes
function deepClone(value) {
    // Prefer structuredClone when available (Node 17+), fallback to JSON clone for plain objects.
    if (typeof globalThis.structuredClone === 'function') {
        return globalThis.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}

// @ai - Prototype base (conceptual interface)
class Prototype {
    // @ai
    clone() {
        throw new Error('Prototype.clone() must be implemented');
    }
}

// @ai - Concrete Prototype
class ReviewPolicyTemplate extends Prototype {
    // @ai
    constructor({ name, thresholds, tags }) {
        super();
        this.name = name;
        this.thresholds = thresholds; // nested object
        this.tags = tags; // array
    }

    // @ai
    clone() {
        // Ensure deep copy so nested structures don't share references.
        return new ReviewPolicyTemplate(deepClone({
            name: this.name,
            thresholds: this.thresholds,
            tags: this.tags
        }));
    }
}

// @ai - Prototype Registry
class PrototypeRegistry {
    // @ai
    constructor() {
        this._prototypes = new Map();
    }

    // @ai
    register(key, prototype) {
        if (!key) throw new Error('PrototypeRegistry.register requires a key');
        if (!prototype || typeof prototype.clone !== 'function') {
            throw new Error('PrototypeRegistry.register requires a cloneable prototype');
        }
        this._prototypes.set(key, prototype);
    }

    // @ai
    create(key) {
        const proto = this._prototypes.get(key);
        if (!proto) throw new Error(`No prototype registered for key "${key}"`);
        return proto.clone();
    }
}

// @ai - Demo: Prototype in action
console.log('\nPrototype Pattern demo:');
const registry = new PrototypeRegistry();
registry.register('strict', new ReviewPolicyTemplate({
    name: 'Strict Review',
    thresholds: { minSeconds: 30, minEngagementSignals: 3 },
    tags: ['security', 'critical']
}));

const strictA = registry.create('strict');
strictA.name = 'Strict Review (project A)';
strictA.thresholds.minSeconds = 45;
strictA.tags.push('backend');

const strictB = registry.create('strict');
console.log('A:', strictA);
console.log('B:', strictB); // proves deep copy (B unaffected by A edits)

// @ai
// Composite Pattern (GoF) Implementation
// Goal: Compose objects into tree structures to represent part-whole hierarchies,
//       and let clients treat individual objects (Leaf) and compositions (Composite) uniformly.

// @ai - Component
class ReviewItem {
    // @ai
    getEffortMinutes() {
        throw new Error('ReviewItem.getEffortMinutes() must be implemented');
    }

    // @ai
    describe(indent = 0) {
        throw new Error('ReviewItem.describe() must be implemented');
    }
}

// @ai - Leaf
class ReviewTask extends ReviewItem {
    // @ai
    constructor(name, effortMinutes) {
        super();
        this.name = name;
        this.effortMinutes = effortMinutes;
    }

    // @ai
    getEffortMinutes() {
        return this.effortMinutes;
    }

    // @ai
    describe(indent = 0) {
        const pad = ' '.repeat(indent);
        return `${pad}- ${this.name} (${this.effortMinutes}m)`;
    }
}

// @ai - Composite
class ReviewChecklist extends ReviewItem {
    // @ai
    constructor(name) {
        super();
        this.name = name;
        this.children = [];
    }

    // @ai
    add(item) {
        if (!item || typeof item.getEffortMinutes !== 'function') {
            throw new Error('ReviewChecklist.add requires a ReviewItem');
        }
        this.children.push(item);
        return this;
    }

    // @ai
    remove(item) {
        this.children = this.children.filter(c => c !== item);
        return this;
    }

    // @ai
    getEffortMinutes() {
        return this.children.reduce((sum, c) => sum + c.getEffortMinutes(), 0);
    }

    // @ai
    describe(indent = 0) {
        const pad = ' '.repeat(indent);
        const lines = [`${pad}+ ${this.name} (total ${this.getEffortMinutes()}m)`];
        for (const child of this.children) {
            lines.push(child.describe(indent + 2));
        }
        return lines.join('\n');
    }
}

// @ai - Demo: Composite in action
console.log('\nComposite Pattern demo:');
const rootChecklist = new ReviewChecklist('AI Change Review');
const quickChecks = new ReviewChecklist('Quick sanity checks')
    .add(new ReviewTask('Scan diff for obvious issues', 2))
    .add(new ReviewTask('Run unit tests', 3));

const deeperChecks = new ReviewChecklist('Deeper checks')
    .add(new ReviewTask('Validate edge cases', 5))
    .add(new ReviewTask('Check security implications', 6));

rootChecklist.add(quickChecks).add(deeperChecks).add(new ReviewTask('Write summary notes', 2));
console.log(rootChecklist.describe());

// @ai
// Facade Pattern (GoF) Implementation
// Goal: Provide a simplified interface to a complex subsystem.
//
// In this example:
// - Subsystems: DebtStore, SuggestionTracker, Notifier (small stand-ins)
// - Facade: AwarenessWorkflowFacade (one-call API for common operations)

// @ai - Subsystem: persistence-like store
class DebtStore {
    // @ai
    constructor() {
        this._byFile = new Map(); // file -> minutes
    }

    // @ai
    addDebt(file, minutes) {
        const prev = this._byFile.get(file) || 0;
        this._byFile.set(file, prev + Math.max(0, minutes));
    }

    // @ai
    clearDebt(file) {
        this._byFile.delete(file);
    }

    // @ai
    getDebt(file) {
        return this._byFile.get(file) || 0;
    }
}

// @ai - Subsystem: suggestion tracking
class SuggestionTracker {
    // @ai
    constructor() {
        this._pendingByFile = new Map(); // file -> count
    }

    // @ai
    recordAISuggestion(file) {
        const prev = this._pendingByFile.get(file) || 0;
        this._pendingByFile.set(file, prev + 1);
    }

    // @ai
    markReviewed(file) {
        this._pendingByFile.set(file, 0);
    }

    // @ai
    getPendingCount(file) {
        return this._pendingByFile.get(file) || 0;
    }
}

// @ai - Subsystem: notifications/UX
class Notifier {
    // @ai
    warn(msg) {
        console.log(`[WARN] ${msg}`);
    }

    // @ai
    info(msg) {
        console.log(`[INFO] ${msg}`);
    }
}

// @ai - Facade: one-stop workflow API
class AwarenessWorkflowFacade {
    // @ai
    constructor({ debtStore, suggestionTracker, notifier }) {
        this.debtStore = debtStore;
        this.suggestionTracker = suggestionTracker;
        this.notifier = notifier;
    }

    // @ai
    recordAIChange({ file, estimatedReviewMinutes }) {
        this.suggestionTracker.recordAISuggestion(file);
        this.debtStore.addDebt(file, estimatedReviewMinutes);
        const pending = this.suggestionTracker.getPendingCount(file);
        const debt = this.debtStore.getDebt(file);
        this.notifier.warn(`AI change recorded for ${file} (pending=${pending}, debt=${debt}m)`);
    }

    // @ai
    markFileReviewed(file) {
        this.suggestionTracker.markReviewed(file);
        this.debtStore.clearDebt(file);
        this.notifier.info(`Reviewed ${file} (pending=0, debt=0m)`);
    }

    // @ai
    getStatus(file) {
        return {
            file,
            pending: this.suggestionTracker.getPendingCount(file),
            debtMinutes: this.debtStore.getDebt(file)
        };
    }
}

// @ai - Demo: Facade in action
console.log('\nFacade Pattern demo:');
const facade = new AwarenessWorkflowFacade({
    debtStore: new DebtStore(),
    suggestionTracker: new SuggestionTracker(),
    notifier: new Notifier()
});

facade.recordAIChange({ file: 'src/auth/login.ts', estimatedReviewMinutes: 8 });
facade.recordAIChange({ file: 'src/auth/login.ts', estimatedReviewMinutes: 4 });
console.log('Status:', facade.getStatus('src/auth/login.ts'));
facade.markFileReviewed('src/auth/login.ts');
console.log('Status:', facade.getStatus('src/auth/login.ts'));

// Utility function for random operations
function generateRandomId(prefix = 'id') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}_${timestamp}_${random}`;
}
