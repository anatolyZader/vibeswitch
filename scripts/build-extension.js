/**
 * Bundle extension for packaging. Produces out/extension.js (single file).
 * Run: node scripts/build-extension.js (uses npx esbuild; or npm run build)
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'out');
fs.mkdirSync(outDir, { recursive: true });

const entry = path.join(root, 'extension.js');
const outfile = path.join(outDir, 'extension.js');

execSync(
  `npx esbuild "${entry}" --bundle --outfile="${outfile}" --platform=node --target=node16 --external:vscode --sourcemap`,
  { stdio: 'inherit', cwd: root }
);
console.log('Built out/extension.js');
