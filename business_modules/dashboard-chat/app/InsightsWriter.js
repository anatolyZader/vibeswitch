/**
 * InsightsWriter: Safe, restricted file writer for dashboard chat insights.
 * ONLY allows writing markdown files to the insights/ subdirectory.
 * This is the ONLY write capability the dashboard chat has.
 */

const path = require('path');
const fs = require('fs');

// Absolute path to insights directory (resolved at runtime)
function getInsightsDir(extensionPath) {
    if (!extensionPath) {
        throw new Error('Extension path required for insights directory');
    }
    return path.join(extensionPath, 'business_modules', 'dashboard-chat', 'insights');
}

/**
 * Validate that a filename is safe and only contains allowed characters
 * @param {string} filename
 * @returns {boolean}
 */
function isValidFilename(filename) {
    // Only allow alphanumeric, dash, underscore, and .md extension
    const validPattern = /^[a-zA-Z0-9_-]+\.md$/;
    return validPattern.test(filename);
}

/**
 * Validate that content is reasonable (not too large, not malicious)
 * @param {string} content
 * @returns {{ valid: boolean, error?: string }}
 */
function validateContent(content) {
    if (!content || typeof content !== 'string') {
        return { valid: false, error: 'Content must be a non-empty string' };
    }
    
    const MAX_SIZE = 500000; // 500KB max
    if (content.length > MAX_SIZE) {
        return { valid: false, error: `Content too large (max ${MAX_SIZE} chars)` };
    }
    
    // Check for potentially malicious content
    if (content.includes('<script>') || content.includes('javascript:')) {
        return { valid: false, error: 'Content contains potentially unsafe patterns' };
    }
    
    return { valid: true };
}

/**
 * Generate a timestamped filename for an insight
 * @param {string} [prefix] - Optional prefix (default: 'insight')
 * @returns {string} - e.g., 'insight_2026-02-11_14-30-45.md'
 */
function generateFilename(prefix = 'insight') {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${prefix}_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.md`;
}

/**
 * Create an insight markdown file in the insights directory
 * @param {string} extensionPath - VS Code extension path
 * @param {Object} options
 * @param {string} [options.filename] - Optional filename (auto-generated if not provided)
 * @param {string} options.content - Markdown content to write
 * @param {string} [options.title] - Optional title for the insight
 * @param {Object} [options.metadata] - Optional metadata to include as frontmatter
 * @returns {Promise<{ success: boolean, path?: string, error?: string }>}
 */
async function createInsight(extensionPath, options) {
    try {
        const { content, title, metadata, filename: customFilename } = options;
        
        // Validate content
        const contentValidation = validateContent(content);
        if (!contentValidation.valid) {
            return { success: false, error: contentValidation.error };
        }
        
        // Get insights directory
        const insightsDir = getInsightsDir(extensionPath);
        
        // Ensure insights directory exists
        if (!fs.existsSync(insightsDir)) {
            fs.mkdirSync(insightsDir, { recursive: true });
        }
        
        // Generate or validate filename
        let filename;
        if (customFilename) {
            if (!isValidFilename(customFilename)) {
                return { success: false, error: 'Invalid filename. Use only alphanumeric, dash, underscore, and .md extension' };
            }
            filename = customFilename;
        } else {
            filename = generateFilename();
        }
        
        // Construct full path
        const fullPath = path.join(insightsDir, filename);
        
        // Check if file already exists
        if (fs.existsSync(fullPath)) {
            return { success: false, error: `File already exists: ${filename}` };
        }
        
        // Build markdown content with frontmatter if metadata provided
        let finalContent = '';
        
        if (metadata || title) {
            finalContent += '---\n';
            if (title) {
                finalContent += `title: ${title}\n`;
            }
            finalContent += `created: ${new Date().toISOString()}\n`;
            if (metadata) {
                Object.entries(metadata).forEach(([key, value]) => {
                    finalContent += `${key}: ${value}\n`;
                });
            }
            finalContent += '---\n\n';
        }
        
        if (title && !metadata) {
            finalContent += `# ${title}\n\n`;
        }
        
        finalContent += content;
        
        // Write file atomically (write to temp, then rename)
        const tempPath = fullPath + '.tmp';
        fs.writeFileSync(tempPath, finalContent, 'utf8');
        fs.renameSync(tempPath, fullPath);
        
        return {
            success: true,
            path: fullPath,
            filename: filename,
            relativePath: `business_modules/dashboard-chat/insights/${filename}`
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message || 'Failed to create insight'
        };
    }
}

/**
 * List all insights in the insights directory
 * @param {string} extensionPath
 * @returns {Promise<{ files: Array<{name: string, path: string, created: Date, size: number}>, error?: string }>}
 */
async function listInsights(extensionPath) {
    try {
        const insightsDir = getInsightsDir(extensionPath);
        
        if (!fs.existsSync(insightsDir)) {
            return { files: [] };
        }
        
        const files = fs.readdirSync(insightsDir)
            .filter(f => f.endsWith('.md') && f !== '.gitkeep')
            .map(f => {
                const fullPath = path.join(insightsDir, f);
                const stats = fs.statSync(fullPath);
                return {
                    name: f,
                    path: fullPath,
                    created: stats.birthtime,
                    size: stats.size
                };
            })
            .sort((a, b) => b.created - a.created); // Newest first
        
        return { files };
        
    } catch (error) {
        return {
            files: [],
            error: error.message || 'Failed to list insights'
        };
    }
}

module.exports = {
    createInsight,
    listInsights,
    generateFilename,
    getInsightsDir
};
