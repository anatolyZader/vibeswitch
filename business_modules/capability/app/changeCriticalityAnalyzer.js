/**
 * Change Criticality Analyzer (Improved)
 * 
 * Analyzes code changes to determine their impact on:
 * - Code dependencies (how many files depend on this file)
 * - Extension workflow (entry points, core modules, activation paths)
 * - Change type (structural vs cosmetic)
 * - Runtime risk (activation/command/startup paths)
 * 
 * Design improvements:
 * - Separates "blast radius" (location + centrality) from "surface change" (interface/structural)
 * - Detects activation path changes (package.json, commands, DI wiring)
 * - Configurable weights for testability
 * - Async/non-blocking to avoid UI freezes
 * - Fixed regex bugs, path normalization, diff parsing
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ========== CONFIGURABLE WEIGHTS ==========
const WEIGHTS = {
    // Location multipliers
    entryPoint: 2.5,
    coreFile: 2.0,
    coreModule: 1.5,
    
    // Centrality multipliers (logarithmic scale)
    centrality: {
        none: 1.0,
        low: 1.2,      // 1-5 deps
        medium: 1.5,   // 6-15 deps
        high: 2.0      // 16+ deps
    },
    
    // Surface change multipliers
    surfaceChange: {
        cosmetic: 0.5,
        content: 1.0,
        structural: 1.5,
        interface: 2.0
    },
    
    // Runtime risk multipliers
    runtimeRisk: {
        none: 1.0,
        low: 1.3,      // Used during commands
        medium: 1.6,   // Used during activation
        high: 2.0      // Critical activation path
    },
    
    // Activation path detection
    activationPath: {
        packageJson: 2.0,
        commandRegistration: 1.8,
        diWiring: 1.6,
        compositionRoot: 1.8
    }
};

// Core extension files that are critical to workflow
const CORE_EXTENSION_FILES = [
    'extension.js',
    'compositionRoot.js',
    'diContainer.js',
    'extensionState.js',
    'initializeHelpers.js'
];

// Core module directories (high impact if changed)
const CORE_MODULE_DIRS = [
    'business_modules/awareness/app',
    'business_modules/mode/app',
    'business_modules/capability/app'
];

// Cache for dependency counts (key: relativePath, value: count)
const dependencyCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map();

// Cache for file listings (key: workspaceRoot, value: {files: [], timestamp: number})
const fileListCache = new Map();
const FILE_LIST_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Concurrency limit for async file reads
const MAX_CONCURRENT_READS = 20;

/**
 * Analyze change criticality for a file (async, non-blocking)
 * @param {string} filePath - Absolute path to changed file
 * @param {string} workspaceRoot - Workspace root path
 * @param {Object} document - Optional document object (text content, not VS Code API)
 * @returns {Promise<{criticality: number, criticalityLabel: string, factors: Object, impact: string}>}
 */
