/**
 * DICompositionRoot - Composition root for VibeSwitch extension
 * 
 * This is the composition root that handles dependency injection configuration
 * for all extension modules. It centralizes the creation and wiring of:
 * - All adapters (infrastructure layer)
 * - All domain services (domain layer)
 * - All application services
 * 
 * The composition root stores adapters in the DI container and returns
 * configured services ready for injection.
 * 
 * Note: This is related to DI (Dependency Injection) as it's the composition root,
 * but it's distinct from the DI container itself:
 * - DI Container: Storage mechanism for dependencies
 * - Composition Root: Wiring/configuration logic that creates and wires dependencies
 */

const vscode = require('vscode');

/**
 * Create and configure all Awareness module adapters and services
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @param {DIContainer} diContainer - Dependency injection container
 * @returns {Object} Configured adapters and services for awareness module
 */
function createAwarenessComposition(context, diContainer) {
    // ============================================
    // Import Adapter Classes
    // ============================================
    const AwarenessVSCodeAdapter = require('../business_modules/awareness/infrastructure/adapters/awarenessVSCodeAdapter');
    const AwarenessWorkspaceStateAdapter = require('../business_modules/awareness/infrastructure/adapters/awarenessWorkspaceStateAdapter');
    const AwarenessEventEmitterMessagingAdapter = require('../business_modules/awareness/infrastructure/adapters/awarenessEventEmitterMessagingAdapter');
    const AwarenessLoggerAdapter = require('../business_modules/awareness/infrastructure/adapters/awarenessLoggerAdapter');
    const AwarenessFileSystemAdapter = require('../business_modules/awareness/infrastructure/adapters/awarenessFileSystemAdapter');
    const AwarenessIdGeneratorAdapter = require('../business_modules/awareness/infrastructure/adapters/awarenessIdGeneratorAdapter');
    const AwarenessHashGeneratorAdapter = require('../business_modules/awareness/infrastructure/adapters/awarenessHashGeneratorAdapter');

    // ============================================
    // Import Domain Service Classes (Core Domain Logic Only)
    // ============================================
    // Note: Score and debt calculations moved to app layer as pure functions
    // Only keep domain services that protect invariants or contain domain logic
    const RangeOperationServiceD = require('../business_modules/awareness/domain/services/rangeOperationServiceD');
    const UriPathOperationServiceD = require('../business_modules/awareness/domain/services/uriPathOperationServiceD');
    const ChangeClassificationServiceD = require('../business_modules/awareness/domain/services/changeClassificationServiceD');

    // ============================================
    // Create Adapters (Infrastructure Layer)
    // ============================================
    const adapters = {
        vscodeAdapter: new AwarenessVSCodeAdapter(vscode),
        persistenceAdapter: new AwarenessWorkspaceStateAdapter(context),
        messagingAdapter: new AwarenessEventEmitterMessagingAdapter(null, adapters.idGeneratorAdapter),
        loggerAdapter: new AwarenessLoggerAdapter(),
        fileSystemAdapter: new AwarenessFileSystemAdapter(),
        idGeneratorAdapter: new AwarenessIdGeneratorAdapter(),
        hashGeneratorAdapter: new AwarenessHashGeneratorAdapter()
    };

    // ============================================
    // Store Adapters in DI Container
    // ============================================
    // Single source of truth - all adapters stored here
    diContainer.setAdapter('awareness', 'vscodeAdapter', adapters.vscodeAdapter);
    diContainer.setAdapter('awareness', 'persistenceAdapter', adapters.persistenceAdapter);
    diContainer.setAdapter('awareness', 'messagingAdapter', adapters.messagingAdapter);
    diContainer.setAdapter('awareness', 'loggerAdapter', adapters.loggerAdapter);
    diContainer.setAdapter('awareness', 'fileSystemAdapter', adapters.fileSystemAdapter);
    diContainer.setAdapter('awareness', 'idGeneratorAdapter', adapters.idGeneratorAdapter);
    diContainer.setAdapter('awareness', 'hashGeneratorAdapter', adapters.hashGeneratorAdapter);

    // ============================================
    // Retrieve Adapters from DI Container
    // ============================================
    // This ensures we use the single source of truth
    const adaptersFromDI = {
        vscodeAdapter: diContainer.getAdapter('awareness', 'vscodeAdapter'),
        persistenceAdapter: diContainer.getAdapter('awareness', 'persistenceAdapter'),
        messagingAdapter: diContainer.getAdapter('awareness', 'messagingAdapter'),
        loggerAdapter: diContainer.getAdapter('awareness', 'loggerAdapter'),
        fileSystemAdapter: diContainer.getAdapter('awareness', 'fileSystemAdapter'),
        idGeneratorAdapter: diContainer.getAdapter('awareness', 'idGeneratorAdapter'),
        hashGeneratorAdapter: diContainer.getAdapter('awareness', 'hashGeneratorAdapter')
    };

    // ============================================
    // Create Domain Services (Domain Layer - Core Business Logic Only)
    // ============================================
    // Domain services are stateless - no constructor dependencies
    // Ports are passed as method parameters
    // Note: Score and debt calculations moved to app layer as pure functions
    // Only keep domain services that protect invariants or contain domain logic
    const domainServices = {
        rangeOperationServiceD: new RangeOperationServiceD(), // Domain logic: rangesOverlap, isPositionInRange
        uriPathOperationServiceD: new UriPathOperationServiceD(), // Domain validation: isCodeDocument, isSkippableUri
        changeClassificationServiceD: new ChangeClassificationServiceD() // Change classification heuristics
    };

    // ============================================
    // Return Composition Result
    // ============================================
    return {
        adapters: adaptersFromDI,  // Adapters retrieved from DI container
        domainServices: domainServices  // Domain services ready for injection
    };
}

/**
 * Create and configure all Usage Stats module services
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @param {DIContainer} diContainer - Dependency injection container
 * @returns {Object} Configured services for usage-stats module
 */
function createUsageStatsComposition(context, diContainer) {
    const UsageStatsManager = require('../business_modules/usage-stats/app/usageStatsService');
    
    // Usage Stats currently doesn't have separate adapters/services
    // It's created directly, but we can add adapter support here in the future
    const usageStatsService = new UsageStatsManager(context);
    
    // Store in DI container if needed
    // diContainer.register('usageStatsService', usageStatsService);
    
    return {
        usageStatsService: usageStatsService
    };
}

/**
 * Create and configure all Mode module services
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @param {DIContainer} diContainer - Dependency injection container
 * @returns {Object} Configured services for mode module
 */
function createModeComposition(context, diContainer) {
    // Mode module currently uses a simple function (modeDetection)
    // No services/adapters needed yet, but structure is ready for future expansion
    
    return {
        // Future: modeService, modeAdapters, etc.
    };
}

/**
 * Create complete extension composition
 * Composes all modules: awareness, usage-stats, mode, etc.
 * 
 * @param {vscode.ExtensionContext} context - VS Code extension context
 * @param {DIContainer} diContainer - Dependency injection container
 * @returns {Object} Complete composition with all modules
 */
function createExtensionComposition(context, diContainer) {
    // Compose all modules
    const awareness = createAwarenessComposition(context, diContainer);
    const usageStats = createUsageStatsComposition(context, diContainer);
    const mode = createModeComposition(context, diContainer);
    
    return {
        awareness: awareness,
        usageStats: usageStats,
        mode: mode
    };
}

module.exports = {
    createExtensionComposition,
    createAwarenessComposition,
    createUsageStatsComposition,
    createModeComposition
};
