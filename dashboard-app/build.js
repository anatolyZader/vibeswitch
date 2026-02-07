const path = require('path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const outFile = path.join(root, 'out', 'dashboard-app.js');
esbuild.build({
  entryPoints: [path.join(__dirname, 'src', 'index.jsx')],
  bundle: true,
  outfile: outFile,
  format: 'iife',
  globalName: 'VibeSwitchDashboard',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.jsx': 'jsx' }
}).then(() => console.log('Built out/dashboard-app.js')).catch(() => process.exit(1));