async function analyzeChangeCriticality(filePath, workspaceRoot, document = null) {
    if (!filePath || !workspaceRoot || filePath === 'UNKNOWN') {
        return {
            criticality: 1.0,
            criticalityLabel: 'Unknown',
            factors: {},
            impact: 'Cannot analyze - missing file path'
        };
    }

    const relativePathNative = path.relative(workspaceRoot, filePath);
    const relativePath = normalizePathSeparators(relativePathNative);
    const fileName = path.basename(filePath);
    const factors = {};

    // Factor 1: File path-based criticality (from existing utility)
    let fileCriticality = 1.0;
    try {
        const fileCriticalityUtil = require('../../awareness/app/utilities/fileCriticality');
        const fileUri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
        fileCriticality = fileCriticalityUtil.getFileCriticality(fileUri);
        factors.pathBased = fileCriticality;
    } catch (e) {
        factors.pathBased = 1.0;
    }

    // Factor 2: Core extension file check
    let isCoreFile = false;
    if (CORE_EXTENSION_FILES.includes(fileName)) {
        isCoreFile = true;
        factors.isCoreExtensionFile = true;
    }

    // Factor 3: Core module directory check (with proper path normalization)
    let isCoreModule = false;
    for (const coreDir of CORE_MODULE_DIRS) {
        if (relativePath.startsWith(coreDir)) {
            isCoreModule = true;
            factors.isCoreModule = true;
            factors.coreModuleDir = coreDir;
            break;
        }
    }

    // Factor 4: Dependency centrality (async, cached)
    let dependencyCount = 0;
    let centralityScore = 1.0;
    try {
        dependencyCount = await countFileDependencies(relativePathNative, relativePath, workspaceRoot);
        // Logarithmic scale
        if (dependencyCount === 0) {
            centralityScore = WEIGHTS.centrality.none;
        } else if (dependencyCount <= 5) {
            centralityScore = WEIGHTS.centrality.low;
        } else if (dependencyCount <= 15) {
            centralityScore = WEIGHTS.centrality.medium;
        } else {
            centralityScore = WEIGHTS.centrality.high;
        }
        factors.dependencyCount = dependencyCount;
        factors.centralityScore = centralityScore;
    } catch (e) {
        factors.dependencyCount = 0;
        factors.centralityScore = WEIGHTS.centrality.none;
    }

    // Factor 5: Change type analysis (async, uses VS Code API when available)
    let changeTypeScore = 1.0;
    let changeType = 'unknown';
    try {
        const changeAnalysis = await analyzeChangeType(filePath, workspaceRoot, document);
        changeType = changeAnalysis.type;
        changeTypeScore = WEIGHTS.surfaceChange[changeType] || WEIGHTS.surfaceChange.content;
        factors.changeType = changeType;
        factors.changeTypeScore = changeTypeScore;
        factors.structuralChanges = changeAnalysis.structuralChanges;
    } catch (e) {
        factors.changeType = 'unknown';
        changeTypeScore = WEIGHTS.surfaceChange.content;
    }

    // Factor 6: Entry point check
    let isEntryPoint = false;
    if (fileName === 'extension.js' || fileName === 'compositionRoot.js') {
        isEntryPoint = true;
        factors.isEntryPoint = true;
    }

    // Factor 7: Activation path detection
    let runtimeRisk = WEIGHTS.runtimeRisk.none;
    const activationFactors = detectActivationPathChanges(filePath, relativePath, fileName);
    if (activationFactors.length > 0) {
        factors.activationPath = activationFactors;
        // Highest activation risk wins
        if (activationFactors.some(f => f.includes('package.json'))) {
            runtimeRisk = WEIGHTS.runtimeRisk.high;
        } else if (activationFactors.some(f => f.includes('extension.js') || f.includes('compositionRoot'))) {
            runtimeRisk = WEIGHTS.runtimeRisk.high;
        } else if (activationFactors.some(f => f.includes('command') || f.includes('DI'))) {
            runtimeRisk = WEIGHTS.runtimeRisk.medium;
        } else {
            runtimeRisk = WEIGHTS.runtimeRisk.low;
        }
        factors.runtimeRisk = runtimeRisk;
    }

    // ========== CALCULATE COMPOSITE CRITICALITY ==========
    // Separate: Blast Radius (location + centrality) × Surface Change × Runtime Risk
    
    // Blast Radius: base path criticality × location boost × centrality
    let blastRadius = fileCriticality;
    
    if (isEntryPoint) {
        blastRadius *= WEIGHTS.entryPoint;
    } else if (isCoreFile) {
        blastRadius *= WEIGHTS.coreFile;
    } else if (isCoreModule) {
        blastRadius *= WEIGHTS.coreModule;
    }
    
    blastRadius *= centralityScore;
    
    // Surface Change: how likely it breaks dependents
    const surfaceChange = changeTypeScore;
    
    // Runtime Risk: activation/command path impact
    const runtimeRiskMultiplier = runtimeRisk;
    
    // Final criticality = Blast Radius × Surface Change × Runtime Risk
    let criticality = blastRadius * surfaceChange * runtimeRiskMultiplier;
    
    // Cap at reasonable maximum (10.0)
    criticality = Math.min(criticality, 10.0);
    
    // Ensure LOW is reachable: if cosmetic change in test file with no deps, should be < 1.0
    // This happens when: fileCriticality=0.5 (test) × cosmetic=0.5 × no boost = 0.25
    // So we're good - LOW is reachable now

    // Generate label and impact description
    let criticalityLabel = 'REGULAR';
    if (criticality >= 8.0) {
        criticalityLabel = '🔴 CRITICAL (Entry Point / High Centrality)';
    } else if (criticality >= 5.0) {
        criticalityLabel = '🟠 VERY HIGH (Core Module / Structural)';
    } else if (criticality >= 3.0) {
        criticalityLabel = '🟡 HIGH (Core Module / Dependencies)';
    } else if (criticality >= 2.0) {
        criticalityLabel = '🟢 MEDIUM (Moderate Impact)';
    } else if (criticality >= 1.0) {
        criticalityLabel = '⚪ REGULAR';
    } else {
        criticalityLabel = '🔵 LOW (Test/Cosmetic)';
    }

    // Build impact description
    const impactParts = [];
    if (isEntryPoint) {
        impactParts.push('Entry point file');
    } else if (isCoreFile) {
        impactParts.push('Core extension file');
    }
    if (isCoreModule) {
        impactParts.push('Core module');
    }
    if (dependencyCount > 0) {
        impactParts.push(`${dependencyCount} dependent file${dependencyCount !== 1 ? 's' : ''}`);
    }
    if (changeType === 'structural') {
        impactParts.push('Structural changes');
    } else if (changeType === 'interface') {
        impactParts.push('Interface/export changes');
    }
    if (activationFactors.length > 0) {
        impactParts.push(`Activation path: ${activationFactors.join(', ')}`);
    }

    const impact = impactParts.length > 0 
        ? impactParts.join(' • ')
        : 'Standard code change';

    return {
        criticality,
        criticalityLabel,
        factors: {
            ...factors,
            blastRadius,  // Keep as number, format at UI layer
            surfaceChange, // Keep as number
            runtimeRisk: runtimeRiskMultiplier // Keep as number
        },
        impact
    };
}

