# Detailed Review: Project Process Measures (Plan, Schedule, Acceptance Tests)

This document describes how the three **project process** deviation measures are obtained in VibeSwitch: **Plan** (scope and order), **Schedule** (dates and terms), and **Acceptance tests**. Each measure is expressed as a **deviation 0–100**: 0 = on track, 100 = fully off track (none done or all failing). The measures feed the dashboard “Project process” section and the research module (sent to the external analysis agent).

---

## 1. Overview

| Measure | Meaning | Data source | Default config |
|--------|---------|-------------|----------------|
| **Plan** | Conceptual plan progress: share of plan items still unchecked | Markdown file with checkboxes (e.g. `PLAN.md`) | `plan.enabled: true`, `plan.path: PLAN.md` |
| **Schedule** | Sprint progress: share of story points not yet “Done” in active Jira sprint | Jira Cloud REST (board, active sprint, issues) | `jira.enabled: false` (opt-in) |
| **Acceptance tests** | Share of tests failing when running the workspace test command | Run command (e.g. `npm test`), parse stdout | `acceptanceTests.enabled: true`, `command: npm test` |

All three are **always measured against the current state** of their anchor (file content, Jira API, test run). There is no caching of past values inside the clients; the dashboard and research module call `fetchMeasures()` when building the payload.

---

## 2. Plan Deviation (Scope and Order)

### 2.1 Purpose

Plan deviation answers: *How much of the conceptual plan (what to do and in which order) is still not done?* It uses a single markdown file as the “plan anchor”: tasks are represented as checkboxes. Deviation = percentage of plan items still unchecked.

### 2.2 Implementation

- **Module:** `business_modules/awareness/app/usage/planDeviationClient.js`
- **API:** `createPlanDeviationClient(opts)` returns `{ fetchMeasures }`. `fetchMeasures()` returns a Promise resolving to either:
  - `null` (no workspace root, file missing, no checkboxes, or read error), or
  - `{ deviation0To100, total, done, path }` where:
    - `deviation0To100` = `Math.round(100 * (1 - done / total))`, clamped 0–100
    - `total` = number of checkbox lines (checked + unchecked)
    - `done` = number of checked lines
    - `path` = plan file path (relative or absolute)

### 2.3 Checkbox parsing

- **Function:** `parseCheckboxes(content)` (exported for tests).
- **Rules:**
  - **Unchecked:** line contains `[ ]` or `[  ]` (regex `\[\s?\]`). Counted as one plan item, not done.
  - **Checked:** line contains `[x]` or `[X]` (regex `\[[xX]\]`). Counted as one plan item, done.
  - Lines with no checkbox are ignored.
  - Empty or null content yields `{ total: 0, done: 0 }`; the client then returns `null` (no deviation number).

So the plan is “what’s in the file right now”: if the user edits the file (adds/removes/checks items), the next `fetchMeasures()` reflects that.

### 2.4 File path and workspace

- **Workspace root:** Provided by `getWorkspaceRoot()` from the composition root: first workspace folder’s `uri.fsPath`, or `''` if none. If root is empty or not a string, `fetchMeasures()` returns `null`.
- **Plan path:** From config `vibeswitch.projectProgress.plan.path` (default `PLAN.md`). If absolute, used as-is; otherwise `path.join(workspaceRoot, planPath)`.
- **Read:** `fs.promises.readFile(fullPath, 'utf8')`. On error (e.g. file not found), the client logs and returns `null`.

### 2.5 Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `vibeswitch.projectProgress.plan.enabled` | boolean | `true` | Whether to create the plan deviation client. |
| `vibeswitch.projectProgress.plan.path` | string | `PLAN.md` | Path to the plan file (relative to workspace root or absolute). |

### 2.6 Wiring and consumers

