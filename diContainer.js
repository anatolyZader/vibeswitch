/**
 * DIContainer - Dependency Injection container for VibeSwitch extension
 * Centralizes all extension dependencies and state in a single, manageable container
 * 
 * Enhanced with adapter resolution for Ports and Adapters pattern
 */

class DIContainer {
    constructor() {
        // UI Components
        this.statusBarItem = null;
        this.awarenessBarItem = null;
        this.outputChannel = null;
        
        // Core State
        this.currentMode = null;
        this.extensionContext = null;
        
        // Managers & Monitors
        this.usageStats = null;
        this.awarenessMonitor = null;
        this.fileDecorationProvider = null;
        
        // Timers
        this.meterUpdateTimer = null;
        
        // Adapter infrastructure
        this.adapterConfig = null;
        this.adapters = {}; // Cache for adapter instances
        this._loadAdapterConfig();
        
        // Service registry for dependency injection
        this.services = {}; // Service instances registered by name
    }
    
    /**
     * Load adapter configuration from config file
     * @private
     */
    _loadAdapterConfig() {
        try {
            this.adapterConfig = require('./infrastructure/config/adapterConfig.json');
        } catch (error) {
            // Config file might not exist yet, use empty config
            this.adapterConfig = { business_modules: {} };
        }
    }
    
    /**
     * Get an adapter instance for a module (returns cached instance if available)
     * @param {string} moduleName - Name of the business module (e.g., 'awareness', 'usage-stats')
     * @param {string} adapterType - Type of adapter (e.g., 'vscodeAdapter', 'persistenceAdapter')
     * @returns {Object|null} Cached adapter instance or null if not set
     */
    getAdapter(moduleName, adapterType) {
        const key = `${moduleName}_${adapterType}`;
        return this.adapters[key] || null;
    }
    
    /**
     * Get adapter configuration metadata from config file
     * @param {string} moduleName - Name of the business module
     * @param {string} adapterType - Type of adapter
     * @returns {Object|null} Adapter configuration metadata or null if not found
     */
    getAdapterConfig(moduleName, adapterType) {
        const moduleConfig = this.adapterConfig.business_modules[moduleName];
        if (!moduleConfig) return null;
        
        // Support both old format (direct string) and new format (object with adapterClass)
        if (moduleConfig.adapters && moduleConfig.adapters[adapterType]) {
            // New format: business_modules[module].adapters[adapterType]
            return moduleConfig.adapters[adapterType];
        } else if (moduleConfig[adapterType]) {
            // Old format: business_modules[module][adapterType] = "adapterName"
            return {
                adapterClass: moduleConfig[adapterType],
                adapterName: moduleConfig[adapterType]
            };
        }
        return null;
    }
    
    /**
     * Get adapter class name from config (supports both old and new format)
     * @param {string} moduleName - Name of the business module
     * @param {string} adapterType - Type of adapter
     * @returns {string} Adapter class name
     * @throws {Error} If adapter not found in config
     */
    getAdapterClassName(moduleName, adapterType) {
        const config = this.getAdapterConfig(moduleName, adapterType);
        if (!config) {
            throw new Error(`No ${adapterType} configured for module: ${moduleName}`);
        }
        return config.adapterClass || config.adapterName || config;
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
     * Update current mode
     */
    setMode(mode) {
        this.currentMode = mode;
    }
    
    /**
     * Get current mode
     */
    getMode() {
        return this.currentMode;
    }
    
    /**
     * Check if extension is fully initialized
     */
    isInitialized() {
        return this.outputChannel !== null && this.extensionContext !== null;
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