/**
 * Normalize path separators to POSIX (for consistent matching)
 * FIXED: Use regex replace to handle mixed separators (Windows paths can contain /)
 * @param {string} filePath - File path
 * @returns {string} Normalized path
 */
function normalizePathSeparators(filePath) {
    return filePath.replace(/\\/g, '/');
}

/**
 * Detect if file is part of activation path (package.json, commands, DI wiring)
 * FIXED: Tightened patterns to avoid false positives (exact files or known folders)
 * @param {string} filePath - Absolute path
 * @param {string} relativePath - Relative path (normalized)
 * @param {string} fileName - Filename
 * @returns {string[]} Array of activation path factors
 */
function detectActivationPathChanges(filePath, relativePath, fileName) {
    const factors = [];
    
    // Exact file matches (highest priority)
    if (fileName === 'package.json') {
        factors.push('package.json (activation events, commands)');
    }
    
    if (fileName === 'extension.js') {
        factors.push('extension.js (activation entry point)');
    }
    
    if (fileName === 'compositionRoot.js') {
        factors.push('compositionRoot.js (DI wiring)');
    }
    
    if (fileName === 'diContainer.js') {
        factors.push('diContainer.js (dependency injection)');
    }
    
    if (fileName === 'initializeHelpers.js') {
        factors.push('initializeHelpers.js (startup initialization)');
    }
    
    // Known patterns (tighter matching)
    // vsCommandsFactory files
    if (/vsCommandsFactory.*\.js$/.test(relativePath)) {
        factors.push('Command registration (vsCommandsFactory)');
    }
    
    // Command registration directories (exact folder match, not substring)
    // Common patterns: app/commands, infrastructure/commands, commands/
    if (/(^|\/)commands(\/|$)/.test(relativePath) ||
        /app\/commands/.test(relativePath) ||
        /infrastructure\/commands/.test(relativePath)) {
        factors.push('Command registration (commands directory)');
    }
    
    // Composition root in path (but not just substring)
    if (/compositionRoot\.js$/.test(relativePath)) {
        factors.push('compositionRoot.js (DI wiring)');
    }
    
    // DI container in path
    if (/diContainer\.js$/.test(relativePath)) {
        factors.push('diContainer.js (dependency injection)');
    }
    
    return factors;
}