- **Composition:** `compositionRoot.js` builds `planDeviationClient` when `projectProgress.plan.enabled` is true, with `getWorkspaceRoot`, `getPlanPath` (from config), and `loggerPort`. The client is passed into `createProjectProgressService` as `planDeviationClient`.
- **Dashboard:** `ui/dashboardDisplay.js` calls `state.projectProgressClient.fetchMeasures()` and puts the result in the payload as `projectProgressMeasures`; `ProjectProcessSection.jsx` displays `planDeviation` as “Plan (scope & order)”.
- **Research:** `ResearchDataService.gatherResearchPayload()` includes `projectProgressMeasures` (with `planDeviation`, `scheduleDeviation`, `acceptanceTestsDeviation`) in the payload sent to the research agent.

---

## 3. Schedule Deviation (Dates and Terms)

### 3.1 Purpose

Schedule deviation answers: *How much of the current sprint (in Jira) is still not done?* It uses the **active sprint** on a Jira board and story points: deviation = percentage of sprint story points not yet in a “Done” status.

### 3.2 Implementation

- **Module:** `business_modules/awareness/app/usage/jiraSprintDeviationClient.js`
- **API:** `createJiraSprintDeviationClient(opts)` returns `{ fetchMeasures }`. `fetchMeasures()` returns a Promise resolving to either:
  - `null` (missing base URL, board ID, or auth; no active sprint; or request error), or
  - `{ deviation0To100, storyPointsPlanned, storyPointsDone, sprintName }` where:
    - `deviation0To100` = `Math.round(100 * (1 - done / planned))`, capped at 100
    - If `planned <= 0`, returns `deviation0To100: 0`, `storyPointsPlanned: 0`, `storyPointsDone: 0`, `sprintName`.

### 3.3 Jira API flow

1. **Active sprint:** `GET {baseUrl}/rest/agile/1.0/board/{boardId}/sprint?state=active`
   - Expects `sprints.values`; uses the first sprint as the active one (`sprintId`, `sprintName`).
2. **Sprint issues:** `GET {baseUrl}/rest/agile/1.0/sprint/{sprintId}/issue?fields=status,{storyPointsField}&maxResults=200`
   - For each issue, story points are read from `issue.fields[storyPointsField]` (numeric or string parseable to number).
   - “Done” is determined by `status.statusCategory.key === 'done'`.
3. **Aggregation:** Sum story points over all issues → `planned`. Sum story points over issues in “Done” → `done`. Deviation = `100 * (1 - done / planned)`.

So the measure is “current sprint only”; it does not look at past or future sprints.

### 3.4 Authentication

- **Method:** HTTP Basic Auth.
- **Source:** Email from config `vibeswitch.projectProgress.jira.email`; API token from VS Code secret storage key `vibeswitch.projectProgress.jira.apiToken`.
- **Header:** `Authorization: Basic base64(email + ':' + token)`.
- If email or token is missing, `getAuthHeader()` returns null and `fetchMeasures()` returns null.

### 3.5 Story points field

- **Config:** `vibeswitch.projectProgress.jira.storyPointsField` (default `customfield_10016`, common in Jira Cloud).
- **Usage:** Used in the `fields=` query and when reading `issue.fields[storyPointsField]`. Values are accepted as number or string that parses to a number; otherwise treated as 0.

### 3.6 Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `vibeswitch.projectProgress.jira.enabled` | boolean | `false` | Whether to create the Jira sprint deviation client. |
| `vibeswitch.projectProgress.jira.baseUrl` | string | `''` | Jira Cloud base URL (e.g. `https://your.atlassian.net`). |
| `vibeswitch.projectProgress.jira.boardId` | string | `''` | Board ID for the Agile board. |
| `vibeswitch.projectProgress.jira.email` | string | `''` | Email used for Basic auth (with API token in secret). |
| `vibeswitch.projectProgress.jira.storyPointsField` | string | `customfield_10016` | Jira field ID for story points. |

**Secret:** `vibeswitch.projectProgress.jira.apiToken` (set via VS Code secret storage; no command is registered in `vsCommandsFactory.js` for it in the current codebase; users can set it via Settings or another mechanism if available).

### 3.7 Wiring and consumers

