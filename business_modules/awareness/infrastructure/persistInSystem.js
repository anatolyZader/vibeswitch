/**
 * Persist In System
 * Persistence handler for file system storage
 * 
 * Provides a unified interface for persisting data to the file system:
 * - Uses VS Code's globalStorageUri or workspaceStorageUri for file paths
 * - Handles JSON file read/write operations
 * - Automatic directory creation
 * - Error handling and recovery
 * 
 * Supports:
 * - Loading and saving data with error handling
 * - Automatic JSON serialization/deserialization
 * - Default values for missing data
 * - Data transformation hooks
 */

const fs = require('fs');
const path = require('path');
const { getLogger } = require('../logger');

class PersistInSystem {
    /**
     * @param {vscode.ExtensionContext} context - VS Code extension context
     * @param {string} storageType - 'global' or 'workspace' (default: 'global')
     * @param {string} fileName - Name of the file to persist (default: 'data.json')
     */
    constructor(context, storageType = 'global', fileName = 'data.json') {
        if (!context) {
            throw new Error('PersistInSystem requires a VS Code extension context');
        }
        
        this.context = context;
        this.storageType = storageType;
        
        // Get the appropriate storage URI
        if (storageType === 'workspace') {
            this.storageUri = context.workspaceStorageUri || context.globalStorageUri;
        } else {
            this.storageUri = context.globalStorageUri;
        }
        
        // Build file path
        this.filePath = path.join(this.storageUri.fsPath, fileName);
        
        // Ensure directory exists
        this.ensureStorageExists();
    }

    /**
     * Ensure storage directory exists
     */
    ensureStorageExists() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            try {
                fs.mkdirSync(dir, { recursive: true });
            } catch (error) {
                console.error('PersistInSystem: Error creating storage directory', error);
                getLogger().log(`PersistInSystem: Error creating storage directory: ${error.message}`);
            }
        }
    }

    /**
     * Load data from file system
     * @param {*} defaultValue - Default value if file doesn't exist
     * @param {Function} transformFn - Optional function to transform loaded data
     * @returns {*} Loaded data or default value
     */
    load(defaultValue = null, transformFn = null) {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = fs.readFileSync(this.filePath, 'utf8');
                const parsed = JSON.parse(data);
                
                // Apply transformation if provided
                if (transformFn) {
                    return transformFn(parsed);
                }
                
                return parsed;
            } else {
                // File doesn't exist, return default
                return defaultValue;
            }
        } catch (error) {
            console.error(`PersistInSystem: Error loading ${this.filePath}`, error);
            getLogger().log(`PersistInSystem: Error loading ${this.filePath}: ${error.message}`);
            return defaultValue;
        }
    }

    /**
     * Save data to file system
     * @param {*} data - Data to save
     * @param {Function} transformFn - Optional function to transform data before saving
     * @param {Object} options - Save options
     * @param {boolean} options.pretty - Pretty print JSON (default: true)
     * @returns {boolean} True if save was successful
     */
    save(data, transformFn = null, options = {}) {
        try {
            // Ensure directory exists before saving
            this.ensureStorageExists();
            
            let dataToSave = data;
            
            // Apply transformation if provided
            if (transformFn) {
                dataToSave = transformFn(data);
            }
            
            // Convert to JSON string
            const pretty = options.pretty !== false; // Default to true
            const jsonString = pretty 
                ? JSON.stringify(dataToSave, null, 2)
                : JSON.stringify(dataToSave);
            
            // Write to file
            fs.writeFileSync(this.filePath, jsonString, 'utf8');
            return true;
        } catch (error) {
            console.error(`PersistInSystem: Error saving ${this.filePath}`, error);
            getLogger().log(`PersistInSystem: Error saving ${this.filePath}: ${error.message}`);
            return false;
        }
    }

    /**
     * Check if file exists
     * @returns {boolean} True if file exists
     */
    exists() {
        return fs.existsSync(this.filePath);
    }

    /**
     * Delete the file
     * @returns {boolean} True if deletion was successful
     */
    delete() {
        try {
            if (fs.existsSync(this.filePath)) {
                fs.unlinkSync(this.filePath);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`PersistInSystem: Error deleting ${this.filePath}`, error);
            getLogger().log(`PersistInSystem: Error deleting ${this.filePath}: ${error.message}`);
            return false;
        }
    }

    /**
     * Get the file path
     * @returns {string} Full path to the storage file
     */
    getFilePath() {
        return this.filePath;
    }

    /**
     * Get file size in bytes
     * @returns {number} File size in bytes, or 0 if file doesn't exist
     */
    getFileSize() {
        try {
            if (fs.existsSync(this.filePath)) {
                const stats = fs.statSync(this.filePath);
                return stats.size;
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get file modification time
     * @returns {Date|null} File modification date, or null if file doesn't exist
     */
    getModificationTime() {
        try {
            if (fs.existsSync(this.filePath)) {
                const stats = fs.statSync(this.filePath);
                return stats.mtime;
            }
            return null;
        } catch (error) {
            return null;
        }
    }
}

module.exports = PersistInSystem;

