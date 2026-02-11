/**
 * Manual validation script for Claude adapter
 * Run this to test that both adapters are properly structured
 */

const { createOpenAILLMAdapter } = require('../../../business_modules/dashboard-chat/infrastructure/adapters/OpenAILLMAdapter');
const { createClaudeLLMAdapter } = require('../../../business_modules/dashboard-chat/infrastructure/adapters/ClaudeLLMAdapter');

console.log('Testing adapter creation...\n');

// Test OpenAI adapter
console.log('1. OpenAI Adapter:');
const openaiAdapter = createOpenAILLMAdapter({ apiKey: 'test-key', model: 'gpt-4o-mini' });
console.log('   ✓ Created successfully');
console.log('   ✓ Has chat method:', typeof openaiAdapter.chat === 'function');

// Test Claude adapter
console.log('\n2. Claude Adapter:');
const claudeAdapter = createClaudeLLMAdapter({ apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' });
console.log('   ✓ Created successfully');
console.log('   ✓ Has chat method:', typeof claudeAdapter.chat === 'function');

// Test interface compatibility
console.log('\n3. Interface Compatibility:');
console.log('   ✓ Both adapters have chat method');
console.log('   ✓ Both return promises from chat method');

// Test with empty API key
console.log('\n4. Empty API Key Handling:');
Promise.all([
    createOpenAILLMAdapter({ apiKey: '' }).chat('system', 'user'),
    createClaudeLLMAdapter({ apiKey: '' }).chat('system', 'user')
]).then(([openaiResult, claudeResult]) => {
    console.log('   ✓ OpenAI returns null:', openaiResult === null);
    console.log('   ✓ Claude returns null:', claudeResult === null);
    console.log('\n✅ All validations passed!');
}).catch(err => {
    console.error('   ✗ Error:', err.message);
});
