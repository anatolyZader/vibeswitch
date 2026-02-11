#!/usr/bin/env node

/**
 * Create Markdown File with Timestamp Prefix
 * 
 * Usage:
 *   node scripts/create-md.js "filename"
 *   node scripts/create-md.js "filename" --dir docs
 *   node scripts/create-md.js "filename" --dir docs --no-timestamp
 *   node scripts/create-md.js "plan-name.plan" --plans   (creates in .cursor/plans with timestamp)
 * 
 * Creates a markdown file with optional timestamp prefix:
 *   YYYY-MM-DD_HH-MM-filename.md
 * 
 * If --no-timestamp is provided, creates: filename.md
 * If --plans is provided, target dir is .cursor/plans (timestamp always used).
 */

const fs = require('fs');
const path = require('path');

// Parse arguments
const args = process.argv.slice(2);
let filename = null;
let targetDir = 'docs';
let noTimestamp = false;

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dir' || arg === '-d') {
        targetDir = args[++i];
    } else if (arg === '--plans' || arg === '-p') {
        targetDir = '.cursor/plans';
        noTimestamp = false; // plans always get timestamp
    } else if (arg === '--no-timestamp' || arg === '-n') {
        noTimestamp = true;
    } else if (!filename && !arg.startsWith('-')) {
        filename = arg;
    }
}

// Validate filename
if (!filename) {
    console.error('Error: Missing filename');
    console.error('');
    console.error('Usage:');
    console.error('  node scripts/create-md.js "filename"');
    console.error('  node scripts/create-md.js "filename" --dir docs');
    console.error('  node scripts/create-md.js "plan-name.plan" --plans');
    console.error('  node scripts/create-md.js "filename" --no-timestamp');
    process.exit(1);
}

// Plans always use timestamp
if (targetDir === '.cursor/plans') {
    noTimestamp = false;
}

// Remove .md extension if provided (we'll add it)
filename = filename.replace(/\.md$/, '');

// Generate timestamp prefix (YYYY-MM-DD_HH-MM)
const now = new Date();
const timestamp = now.toISOString()
    .slice(0, 16)
    .replace(/[:T]/g, '-')
    .replace(/(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})/, '$1_$2-$3');

// Build final filename
const finalFilename = noTimestamp 
    ? `${filename}.md`
    : `${timestamp}-${filename}.md`;

// Resolve target directory (relative to project root)
const projectRoot = path.resolve(__dirname, '..');
const targetPath = path.resolve(projectRoot, targetDir);

// Ensure target directory exists
if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
}

// Full file path
const filePath = path.join(targetPath, finalFilename);

// Check if file already exists
if (fs.existsSync(filePath)) {
    console.error(`Error: File already exists: ${filePath}`);
    process.exit(1);
}

// Generate file content
const title = filename
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const content = `# ${title}

Created at ${now.toISOString()}

---

`;

// Write file
fs.writeFileSync(filePath, content, 'utf8');

// Success message
console.log(`✅ Created: ${path.relative(projectRoot, filePath)}`);
console.log(`   Full path: ${filePath}`);
