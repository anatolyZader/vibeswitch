# Review: Objective Code Quality Data for the Research Module

Detailed review of how objective code quality data is obtained and provided by the research module. **Data gathering** happens in the extension (research business module); **calculations and analysis** are performed by an **external Claude code agent** on a Fastify app (e.g. Google Cloud Run). See `docs/RESEARCH-EXTERNAL-AGENT-CONTRACT.md` and `research-agent/README.md`.

## 1. Executive Summary

- **Token usage:** Obtained in extension (Cursor API). Gathered by the research module and sent to the external agent with the rest of the payload.
- **Sonar:** Obtained in extension via SonarCloud Web API. Gathered by the research module and sent as `sonarMeasures` to the external agent. Dashboard also shows Sonar when configured.
- **ESLint:** Obtained in extension via ESLint Node API (run on workspace). Gathered by the research module and sent as `eslintMeasures` (errorCount, warningCount, fixable). Dashboard shows ESLint when enabled.
- **Project progress (plan, schedule, acceptance tests):** Three deviation anchors gathered by the research module and sent as `projectProgressMeasures`: `planDeviation`, `scheduleDeviation`, `acceptanceTestsDeviation` (each 0–100 or null). Plan = conceptual (what and order), from PLAN.md checkboxes. Schedule = dates/terms, from Jira active sprint. Acceptance tests = % failing from running the test suite. Always measured against **current** state of each anchor. Dashboard section "Project process" shows three gauges.
- **Extension metrics (scoreData, antipatternBreakdown):** Gathered by the research module and sent to the external agent as behavioral measures.

The **research business module** gathers all of the above into a single payload and POSTs it to the external agent at `{vibeswitch.research.agentUrl}/ingest`. No correlation, regression, or analysis runs in the extension; the external Fastify/Cloud Run service runs the Claude code agent for that.

## 2. Token Usage (Implemented)

**How obtained:** Cursor API: `business_modules/awareness/app/usage/cursorUsageApiClient.js`. URL: get-filtered-usage-events. User stores WorkosCursorSessionToken via command (vsCommandsFactory; key vibeswitch.cursorUsageToken in secretStorage). compositionRoot wires getToken to context.secretStorage.get('vibeswitch.cursorUsageToken'). createCursorUsageApiClient returns fetchTokenUsage: if no token, returns usageApiAvailable false and zeros; else POST with Cookie, then aggregateUsageEvents(events) yielding totalInput, totalOutput, totalTokens, byModel, optional costCents.

**How provided to research:** The research module (ResearchDataService) gathers tokenUsage via state.tokenUsageClient.fetchTokenUsage(), along with scoreData, antipatternBreakdown, and sonarMeasures, into one payload and POSTs it to the external agent (POST /ingest). No local time_series or StatisticalAnalyzer in the extension.

**How used in analysis:** The external Claude code agent (Fastify/Cloud Run) receives the payload, may persist it, and runs correlations, regression, and analysis. See research-agent/ and docs/RESEARCH-EXTERNAL-AGENT-CONTRACT.md.

## 3. Sonar (Implemented via Web API)

**How obtained:** SonarCloud Web API client: `business_modules/awareness/app/usage/sonarCloudApiClient.js`. Single GET to `api/measures/component` with `component=<projectKey>`, optional `branch`, and `metricKeys=bugs,vulnerabilities,code_smells,duplicated_lines_density,coverage,ncloc`. Authentication: Bearer token from secret storage (key `vibeswitch.sonarToken`). Project key and optional branch from config: `vibeswitch.sonar.projectKey`, `vibeswitch.sonar.branch`. Commands: "Set SonarCloud Token", "Set Sonar Project Key", "Clear Sonar Configuration" (vsCommandsFactory). compositionRoot creates sonarClient and sets state.sonarClient.

**How provided to dashboard:** buildDashboardPayload and openDashboard (ui/dashboardDisplay.js) call state.sonarClient.fetchMeasures() when available and add sonarMeasures to the payload. ResearchSection (dashboard-app) displays bugs, vulnerabilities, code_smells, duplicated_lines_density, coverage, ncloc when sonarApiAvailable is true.

**How provided to research:** ResearchDataService includes state.sonarClient.fetchMeasures() in the payload sent to the external agent (POST /ingest). The agent performs all analysis (no MEASURE_PATHS or local DB in the extension).