/**
 * Count how many files in the workspace depend on (require/import) the given file
 * FIXED: Removed /g flag, improved patterns to avoid basename-only collisions
 * @param {string} relativePathNative - Relative path (native format)
 * @param {string} relativePathPosix - Relative path (POSIX normalized)
 * @param {string} workspaceRoot - Workspace root path
 * @returns {Promise<number>} Number of files that depend on this file
 */
async function countFileDependencies(relativePathNative, relativePathPosix, workspaceRoot) {
    try {
        // Check cache first
        const cacheKey = `${workspaceRoot}:${relativePathPosix}`;
        const cached = dependencyCache.get(cacheKey);
        const cacheTime = cacheTimestamps.get(cacheKey);
        if (cached !== undefined && cacheTime && (Date.now() - cacheTime < CACHE_TTL)) {
            return cached;
        }

        // Normalize path (remove extension, handle index.js) - use POSIX for normalized path
        const normalizedPath = normalizeModulePath(relativePathPosix);
        if (!normalizedPath) {
            dependencyCache.set(cacheKey, 0);
            cacheTimestamps.set(cacheKey, Date.now());
            return 0;
        }

        // Build search patterns - FIXED: require directory context to avoid basename collisions
        const escapedPath = escapeRegex(normalizedPath);
        const dirName = path.posix.dirname(normalizedPath);
        const baseName = path.posix.basename(normalizedPath, path.posix.extname(normalizedPath));
        const escapedDir = escapeRegex(dirName);
        const escapedBase = escapeRegex(baseName);
        
        // Patterns without 'g' flag (non-stateful)
        // Prefer exact path matches, with optional directory context for relative imports
        const searchPatterns = [
            // require('./path/to/file') or require('./path/to/file.js')
            new RegExp(`require\\(['"]\\.?/?${escapedPath}(?:\\.js)?['"]\\)`),
            // import ... from './path/to/file'
            new RegExp(`from ['"]\\.?/?${escapedPath}(?:\\.js)?['"]`),
            // require('../dir/file') - require directory context, not just basename
            new RegExp(`require\\(['"][^'"]*${escapedDir}[/\\\\]${escapedBase}(?:\\.js)?['"]\\)`),
            // import ... from '../dir/file'
            new RegExp(`from ['"][^'"]*${escapedDir}[/\\\\]${escapedBase}(?:\\.js)?['"]`)
        ];

        // FIXED: Build explicit scope list deterministically (not filter after full walk)
        // This ensures deterministic order and avoids wasted work
        const filesToSearch = await findScopedJSFiles(workspaceRoot);

        // FIXED: Create task functions instead of promises to actually limit concurrency
        const tasks = filesToSearch.map(file => async () => {
            // Skip the file itself
            const fileRelative = normalizePathSeparators(path.relative(workspaceRoot, file));
            if (fileRelative === relativePathPosix) {
                return null;
            }

            try {
                const content = await fs.readFile(file, 'utf8');
                for (const pattern of searchPatterns) {
                    // FIXED: Reset lastIndex before each test (defensive)
                    pattern.lastIndex = 0;
                    if (pattern.test(content)) {
                        return file; // Return file path to count it
                    }
                }
                return null;
            } catch (e) {
                // Skip files that can't be read
                return null;
            }
        });

        // Process in batches to limit concurrency (tasks execute only when called)
        const batchSize = MAX_CONCURRENT_READS;
        let count = 0;
        
        for (let i = 0; i < tasks.length; i += batchSize) {
            const batch = tasks.slice(i, i + batchSize).map(fn => fn());
            const results = await Promise.allSettled(batch);
            count += results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
        }

        // Cache result
        dependencyCache.set(cacheKey, count);
        cacheTimestamps.set(cacheKey, Date.now());

        return count;
    } catch (e) {
        return 0;
    }
}

