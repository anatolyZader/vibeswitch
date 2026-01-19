/**
 * Composition Root - Centralized dependency composition
 * Creates and wires all adapters, services, and domain services
 */

const vscode = require('vscode');
const AwarenessEngine = require('./business_modules/awareness/app/awarenessEngine');

/**
 * Build all adapters for awareness module
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @returns {Object} Object containing all adapter instances
 */
function buildAdapters(context) {
    const AwarenessVSCodeAdapter = require('./business_modules/awareness/infrastructure/adapters/awarenessVSCodeAdapter');
    const AwarenessWorkspaceStateAdapter = require('./business_modules/awareness/infrastructure/adapters/awarenessWorkspaceStateAdapter');
    const AwarenessLoggerAdapter = require('./business_modules/awareness/infrastructure/adapters/awarenessLoggerAdapter');
    const AwarenessIdGeneratorAdapter = require('./business_modules/awareness/infrastructure/adapters/awarenessIdGeneratorAdapter');
    const AwarenessHashGeneratorAdapter = require('./business_modules/awareness/infrastructure/adapters/awarenessHashGeneratorAdapter');
    
    return {
        vscodeAdapter: new AwarenessVSCodeAdapter(vscode),
        persistenceAdapter: new AwarenessWorkspaceStateAdapter(context),
        loggerAdapter: new AwarenessLoggerAdapter(),
        idGeneratorAdapter: new AwarenessIdGeneratorAdapter(),
        hashGeneratorAdapter: new AwarenessHashGeneratorAdapter()
    };
}

/**
 * Build all domain services
 * @returns {Object} Object containing all domain service instances
 */
function buildDomainServices() {
    const RangeOperationServiceD = require('./business_modules/awareness/domain/services/rangeOperationServiceD');
    const UriPathOperationServiceD = require('./business_modules/awareness/domain/services/uriPathOperationServiceD');
    
    return {
        rangeOperationServiceD: new RangeOperationServiceD(),
        uriPathOperationServiceD: new UriPathOperationServiceD()
    };
}

/**
 * Build AwarenessEngine with provided dependencies
 * @param {Object} adapters - Adapter instances
 * @param {Object} domainServices - Domain service instances
 * @returns {AwarenessEngine} Configured AwarenessEngine instance
 */
function buildAwarenessEngine(adapters, domainServices) {
    return new AwarenessEngine({
        vscodeAdapter: adapters.vscodeAdapter,
        persistenceAdapter: adapters.persistenceAdapter,
        loggerAdapter: adapters.loggerAdapter,
        idGeneratorAdapter: adapters.idGeneratorAdapter,
        hashGeneratorAdapter: adapters.hashGeneratorAdapter,
        rangeOperationServiceD: domainServices.rangeOperationServiceD,
        uriPathOperationServiceD: domainServices.uriPathOperationServiceD
    });
}

/**
 * Build usage stats service
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @returns {Object} UsageStatsService instance
 */
function buildUsageStatsService(context) {
    const UsageStatsService = require('./business_modules/usage-stats/app/usageStatsService');
    return new UsageStatsService(context);
}

/**
 * Compose all extension dependencies
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @param {ExtensionState} state - Extension runtime state
 * @param {DIContainer} container - DI container for adapters and services
 * @returns {Object} Object containing all composed services and adapters
 */
function compose(context, state, container) {
    // Build adapters once (single source of truth)
    const adapters = buildAdapters(context);
    const domainServices = buildDomainServices();
    
    // Build services using the same adapter instances
    const awarenessEngine = buildAwarenessEngine(adapters, domainServices);
    const usageStatsService = buildUsageStatsService(context);

    // Optional LLM module (separate bounded context)
    try {
        const { composeLLM } = require('./business_modules/llm/compose');
        const llm = composeLLM({ context, loggerPort: adapters.loggerAdapter });
        awarenessEngine.setLLMServices({
            insightService: llm.insightService,
            insightStore: llm.insightStore
        });
    } catch (err) {
        // LLM module is optional; never fail extension startup.
        adapters.loggerAdapter?.error?.('compositionRoot: Failed to compose LLM module', err);
    }
    
    // Store adapters in DI container
    container.setAdapter('awareness', 'vscodeAdapter', adapters.vscodeAdapter);
    container.setAdapter('awareness', 'persistenceAdapter', adapters.persistenceAdapter);
    container.setAdapter('awareness', 'loggerAdapter', adapters.loggerAdapter);
    container.setAdapter('awareness', 'idGeneratorAdapter', adapters.idGeneratorAdapter);
    container.setAdapter('awareness', 'hashGeneratorAdapter', adapters.hashGeneratorAdapter);
    
    // Register services in DI container
    container.register('awarenessEngine', awarenessEngine);
    
    // Store service references in extension state
    state.usageStats = usageStatsService;
    
    return {
        awarenessEngine,
        usageStatsService,
        adapters
    };
}

module.exports = {
    compose,
    buildAwarenessEngine,
    buildUsageStatsService,
    buildAdapters,
    buildDomainServices
};
