// ============================================
// PROTOTYPE PATTERN - Creational
// ============================================
// Creates objects by cloning existing instances rather than creating new ones

class Shape {
    constructor() {
        this.type = null;
        this.color = null;
        this.x = null;
        this.y = null;
    }
    
    clone() {
        const clone = Object.create(Object.getPrototypeOf(this));
        clone.type = this.type;
        clone.color = this.color;
        clone.x = this.x;
        clone.y = this.y;
        return clone;
    }
    
    draw() {
        console.log(`Drawing ${this.color} ${this.type} at (${this.x}, ${this.y})`);
    }
}

class Circle extends Shape {
    constructor(color, x, y) {
        super();
        this.type = 'Circle';
        this.color = color;
        this.x = x;
        this.y = y;
    }
}

class Rectangle extends Shape {
    constructor(color, x, y) {
        super();
        this.type = 'Rectangle';
        this.color = color;
        this.x = x;
        this.y = y;
    }
}

// Prototype registry
class ShapeRegistry {
    constructor() {
        this.prototypes = {};
    }
    
    addPrototype(key, shape) {
        this.prototypes[key] = shape;
    }
    
    getPrototype(key) {
        return this.prototypes[key]?.clone();
    }
}

// Usage
const registry = new ShapeRegistry();
registry.addPrototype('redCircle', new Circle('red', 0, 0));
registry.addPrototype('blueRectangle', new Rectangle('blue', 0, 0));

const circle1 = registry.getPrototype('redCircle');
circle1.x = 10;
circle1.y = 20;
circle1.draw();

const circle2 = registry.getPrototype('redCircle');
circle2.x = 30;
circle2.y = 40;
circle2.draw();

// ============================================
// FLYWEIGHT PATTERN - Structural
// ============================================
// Minimizes memory usage by sharing intrinsic state among similar objects

class TreeType {
    constructor(name, color, texture) {
        this.name = name;
        this.color = color;
        this.texture = texture;
    }
    
    draw(canvas, x, y) {
        console.log(`Drawing ${this.color} ${this.name} tree at (${x}, ${y}) with texture: ${this.texture}`);
    }
}

class TreeTypeFactory {
    constructor() {
        this.treeTypes = {};
    }
    
    getTreeType(name, color, texture) {
        const key = `${name}_${color}_${texture}`;
        if (!this.treeTypes[key]) {
            this.treeTypes[key] = new TreeType(name, color, texture);
            console.log(`Creating new TreeType: ${key}`);
        } else {
            console.log(`Reusing existing TreeType: ${key}`);
        }
        return this.treeTypes[key];
    }
}

class Tree {
    constructor(x, y, treeType) {
        this.x = x;
        this.y = y;
        this.treeType = treeType;
    }
    
    draw(canvas) {
        this.treeType.draw(canvas, this.x, this.y);
    }
}

class Forest {
    constructor() {
        this.trees = [];
        this.factory = new TreeTypeFactory();
    }
    
    plantTree(x, y, name, color, texture) {
        const treeType = this.factory.getTreeType(name, color, texture);
        const tree = new Tree(x, y, treeType);
        this.trees.push(tree);
    }
    
    draw(canvas) {
        this.trees.forEach(tree => tree.draw(canvas));
    }
}

// Usage
const forest = new Forest();
forest.plantTree(1, 1, 'Oak', 'Green', 'Rough');
forest.plantTree(2, 2, 'Oak', 'Green', 'Rough'); // Reuses TreeType
forest.plantTree(3, 3, 'Pine', 'Dark Green', 'Smooth');
forest.plantTree(4, 4, 'Oak', 'Green', 'Rough'); // Reuses TreeType again
console.log(`Total trees: ${forest.trees.length}, Unique tree types: ${Object.keys(forest.factory.treeTypes).length}`);

