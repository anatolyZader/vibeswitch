// Test file to trigger AI activity detection
// This should be detected by the awareness monitor

function testAwarenessDetection() {
    console.log('Testing awareness monitor detection');
    
    // This is a substantial block of code that should trigger
    // the AI activity detection in the awareness monitor
    const data = {
        name: 'Test',
        value: 123,
        timestamp: Date.now(),
        description: 'This file was created to test if the awareness monitor properly detects AI-generated content'
    };
    
    return data;
}

function anotherFunction() {
    // Adding more content to make this file substantial
    const array = [1, 2, 3, 4, 5];
    const result = array.map(x => x * 2);
    return result.reduce((a, b) => a + b, 0);
}

module.exports = { testAwarenessDetection, anotherFunction };


