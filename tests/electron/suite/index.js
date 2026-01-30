/**
 * Extension test runner - runs inside Extension Development Host.
 * Loads all *.test.js files in this directory and runs them with Mocha.
 */
const path = require('path');
const Mocha = require('mocha');
const { glob } = require('glob');

async function run() {
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 15000
    });

    const testsRoot = path.resolve(__dirname);
    const files = await glob('**/*.test.js', { cwd: testsRoot });

    for (const f of files) {
        mocha.addFile(path.resolve(testsRoot, f));
    }

    return new Promise((resolve, reject) => {
        mocha.run((failures) => {
            if (failures > 0) {
                reject(new Error(`${failures} tests failed.`));
            } else {
                resolve();
            }
        });
    });
}

module.exports = { run };
