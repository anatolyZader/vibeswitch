#!/usr/bin/env node

/**
 * Suggests edge and corner cases for a spec using an LLM (OpenAI API).
 * Output can be passed to judge-spec-coverage via --suggested-cases.
 *
 * Usage:
 *   node scripts/suggest-spec-cases.js --spec docs/specs/spec-foo.md
 *   node scripts/suggest-spec-cases.js --spec docs/specs/spec-foo.md --code lib/foo.js --output suggested-cases.md
 *
 * Environment: OPENAI_API_KEY (required), SPEC_LLM_MODEL (optional, default: gpt-4o-mini).
 * Exit code: 0 on success, 2 on error.
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
    const args = process.argv.slice(2);
    let specPath = null;
    let codePath = null;
    let outputPath = null;
    let apiKey = process.env.OPENAI_API_KEY;
    let model = process.env.SPEC_LLM_MODEL || 'gpt-4o-mini';

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--spec' || arg === '-s') specPath = args[++i];
        else if (arg === '--code' || arg === '-c') codePath = args[++i];
        else if (arg === '--output' || arg === '-o') outputPath = args[++i];
        else if (arg === '--model' || arg === '-m') model = args[++i];
        else if (arg === '--api-key') apiKey = args[++i];
        else if (arg === '--help' || arg === '-h') {
            console.log(`
Usage: node scripts/suggest-spec-cases.js --spec <spec.md> [options]
Options: --spec -s, --code -c, --output -o, --model -m, --api-key, --help -h
Env: OPENAI_API_KEY (required), SPEC_LLM_MODEL (optional)
`);
            process.exit(0);
        }
    }
    if (!specPath) { console.error('Error: --spec is required.'); process.exit(2); }
    if (!apiKey) { console.error('Error: OPENAI_API_KEY or --api-key required.'); process.exit(2); }
    return { specPath, codePath, outputPath, apiKey, model };
}

function readFile(p) {
    const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    if (!fs.existsSync(abs)) throw new Error('File not found: ' + abs);
    return fs.readFileSync(abs, 'utf8');
}

const SYSTEM_PROMPT = `You are a senior engineer. Suggest additional edge and corner cases for testing based on the spec (and optional code).
- Edge case: boundary of valid behavior (empty, max length, single element).
- Corner case: unusual/rare scenario (null, wrong type, encoding, concurrency).
List cases NOT already clearly in the spec's Edge cases / Error cases / Input-Output.
Return JSON only (no markdown): { "suggestedEdgeCases": ["...", ...], "suggestedCornerCases": ["...", ...] }
Use empty arrays if none. Be concise; 3-8 per category typical.`;

function buildUserPrompt(specContent, codeContent) {
    let out = '## Spec\n\n' + specContent;
    if (codeContent) out += '\n\n## Code (context)\n\n```\n' + codeContent.slice(0, 12000) + (codeContent.length > 12000 ? '\n...' : '') + '\n```\n';
    out += '\n\nSuggest edge and corner cases. Return JSON only.';
    return out;
}

async function callOpenAI(apiKey, model, systemPrompt, userPrompt, timeoutMs = 45000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model, temperature: 0.2, messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ] })
        });
        if (!res.ok) throw new Error('OpenAI ' + res.status + ': ' + (await res.text()).slice(0, 300));
        const content = (await res.json())?.choices?.[0]?.message?.content;
        if (!content) throw new Error('Empty response');
        return content;
    } finally { clearTimeout(t); }
}

function extractJSON(text) {
    const t = text.trim();
    const i = t.indexOf('{'), j = t.lastIndexOf('}') + 1;
    if (i === -1 || j <= i) throw new Error('No JSON in response');
    return JSON.parse(t.slice(i, j));
}

function formatReport(result) {
    let out = '# Suggested edge and corner cases\n\n';
    if (result.suggestedEdgeCases && result.suggestedEdgeCases.length) {
        out += '## Suggested edge cases\n\n';
        result.suggestedEdgeCases.forEach((c) => { out += '- ' + c + '\n'; });
        out += '\n';
    }
    if (result.suggestedCornerCases && result.suggestedCornerCases.length) {
        out += '## Suggested corner cases\n\n';
        result.suggestedCornerCases.forEach((c) => { out += '- ' + c + '\n'; });
    }
    return out;
}

async function main() {
    const { specPath, codePath, outputPath, apiKey, model } = parseArgs();
    const specContent = readFile(specPath);
    let codeContent = null;
    if (codePath) {
        const abs = path.isAbsolute(codePath) ? codePath : path.join(process.cwd(), codePath);
        if (fs.existsSync(abs)) codeContent = readFile(abs);
    }
    const userPrompt = buildUserPrompt(specContent, codeContent);
    process.stderr.write('Calling LLM to suggest edge/corner cases...\n');
    const raw = await callOpenAI(apiKey, model, SYSTEM_PROMPT, userPrompt);
    const result = extractJSON(raw);
    const report = formatReport(result);
    if (outputPath) {
        const outAbs = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);
        fs.writeFileSync(outAbs, report, 'utf8');
        process.stderr.write('Written to ' + outAbs + '\n');
    } else {
        console.log(report);
    }
    process.exit(0);
}

main().catch((e) => { console.error(e.message || e); process.exit(2); });
