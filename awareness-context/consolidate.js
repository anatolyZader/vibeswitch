/**
 * Script to consolidate all awareness module files by layer
 * Creates single files for each layer: domain, input, app, infrastructure
 */

const fs = require('fs');
const path = require('path');

const AWARENESS_ROOT = path.join(__dirname, '../business_modules/awareness');
const OUTPUT_DIR = __dirname;

// Exclude patterns
const EXCLUDE_PATTERNS = [
    /test/i,
    /\.test\./i,
    /mock/i,
    /legacy/i
];

function shouldInclude(filePath) {
    return !EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            getAllFiles(filePath, fileList);
        } else if (file.endsWith('.js') && shouldInclude(filePath)) {
            fileList.push(filePath);
        }
    });
    
    return fileList;
}

function consolidateLayer(layerName) {
    const layerDir = path.join(AWARENESS_ROOT, layerName);
    if (!fs.existsSync(layerDir)) {
        console.log(`Layer ${layerName} does not exist, skipping...`);
        return;
    }
    
    const files = getAllFiles(layerDir);
    const MAX_LINES_PER_FILE = 2000;
    
    // Process files and build content chunks
    const fileChunks = [];
    let currentChunk = [];
    let currentChunkLines = 0;
    
    files.forEach((filePath, index) => {
        const relativePath = path.relative(AWARENESS_ROOT, filePath);
        let fileContent = fs.readFileSync(filePath, 'utf8');
        
        // Comment out require statements to prevent conflicts
        // Handle destructured requires: const { a, b } = require(...)
        fileContent = fileContent.replace(/^(\s*)(const\s+\{[^}]*\}\s*=\s*require\(['"][^'"]*['"]\);?)/gm, '$1// $2 // Commented for consolidation');
        // Handle simple requires: const X = require(...)
        fileContent = fileContent.replace(/^(\s*)(const\s+\w+\s*=\s*require\(['"][^'"]*['"]\);?)/gm, '$1// $2 // Commented for consolidation');
        
        // Comment out module.exports - handle multi-line object exports
        const lines = fileContent.split('\n');
        let inModuleExports = false;
        let braceCount = 0;
        const processedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check if this line starts module.exports
            if (line.match(/^\s*module\.exports\s*=\s*\{/)) {
                inModuleExports = true;
                braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
                processedLines.push('// ' + line + ' // Commented for consolidation');
                continue;
            }
            
            // If we're in a module.exports block, count braces
            if (inModuleExports) {
                braceCount += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
                processedLines.push('// ' + line + ' // Commented for consolidation');
                
                // If braces are balanced, we've reached the end
                if (braceCount === 0) {
                    inModuleExports = false;
                }
                continue;
            }
            
            // Handle single-line module.exports
            if (line.match(/^\s*module\.exports\s*=\s*[^;]+;/)) {
                processedLines.push('// ' + line + ' // Commented for consolidation');
                continue;
            }
            
            // Regular line
            processedLines.push(line);
        }
        
        fileContent = processedLines.join('\n');
        
        // Calculate lines for this file (header + content + footer)
        const fileHeader = `\n// ============================================================================\n// FILE ${index + 1}/${files.length}: ${relativePath}\n// ============================================================================\n\n(function() { // IIFE scope for ${relativePath}\n`;
        const fileFooter = `\n})(); // End IIFE for ${relativePath}\n\n`;
        const fileLines = fileHeader.split('\n').length + fileContent.split('\n').length + fileFooter.split('\n').length;
        
        // Check if adding this file would exceed the limit
        if (currentChunkLines > 0 && currentChunkLines + fileLines > MAX_LINES_PER_FILE) {
            // Save current chunk and start new one
            fileChunks.push(currentChunk);
            currentChunk = [];
            currentChunkLines = 0;
        }
        
        // Add file to current chunk
        currentChunk.push({
            index: index + 1,
            totalFiles: files.length,
            relativePath: relativePath,
            content: fileContent
        });
        currentChunkLines += fileLines;
    });
    
    // Add remaining chunk
    if (currentChunk.length > 0) {
        fileChunks.push(currentChunk);
    }
    
    // Write chunks to files
    if (fileChunks.length === 1) {
        // Single file - no need for part suffix
        const outputFile = path.join(OUTPUT_DIR, `${layerName}-consolidated.js`);
        let content = `/**
 * ${layerName.toUpperCase()} LAYER - CONSOLIDATED
 * 
 * This file contains all code from the ${layerName} layer of the awareness module.
 * Generated automatically for ChatGPT context.
 * 
 * Files included: ${files.length}
 * Generated: ${new Date().toISOString()}
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================

`;
        
        currentChunk.forEach(file => {
            content += `\n// ============================================================================\n`;
            content += `// FILE ${file.index}/${file.totalFiles}: ${file.relativePath}\n`;
            content += `// ============================================================================\n\n`;
            content += `(function() { // IIFE scope for ${file.relativePath}\n`;
            content += file.content;
            content += `\n})(); // End IIFE for ${file.relativePath}\n\n`;
        });
        
        fs.writeFileSync(outputFile, content, 'utf8');
        const lineCount = content.split('\n').length;
        console.log(`✓ Created ${outputFile} (${files.length} files, ${lineCount} lines, ${(content.length / 1024).toFixed(2)} KB)`);
    } else {
        // Multiple files - create parts
        fileChunks.forEach((chunk, partIndex) => {
            const partNum = partIndex + 1;
            const outputFile = path.join(OUTPUT_DIR, `${layerName}-consolidated-part${partNum}.js`);
            
            let content = `/**
 * ${layerName.toUpperCase()} LAYER - CONSOLIDATED (PART ${partNum}/${fileChunks.length})
 * 
 * This file contains part ${partNum} of ${fileChunks.length} of the ${layerName} layer code.
 * Generated automatically for ChatGPT context.
 * 
 * Files in this part: ${chunk.length}/${files.length}
 * Generated: ${new Date().toISOString()}
 */

// ============================================================================
// FILE SEPARATORS
// ============================================================================

`;
            
            chunk.forEach(file => {
                content += `\n// ============================================================================\n`;
                content += `// FILE ${file.index}/${file.totalFiles}: ${file.relativePath}\n`;
                content += `// ============================================================================\n\n`;
                content += `(function() { // IIFE scope for ${file.relativePath}\n`;
                content += file.content;
                content += `\n})(); // End IIFE for ${file.relativePath}\n\n`;
            });
            
            fs.writeFileSync(outputFile, content, 'utf8');
            const lineCount = content.split('\n').length;
            console.log(`✓ Created ${outputFile} (${chunk.length} files, ${lineCount} lines, ${(content.length / 1024).toFixed(2)} KB)`);
        });
    }
}

// Consolidate each layer
console.log('Consolidating awareness module files...\n');

['domain', 'input', 'app', 'infrastructure'].forEach(layer => {
    consolidateLayer(layer);
});

console.log('\n✓ Consolidation complete!');
