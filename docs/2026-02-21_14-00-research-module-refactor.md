# Research Module — Refactored Architecture (Ports & Adapters)

This document describes the refactored Research business module for the Vibeswitch extension: its two main flows, the ports-and-adapters design, file layout, contracts, and how to use or extend it.

**Spec reference:** [docs/specs/spec-research.md](specs/spec-research.md)

---

## 1. Overview

The Research module has two independent flows:

1. **Ingest pipeline** — Gathers objective code-quality data from extension state, optionally persists it to local SQLite, and POSTs current + history to an external research agent on a configurable poll interval. No analysis is done in the extension; the external agent performs analysis.
2. **Daily research (review)** — Runs multiple fetchers in parallel (arXiv, Medium, LinkedIn, X), aggregates normalized items, and writes a Markdown daily report to `reportsDir/YYYY-MM-DD.md`.

The module is **in-process only**: it has no input layer (no HTTP, events, or CLI entry). The app layer is the entry point; callers resolve the research service or daily research runner from the composition root and call them directly.

---

## 2. Ingest Pipeline (Flow 1)

### 2.1 Behavior

- **Gather:** Build a payload from extension state: `scoreData` (awarenessEngine.getScore), `antipatternBreakdown` (getAntipatternBreakdownAsync or getAntipatternBreakdown), `tokenUsage`, `sonarMeasures`, `eslintMeasures`, `projectProgressMeasures`, `currentMode`. Add `timestamp` and `source: 'vibeswitch-extension'`. Missing clients yield `null` for that field; no throw.
- **Persist (optional):** When a persistence implementation is available (DB path or injected port), each payload is persisted to local SQLite (`ingest_payloads` table; optional `sonar_snapshots` for Sonar metrics).
- **Send:** On each poll tick, if agent URL is set: read current + history from the store (last N days, last N rows), then POST `{ current, history }` to `baseUrl/ingest` with optional Bearer API key. If agent URL is missing or empty, send is skipped.
- **Poller:** `start()` runs an immediate tick and then ticks on a configurable interval; `stop()` clears the interval and closes the store if it was created internally. Start/stop are idempotent.

### 2.2 Public API (App Layer)

| API | Description |
|-----|-------------|
| `gatherResearchPayload(state)` | Builds and returns the research payload from extension state. Async; missing clients produce `null` fields. |
| `createResearchDataService(opts)` | Returns `{ start(), stop(), gatherResearchPayload }`. Supports **ports injection** or **legacy opts** (see §2.4). |

### 2.3 Payload Shape (Value Object)

The payload sent to the agent (and stored) has this shape:

```js
{
  timestamp: number,           // Date.now()
  source: 'vibeswitch-extension',
  scoreData: Object | null,    // awarenessEngine.getScore()
  antipatternBreakdown: Object | null,
  tokenUsage: Object | null,
  sonarMeasures: Object | null,
  eslintMeasures: Object | null,
  projectProgressMeasures: Object | null,
  currentMode: string          // e.g. 'dev', 'vibe'
}
```

---

## 3. Ports and Adapters (Refactor)

The ingest flow is designed around **ports** (interfaces) and **adapters** (implementations). The app service depends on abstractions, not concrete infrastructure.

### 3.1 Domain Ports

| Port | Location | Contract |
|------|----------|----------|
| **IResearchPersistencePort** | `domain/ports/IResearchPersistencePort.js` | `persist(payload): Promise<void>`; `getPayloadForAgent({ lastDays?, lastN? }): Promise<{ current: Object\|null, history: Object[] }>`. When store has no data, returns `current: null`, `history: []`. |
| **IResearchAgentPort** | `domain/ports/IResearchAgentPort.js` | `send(payload): Promise<{ ok: boolean, status?: number, error?: string }>`. When agent URL is missing/empty, returns `{ ok: false, error: "..." }`; never throws. |

Ports are abstract (throw if instantiated directly); adapters implement them.

### 3.2 Infrastructure Adapters

| Adapter | Location | Implements | Notes |
|---------|----------|------------|--------|
| **researchSqlitePersistenceAdapter** | `infrastructure/adapters/researchSqlitePersistenceAdapter.js` | IResearchPersistencePort | Delegates to `createResearchStore(dbPath, opts)`. Returns the same interface: `persist`, `getPayloadForAgent`, `close`. |
| **researchAgentClientAdapter** | `infrastructure/adapters/researchAgentClientAdapter.js` | IResearchAgentPort | Delegates to `createResearchAgentClient(opts)`. POSTs to `baseUrl/ingest`, optional Bearer token. |

