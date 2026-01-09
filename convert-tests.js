const fs = require('fs');
const path = require('path');

const testFiles = [
    'tests/business_modules/awareness/domain/entities/suggestionBatch.test.js',
    'tests/business_modules/awareness/domain/events/reviewSessionEvents.test.js',
    'tests/business_modules/awareness/domain/events/suggestionBatchEvent.test.js',
    'tests/business_modules/awareness/infrastructure/adapters/awarenessMessagingAdapter.events.test.js'
];

testFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${file} - not found`);
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove chai import
    content = content.replace(/const \{ assert \} = require\('chai'\);\n/g, '');
    
    // Convert suite to describe
    content = content.replace(/suite\(/g, 'describe(');
    
    // Convert setup/teardown
    content = content.replace(/setup\(/g, 'beforeEach(');
    content = content.replace(/teardown\(/g, 'afterEach(');
    
    // Convert assertions - must be done carefully
    content = content.replace(/assert\.strictEqual\(([^,]+),\s*([^)]+)\)/g, 'expect($1).toBe($2)');
    content = content.replace(/assert\.instanceOf\(([^,]+),\s*([^)]+)\)/g, 'expect($1).toBeInstanceOf($2)');
    content = content.replace(/assert\.isTrue\(([^)]+)\)/g, 'expect($1).toBe(true)');
    content = content.replace(/assert\.isFalse\(([^)]+)\)/g, 'expect($1).toBe(false)');
    content = content.replace(/assert\.isNull\(([^)]+)\)/g, 'expect($1).toBeNull()');
    content = content.replace(/assert\.isNotNull\(([^)]+)\)/g, 'expect($1).not.toBeNull()');
    content = content.replace(/assert\.isAtLeast\(([^,]+),\s*([^)]+)\)/g, 'expect($1).toBeGreaterThanOrEqual($2)');
    content = content.replace(/assert\.isAtMost\(([^,]+),\s*([^)]+)\)/g, 'expect($1).toBeLessThanOrEqual($2)');
    content = content.replace(/assert\.isDefined\(([^)]+)\)/g, 'expect($1).toBeDefined()');
    content = content.replace(/assert\.deepEqual\(([^,]+),\s*([^)]+)\)/g, 'expect($1).toEqual($2)');
    content = content.replace(/assert\.ok\(([^)]+)\)/g, 'expect($1).toBeTruthy()');
    content = content.replace(/assert\.doesNotThrow\(/g, 'expect(() => ');
    
    // Fix broken patterns from previous conversion
    content = content.replace(/expect\(isAtLeast\(/g, 'expect(');
    content = content.replace(/expect\(isAtMost\(/g, 'expect(');
    content = content.replace(/expect\(strictEqual\(/g, 'expect(');
    content = content.replace(/expect\(isTrue\(/g, 'expect(');
    content = content.replace(/expect\(isFalse\(/g, 'expect(');
    content = content.replace(/expect\(isNull\(/g, 'expect(');
    content = content.replace(/expect\(isNotNull\(/g, 'expect(');
    content = content.replace(/expect\(isDefined\(/g, 'expect(');
    content = content.replace(/expect\(deepEqual\(/g, 'expect(');
    content = content.replace(/expect\(ok\(/g, 'expect(');
    
    fs.writeFileSync(filePath, content);
    console.log(`Converted ${file}`);
});

console.log('Conversion complete!');