**Code visibility:** The extension does not make code visible to Sonar. Analysis is assumed to be run in CI (e.g. SonarCloud GitHub Action) or manually; the same project key (and branch) configured in the extension must be used. See plan/docs for minimal sonar-project.properties and CI sample.

## 4. ESLint (Implemented via Node API)

**How obtained:** ESLint measures client: `business_modules/awareness/app/usage/eslintMeasuresClient.js`. Uses ESLint Node API (optional dependency): `new ESLint({ cwd: workspaceRoot })`, then `lintFiles(patterns)`. Patterns and timeout from config: `vibeswitch.eslint.patterns` (default `**/*.js`, `**/*.ts`, `**/*.jsx`, `**/*.tsx`), `vibeswitch.eslint.timeoutMs` (default 30000). Aggregates results to errorCount, warningCount, fixableErrorCount, fixableWarningCount. When ESLint is not installed, timeout, or no workspace: returns eslintApiAvailable false. Config: `vibeswitch.eslint.enabled` (default true), `vibeswitch.eslint.patterns`, `vibeswitch.eslint.timeoutMs`. compositionRoot creates eslintClient when enabled and workspace exists; state.eslintClient.

**How provided to dashboard:** buildDashboardPayload and openDashboard call state.eslintClient.fetchMeasures() when available and add eslintMeasures to the payload. ResearchSection displays errors, warnings (and fixable count) when eslintApiAvailable.

**How provided to research:** ResearchDataService calls state.eslintClient.fetchMeasures() when state.eslintClient exists and includes eslintMeasures in the payload sent to the external agent (POST /ingest). Analysis is performed by the external agent.

## 5. Project Progress (Plan, Schedule, Acceptance Tests)

**Concepts:** **Plan** = conceptual (what has to be done and in which order); deviation = % of plan items still unchecked. **Schedule** = dates and terms; deviation = how far sprint completion is from schedule (story points done vs in sprint). **Acceptance tests** = TDD-style tests run before/along development; deviation = % tests failing. All three are always measured against the **current** state of the anchor (e.g. if the plan file is edited, deviation is recomputed against the new content).

**How obtained:** Project progress service: `business_modules/awareness/app/usage/projectProgressService.js` aggregates three optional clients. (1) Plan: `planDeviationClient.js` reads a markdown file (default PLAN.md) and parses `[ ]` / `[x]` checkboxes; deviation = 100 × (1 − done/total). Config: `vibeswitch.projectProgress.plan.enabled`, `vibeswitch.projectProgress.plan.path`. (2) Schedule: `jiraSprintDeviationClient.js` calls Jira Cloud REST (board active sprint, sprint issues with story points); deviation = 100 × (1 − storyPointsDone/storyPointsPlanned). Config: `vibeswitch.projectProgress.jira.enabled`, `vibeswitch.projectProgress.jira.baseUrl`, `vibeswitch.projectProgress.jira.boardId`, `vibeswitch.projectProgress.jira.email`; API token in secret `vibeswitch.projectProgress.jira.apiToken`. (3) Acceptance tests: `acceptanceTestsDeviationClient.js` runs a command (default `npm test`) in workspace and parses stdout for pass/fail; deviation = 100 × (failed/total). Config: `vibeswitch.projectProgress.acceptanceTests.enabled`, `vibeswitch.projectProgress.acceptanceTests.command`, `vibeswitch.projectProgress.acceptanceTests.timeoutMs`. compositionRoot wires all three and sets state.projectProgressClient.

**How provided to dashboard:** buildDashboardPayload and openDashboard call state.projectProgressClient.fetchMeasures() and add projectProgressMeasures to the payload. Dashboard section "Project process" (ProjectProcessSection.jsx) displays three gauges: Plan (scope & order), Schedule (dates & terms), Acceptance tests. Each shows 0–100 deviation or N/A.

**How provided to research:** ResearchDataService includes projectProgressMeasures in the payload sent to the external agent (POST /ingest). Each of planDeviation, scheduleDeviation, acceptanceTestsDeviation may be a number 0–100 or null when disabled or unavailable.

## 6. Extension Metrics (Provided to Research)

scoreData and antipatternBreakdown are gathered by ResearchDataService (awarenessEngine.getScore(), getAntipatternBreakdownAsync/getAntipatternBreakdown) and included in the payload sent to the external agent. These are behavioral (extension) measures; the agent may correlate them with tokenUsage, sonarMeasures, eslintMeasures, and projectProgressMeasures.

