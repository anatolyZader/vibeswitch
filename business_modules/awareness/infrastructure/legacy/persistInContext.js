/**
 * Persist In Context
 * Persistence handler for VS Code extension context storage (workspaceState/globalState)
 * 
 * Provides a unified interface for persisting data using VS Code's storage APIs:
 * - workspaceState: Workspace-specific storage (per workspace)
 * - globalState: Global storage (across all workspaces)
 * 
 * Supports:
 * - Loading and saving data with error handling
 * - Automatic conversion between Map and Object formats
 * - Default values for missing data
 * - Data cleanup/transformation hooks
 */

const { getLogger } = require('../logger');

class PersistInContext {
    /**
     * @param {vscode.ExtensionContext} context - VS Code extension context
     * @param {string} storageType - 'workspace' or 'global' (default: 'workspace')
     */
    constructor(context, storageType = 'workspace') {
        if (!context) {
            throw new Error('PersistInContext requires a VS Code extension context');
        }
        
        this.context = context;
        this.storageType = storageType;
        
        // Get the appropriate storage API
        if (storageType === 'global') {
            this.storage = context.globalState;
        } else {
            this.storage = context.workspaceState;
        }
    }

    /**
     * Load data from storage
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @param {Function} transformFn - Optional function to transform loaded data
     * @returns {*} Loaded data or default value
     */
    load(key, defaultValue = null, transformFn = null) {
        if (!this.context || !this.storage) {
            getLogger().log(`PersistInContext: Cannot load ${key} - no storage available`);
            return defaultValue;
        }

        try {
            const stored = this.storage.get(key, defaultValue);
            
            // Apply transformation if provided
            if (transformFn && stored !== defaultValue) {
                return transformFn(stored);
            }
            
            return stored;
        } catch (error) {
            console.error(`PersistInContext: Error loading ${key}`, error);
            getLogger().log(`PersistInContext: Error loading ${key}: ${error.message}`);
            return defaultValue;
        }
    }

    /**
     * Load data as a Map (converts object to Map)
     * @param {string} key - Storage key
     * @param {Map} defaultMap - Default Map if key doesn't exist
     * @param {Function} transformFn - Optional function to transform each entry
     * @returns {Map} Loaded data as Map
     */
    loadAsMap(key, defaultMap = new Map(), transformFn = null) {
        const stored = this.load(key, {}, transformFn);
        
        if (stored instanceof Map) {
            return stored;
        }
        
        // Convert object to Map
        const map = new Map(Object.entries(stored));
        
        // Apply transformation to each entry if provided
        if (transformFn) {
            const transformedMap = new Map();
            for (const [k, v] of map.entries()) {
                const transformed = transformFn(k, v);
                if (transformed) {
                    transformedMap.set(transformed.key || k, transformed.value || v);
                } else {
                    transformedMap.set(k, v);
                }
            }
            return transformedMap;
        }
        
        return map;
    }

    /**
     * Save data to storage
     * @param {string} key - Storage key
     * @param {*} data - Data to save
     * @param {Function} transformFn - Optional function to transform data before saving
     * @returns {Promise<boolean>} True if save was successful
     */
    async save(key, data, transformFn = null) {
        if (!this.context || !this.storage) {
            getLogger().log(`PersistInContext: Cannot save ${key} - no storage available`);
            return false;
        }

        try {
            let dataToSave = data;
            
            // Apply transformation if provided
            if (transformFn) {
                dataToSave = transformFn(data);
            }
            
            // Convert Map to object if needed
            if (dataToSave instanceof Map) {
                dataToSave = Object.fromEntries(dataToSave);
            }
            
            await this.storage.update(key, dataToSave);
            return true;
        } catch (error) {
            console.error(`PersistInContext: Error saving ${key}`, error);
            getLogger().log(`PersistInContext: Error saving ${key}: ${error.message}`);
            return false;
        }
    }

    /**
     * Save data synchronously (for compatibility with existing code)
     * Note: VS Code's storage.update() is async, but this provides a sync interface
     * @param {string} key - Storage key
     * @param {*} data - Data to save
     * @param {Function} transformFn - Optional function to transform data before saving
     * @returns {boolean} True if save was initiated successfully
     */
    saveSync(key, data, transformFn = null) {
        // Fire and forget - actual save is async
        this.save(key, data, transformFn).catch(error => {
            console.error(`PersistInContext: Async save failed for ${key}`, error);
        });
        return true;
    }

    /**
     * Delete data from storage
     * @param {string} key - Storage key to delete
     * @returns {Promise<boolean>} True if deletion was successful
     */
    async delete(key) {
        if (!this.context || !this.storage) {
            return false;
        }

        try {
            await this.storage.update(key, undefined);
            return true;
        } catch (error) {
            console.error(`PersistInContext: Error deleting ${key}`, error);
            return false;
        }
    }

    /**
     * Check if a key exists in storage
     * @param {string} key - Storage key to check
     * @returns {boolean} True if key exists
     */
    has(key) {
        if (!this.storage) {
            return false;
        }
        
        try {
            const value = this.storage.get(key);
            return value !== undefined;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get all keys in storage (if supported by storage type)
     * @returns {string[]} Array of keys
     */
    getAllKeys() {
        // VS Code storage API doesn't provide a direct way to get all keys
        // This would need to be maintained separately if needed
        return [];
    }

    /**
     * Clear all data for this storage type
     * WARNING: This will clear ALL workspace/global state, use with caution
     * @returns {Promise<boolean>} True if clear was successful
     */
    async clearAll() {
        if (!this.storage) {
            return false;
        }

        try {
            // VS Code doesn't provide a direct clearAll, so we'd need to track keys
            // For now, this is a placeholder
            getLogger().log('PersistInContext: clearAll() not fully implemented - requires key tracking');
            return false;
        } catch (error) {
            console.error('PersistInContext: Error clearing storage', error);
            return false;
        }
    }
}

module.exports = PersistInContext;