- **Composition:** When `projectProgress.jira.enabled` is true and both `baseUrl` and `boardId` are set, `compositionRoot.js` creates `jiraSprintDeviationClient` with `getBaseUrl`, `getBoardId`, `getAuthHeader` (from context.secretStorage + email), `getStoryPointsField`, and `loggerPort`. This client is passed into `createProjectProgressService` as `jiraSprintDeviationClient`.
- **Dashboard and research:** Same as plan: `projectProgressClient.fetchMeasures()` yields `scheduleDeviation` inside `projectProgressMeasures`; dashboard shows “Schedule (dates & terms)”, research sends it to the agent.

### 3.8 Timeout and errors

- **Request timeout:** 15 seconds per HTTP request; on timeout the request is destroyed and the promise rejects; the client returns `null` and logs.
- **Non-2xx or parse errors:** Rejected promise is caught; client returns `null` and logs.

---

## 4. Acceptance Tests Deviation

### 4.1 Purpose

Acceptance tests deviation answers: *What share of the test suite is failing right now?* It runs a configurable command (e.g. `npm test`) in the workspace and parses stdout for pass/fail counts. Deviation = percentage of tests failing.

### 4.2 Implementation

- **Module:** `business_modules/awareness/app/usage/acceptanceTestsDeviationClient.js`
- **API:** `createAcceptanceTestsDeviationClient(opts)` returns `{ fetchMeasures }`. `fetchMeasures()` returns a Promise resolving to either:
  - `null` (no workspace root, spawn error, or output that cannot be parsed), or
  - `{ deviation0To100, total, passed, failed }` where:
    - `deviation0To100` = `Math.round(100 * (failed / total))`, clamped 0–100
    - `total`, `passed`, `failed` come from `parseTestOutput(stdout)`.

### 4.3 Test execution

- **Process:** `child_process.spawn(exec, args, { cwd: workspaceRoot, shell: true, stdio: ['ignore', 'pipe', 'pipe'] })`.
- **Command:** From config `vibeswitch.projectProgress.acceptanceTests.command` (default `npm test`). Split on whitespace: first token = executable, rest = arguments.
- **Working directory:** `getWorkspaceRoot()` (same as plan: first workspace folder). If root is empty, `fetchMeasures()` returns `null`.
- **Output:** Both stdout and stderr are concatenated into a single string and passed to `parseTestOutput`. So the parser must work with the test runner’s format (Jest, Mocha, etc.) as long as it emits the expected patterns.

### 4.4 Output parsing

- **Function:** `parseTestOutput(stdout)` (exported for tests).
- **Patterns (regex):**
  - `(\d+)\s+passed?` → `passed`
  - `(\d+)\s+failed?` → `failed`
  - `(\d+)\s+total` → `total` (if absent, `total = passed + failed`)
- If `total <= 0` after parsing, returns `null`; the client then returns `null`.

This is best-effort and depends on the runner’s wording (e.g. “1 passed”, “2 failed”, “3 total”). Runners that don’t emit such lines may not be parsed correctly.

### 4.5 Timeout

- **Config:** `vibeswitch.projectProgress.acceptanceTests.timeoutMs` (default 60000, minimum 5000).
- **Behavior:** A timer is set for `timeoutMs`. On timeout, the child is killed with `SIGTERM`, and the output collected so far is parsed. So the result can be based on partial output (e.g. first few tests). On normal exit, the timer is cleared and the full output is parsed.

### 4.6 Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `vibeswitch.projectProgress.acceptanceTests.enabled` | boolean | `true` | Whether to create the acceptance tests deviation client. |
| `vibeswitch.projectProgress.acceptanceTests.command` | string | `npm test` | Command to run (e.g. `npm test`, `yarn test`, `npx jest`). |
| `vibeswitch.projectProgress.acceptanceTests.timeoutMs` | number | 60000 | Timeout in milliseconds (min 5000). |

### 4.7 Wiring and consumers

- **Composition:** When `projectProgress.acceptanceTests.enabled` is true, `compositionRoot.js` creates `acceptanceTestsDeviationClient` with `getWorkspaceRoot`, `getCommand`, `getTimeoutMs`, and `loggerPort`. This client is passed into `createProjectProgressService` as `acceptanceTestsDeviationClient`.
- **Dashboard and research:** Same pattern: `projectProgressClient.fetchMeasures()` provides `acceptanceTestsDeviation`; dashboard shows “Acceptance tests”, research includes it in the ingest payload.

