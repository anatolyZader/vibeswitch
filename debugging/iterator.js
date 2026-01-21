// @ai
// Iterator Pattern (GoF) - JavaScript realization
// Goal: Provide a way to access elements of an aggregate object sequentially
//       without exposing its underlying representation.

// @ai - Aggregate
class SuggestionCollection {
    constructor(items = []) {
        this._items = Array.from(items);
    }

    add(item) {
        this._items.push(item);
    }

    // @ai - JS iterator protocol
    [Symbol.iterator]() {
        let idx = 0;
        const items = this._items;
        return {
            next() {
                if (idx < items.length) {
                    return { value: items[idx++], done: false };
                }
                return { value: undefined, done: true };
            }
        };
    }
}

// @ai - Demo
console.log('Iterator demo:');
const suggestions = new SuggestionCollection([
    { id: 's1', status: 'pending', size: 120 },
    { id: 's2', status: 'accepted', size: 80 },
    { id: 's3', status: 'pending', size: 300 }
]);

let pendingSize = 0;
for (const s of suggestions) {
    if (s.status === 'pending') pendingSize += s.size;
}
console.log('pendingSize:', pendingSize);
