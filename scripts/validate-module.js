#!/usr/bin/env node
/**
 * Validates a business module against the module structure (app, domain, infrastructure required; input optional) and import rules.
 * Exit 0 = pass, non-zero = fail (messages to stderr).
 *
 * Usage: node scripts/validate-module.js --module=<name>
 *    or: npm run validate:module -- --module=<name>
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const businessModulesRoot = path.join(repoRoot, 'business_modules');
const compositionRootPath = path.join(repoRoot, 'compositionRoot.js');

function parseArgs() {
    const arg = process.argv.find(a => a.startsWith('--module='));
    if (!arg) {
        console.error('Usage: node scripts/validate-module.js --module=<name>');
        console.error('Example: npm run validate:module -- --module=awareness');
        process.exit(2);
    }
    return arg.slice('--module='.length).trim();
}

function requiredDirsExist(moduleName) {
    const moduleRoot = path.join(businessModulesRoot, moduleName);
    const required = ['app', 'domain', 'infrastructure']; // input/ is optional when module is only called in-process
    const missing = [];
    const empty = [];
    for (const dir of required) {
        const p = path.join(moduleRoot, dir);
        if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
            missing.push(dir);
        } else {
            const jsInLayer = listJsFiles(p);
            if (jsInLayer.length === 0) {
                empty.push(dir);
            }
        }
    }
    // If input/ exists, it must have at least one .js file
    const inputDir = path.join(moduleRoot, 'input');
    if (fs.existsSync(inputDir) && fs.statSync(inputDir).isDirectory()) {
        if (listJsFiles(inputDir).length === 0) empty.push('input');
    }
    if (missing.length) {
        console.error(`[validate-module] Required directories missing for ${moduleName}: ${missing.join(', ')}`);
        console.error(`  Expected under: business_modules/${moduleName}/`);
        return false;
    }
    if (empty.length) {
        console.error(`[validate-module] Directories must contain at least one .js file: ${empty.join(', ')}`);
        console.error(`  (input/ is optional; when present it must have at least one file.)`);
        return false;
    }
    return true;
}

function listJsFiles(dir, baseDir = dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            results.push(...listJsFiles(full, baseDir));
        } else if (e.isFile() && e.name.endsWith('.js')) {
            results.push(path.relative(baseDir, full));
        }
    }
    return results;
}

function extractRequires(content) {
    const reqs = [];
    const re = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m;
    while ((m = re.exec(content)) !== null) {
        reqs.push(m[1]);
    }
    return reqs;
}

function resolveRequire(fromFileAbs, requireArg) {
    const fromDir = path.dirname(fromFileAbs);
    const resolved = path.resolve(fromDir, requireArg);
    return path.normalize(resolved);
}

function isUnder(absPath, dir) {
    const norm = path.normalize(path.resolve(absPath));
    const base = path.normalize(path.resolve(dir));
    return norm === base || norm.startsWith(base + path.sep);
}

function forbiddenDomainImports(moduleName) {
    const moduleRoot = path.join(businessModulesRoot, moduleName);
    const domainDir = path.join(moduleRoot, 'domain');
    if (!fs.existsSync(domainDir)) return { ok: true };

    const domainFiles = listJsFiles(domainDir).map(f => path.join(domainDir, f));
    const appDir = path.join(moduleRoot, 'app');
    const inputDir = path.join(moduleRoot, 'input');
    const infraDir = path.join(moduleRoot, 'infrastructure');

    for (const file of domainFiles) {
        const content = fs.readFileSync(file, 'utf8');
        const fromFile = path.resolve(file);
        for (const req of extractRequires(content)) {
            const resolved = resolveRequire(fromFile, req);
            if (!isUnder(resolved, repoRoot)) continue;
            if (isUnder(resolved, appDir) || isUnder(resolved, inputDir) || isUnder(resolved, infraDir)) {
                console.error(`[validate-module] Domain must not import app/input/infrastructure: ${path.relative(repoRoot, file)} requires ${req} -> ${path.relative(repoRoot, resolved)}`);
                return { ok: false };
            }
        }
    }
    return { ok: true };
}

function crossModuleImports(moduleName) {
    const moduleRoot = path.join(businessModulesRoot, moduleName);
    const allJs = listJsFiles(moduleRoot).map(f => path.join(moduleRoot, f));

    for (const file of allJs) {
        const content = fs.readFileSync(file, 'utf8');
        const fromFile = path.resolve(file);
        for (const req of extractRequires(content)) {
            const resolved = resolveRequire(fromFile, req);
            if (!isUnder(resolved, businessModulesRoot)) continue;
            const relativeToBiz = path.relative(businessModulesRoot, resolved);
            const otherModule = relativeToBiz.split(path.sep)[0];
            if (otherModule && otherModule !== moduleName) {
                console.error(`[validate-module] No cross-module imports: ${path.relative(repoRoot, file)} requires ${req} -> business_modules/${otherModule}/`);
                return { ok: false };
            }
        }
    }
    return { ok: true };
}

function wiringInCompositionRoot(moduleName) {
    if (!fs.existsSync(compositionRootPath)) {
        console.error('[validate-module] compositionRoot.js not found');
        return false;
    }
    const content = fs.readFileSync(compositionRootPath, 'utf8');
    const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const requireRe = new RegExp(
        "require\\s*\\(\\s*['\"][^'\"]*business_modules/" + escaped + "[^'\"]*['\"]\\s*\\)"
    );
    if (!requireRe.test(content)) {
        console.error(`[validate-module] Module ${moduleName} must be wired in compositionRoot.js (expected a require(...) line containing "business_modules/${moduleName}/...")`);
        return false;
    }
    return true;
}

function main() {
    const moduleName = parseArgs();
    const moduleRoot = path.join(businessModulesRoot, moduleName);
    if (!fs.existsSync(moduleRoot) || !fs.statSync(moduleRoot).isDirectory()) {
        console.error(`[validate-module] No such module: business_modules/${moduleName}`);
        process.exit(1);
    }

    let ok = true;
    if (!requiredDirsExist(moduleName)) ok = false;
    if (!forbiddenDomainImports(moduleName).ok) ok = false;
    if (!crossModuleImports(moduleName).ok) ok = false;
    if (!wiringInCompositionRoot(moduleName)) ok = false;

    if (ok) {
        console.log(`[validate-module] OK: business_modules/${moduleName} passed all checks.`);
        process.exit(0);
    }
    process.exit(1);
}

main();