---

## 5. Aggregation: Project Progress Service

### 5.1 Role

The **project progress service** does not fetch data itself. It holds references to up to three clients (plan, Jira sprint, acceptance tests) and aggregates their results into a single shape.

- **Module:** `business_modules/awareness/app/usage/projectProgressService.js`
- **API:** `createProjectProgressService(opts)` with optional `planDeviationClient`, `jiraSprintDeviationClient`, `acceptanceTestsDeviationClient`, and `loggerPort`. Returns `{ fetchMeasures }`.

### 5.2 fetchMeasures() behavior

- **Return shape:** `{ planDeviation: number|null, scheduleDeviation: number|null, acceptanceTestsDeviation: number|null }`.
- **Defaults:** Each key is `null` if the corresponding client is missing or if its `fetchMeasures()` returns null or a value without a numeric `deviation0To100`.
- **Execution:** For each present client, `fetchMeasures()` is awaited; the numeric `deviation0To100` is assigned to the corresponding key (`planDeviation`, `scheduleDeviation`, `acceptanceTestsDeviation`). Exceptions are caught and logged; that measure remains `null`.

So the service always returns an object with exactly three keys; each is either a number 0–100 or null.

---

## 6. Data flow summary

```
Workspace (folder, PLAN.md, npm test)
    +
Jira Cloud (when enabled: baseUrl, boardId, email + apiToken)
    ↓
planDeviationClient.fetchMeasures()     → planDeviation (0–100 or null)
jiraSprintDeviationClient.fetchMeasures() → scheduleDeviation (0–100 or null)
acceptanceTestsDeviationClient.fetchMeasures() → acceptanceTestsDeviation (0–100 or null)
    ↓
projectProgressClient.fetchMeasures()   → { planDeviation, scheduleDeviation, acceptanceTestsDeviation }
    ↓
├── Dashboard: buildDashboardPayload() → payload.projectProgressMeasures → ProjectProcessSection (3 gauges)
└── Research: gatherResearchPayload()   → payload.projectProgressMeasures → POST /ingest (research agent)
```

---

## 7. Key file reference

| Concern | File(s) |
|--------|--------|
| Plan deviation (checkbox parsing, file read) | `business_modules/awareness/app/usage/planDeviationClient.js` |
| Schedule deviation (Jira Agile REST) | `business_modules/awareness/app/usage/jiraSprintDeviationClient.js` |
| Acceptance tests deviation (spawn, parse stdout) | `business_modules/awareness/app/usage/acceptanceTestsDeviationClient.js` |
| Aggregation | `business_modules/awareness/app/usage/projectProgressService.js` |
| Wiring (config, workspace root, secrets) | `compositionRoot.js` (project progress block) |
| Config schema | `package.json` (vibeswitch.projectProgress.*) |
| Dashboard payload and UI | `ui/dashboardDisplay.js`, `dashboard-app/src/ProjectProcessSection.jsx` |
| Research payload | `business_modules/research/app/ResearchDataService.js` (gatherResearchPayload) |
| Unit tests | `tests/business_modules/awareness/app/usage/planDeviationClient.test.js`, `projectProgressService.test.js`, `acceptanceTestsDeviationClient.test.js` |

---

## 8. Design notes

- **Current state only:** All three measures are recomputed on each request; no persistence of historical values in these clients. The research module may persist the aggregated `projectProgressMeasures` in SQLite as part of the full payload and send current + history to the agent for trend/correlation analysis.
- **Failure semantics:** Any client that fails (missing config, I/O error, API error, parse failure) contributes `null` for its deviation; the other two can still be present.
- **Plan as single file:** Plan is one file; there is no multi-file or multi-doc plan aggregation.
- **Jira opt-in:** Schedule is off by default (`jira.enabled: false`) and requires Jira Cloud base URL, board ID, and credentials.
- **Test runner agnostic:** Acceptance tests deviation is parser-based; support for more runners can be added by extending `parseTestOutput` or adding runner-specific parsers.
