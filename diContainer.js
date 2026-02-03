/**
 * DIContainer - Dependency Injection container for VibeSwitch extension
 * Stores and resolves adapters and services using dependency injection pattern
 * 
 * Enhanced with adapter resolution for Ports and Adapters pattern
 */

class DIContainer {
    constructor() {
        // Adapter infrastructure
        this.adapters = {}; // Cache for adapter instances
        
        // Service registry for dependency injection
        this.services = {}; // Service instances registered by name
    }
    
    /**
     * Get an adapter instance for a module (returns cached instance if available)
     * @param {string} moduleName - Name of the business module (e.g., 'awareness', 'user-stats')
     * @param {string} adapterType - Type of adapter (e.g., 'vscodeAdapter', 'persistenceAdapter')
     * @returns {Object|null} Cached adapter instance or null if not set
     */
    getAdapter(moduleName, adapterType) {
        const key = `${moduleName}_${adapterType}`;
        return this.adapters[key] || null;
    }
    
    /**
     * Set adapter dependencies (called after adapters are created with proper dependencies)
     * This allows adapters to be created with their required dependencies (vscode, context, etc.)
     * @param {string} moduleName - Name of the business module
     * @param {string} adapterType - Type of adapter
     * @param {Object} adapterInstance - Adapter instance with dependencies already injected
     */
    setAdapter(moduleName, adapterType, adapterInstance) {
        const key = `${moduleName}_${adapterType}`;
        this.adapters[key] = adapterInstance;
    }
    
    /**
     * Register a service instance in the DI container
     * @param {string} name - Service name (e.g., 'awarenessService', 'modeService')
     * @param {Object} instance - Service instance
     */
    register(name, instance) {
        if (!name || typeof name !== 'string') {
            throw new Error('Service name must be a non-empty string');
        }
        if (!instance) {
            throw new Error(`Service instance for '${name}' cannot be null or undefined`);
        }
        this.services[name] = instance;
    }
    
    /**
     * Resolve a service from the DI container (async for future factory support)
     * @param {string} name - Service name
     * @returns {Promise<Object>} Service instance
     * @throws {Error} If service not found
     */
    async resolve(name) {
        if (this.services[name]) {
            return Promise.resolve(this.services[name]);
        }
        throw new Error(`Service '${name}' not found in DI container`);
    }
    
    /**
     * Resolve a service from the DI container (synchronous)
     * @param {string} name - Service name
     * @returns {Object} Service instance
     * @throws {Error} If service not found
     */
    resolveSync(name) {
        if (this.services[name]) {
            return this.services[name];
        }
        throw new Error(`Service '${name}' not found in DI container`);
    }
}

module.exports = DIContainer;