The concrete implementations **ResearchStore** and **ResearchAgentClient** remain in `infrastructure/` (not under `adapters/`) and are used both by the adapters and by the service when ports are not injected (legacy path).

### 3.3 Service Options: Ports vs Legacy

`createResearchDataService(opts)` accepts two usage patterns:

**Ports pattern (injection):**

- `opts.persistencePort` — object implementing IResearchPersistencePort (e.g. from `createResearchSqlitePersistenceAdapter`).
- `opts.agentPort` — object implementing IResearchAgentPort (e.g. from `createResearchAgentClientAdapter`).
- When both are provided, the service uses only these; it does not call `createResearchStore` or `createResearchAgentClient`. Useful for testing (mock ports) or for composition roots that construct adapters asynchronously.

**Legacy pattern (backward compatible):**

- `opts.getDbPath` — function returning the SQLite file path. If provided (and no `persistencePort`), the service creates a store via `createResearchStore(getDbPath(), …)` on first tick.
- `opts.getAgentUrl` — function returning the agent base URL. If no `agentPort`, the service creates a client via `createResearchAgentClient({ baseUrl: getAgentUrl(), … })` on each tick when sending.
- The extension’s composition root currently uses this pattern (getDbPath, getAgentUrl, getApiKey, etc.).

Other options (both patterns):

- `state` — extension state for `gatherResearchPayload`.
- `getApiKey` — optional async function for Bearer token.
- `pollIntervalMs`, `lastDays`, `lastN` — poll interval and history window (defaults: 5 min, 7 days, 50 rows).
- `loggerPort` — optional `{ error }` for logging failures.

---

## 4. Daily Research (Flow 2)

### 4.1 Behavior

- **Fetchers:** arXiv, Medium, LinkedIn, X run in parallel. Each returns a list of **normalized items**: `{ title, link, summary, source, date }`. Injectable `fetchFn` and optional tokens (e.g. `getXBearerToken`, `getLinkedInApiKey`) are supported.
- **Aggregation:** `runFetchers(opts)` concatenates all results and returns a single array.
- **Report:** Markdown is generated with a header and items grouped by source (arxiv, medium, linkedin, x), then written to `reportsDir/YYYY-MM-DD.md`. Invalid `dateStr` falls back to today.
- **Runner:** `createDailyResearchRunner(opts)` returns `{ run(), runFetchers }`. `run()` runs fetchers and writes the report; returns `{ reportPath, itemCount }`. `runFetchers` is exposed for tests.

### 4.2 Public API

| API | Location | Description |
|-----|----------|-------------|
| `runFetchers(opts)` | researchReview/dailyResearchRunner.js | Runs all fetchers in parallel; returns concatenated array of normalized items. |
| `generateReportMarkdown(items, dateStr)` | researchReview/reportGenerator.js | Returns Markdown string grouped by source. |
| `writeReportFile(reportsDir, dateStr, content)` | researchReview/reportGenerator.js | Writes file to `reportsDir/dateStr.md`; returns path. |
| `generateDailyReport(items, reportsDir, dateStr?, opts?)` | researchReview/reportGenerator.js | Generates markdown and writes file; invalid dateStr → today. |
| `createDailyResearchRunner(opts)` | researchReview/dailyResearchRunner.js | Returns `{ run(), runFetchers }`. Options: getReportsDir, fetchFn, getXBearerToken, getLinkedInApiKey, xUsernames, loggerPort. |

Daily research does not yet use domain ports for fetchers or report writing; it remains in `researchReview/` with direct use of fetchers and reportGenerator. The spec allows optional ports for fetchers and report writer in a future refactor.

---

## 5. Module Layout

```
business_modules/research/
├── index.js                          # Re-exports createResearchDataService, gatherResearchPayload, createResearchAgentClient, createResearchStore, DEFAULT_DB_PATH
├── app/
│   └── ResearchDataService.js        # createResearchDataService, gatherResearchPayload; uses ports or legacy getDbPath/getAgentUrl
├── domain/
│   └── ports/
│       ├── IResearchPersistencePort.js
│       └── IResearchAgentPort.js
├── infrastructure/
│   ├── ResearchStore.js               # SQLite persistence (ingest_payloads, sonar_snapshots); used by adapter and by service in legacy mode
│   ├── ResearchAgentClient.js        # HTTP client for baseUrl/ingest; used by adapter and by service in legacy mode
│   └── adapters/
│       ├── researchSqlitePersistenceAdapter.js
│       └── researchAgentClientAdapter.js
└── researchReview/
    ├── dailyResearchRunner.js        # runFetchers, runDailyResearch, createDailyResearchRunner
    ├── reportGenerator.js           # generateReportMarkdown, writeReportFile, generateDailyReport
    └── fetchers/
        ├── arxivFetcher.js
        ├── mediumFetcher.js
        ├── linkedinFetcher.js
        └── xFetcher.js
```