/**
 * Normalize module path for dependency matching (uses POSIX paths)
 * @param {string} filePath - File path (POSIX normalized)
 * @returns {string|null} Normalized path or null
 */
function normalizeModulePath(filePath) {
    if (!filePath) return null;

    // Already POSIX normalized, use path.posix.*
    let normalized = filePath;

    // Remove .js extension
    normalized = normalized.replace(/\.js$/, '');

    // Handle index.js -> directory
    if (path.posix.basename(normalized) === 'index') {
        normalized = path.posix.dirname(normalized);
    }

    // Remove leading ./
    normalized = normalized.replace(/^\.\//, '');

    return normalized;
}

/**
 * Escape special regex characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find JavaScript files in scoped directories (deterministic, cached)
 * FIXED: Build explicit scope list instead of filtering after full walk
 * @param {string} workspaceRoot - Workspace root
 * @returns {Promise<string[]>} Array of absolute file paths
 */
async function findScopedJSFiles(workspaceRoot) {
    // Cache key includes scope hash for deterministic caching
    const scopeKey = `${workspaceRoot}:scoped`;
    const cached = fileListCache.get(scopeKey);
    if (cached && (Date.now() - cached.timestamp < FILE_LIST_CACHE_TTL)) {
        return cached.files;
    }

    const files = [];
    const dirsToSkip = ['node_modules', '.git', '.cursor', '.vscode', 'dist', 'build', '.vibeswitch', 'tests', 'test'];
    const fileExtensions = ['.js', '.ts']; // Include TypeScript for future-proofing

    // Explicit scope: walk only these directories deterministically
    const scopedDirs = [
        path.join(workspaceRoot, 'business_modules'),
        path.join(workspaceRoot, 'cross-cut-modules')
    ];

    // Also include root-level files
    const rootFiles = [];
    try {
        const rootEntries = await fs.readdir(workspaceRoot, { withFileTypes: true });
        for (const entry of rootEntries) {
            if (entry.isFile()) {
                const ext = path.extname(entry.name);
                if (fileExtensions.includes(ext)) {
                    rootFiles.push(path.join(workspaceRoot, entry.name));
                }
            }
        }
    } catch (e) {
        // Skip if can't read root
    }

    async function walkDir(dir) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(workspaceRoot, fullPath);

                // Skip certain directories
                if (entry.isDirectory()) {
                    if (!dirsToSkip.some(skip => relativePath.includes(skip))) {
                        await walkDir(fullPath);
                    }
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (fileExtensions.includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (e) {
            // Skip directories that can't be read
        }
    }

    // Walk scoped directories in deterministic order
    for (const scopedDir of scopedDirs) {
        try {
            const stat = await fs.stat(scopedDir);
            if (stat.isDirectory()) {
                await walkDir(scopedDir);
            }
        } catch (e) {
            // Directory doesn't exist, skip
        }
    }

    // Combine: root files first, then scoped directories (deterministic order)
    const allFiles = [...rootFiles, ...files].sort(); // Sort for deterministic order
    
    // Cache result
    fileListCache.set(scopeKey, { files: allFiles, timestamp: Date.now() });
    
    return allFiles;
}

/**
 * Find all JavaScript files in workspace (async, cached) - kept for backward compatibility
 * @param {string} workspaceRoot - Workspace root
 * @returns {Promise<string[]>} Array of absolute file paths
 */
async function findJSFilesAsync(workspaceRoot) {
    // Use scoped version for consistency
    return findScopedJSFiles(workspaceRoot);
}

/**
 * Strip diff prefix from a line (+/-/space)
 * @param {string} line - Diff line
 * @returns {string} Line without diff prefix
 */
function stripDiffPrefix(line) {
    if (!line) return '';
    const first = line[0];
    if (first === '+' || first === '-' || first === ' ') return line.slice(1);
    return line;
}

/**
 * Check if line is a diff header/metadata line
 * @param {string} line - Line to check
 * @returns {boolean} True if it's a diff header
 */
function isDiffHeaderLine(line) {
    const trimmed = line.trimEnd();
    if (!trimmed) return false;
    return trimmed.startsWith('diff --git') ||
           trimmed.startsWith('index ') ||
           trimmed.startsWith('--- ') ||
           trimmed.startsWith('+++ ') ||
           trimmed.startsWith('@@');
}

/**
 * Execute git diff with timeout that actually kills the process
 * FIXED: Windows kill semantics (graceful then SIGKILL), cleanup listeners, windowsHide
 * @param {string} workspaceRoot - Workspace root
 * @param {string} relativePath - Relative file path
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<string>} Git diff output
 */
function gitDiffWithTimeout(workspaceRoot, relativePath, timeoutMs = 2000) {
    return new Promise((resolve, reject) => {
        const child = spawn('git', ['diff', 'HEAD', '--', relativePath], {
            cwd: workspaceRoot,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true // Avoid console window flashes on Windows
        });
        
        let stdout = '';
        let stderr = '';
        let resolved = false;
        
        const cleanup = () => {
            // Remove listeners to prevent leaks
            child.stdout.removeAllListeners();
            child.stderr.removeAllListeners();
            child.removeAllListeners();
        };
        
        const finish = (result) => {
            if (resolved) return;
            resolved = true;
            cleanup();
            resolve(result);
        };
        
        const fail = (err) => {
            if (resolved) return;
            resolved = true;
            cleanup();
            reject(err);
        };
        
        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        // Graceful kill first, then SIGKILL after short grace period (Windows-friendly)
        const timeout = setTimeout(() => {
            if (resolved) return;
            // Try graceful kill first
            child.kill();
            // If still running after grace period, force kill
            const forceKillTimeout = setTimeout(() => {
                if (!resolved && !child.killed) {
                    child.kill('SIGKILL');
                }
            }, 100);
            // Clean up force kill timeout if process exits
            child.once('close', () => clearTimeout(forceKillTimeout));
            fail(new Error('Timeout'));
        }, timeoutMs);
        
        child.on('close', (code) => {
            clearTimeout(timeout);
            if (resolved) return;
            if (code === 0 || stdout) {
                finish(stdout.trim());
            } else {
                fail(new Error(`git diff failed: ${stderr || 'unknown error'}`));
            }
        });
        
        child.on('error', (err) => {
            clearTimeout(timeout);
            fail(err);
        });
    });
}

/**
 * Analyze the type of change (structural vs cosmetic)
 * FIXED: Proper diff parsing, operator precedence, strip metadata, fix comment detection
 * FIXED: Git timeout actually kills the process
 * @param {string} filePath - Absolute path to file
 * @param {string} workspaceRoot - Workspace root
 * @param {Object} document - Optional document object (text content) - currently unused, kept for future
 * @returns {Promise<{type: string, score: number, structuralChanges: string[]}>}
 */
async function analyzeChangeType(filePath, workspaceRoot, document = null) {
    try {
        let diffOutput = '';
        
        // TODO: Use document.text for in-memory diff analysis in future
        // For now, document parameter is kept for API compatibility but not used
        
        // Try git diff (async, with timeout that kills process)
        try {
            const relativePath = path.relative(workspaceRoot, filePath);
            diffOutput = await gitDiffWithTimeout(workspaceRoot, relativePath, 2000);
        } catch (e) {
            // File not tracked, not a git repo, or timeout - return unknown
            return { type: 'unknown', score: WEIGHTS.surfaceChange.content, structuralChanges: [] };
        }

        if (!diffOutput) {
            return { type: 'unknown', score: WEIGHTS.surfaceChange.content, structuralChanges: [] };
        }

        // FIXED: Strip diff metadata (---, +++, @@, diff --git) before analysis
        const lines = diffOutput.split('\n');
        const hunkLines = lines.filter(line => {
            const trimmed = line.trimEnd();
            if (!trimmed) return false;
            // FIXED: Explicitly exclude header forms
            if (isDiffHeaderLine(trimmed)) return false;
            // Keep only actual change lines (+/-) and context lines (space)
            return trimmed[0] === '+' || trimmed[0] === '-' || trimmed[0] === ' ';
        });
        const cleanDiff = hunkLines.join('\n');

        const structuralChanges = [];
        let hasStructural = false;
        let hasInterface = false;

        // FIXED: Proper operator precedence with grouping
        // Check for export changes (module.exports, exports., export default)
        const exportAddedPattern = /^(?:\+.*module\.exports|\+.*exports\.|\+.*export\s+(?:default\s+)?(?:function|class|const|let|var))/m;
        const exportRemovedPattern = /^(?:-.*module\.exports|-.*exports\.|-.*export\s+(?:default\s+)?(?:function|class|const|let|var))/m;
        
        if (exportAddedPattern.test(cleanDiff)) {
            structuralChanges.push('Exports added');
            hasInterface = true;
        }
        if (exportRemovedPattern.test(cleanDiff)) {
            structuralChanges.push('Exports removed');
            hasInterface = true;
        }

        // Check for import/require changes
        const importAddedPattern = /^(?:\+.*require\(|\+.*import\s+)/m;
        const importRemovedPattern = /^(?:-.*require\(|-.*import\s+)/m;
        
        if (importAddedPattern.test(cleanDiff)) {
            structuralChanges.push('Imports added');
            hasInterface = true;
        }
        if (importRemovedPattern.test(cleanDiff)) {
            structuralChanges.push('Imports removed');
            hasInterface = true;
        }

        // Check for function/class signature changes
        const funcClassAddedPattern = /^(?:\+.*function\s+\w+\s*\(|\+.*class\s+\w+|\+.*const\s+\w+\s*=\s*(?:async\s+)?\()/m;
        const funcClassRemovedPattern = /^(?:-.*function\s+\w+\s*\(|-.*class\s+\w+|-.*const\s+\w+\s*=\s*(?:async\s+)?\()/m;
        
        if (funcClassAddedPattern.test(cleanDiff)) {
            structuralChanges.push('Functions/classes added');
            hasStructural = true;
        }
        if (funcClassRemovedPattern.test(cleanDiff)) {
            structuralChanges.push('Functions/classes removed');
            hasStructural = true;
        }

        // Check for constructor changes
        const constructorPattern = /^(?:[+-].*constructor\s*\()/m;
        if (constructorPattern.test(cleanDiff)) {
            structuralChanges.push('Constructor changes');
            hasStructural = true;
        }

        // Check for method additions/removals
        const methodPattern = /^(?:[+-].*\w+\s*\([^)]*\)\s*\{)/m;
        if (methodPattern.test(cleanDiff)) {
            structuralChanges.push('Method changes');
            hasStructural = true;
        }

        // Determine type and score
        let type = 'cosmetic';
        let score = WEIGHTS.surfaceChange.cosmetic;

        if (hasInterface) {
            type = 'interface';
            score = WEIGHTS.surfaceChange.interface;
        } else if (hasStructural) {
            type = 'structural';
            score = WEIGHTS.surfaceChange.structural;
        } else {
            // FIXED: Strip diff prefix before checking comments/whitespace
            const nonWhitespaceChanges = hunkLines.filter(line => {
                const raw = stripDiffPrefix(line).trim();
                if (!raw) return false;

                // FIXED: Check comments after stripping diff prefix
                if (raw.startsWith('//')) return false;
                if (raw.startsWith('/*') || raw.startsWith('*') || raw.startsWith('*/')) return false;

                return true;
            });
            
            if (nonWhitespaceChanges.length === 0) {
                type = 'cosmetic';
                score = WEIGHTS.surfaceChange.cosmetic;
            } else {
                type = 'content';
                score = WEIGHTS.surfaceChange.content;
            }
        }

        return { type, score, structuralChanges };
    } catch (e) {
        // If analysis fails, return default
        return { type: 'unknown', score: WEIGHTS.surfaceChange.content, structuralChanges: [] };
    }
}

module.exports = {
    analyzeChangeCriticality,
    countFileDependencies,
    analyzeChangeType,
    WEIGHTS // Export for testing
};
