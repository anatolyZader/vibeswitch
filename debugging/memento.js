// @ai
// Gang of Four (GoF) Design Patterns - JavaScript Realizations
// This file contains implementations of 3 classic GoF patterns:
// 1. Observer Pattern (Behavioral)
// 2. Strategy Pattern (Behavioral)
// 3. Factory Method Pattern (Creational)

// ============================================================================
// 1. OBSERVER PATTERN
// ============================================================================
// Goal: Define a one-to-many dependency between objects so that when one object
//       changes state, all its dependents are notified and updated automatically.

// @ai - Subject (Observable)
class EventEmitter {
    constructor() {
        this._observers = new Map();
    }

    subscribe(event, observer) {
        if (!this._observers.has(event)) {
            this._observers.set(event, new Set());
        }
        this._observers.get(event).add(observer);
        return () => this.unsubscribe(event, observer);
    }

    unsubscribe(event, observer) {
        const observers = this._observers.get(event);
        if (observers) {
            observers.delete(observer);
        }
    }

    notify(event, data) {
        const observers = this._observers.get(event);
        if (observers) {
            observers.forEach(observer => observer(data));
        }
    }
}

// @ai - Concrete Subject
class StockTicker extends EventEmitter {
    constructor(symbol) {
        super();
        this.symbol = symbol;
        this.price = 0;
    }

    setPrice(newPrice) {
        const oldPrice = this.price;
        this.price = newPrice;
        this.notify('priceChange', {
            symbol: this.symbol,
            oldPrice,
            newPrice,
            change: newPrice - oldPrice
        });
    }
}

// @ai - Observer Demo
console.log('=== OBSERVER PATTERN DEMO ===');
const stock = new StockTicker('AAPL');

const investor1 = (data) => console.log(`Investor 1: ${data.symbol} changed by $${data.change.toFixed(2)}`);
const investor2 = (data) => console.log(`Investor 2: ${data.symbol} now at $${data.newPrice.toFixed(2)}`);

const unsub1 = stock.subscribe('priceChange', investor1);
stock.subscribe('priceChange', investor2);

stock.setPrice(150.00);
stock.setPrice(152.50);

unsub1(); // Investor 1 unsubscribes
stock.setPrice(148.75);

console.log('');

// ============================================================================
// 2. STRATEGY PATTERN
// ============================================================================
// Goal: Define a family of algorithms, encapsulate each one, and make them
//       interchangeable. Strategy lets the algorithm vary independently from
//       clients that use it.

// @ai - Strategy Interface (implicit in JS)
// Each strategy must implement: calculate(items)

// @ai - Concrete Strategies
const PricingStrategies = {
    regular: {
        name: 'Regular',
        calculate(items) {
            return items.reduce((sum, item) => sum + item.price * item.qty, 0);
        }
    },

    premium: {
        name: 'Premium (10% off)',
        calculate(items) {
            const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
            return subtotal * 0.90;
        }
    },

    bulk: {
        name: 'Bulk (15% off on 5+ items)',
        calculate(items) {
            const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
            const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
            return totalQty >= 5 ? subtotal * 0.85 : subtotal;
        }
    },

    clearance: {
        name: 'Clearance (50% off)',
        calculate(items) {
            const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
            return subtotal * 0.50;
        }
    }
};

// @ai - Context
class ShoppingCart {
    constructor() {
        this.items = [];
        this.pricingStrategy = PricingStrategies.regular;
    }

    addItem(name, price, qty = 1) {
        this.items.push({ name, price, qty });
        return this;
    }

    setStrategy(strategy) {
        this.pricingStrategy = strategy;
        return this;
    }

    checkout() {
        const total = this.pricingStrategy.calculate(this.items);
        return {
            strategy: this.pricingStrategy.name,
            items: this.items.length,
            total: total.toFixed(2)
        };
    }
}

// @ai - Strategy Demo
console.log('=== STRATEGY PATTERN DEMO ===');
const cart = new ShoppingCart();
cart.addItem('Keyboard', 99.99, 2)
    .addItem('Mouse', 49.99, 3)
    .addItem('Monitor', 299.99, 1);

console.log('Regular:', cart.setStrategy(PricingStrategies.regular).checkout());
console.log('Premium:', cart.setStrategy(PricingStrategies.premium).checkout());
console.log('Bulk:', cart.setStrategy(PricingStrategies.bulk).checkout());
console.log('Clearance:', cart.setStrategy(PricingStrategies.clearance).checkout());

console.log('');

// ============================================================================
// 3. FACTORY METHOD PATTERN
// ============================================================================
// Goal: Define an interface for creating an object, but let subclasses decide
//       which class to instantiate. Factory Method lets a class defer
//       instantiation to subclasses.

// @ai - Product Interface (implicit in JS)
// Each product must implement: render(), serialize()

// @ai - Concrete Products
class TextDocument {
    constructor(content) {
        this.type = 'text';
        this.content = content;
        this.createdAt = new Date();
    }

    render() {
        return `[TEXT] ${this.content}`;
    }

    serialize() {
        return { type: this.type, content: this.content };
    }
}

class SpreadsheetDocument {
    constructor(content) {
        this.type = 'spreadsheet';
        this.rows = content.split('\n').map(row => row.split(','));
        this.createdAt = new Date();
    }

    render() {
        const header = this.rows[0]?.join(' | ') || '';
        return `[SPREADSHEET]\n${header}\n${'─'.repeat(header.length)}`;
    }

    serialize() {
        return { type: this.type, rows: this.rows };
    }
}

class PresentationDocument {
    constructor(content) {
        this.type = 'presentation';
        this.slides = content.split('---').map(s => s.trim());
        this.createdAt = new Date();
    }

    render() {
        return `[PRESENTATION] ${this.slides.length} slides`;
    }

    serialize() {
        return { type: this.type, slides: this.slides };
    }
}

// @ai - Creator (Factory)
class DocumentFactory {
    static create(type, content) {
        const factories = {
            text: (c) => new TextDocument(c),
            spreadsheet: (c) => new SpreadsheetDocument(c),
            presentation: (c) => new PresentationDocument(c)
        };

        const factory = factories[type];
        if (!factory) {
            throw new Error(`Unknown document type: ${type}`);
        }
        return factory(content);
    }

    static fromExtension(filename, content) {
        const ext = filename.split('.').pop().toLowerCase();
        const typeMap = {
            txt: 'text',
            md: 'text',
            csv: 'spreadsheet',
            xlsx: 'spreadsheet',
            ppt: 'presentation',
            pptx: 'presentation'
        };
        return this.create(typeMap[ext] || 'text', content);
    }
}

// @ai - Factory Method Demo
console.log('=== FACTORY METHOD PATTERN DEMO ===');

const doc1 = DocumentFactory.create('text', 'Hello, World!');
const doc2 = DocumentFactory.create('spreadsheet', 'Name,Age,City\nAlice,30,NYC\nBob,25,LA');
const doc3 = DocumentFactory.create('presentation', 'Title Slide---Content Slide---Summary');

console.log(doc1.render());
console.log(doc2.render());
console.log(doc3.render());

// Using extension-based factory
const doc4 = DocumentFactory.fromExtension('report.csv', 'Product,Sales\nWidget,100');
console.log('From extension:', doc4.render());

console.log('');
console.log('=== ALL DEMOS COMPLETE ===');

// @ai - Exports for module usage
module.exports = {
    // Observer
    EventEmitter,
    StockTicker,
    // Strategy
    PricingStrategies,
    ShoppingCart,
    // Factory Method
    TextDocument,
    SpreadsheetDocument,
    PresentationDocument,
    DocumentFactory
};
