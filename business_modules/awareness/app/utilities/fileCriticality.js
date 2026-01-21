/**
 * File Criticality Utility
 * Determines the criticality level of a file based on its path/URI
 * 
 * Criticality affects risk-based debt calculation:
 * - Higher criticality = higher base risk
 * - Security/auth files = highest criticality
 * - Infrastructure/config = medium-high
 * - Test files = lower criticality
 * - Regular code = baseline
 */

/**
 * Normalize URI to path segments for matching
 * @param {string} fileUri - File URI string
 * @returns {Object} Normalized path info { path: string, segments: string[], filename: string }
 */
function normalizePath(fileUri) {
    if (!fileUri) return { path: '', segments: [], filename: '' };
    
    // Remove URI scheme (file://, etc.) and query params
    let path = fileUri;
    try {
        // If it's a full URI, extract path
        if (path.includes('://')) {
            const url = new URL(path);
            path = url.pathname;
        }
        // Remove query/fragment
        const queryIndex = path.indexOf('?');
        if (queryIndex >= 0) path = path.substring(0, queryIndex);
        const fragmentIndex = path.indexOf('#');
        if (fragmentIndex >= 0) path = path.substring(0, fragmentIndex);
    } catch (e) {
        // If URL parsing fails, use as-is
    }
    
    // Normalize path separators (Windows \ to /)
    path = path.replace(/\\/g, '/');
    
    // Split into segments
    const segments = path.split('/').filter(s => s.length > 0);
    const filename = segments.length > 0 ? segments[segments.length - 1].toLowerCase() : '';
    
    return { path: path.toLowerCase(), segments: segments.map(s => s.toLowerCase()), filename };
}

/**
 * Check if path segment matches (exact segment or filename)
 * @param {string[]} segments - Path segments
 * @param {string} filename - Filename
 * @param {string[]} segmentPatterns - Patterns to match in segments
 * @param {string[]} filenamePatterns - Patterns to match in filenames
 * @returns {boolean} True if matches
 */
function matchesPathPattern(segments, filename, segmentPatterns, filenamePatterns) {
    // Check segments (exact match or contains as a segment)
    for (const pattern of segmentPatterns) {
        if (segments.some(s => s === pattern || s.includes(pattern))) {
            return true;
        }
    }
    
    // Check filename (exact match or starts/ends with pattern)
    for (const pattern of filenamePatterns) {
        if (filename === pattern || 
            filename.startsWith(pattern + '.') || 
            filename.endsWith('.' + pattern) ||
            filename.includes('.' + pattern + '.')) {
            return true;
        }
    }
    
    return false;
}

/**
 * Get file criticality multiplier based on file path/URI
 * @param {string} fileUri - File URI string
 * @returns {number} Criticality multiplier (0.5 to 2.0)
 */
function getFileCriticality(fileUri) {
    if (!fileUri) return 1.0;
    
    const { segments, filename } = normalizePath(fileUri);
    
    // Highest criticality: Security and authentication
    // Match explicit segments and filenames only (avoid false matches like "monkey", "keyboard")
    const securitySegments = ['auth', 'security', 'secrets', 'credentials', 'password', 'token', 'key', 'secret'];
    const securityFilenames = ['.env', '.npmrc', '.pem', '.key', '.secret', 'credentials', 'password', 'token'];
    if (matchesPathPattern(segments, filename, securitySegments, securityFilenames)) {
        return 2.0;
    }
    
    // High criticality: Infrastructure and configuration
    const infraSegments = ['infra', 'infrastructure', 'config', 'configuration', 'deploy', 'docker', 'kubernetes', 'k8s'];
    const infraFilenames = ['.env', '.config', 'dockerfile', 'docker-compose', 'k8s', 'kubernetes'];
    if (matchesPathPattern(segments, filename, infraSegments, infraFilenames)) {
        return 1.5;
    }
    
    // Medium-high criticality: Database and API
    const dbApiSegments = ['db', 'database', 'api', 'routes', 'middleware'];
    if (matchesPathPattern(segments, filename, dbApiSegments, [])) {
        return 1.3;
    }
    
    // Lower criticality: Test files
    const testSegments = ['test', 'tests', 'spec', '__tests__'];
    const testFilenames = ['.test.js', '.test.ts', '.spec.js', '.spec.ts'];
    // Also check if filename contains .test. or .spec.
    const isTestFile = matchesPathPattern(segments, filename, testSegments, testFilenames) ||
                       filename.includes('.test.') ||
                       filename.includes('.spec.');
    if (isTestFile) {
        return 0.5;
    }
    
    // Baseline: Regular code files
    return 1.0;
}

/**
 * Check if file is a test file
 * @param {string} fileUri - File URI string
 * @returns {boolean} True if file is a test file
 */
function isTestFile(fileUri) {
    if (!fileUri) return false;
    const path = fileUri.toLowerCase();
    return path.includes('/test/') ||
           path.includes('/tests/') ||
           path.includes('/spec/') ||
           path.includes('/__tests__/') ||
           path.includes('.test.') ||
           path.includes('.spec.') ||
           path.endsWith('.test.js') ||
           path.endsWith('.test.ts') ||
           path.endsWith('.spec.js') ||
           path.endsWith('.spec.ts');
}

module.exports = {
    getFileCriticality,
    isTestFile
};
