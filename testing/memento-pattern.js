// ============================================
// MEMENTO PATTERN - Behavioral
// ============================================
// Captures and externalizes an object's internal state for later restoration

class Memento {
    constructor(state) {
        this.state = JSON.parse(JSON.stringify(state)); // Deep copy
        this.timestamp = Date.now();
    }
    
    getState() {
        return JSON.parse(JSON.stringify(this.state)); // Return copy
    }
}

class Editor {
    constructor() {
        this.content = '';
        this.cursorPosition = 0;
    }
    
    type(text) {
        this.content = this.content.slice(0, this.cursorPosition) + 
                      text + 
                      this.content.slice(this.cursorPosition);
        this.cursorPosition += text.length;
        console.log(`Editor: Content is now "${this.content}"`);
    }
    
    setCursor(position) {
        this.cursorPosition = Math.max(0, Math.min(position, this.content.length));
    }
    
    save() {
        return new Memento({
            content: this.content,
            cursorPosition: this.cursorPosition
        });
    }
    
    restore(memento) {
        const state = memento.getState();
        this.content = state.content;
        this.cursorPosition = state.cursorPosition;
        console.log(`Editor: Restored to "${this.content}"`);
    }
    
    getState() {
        return {
            content: this.content,
            cursorPosition: this.cursorPosition
        };
    }
}

class History {
    constructor() {
        this.states = [];
        this.currentIndex = -1;
    }
    
    push(memento) {
        // Remove any states after current index (for undo/redo)
        this.states = this.states.slice(0, this.currentIndex + 1);
        this.states.push(memento);
        this.currentIndex = this.states.length - 1;
    }
    
    undo() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            return this.states[this.currentIndex];
        }
        return null;
    }
    
    redo() {
        if (this.currentIndex < this.states.length - 1) {
            this.currentIndex++;
            return this.states[this.currentIndex];
        }
        return null;
    }
}

// Usage
const editor = new Editor();
const history = new History();

editor.type('Hello');
history.push(editor.save());

editor.type(' World');
history.push(editor.save());

editor.type('!');
history.push(editor.save());

console.log('Current:', editor.getState());

const undoState = history.undo();
if (undoState) {
    editor.restore(undoState);
}

const redoState = history.redo();
if (redoState) {
    editor.restore(redoState);
}

// ============================================
// VISITOR PATTERN - Behavioral
// ============================================
// Separates algorithms from the objects on which they operate

class Visitor {
    visit(element) {
        throw new Error('visit() must be implemented');
    }
}

class Element {
    accept(visitor) {
        throw new Error('accept() must be implemented');
    }
}

class Document extends Element {
    constructor() {
        super();
        this.elements = [];
    }
    
    addElement(element) {
        this.elements.push(element);
    }
    
    accept(visitor) {
        visitor.visitDocument(this);
        this.elements.forEach(element => element.accept(visitor));
    }
}

class Paragraph extends Element {
    constructor(text) {
        super();
        this.text = text;
    }
    
    accept(visitor) {
        visitor.visitParagraph(this);
    }
}

class Heading extends Element {
    constructor(text, level) {
        super();
        this.text = text;
        this.level = level;
    }
    
    accept(visitor) {
        visitor.visitHeading(this);
    }
}

class WordCountVisitor extends Visitor {
    constructor() {
        super();
        this.wordCount = 0;
    }
    
    visitDocument(doc) {
        // Document itself doesn't add words
    }
    
    visitParagraph(paragraph) {
        const words = paragraph.text.split(/\s+/).filter(w => w.length > 0);
        this.wordCount += words.length;
        console.log(`WordCountVisitor: Paragraph has ${words.length} words`);
    }
    
    visitHeading(heading) {
        const words = heading.text.split(/\s+/).filter(w => w.length > 0);
        this.wordCount += words.length;
        console.log(`WordCountVisitor: Heading H${heading.level} has ${words.length} words`);
    }
    
    getWordCount() {
        return this.wordCount;
    }
}

class ExportVisitor extends Visitor {
    constructor() {
        super();
        this.output = [];
    }
    
    visitDocument(doc) {
        this.output.push('<document>');
    }
    
    visitParagraph(paragraph) {
        this.output.push(`  <p>${paragraph.text}</p>`);
    }
    
    visitHeading(heading) {
        this.output.push(`  <h${heading.level}>${heading.text}</h${heading.level}>`);
    }
    
    getOutput() {
        this.output.push('</document>');
        return this.output.join('\n');
    }
}

// Usage
const document = new Document();
document.addElement(new Heading('Introduction', 1));
document.addElement(new Paragraph('This is the first paragraph.'));
document.addElement(new Paragraph('This is the second paragraph with more words.'));
document.addElement(new Heading('Conclusion', 2));

const wordCountVisitor = new WordCountVisitor();
document.accept(wordCountVisitor);
console.log(`Total word count: ${wordCountVisitor.getWordCount()}`);

const exportVisitor = new ExportVisitor();
document.accept(exportVisitor);
console.log('Exported HTML:');
console.log(exportVisitor.getOutput());