## 7. Data Flow

User sets Cursor token -> compositionRoot creates tokenUsageClient. User sets Sonar token and project key -> compositionRoot creates sonarClient. When vibeswitch.eslint.enabled and workspace exists, compositionRoot creates eslintClient. Dashboard: buildDashboardPayload fetches tokenUsage, sonarMeasures, and eslintMeasures; ResearchSection shows each when available. When `vibeswitch.research.enabled` is true and `vibeswitch.research.agentUrl` is set, compositionRoot creates ResearchDataService; extension.js starts it on activate. ResearchDataService runs on an interval: gathers scoreData, antipatternBreakdown, tokenUsage, sonarMeasures, eslintMeasures, projectProgressMeasures (via state.projectProgressClient.fetchMeasures()), and POSTs to `{agentUrl}/ingest`. The external Fastify/Cloud Run service receives the payload and runs the Claude code agent for calculations and analysis. No analysis runs in the extension.

## 8. Recommendations

Keep token, Sonar, and ESLint integration as-is. Implement Claude analysis logic in the research-agent service (see research-agent/README.md and server.js).

Key files: business_modules/research/app/ResearchDataService.js, business_modules/research/infrastructure/ResearchAgentClient.js, compositionRoot.js, extension.js, research-agent/server.js, docs/RESEARCH-EXTERNAL-AGENT-CONTRACT.md.

## 9. Key File References

- Project progress: `business_modules/awareness/app/usage/planDeviationClient.js`, `projectProgressService.js`, `acceptanceTestsDeviationClient.js`, `jiraSprintDeviationClient.js`; `compositionRoot.js` (state.projectProgressClient, state.planDeviationClient, state.jiraSprintDeviationClient, state.acceptanceTestsDeviationClient); `ui/dashboardDisplay.js` (projectProgressMeasures in payload); `dashboard-app/src/ProjectProcessSection.jsx`. Config: vibeswitch.projectProgress.plan.enabled, vibeswitch.projectProgress.plan.path; vibeswitch.projectProgress.jira.* (enabled, baseUrl, boardId, email, storyPointsField); secret vibeswitch.projectProgress.jira.apiToken; vibeswitch.projectProgress.acceptanceTests.enabled, command, timeoutMs.
- Token usage: `business_modules/awareness/app/usage/cursorUsageApiClient.js`; `compositionRoot.js`; `vsCommandsFactory.js` (vibeswitch.cursorUsageToken).
- Sonar: `business_modules/awareness/app/usage/sonarCloudApiClient.js`; `compositionRoot.js`; `vsCommandsFactory.js` (setSonarToken, setSonarProjectKey, clearSonarConfig); `ui/dashboardDisplay.js`; `dashboard-app/src/ResearchSection.jsx`.
- ESLint: `business_modules/awareness/app/usage/eslintMeasuresClient.js` (createEslintMeasuresClient, fetchMeasures); `compositionRoot.js` (state.eslintClient when eslint.enabled and workspace root); `ui/dashboardDisplay.js`; `dashboard-app/src/ResearchSection.jsx`. Config: vibeswitch.eslint.enabled, vibeswitch.eslint.patterns, vibeswitch.eslint.timeoutMs. ESLint is an optionalDependency; when missing, eslintApiAvailable is false.
- Research module (gather + send, no analysis): `business_modules/research/app/ResearchDataService.js` (gatherResearchPayload, createResearchDataService); `business_modules/research/infrastructure/ResearchAgentClient.js` (createResearchAgentClient, POST /ingest); `business_modules/research/index.js`. compositionRoot composes researchService when research.enabled and research.agentUrl set; extension.js starts state.researchService on activate and stops on deactivate.
- External agent: `research-agent/server.js` (Fastify POST /ingest, GET /health); `research-agent/README.md`; `docs/RESEARCH-EXTERNAL-AGENT-CONTRACT.md`.
- Config: vibeswitch.research.enabled, vibeswitch.research.agentUrl, vibeswitch.research.pollIntervalMs; optional secret vibeswitch.research.agentApiKey for Bearer auth. ESLint: vibeswitch.eslint.enabled, vibeswitch.eslint.patterns, vibeswitch.eslint.timeoutMs.
