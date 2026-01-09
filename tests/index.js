const path = require('path');
const Mocha = require('mocha');
const { glob } = require('glob');

function run() {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000,
        reporter: 'spec'
    });

    const testsRoot = path.resolve(__dirname, '.');

    return new Promise(async (resolve, reject) => {
        try {
            const files = await glob('**/**.test.js', { cwd: testsRoot });
            
            if (files.length === 0) {
                console.log('No test files found');
                return resolve();
            }

            // Filter out tests that require VS Code API or complex setup
            // Focus on pure domain entity tests first
            const testFiles = files.filter(f => 
                !f.includes('extension.test.js') && 
                !f.includes('awarenessService.adapters.test.js') && // Requires complex setup
                !f.includes('sessionTracker.reviewSession.test.js') && // Requires vscode in utils
                !f.includes('agentSuggestionHandler.batch.test.js') // Requires vscode
            );
            
            if (testFiles.length === 0) {
                console.log('No runnable test files found');
                return resolve();
            }

            console.log(`Found ${testFiles.length} test file(s)`);

            // Add files to the test suite
            testFiles.forEach(f => {
                console.log(`  - ${f}`);
                mocha.addFile(path.resolve(testsRoot, f));
            });

            // Run the mocha test
            mocha.run(failures => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    console.log(`\n✓ All ${testFiles.length} test file(s) passed`);
                    resolve();
                }
            });
        } catch (err) {
            console.error(err);
            reject(err);
        }
    });
}

module.exports = { run };

// If this file is run directly, execute the tests
if (require.main === module) {
    run().then(() => {
        process.exit(0);
    }).catch(err => {
        console.error('Test execution failed:', err);
        process.exit(1);
    });
}










