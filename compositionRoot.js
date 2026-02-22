/**
 * Composition Root - Centralized dependency composition
 * Creates and wires all adapters, services, and domain services
 */

const path = require('path');
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
    const UsageStatsService = require('./business_modules/user-stats/app/usageStatsService');
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

    // Antipattern event store + code analysis (dashboard, boundary detector)
    try {
        const fs = require('fs').promises;
        const path = require('path');
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        const workspaceRoot = workspaceFolders[0] ? workspaceFolders[0].uri.fsPath : '';
        if (workspaceRoot) {
            const AntiPatternEventStore = require('./business_modules/awareness/app/antipatterns/antiPatternEventStore');
            const { createCodeAnalysisService } = require('./cross-cut-modules/code-analysis/app/CodeAnalysisService');
            const eventStore = new AntiPatternEventStore(workspaceRoot, { loggerPort: adapters.loggerAdapter });
            const readFile = async (filePath) => {
                const abs = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
                const content = await fs.readFile(abs, 'utf8').catch(() => null);
                if (content == null) return null;
                const stat = await fs.stat(abs).catch(() => null);
                const mtime = stat && stat.mtime ? (typeof stat.mtime.getTime === 'function' ? stat.mtime.getTime() : stat.mtimeMs || 0) : 0;
                return { content, mtime, size: stat ? stat.size : 0 };
            };
            const codeAnalysisService = createCodeAnalysisService({ readFile, cacheMaxEntries: 200 });
            awarenessEngine.setAntipatternServices({ antiPatternEventStore: eventStore, codeAnalysisService });
        }
    } catch (err) {
        adapters.loggerAdapter?.error?.('compositionRoot: Failed to compose antipattern services', err);
    }

    // Token usage monitoring (Cursor usage API)
    try {
        const { createCursorUsageApiClient } = require('./business_modules/awareness/app/usage/cursorUsageApiClient');
        const getToken = async () => {
            try {
                const t = await context.secretStorage.get('vibeswitch.cursorUsageToken');
                return typeof t === 'string' ? t : null;
            } catch (_) {
                return null;
            }
        };
        const tokenUsageClient = createCursorUsageApiClient({ getToken, loggerPort: adapters.loggerAdapter });
        state.tokenUsageClient = tokenUsageClient;
    } catch (err) {
        adapters.loggerAdapter?.error?.('compositionRoot: Failed to compose token usage client', err);
    }

    // SonarCloud API client (research/dashboard measures)
    try {
        const vscodeApi = require('vscode');
        const { createSonarCloudClient } = require('./business_modules/awareness/app/usage/sonarCloudApiClient');
        const getSonarToken = async () => {
            try {
                const t = await context.secretStorage.get('vibeswitch.sonarToken');
                return typeof t === 'string' ? t : null;
            } catch (_) {
                return null;
            }
        };
        const getSonarProjectKey = async () => {
            const cfg = vscodeApi.workspace.getConfiguration('vibeswitch');
            const key = cfg.get('sonar.projectKey', '') || '';
            return typeof key === 'string' ? key.trim() : null;
        };
        const getSonarBranch = async () => {
            const cfg = vscodeApi.workspace.getConfiguration('vibeswitch');
            const branch = cfg.get('sonar.branch', '') || '';
            return typeof branch === 'string' ? branch.trim() || undefined : undefined;
        };
        const sonarClient = createSonarCloudClient({
            getToken: getSonarToken,
            getProjectKey: getSonarProjectKey,
            getBranch: getSonarBranch,
            loggerPort: adapters.loggerAdapter
        });
        state.sonarClient = sonarClient;
    } catch (err) {
        adapters.loggerAdapter?.error?.('compositionRoot: Failed to compose Sonar client', err);
    }

    // ESLint measures (research/dashboard): run ESLint on workspace, aggregate errors/warnings
    try {
        const cfgEslint = vscode.workspace.getConfiguration('vibeswitch');
        const eslintEnabled = cfgEslint.get('eslint.enabled', true);
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        const workspaceRoot = workspaceFolders[0] ? workspaceFolders[0].uri.fsPath : '';
        if (eslintEnabled && workspaceRoot) {
            const { createEslintMeasuresClient } = require('./business_modules/awareness/app/usage/eslintMeasuresClient');
            const getWorkspaceRoot = () => {
                const folders = vscode.workspace.workspaceFolders || [];
                return folders[0] ? folders[0].uri.fsPath : '';
            };
            const timeoutMs = Math.max(5000, cfgEslint.get('eslint.timeoutMs', 30000));
            const patterns = cfgEslint.get('eslint.patterns', ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx']);
            const patternsArr = Array.isArray(patterns) ? patterns : (typeof patterns === 'string' ? [patterns] : ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx']);
            state.eslintClient = createEslintMeasuresClient({
                getWorkspaceRoot,
                timeoutMs,
                patterns: patternsArr,
                loggerPort: adapters.loggerAdapter
            });
        } else {
            state.eslintClient = null;
        }
    } catch (err) {
        adapters.loggerAdapter?.error?.('compositionRoot: Failed to compose ESLint client', err);
        state.eslintClient = null;
    }

    // Project progress (plan, schedule, acceptance tests) - research and dashboard
    try {
        const cfgProg = vscode.workspace.getConfiguration('vibeswitch');
        const getWorkspaceRoot = () => {
            const folders = vscode.workspace.workspaceFolders || [];
            return folders[0] ? folders[0].uri.fsPath : '';
        };
        let planDeviationClient = null;
        const planEnabled = cfgProg.get('projectProgress.plan.enabled', true);
        if (planEnabled) {
            const { createPlanDeviationClient } = require('./business_modules/awareness/app/usage/planDeviationClient');
            const getPlanPath = () => (cfgProg.get('projectProgress.plan.path', '') || 'PLAN.md').trim() || 'PLAN.md';
            planDeviationClient = createPlanDeviationClient({
                getWorkspaceRoot,
                getPlanPath,
                loggerPort: adapters.loggerAdapter
            });
        }
        state.planDeviationClient = planDeviationClient;
        let jiraSprintDeviationClient = null;
        const jiraEnabled = cfgProg.get('projectProgress.jira.enabled', false);
        if (jiraEnabled) {
            const baseUrl = (cfgProg.get('projectProgress.jira.baseUrl', '') || '').trim();
            const boardId = cfgProg.get('projectProgress.jira.boardId', '');
            const email = (cfgProg.get('projectProgress.jira.email', '') || '').trim();
            if (baseUrl && boardId) {
                const { createJiraSprintDeviationClient } = require('./business_modules/awareness/app/usage/jiraSprintDeviationClient');
                const getAuthHeader = async () => {
                    const token = await context.secretStorage.get('vibeswitch.projectProgress.jira.apiToken').catch(() => null);
                    if (!email || !token || typeof token !== 'string') return null;
                    const buf = Buffer.from(email + ':' + token, 'utf8');
                    return 'Basic ' + buf.toString('base64');
                };
                jiraSprintDeviationClient = createJiraSprintDeviationClient({
                    getBaseUrl: () => baseUrl,
                    getBoardId: () => String(boardId),
                    getAuthHeader,
                    getStoryPointsField: () => (cfgProg.get('projectProgress.jira.storyPointsField', '') || 'customfield_10016').trim() || 'customfield_10016',
                    loggerPort: adapters.loggerAdapter
                });
            }
        }
        state.jiraSprintDeviationClient = jiraSprintDeviationClient;
        let acceptanceTestsDeviationClient = null;
        const atEnabled = cfgProg.get('projectProgress.acceptanceTests.enabled', true);
        if (atEnabled) {
            const { createAcceptanceTestsDeviationClient } = require('./business_modules/awareness/app/usage/acceptanceTestsDeviationClient');
            const getAtCommand = () => (cfgProg.get('projectProgress.acceptanceTests.command', '') || 'npm test').trim() || 'npm test';
            const getAtTimeoutMs = () => Math.max(5000, cfgProg.get('projectProgress.acceptanceTests.timeoutMs', 60000));
            acceptanceTestsDeviationClient = createAcceptanceTestsDeviationClient({
                getWorkspaceRoot,
                getCommand: getAtCommand,
                getTimeoutMs: getAtTimeoutMs,
                loggerPort: adapters.loggerAdapter
            });
        }
        state.acceptanceTestsDeviationClient = acceptanceTestsDeviationClient;
        const { createProjectProgressService } = require('./business_modules/awareness/app/usage/projectProgressService');
        state.projectProgressClient = createProjectProgressService({
            planDeviationClient: planDeviationClient || undefined,
            jiraSprintDeviationClient: jiraSprintDeviationClient || undefined,
            acceptanceTestsDeviationClient: acceptanceTestsDeviationClient || undefined,
            loggerPort: adapters.loggerAdapter
        });
    } catch (err) {
        adapters.loggerAdapter?.error?.('compositionRoot: Failed to compose project progress', err);
        state.planDeviationClient = null;
        state.projectProgressClient = null;
    }

    // Research module: gather objective data (Sonar, token, extension metrics) and send to external agent (Fastify/Cloud Run).
    // Analysis is performed by the external Claude code agent, not in the extension.
    try {
        const cfg = vscode.workspace.getConfiguration('vibeswitch');
        const researchEnabled = cfg.get('research.enabled', false);
        const agentUrl = (cfg.get('research.agentUrl', '') || '').trim();
        const pollIntervalMs = Math.max(60000, cfg.get('research.pollIntervalMs', 300000));
        if (researchEnabled && agentUrl) {
            const { createResearchDataService } = require('./business_modules/research');
            const { DEFAULT_DB_PATH } = require('./business_modules/research/infrastructure/ResearchStore');
            const getAgentUrl = () => (vscode.workspace.getConfiguration('vibeswitch').get('research.agentUrl', '') || '').trim();
            const getDbPath = () => DEFAULT_DB_PATH;
            const getResearchApiKey = async () => {
                try {
                    const t = await context.secretStorage.get('vibeswitch.research.agentApiKey');
                    return typeof t === 'string' ? t : null;
                } catch (_) {
                    return null;
                }
            };
            state.researchService = createResearchDataService({
                state,
                getAgentUrl,
                getDbPath,
                getApiKey: getResearchApiKey,
                pollIntervalMs,
                loggerPort: adapters.loggerAdapter
            });
        } else {
            state.researchService = null;
        }
    } catch (err) {
        adapters.loggerAdapter?.error?.('compositionRoot: Failed to compose research module', err);
        state.researchService = null;
    }

    // Daily research: fetch from arxiv, Medium, LinkedIn, X and write report to researchReview/reports (once per day).
    try {
        const cfg = vscode.workspace.getConfiguration('vibeswitch');
        const researchEnabled = cfg.get('research.enabled', false);
        const dailyEnabled = cfg.get('research.daily.enabled', false);
        if (researchEnabled && dailyEnabled && context.extensionPath) {
            const { createDailyResearchRunner } = require('./business_modules/research/researchReview/dailyResearchRunner');
            const getReportsDir = () => path.join(context.extensionPath, 'business_modules', 'research', 'researchReview', 'reports');
            const getXBearerToken = async () => {
                try {
                    const t = await context.secretStorage.get('vibeswitch.research.xBearerToken');
                    return typeof t === 'string' ? t : null;
                } catch (_) {
                    return null;
                }
            };
            const runner = createDailyResearchRunner({
                getReportsDir,
                getXBearerToken,
                loggerPort: adapters.loggerAdapter
            });
            const DAILY_MS = 24 * 60 * 60 * 1000;
            let dailyIntervalId = null;
            state.dailyResearchRunner = {
                start() {
                    if (dailyIntervalId != null) return;
                    const run = () => {
                        runner.run().catch(() => {});
                    };
                    setTimeout(run, 15000);
                    dailyIntervalId = setInterval(run, DAILY_MS);
                },
                stop() {
                    if (dailyIntervalId != null) {
                        clearInterval(dailyIntervalId);
                        dailyIntervalId = null;
                    }
                }
            };
        } else {
            state.dailyResearchRunner = null;
        }
    } catch (err) {
        adapters.loggerAdapter?.error?.('compositionRoot: Failed to compose daily research', err);
        state.dailyResearchRunner = null;
    }

    // Report module: publish research report to X, LinkedIn, Medium (wired when report.enabled and adapters exist)
    try {
        const { createReportService } = require('./business_modules/report/app/reportService');
        const reportCfg = vscode.workspace.getConfiguration('vibeswitch').get('report.enabled', false);
        if (reportCfg) {
            try {
                const { ReportFsContentSourceAdapter } = require('./business_modules/report/infrastructure/adapters/reportFsContentSourceAdapter');
                const { ReportXAdapter } = require('./business_modules/report/infrastructure/adapters/reportXAdapter');
                const { ReportLinkedInAdapter } = require('./business_modules/report/infrastructure/adapters/reportLinkedInAdapter');
                const { ReportMediumAdapter } = require('./business_modules/report/infrastructure/adapters/reportMediumAdapter');
                const getReportXToken = async () => { try { return await context.secretStorage.get('vibeswitch.report.xBearerToken') || null; } catch (_) { return null; } };
                const getReportLinkedInToken = async () => { try { return await context.secretStorage.get('vibeswitch.report.linkedInToken') || null; } catch (_) { return null; } };
                const getReportMediumToken = async () => { try { return await context.secretStorage.get('vibeswitch.report.mediumToken') || null; } catch (_) { return null; } };
                const contentSource = new ReportFsContentSourceAdapter();
                const publishAdapters = {
                    x: new ReportXAdapter({ getBearerToken: getReportXToken }),
                    linkedin: new ReportLinkedInAdapter({ getAccessToken: getReportLinkedInToken }),
                    medium: new ReportMediumAdapter({ getIntegrationToken: getReportMediumToken })
                };
                state.reportService = createReportService({ contentSourcePort: contentSource, publishAdapters });
            } catch (adapterErr) {
                adapters.loggerAdapter?.error?.('compositionRoot: Report adapters not available', adapterErr);
                state.reportService = null;
            }
        } else {
            state.reportService = null;
        }
    } catch (err) {
        adapters.loggerAdapter?.error?.('compositionRoot: Failed to compose report module', err);
        state.reportService = null;
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
