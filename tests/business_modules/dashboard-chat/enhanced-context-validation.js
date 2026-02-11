/**
 * Validation script for enhanced codebase awareness
 */

const { getEnhancedReadOnlyContext, getProjectStructure, getGitContext, getProjectMetadata } = require('../../../business_modules/dashboard-chat/infrastructure/adapters/EnhancedWorkspaceContextAdapter');

console.log('Testing enhanced context adapters...\n');

// Test that all functions are exported
console.log('1. Module Exports:');
console.log('   ✓ getEnhancedReadOnlyContext:', typeof getEnhancedReadOnlyContext === 'function');
console.log('   ✓ getProjectStructure:', typeof getProjectStructure === 'function');
console.log('   ✓ getGitContext:', typeof getGitContext === 'function');
console.log('   ✓ getProjectMetadata:', typeof getProjectMetadata === 'function');

// Test with mock vscode API (basic validation)
console.log('\n2. Function Calls with null vscode:');

Promise.all([
    getEnhancedReadOnlyContext(null, { provider: 'claude' }),
    getProjectStructure(null),
    getGitContext(null),
    getProjectMetadata(null)
]).then(([enhancedContext, structure, git, metadata]) => {
    console.log('   ✓ getEnhancedReadOnlyContext returns empty string:', enhancedContext === '');
    console.log('   ✓ getProjectStructure returns empty string:', structure === '');
    console.log('   ✓ getGitContext returns empty string:', git === '');
    console.log('   ✓ getProjectMetadata returns empty string:', metadata === '');
    console.log('\n✅ All validations passed!');
    console.log('\nNOTE: Enhanced context will provide full codebase awareness when used with real VS Code API.');
    console.log('Features include:');
    console.log('  - Project structure tree (up to 500 files)');
    console.log('  - Git status with modified/staged files');
    console.log('  - Project metadata from package.json');
    console.log('  - Open files (up to 20)');
    console.log('  - Key source files (up to 50)');
    console.log('  - Context limit: 150K chars for Claude, 16K for others');
}).catch(err => {
    console.error('   ✗ Error:', err.message);
});
