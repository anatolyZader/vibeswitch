// @ai
// Template Method Pattern (GoF) - JavaScript realization
// Goal: Define the skeleton of an algorithm in an operation,
//       deferring some steps to subclasses.

// @ai - Abstract class (base)
class ChangeClassifierTemplate {
    classify(change) {
        this.validate(change);
        const features = this.extractFeatures(change);
        const label = this.decideLabel(features);
        return { label, features };
    }

    // @ai - hooks/steps
    validate(_change) { /* default no-op */ }
    extractFeatures(_change) { throw new Error('extractFeatures must be implemented'); }
    decideLabel(_features) { throw new Error('decideLabel must be implemented'); }
}

// @ai - Concrete implementation #1
class MarkerFirstClassifier extends ChangeClassifierTemplate {
    extractFeatures(change) {
        const text = String(change.text || '');
        return {
            hasAIMarker: /\/\/\s*@ai/i.test(text),
            size: text.length
        };
    }
    decideLabel(features) {
        if (features.hasAIMarker) return 'ai';
        return features.size > 500 ? 'ai' : 'user';
    }
}

// @ai - Concrete implementation #2
class ConservativeClassifier extends ChangeClassifierTemplate {
    extractFeatures(change) {
        const inserted = Number(change.inserted) || 0;
        const deleted = Number(change.deleted) || 0;
        return { size: inserted + deleted };
    }
    decideLabel(features) {
        return features.size >= 1000 ? 'ai' : 'user';
    }
}

// @ai - Demo
console.log('Template Method demo:');
const changeA = { text: '// @ai generated code...\nconst x = 1;' };
const changeB = { inserted: 200, deleted: 10 };

console.log(new MarkerFirstClassifier().classify(changeA));
console.log(new ConservativeClassifier().classify(changeB));