- **No input layer:** The module is only invoked in-process from the composition root.
- **App** depends on domain ports and (in legacy mode) on infrastructure for store/client creation.
- **Domain** has no dependencies on app or infrastructure; ports are abstract.
- **Infrastructure** implements the ports via adapters and provides the concrete store and HTTP client.

---

## 6. Composition and Configuration

### 6.1 Ingest (compositionRoot.js)

When `research.enabled` is true and `research.agentUrl` is set:

- `createResearchDataService` is called with: `state`, `getAgentUrl`, `getDbPath` (DEFAULT_DB_PATH), `getApiKey` (from secret storage), `pollIntervalMs`, `loggerPort`.
- The service uses the **legacy** path (no persistencePort/agentPort); it creates the store and client internally.
- The resulting service is assigned to `state.researchService`; the extension is responsible for calling `start()` / `stop()` (e.g. when activating or deactivating research).

### 6.2 Daily Research (compositionRoot.js)

When `research.enabled` and `research.daily.enabled` are true and `context.extensionPath` is set:

- `createDailyResearchRunner` is called with: `getReportsDir`, `getXBearerToken`, `getLinkedInApiKey`, `xUsernames`, `loggerPort`, `fetchFn`.
- The runner is assigned to `state.dailyResearchRunner`; the extension schedules `run()` (e.g. once per day).

### 6.3 Using Ports in Composition (Optional)

To wire the ingest flow with explicit adapters (e.g. for async adapter creation or testing):

1. Create the persistence adapter: `persistencePort = await createResearchSqlitePersistenceAdapter(dbPath, { loggerPort })`.
2. Create the agent adapter: `agentPort = createResearchAgentClientAdapter({ baseUrl, getApiKey, loggerPort })`.
3. Call `createResearchDataService({ state, getAgentUrl, persistencePort, agentPort, pollIntervalMs, lastDays, lastN, loggerPort })`.

The service will use only the injected ports and will not create a store or client internally. On `stop()`, if you need to close the store, the adapter (ResearchStore) exposes `close()`; the composition root or the code that holds the adapter reference is responsible for calling it when disposing the service.

---

## 7. SQLite Schema (ResearchStore)

- **ingest_payloads:** id, received_at, timestamp, source, current_mode, payload_json, created_at. Full payload is stored as JSON.
- **sonar_snapshots:** Optional flattened row per payload when `payload.sonarMeasures` is present: bugs, vulnerabilities, code_smells, duplicated_lines_density, coverage, ncloc, sonar_api_available, payload_id (FK to ingest_payloads).

Default DB path: `~/.vibeswitch/research/research.db`.

---

## 8. Tests

- **Unit:** `tests/business_modules/research/app/ResearchDataService.payload.test.js`, `ResearchDataService.lifecycle.test.js` (including a test that uses injected `persistencePort` and `agentPort`), `ResearchDataService.projectProgress.test.js`; reportGenerator, dailyResearchRunner, fetchers; ResearchStore, ResearchAgentClient.
- **Integration:** `ResearchDataService.integration.test.js` (real SQLite store, mocked agent); `dailyResearchRunner.integration.test.js` (real report writer, mocked fetchers).

Run all research tests: `npm test -- tests/business_modules/research`.

---

## 9. Summary

| Aspect | Detail |
|--------|--------|
| **Ingest entry** | `createResearchDataService(opts)` → `{ start, stop, gatherResearchPayload }`; supports **ports** (persistencePort, agentPort) or **legacy** (getDbPath, getAgentUrl). |
| **Domain** | IResearchPersistencePort, IResearchAgentPort (abstract; no I/O). |
| **Adapters** | researchSqlitePersistenceAdapter, researchAgentClientAdapter in `infrastructure/adapters/`. |
| **Daily research** | researchReview/dailyResearchRunner, reportGenerator, fetchers; no ports refactor yet. |
| **Spec** | [spec-research.md](specs/spec-research.md) defines contracts, I/O, edge cases, and test coverage. |

The refactor keeps backward compatibility: the extension continues to use getDbPath and getAgentUrl. Tests and future composition can use injected ports for clearer boundaries and easier mocking.
