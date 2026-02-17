#!/usr/bin/env node
/**
 * Stop-hook script for long-running agent loops (e.g. grind until tests pass).
 * Receives StopHookInput JSON on stdin; prints { followup_message } to stdout to continue the loop.
 *
 * Contract: Cursor passes { conversation_id, status, loop_count }. If we output
 * { "followup_message": "..." }, the agent continues; empty {} or no output ends the loop.
 */

const fs = require('fs');
const path = require('path');

const MAX_ITERATIONS = parseInt(process.env.GRIND_MAX_ITERATIONS || '5', 10);
const SCRATCHPAD_PATH = process.env.GRIND_SCRATCHPAD || path.join(process.cwd(), '.cursor', 'scratchpad.md');

function readStdin() {
    return new Promise((resolve) => {
        const chunks = [];
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => chunks.push(chunk));
        process.stdin.on('end', () => resolve(chunks.join('')));
    });
}

async function main() {
    const raw = await readStdin();
    let input;
    try {
        input = JSON.parse(raw.trim() || '{}');
    } catch (_) {
        process.stdout.write(JSON.stringify({}) + '\n');
        process.exit(0);
    }

    const { status, loop_count = 0 } = input;
    if (status !== 'completed' || loop_count >= MAX_ITERATIONS) {
        process.stdout.write(JSON.stringify({}) + '\n');
        process.exit(0);
    }

    let scratchpad = '';
    try {
        if (fs.existsSync(SCRATCHPAD_PATH)) {
            scratchpad = fs.readFileSync(SCRATCHPAD_PATH, 'utf8');
        }
    } catch (_) {
        // ignore
    }

    if (scratchpad.includes('DONE')) {
        process.stdout.write(JSON.stringify({}) + '\n');
    } else {
        process.stdout.write(JSON.stringify({
            followup_message: `[Iteration ${loop_count + 1}/${MAX_ITERATIONS}] Continue working. Update .cursor/scratchpad.md with DONE when complete.`
        }) + '\n');
    }
    process.exit(0);
}

main();
