// ============================================
// SINGLETON PATTERN - Creational
// ============================================
// Ensures a class has only one instance and provides global access

class DatabaseConnection {
    constructor() {
        if (DatabaseConnection.instance) {
            return DatabaseConnection.instance;
        }
        
        this.connectionString = 'mongodb://localhost:27017';
        this.isConnected = false;
        DatabaseConnection.instance = this;
    }
    
    connect() {
        if (!this.isConnected) {
            this.isConnected = true;
            console.log('Connected to database');
        }
        return this;
    }
    
    disconnect() {
        this.isConnected = false;
        console.log('Disconnected from database');
    }
}

// Usage
const db1 = new DatabaseConnection();
const db2 = new DatabaseConnection();
console.log(db1 === db2); // true - same instance

// ============================================
// FACTORY PATTERN - Creational
// ============================================
// Creates objects without specifying the exact class of object that will be created

class Vehicle {
    drive() {
        throw new Error('drive() must be implemented');
    }
}

class Car extends Vehicle {
    drive() {
        console.log('Driving a car...');
    }
}

class Motorcycle extends Vehicle {
    drive() {
        console.log('Riding a motorcycle...');
    }
}

class VehicleFactory {
    static createVehicle(type) {
        switch(type.toLowerCase()) {
            case 'car':
                return new Car();
            case 'motorcycle':
                return new Motorcycle();
            default:
                throw new Error(`Unknown vehicle type: ${type}`);
        }
    }
}

// Usage
const car = VehicleFactory.createVehicle('car');
car.drive();

const motorcycle = VehicleFactory.createVehicle('motorcycle');
motorcycle.drive();

// ============================================
// BUILDER PATTERN - Creational
// ============================================
// Constructs complex objects step by step, allowing different representations

class Pizza {
    constructor() {
        this.size = null;
        this.crust = null;
        this.toppings = [];
        this.cheese = false;
        this.sauce = false;
    }
    
    describe() {
        const parts = [
            `Size: ${this.size}`,
            `Crust: ${this.crust}`,
            `Toppings: ${this.toppings.join(', ') || 'none'}`,
            `Cheese: ${this.cheese ? 'yes' : 'no'}`,
            `Sauce: ${this.sauce ? 'yes' : 'no'}`
        ];
        return parts.join(' | ');
    }
}

class PizzaBuilder {
    constructor() {
        this.pizza = new Pizza();
    }
    
    setSize(size) {
        this.pizza.size = size;
        return this;
    }
    
    setCrust(crust) {
        this.pizza.crust = crust;
        return this;
    }
    
    addTopping(topping) {
        this.pizza.toppings.push(topping);
        return this;
    }
    
    addCheese() {
        this.pizza.cheese = true;
        return this;
    }
    
    addSauce() {
        this.pizza.sauce = true;
        return this;
    }
    
    build() {
        return this.pizza;
    }
}

// Usage
const pizza = new PizzaBuilder()
    .setSize('Large')
    .setCrust('Thin')
    .addTopping('Pepperoni')
    .addTopping('Mushrooms')
    .addCheese()
    .addSauce()
    .build();

console.log('Pizza:', pizza.describe());


