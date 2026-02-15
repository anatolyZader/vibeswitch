#!/usr/bin/env node
/**
 * Sync GitHub labels from labels.yml to the repository.
 * Usage: node .github/sync-labels.js
 * Requires: gh CLI authenticated, js-yaml (optional, uses simple YAML parser below).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const labelsFile = path.join(__dirname, 'labels.yml');
const raw = fs.readFileSync(labelsFile, 'utf8');

// Simple YAML array-of-objects parser (avoids js-yaml dependency)
const labels = [];
let current = null;
for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- name:')) {
        if (current) labels.push(current);
        current = { name: trimmed.replace('- name:', '').trim().replace(/^"|"$/g, ''), color: '', description: '' };
    } else if (trimmed.startsWith('color:') && current) {
        current.color = trimmed.replace('color:', '').trim().replace(/^"|"$/g, '');
    } else if (trimmed.startsWith('description:') && current) {
        current.description = trimmed.replace('description:', '').trim().replace(/^"|"$/g, '');
    }
}
if (current) labels.push(current);

console.log(`Found ${labels.length} labels to sync.`);

for (const label of labels) {
    const cmd = `gh label create "${label.name}" --color "${label.color}" --description "${label.description}" --force`;
    try {
        execSync(cmd, { stdio: 'pipe' });
        console.log(`  ✓ ${label.name}`);
    } catch (err) {
        const stderr = err.stderr ? err.stderr.toString() : '';
        console.log(`  ✗ ${label.name}: ${stderr.trim() || 'unknown error'}`);
    }
}

console.log('Done.');
