// @ai
// Visitor Pattern (GoF) - JavaScript realization
// Goal: Represent an operation to be performed on elements of an object structure,
//       allowing you to define new operations without changing the element classes.

// @ai - Elements
class SuggestionNode {
    constructor({ size, status }) {
        this.size = size;
        this.status = status;
    }
    accept(visitor) {
        return visitor.visitSuggestion(this);
    }
}

class FileNode {
    constructor(path) {
        this.path = path;
        this.children = [];
    }
    add(child) {
        this.children.push(child);
        return this;
    }
    accept(visitor) {
        return visitor.visitFile(this);
    }
}

// @ai - Visitor
class MetricsVisitor {
    constructor() {
        this.pendingCount = 0;
        this.pendingSize = 0;
        this.acceptedCount = 0;
    }

    visitFile(file) {
        for (const c of file.children) c.accept(this);
        return this;
    }

    visitSuggestion(s) {
        if (s.status === 'pending') {
            this.pendingCount += 1;
            this.pendingSize += Number(s.size) || 0;
        } else if (s.status === 'accepted') {
            this.acceptedCount += 1;
        }
        return this;
    }
}

// @ai - Demo
console.log('Visitor demo:');
const root = new FileNode('src/auth/login.ts')
    .add(new SuggestionNode({ size: 120, status: 'pending' }))
    .add(new SuggestionNode({ size: 80, status: 'accepted' }))
    .add(new SuggestionNode({ size: 300, status: 'pending' }));

const metrics = new MetricsVisitor();
root.accept(metrics);
console.log({
    file: root.path,
    pendingCount: metrics.pendingCount,
    pendingSize: metrics.pendingSize,
    acceptedCount: metrics.acceptedCount
});
