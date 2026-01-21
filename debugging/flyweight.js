// @ai
// Flyweight Pattern (GoF) - JavaScript realization
// Goal: Use sharing to support large numbers of fine-grained objects efficiently.

// @ai - Flyweight (shared intrinsic state)
class DecorationStyle {
    constructor({ badge, colorKey }) {
        this.badge = badge;
        this.colorKey = colorKey;
    }
}

// @ai - Flyweight Factory
class DecorationStyleFactory {
    constructor() {
        this._cache = new Map(); // key -> DecorationStyle
    }

    getStyle(kind) {
        const key = String(kind);
        if (this._cache.has(key)) return this._cache.get(key);

        let style;
        if (key === 'debt') style = new DecorationStyle({ badge: '⚠', colorKey: 'textLink.activeForeground' });
        else if (key === 'pending') style = new DecorationStyle({ badge: '⏳', colorKey: 'warningForeground' });
        else style = new DecorationStyle({ badge: '', colorKey: 'foreground' });

        this._cache.set(key, style);
        return style;
    }

    getCacheSize() {
        return this._cache.size;
    }
}

// @ai - Context objects (extrinsic state per file)
class FileDecoration {
    constructor(filePath, style) {
        this.filePath = filePath;
        this.style = style; // shared flyweight
    }

    render() {
        return `${this.style.badge} ${this.filePath} (${this.style.colorKey})`;
    }
}

// @ai - Demo
console.log('Flyweight demo:');
const factory = new DecorationStyleFactory();
const files = [
    new FileDecoration('src/auth/login.ts', factory.getStyle('debt')),
    new FileDecoration('src/auth/logout.ts', factory.getStyle('debt')),
    new FileDecoration('src/ui/widget.tsx', factory.getStyle('pending')),
    new FileDecoration('README.md', factory.getStyle('none'))
];

for (const d of files) console.log(d.render());
console.log('styles cached:', factory.getCacheSize(), '(should be small)');
