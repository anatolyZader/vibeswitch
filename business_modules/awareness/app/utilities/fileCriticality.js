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
 * Get file criticality multiplier based on file path/URI
 * @param {string} fileUri - File URI string
 * @returns {number} Criticality multiplier (0.5 to 2.0)
 */
function getFileCriticality(fileUri) {
    if (!fileUri) return 1.0;
    
    const path = fileUri.toLowerCase();
    
    // Highest criticality: Security and authentication
    if (path.includes('/auth/') || 
        path.includes('/security/') || 
        path.includes('/secrets/') ||
        path.includes('/credentials/') ||
        path.includes('/password') ||
        path.includes('/token') ||
        path.includes('/key') ||
        path.includes('/secret')) {
        return 2.0;
    }
    
    // High criticality: Infrastructure and configuration
    if (path.includes('/infra/') || 
        path.includes('/infrastructure/') ||
        path.includes('/config/') ||
        path.includes('/configuration/') ||
        path.includes('/deploy/') ||
        path.includes('/docker') ||
        path.includes('/kubernetes') ||
        path.includes('/k8s') ||
        path.includes('/.env') ||
        path.includes('/.config')) {
        return 1.5;
    }
    
    // Medium-high criticality: Database and API
    if (path.includes('/db/') ||
        path.includes('/database/') ||
        path.includes('/api/') ||
        path.includes('/routes/') ||
        path.includes('/middleware/')) {
        return 1.3;
    }
    
    // Lower criticality: Test files
    if (path.includes('/test/') ||
        path.includes('/tests/') ||
        path.includes('/spec/') ||
        path.includes('/__tests__/') ||
        path.includes('.test.') ||
        path.includes('.spec.') ||
        path.endsWith('.test.js') ||
        path.endsWith('.test.ts') ||
        path.endsWith('.spec.js') ||
        path.endsWith('.spec.ts')) {
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
