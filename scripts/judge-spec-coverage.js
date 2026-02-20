#!/usr/bin/env node

/**
 * Judge test coverage against a spec file using an LLM (OpenAI API).
 * Run before starting TDD implementation (Green phase) to ensure tests cover the spec.
 *
 * Usage:
 *   node scripts/judge-spec-coverage.js --spec docs/specs/spec-validateEmail.md --tests tests/lib/validateEmail.test.js
 *   node scripts/judge-spec-coverage.js --spec docs/specs/spec-foo.md --tests tests/
 *   SPEC_LLM_MODEL=gpt-4o node scripts/judge-spec-coverage.js --spec docs/specs/spec-foo.md --tests tests/ --output report.md
 *
 * Environment:
 *   OPENAI_API_KEY  - Required. OpenAI API key.
 *   SPEC_LLM_MODEL  - Optional. Model name (default: gpt-4o-mini).
 *
 * Exit code: 0 if coverage is adequate, 1 if gaps found or error.
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
    const args = process.argv.slice(2);
    let specPath = null;
    let testsPath = null;
    let outputPath = null;
    let suggestedCasesPath = null;
    let apiKey = process.env.OPENAI_API_KEY;
    let model = process.env.SPEC_LLM_MODEL || 'gpt-4o-mini';

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--spec' || arg === '-s') {
            specPath = args[++i];
        } else if (arg === '--tests' || arg === '-t') {
            testsPath = args[++i];
        } else if (arg === '--output' || arg === '-o') {
            outputPath = args[++i];
        } else if (arg === '--suggested-cases') {
            suggestedCasesPath = args[++i];
        } else if (arg === '--model' || arg === '-m') {
            model = args[++i];
        } else if (arg === '--api-key') {
            apiKey = args[++i];
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
Usage: node scripts/judge-spec-coverage.js --spec <spec.md> --tests <test.js|testsDir> [options]

Options:
  --spec, -s           Path to the spec file (e.g. docs/specs/spec-foo.md)
  --tests, -t           Path to test file or directory containing .test.js files
  --suggested-cases     Path to suggested edge/corner cases (from suggest-spec-cases.js)
  --output, -o          Write report to file (default: stdout)
  --model, -m           OpenAI model (default: env SPEC_LLM_MODEL or gpt-4o-mini)
  --api-key             OpenAI API key (default: env OPENAI_API_KEY)
  --help, -h            Show this help

Environment:
  OPENAI_API_KEY   OpenAI API key (required)
  SPEC_LLM_MODEL   Model name (optional)
`);
            process.exit(0);
        }
    }

    if (!specPath || !testsPath) {
        console.error('Error: --spec and --tests are required.');
        process.exit(2);
    }
    if (!apiKey) {
        console.error('Error: OPENAI_API_KEY or --api-key is required.');
        process.exit(2);
    }

    return { specPath, testsPath, outputPath, suggestedCasesPath, apiKey, model };
}

function readFile(p) {
    const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    if (!fs.existsSync(abs)) {
        throw new Error(`File not found: ${abs}`);
    }
    return fs.readFileSync(abs, 'utf8');
}

function listTestFiles(dir) {
    const abs = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
    if (!fs.existsSync(abs)) throw new Error(`Directory not found: ${abs}`);
    const files = [];
    function walk(d) {
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const e of entries) {
            const full = path.join(d, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.name.endsWith('.test.js')) files.push(full);
        }
    }
    walk(abs);
    return files;
}

function loadTests(testsPath) {
    const abs = path.isAbsolute(testsPath) ? testsPath : path.join(process.cwd(), testsPath);
    const stat = fs.statSync(abs);
    if (stat.isFile()) {
        return [{ path: abs, content: readFile(abs) }];
    }
    return listTestFiles(testsPath).map((f) => ({ path: f, content: readFile(f) }));
}

const SYSTEM_PROMPT = `You are a senior engineer judging whether a test suite adequately covers a specification.
Given a spec file (markdown) and one or more test files (JavaScript Jest tests), you must:
1. Extract from the spec: contract, input/output pairs, edge cases, error cases, success criteria, invariants.
2. Check whether the test files contain tests that cover each of those.
3. Return a JSON object only (no markdown, no code fence) with this exact shape:
{
  "adequate": true or false,
  "summary": "One short sentence: is coverage adequate or not?",
  "gaps": ["list", "of", "missing or weak coverage items from the spec"],
  "covered": ["list of spec items that are clearly covered"]
}
If every requirement in the spec is clearly covered by the tests, set "adequate" to true and "gaps" to [].
Be strict: if an input/output pair or edge case or error case in the spec has no corresponding test, add it to "gaps".
If "Suggested edge/corner cases" are provided, also check whether the tests cover those; add any uncovered suggested case to "gaps" and set "adequate" to false if there are such gaps.`;

function buildUserPrompt(specContent, testEntries, suggestedCasesContent) {
    let out = '## Spec file\n\n';
    out += specContent;
    if (suggestedCasesContent) {
        out += '\n\n## Suggested edge/corner cases (should also be covered by tests)\n\n';
        out += suggestedCasesContent;
    }
    out += '\n\n## Test file(s)\n\n';
    for (const { path: p, content } of testEntries) {
        out += `### ${path.relative(process.cwd(), p)}\n\n`;
        out += '```javascript\n';
        out += content;
        out += '\n```\n\n';
    }
    out += '\nJudge: does the test suite cover all requirements from the spec';
    if (suggestedCasesContent) out += ' and all suggested edge/corner cases';
    out += '? Return the JSON object only.';
    return out;
}

async function callOpenAI(apiKey, model, systemPrompt, userPrompt, timeoutMs = 60000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                temperature: 0.1,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            })
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`OpenAI HTTP ${res.status}: ${text.slice(0, 300)}`);
        }
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error('Empty response from OpenAI');
        return content;
    } finally {
        clearTimeout(t);
    }
}

function extractJSON(text) {
    const trimmed = text.trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}') + 1;
    if (start === -1 || end <= start) throw new Error('No JSON object in response');
    return JSON.parse(trimmed.slice(start, end));
}

function formatReport(result) {
    let out = `# Spec coverage report\n\n`;
    out += `**Summary:** ${result.summary}\n\n`;
    out += `**Adequate:** ${result.adequate ? 'Yes' : 'No'}\n\n`;
    if (result.covered && result.covered.length) {
        out += `## Covered\n\n`;
        result.covered.forEach((c) => { out += `- ${c}\n`; });
        out += '\n';
    }
    if (result.gaps && result.gaps.length) {
        out += `## Gaps\n\n`;
        result.gaps.forEach((g) => { out += `- ${g}\n`; });
    }
    return out;
}

async function main() {
    const { specPath, testsPath, outputPath, suggestedCasesPath, apiKey, model } = parseArgs();

    const specContent = readFile(specPath);
    let suggestedCasesContent = null;
    if (suggestedCasesPath) {
        const abs = path.isAbsolute(suggestedCasesPath) ? suggestedCasesPath : path.join(process.cwd(), suggestedCasesPath);
        if (fs.existsSync(abs)) {
            suggestedCasesContent = readFile(abs);
        }
    }
    const testEntries = loadTests(testsPath);
    if (testEntries.length === 0) {
        console.error('Error: no test files found.');
        process.exit(2);
    }

    const userPrompt = buildUserPrompt(specContent, testEntries, suggestedCasesContent);

    process.stderr.write('Calling LLM to judge spec vs tests...\n');
    const raw = await callOpenAI(apiKey, model, SYSTEM_PROMPT, userPrompt);
    const result = extractJSON(raw);

    const report = formatReport(result);
    if (outputPath) {
        const outAbs = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);
        fs.writeFileSync(outAbs, report, 'utf8');
        process.stderr.write(`Report written to ${outAbs}\n`);
    } else {
        console.log(report);
    }

    process.exit(result.adequate ? 0 : 1);
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(2);
});
