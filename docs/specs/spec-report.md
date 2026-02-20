# Spec: Report business module (publish research results to Medium, LinkedIn, X.com)

Business module that consumes research results (e.g. daily report markdown or structured insights) produced by the research module and publishes them to Medium, LinkedIn, and X.com. A single publishing port (`IReportPublishPort`) is implemented by different publish adapters (one per platform); the app layer orchestrates publishing and aggregates per-platform outcomes.

**Principle:** A great spec defines not only functional requirements but **how those requirements will be tested**. Include edge cases, input-output pairs, and success criteria so the agent can generate unambiguous tests.

---

## Contract

- **Name:** Report module — `ReportService` (app), two domain ports (publish + content source), publish adapters + content-source adapter (infrastructure).
- **Signature / API:**
  - **App:** `ReportService.publishReport(reportInput, options) => Promise<PublishResult>`  
    - `reportInput`: `{ content: string }` (markdown) or `{ reportPath: string }` (path to report file).  
    - `options`: `{ platforms?: ('medium'|'linkedin'|'x')[], credentials?: PlatformCredentials }` (default: all platforms if credentials present).  
    - Returns: `{ medium?: PlatformResult, linkedin?: PlatformResult, x?: PlatformResult }` where `PlatformResult = { success: boolean, postId?: string, url?: string, error?: string }`. **Error style:** never throw from `publishReport` for user input or adapter failures; return `{ success: false, error }` (per platform or single precondition error).
  - **Domain port (publish):** `IReportPublishPort.publish(content: string, opts?) => Promise<PlatformResult>`. Implemented by one adapter per platform (Medium, LinkedIn, X). The service receives `publishAdapters: { medium, linkedin, x }` and calls the appropriate adapter per requested platform.
  - **Domain port (content source):** `IReportContentSourcePort.read(path: string) => Promise<string>`. Used when `reportInput.reportPath` is provided; keeps app layer from doing fs I/O. Implemented by e.g. `reportFsContentSourceAdapter`.
- **Location:**
  - App: `business_modules/report/app/reportService.js`
  - Domain ports: `business_modules/report/domain/ports/IReportPublishPort.js`, `IReportContentSourcePort.js`
  - Input: `business_modules/report/input/`
  - Infrastructure: `business_modules/report/infrastructure/adapters/` — publish: `reportMediumAdapter.js`, `reportLinkedInAdapter.js`, `reportXAdapter.js`; content source: `reportFsContentSourceAdapter.js`

---

## Business module (optional)

- **Module name:** `report`
- **Domain elements:**  
  - Port: `IReportPublishPort` (`publish(content: string, opts?) => Promise<PlatformResult>`).  
  - Port: `IReportContentSourcePort` (`read(path: string) => Promise<string>`). Used when input is `reportPath`; implemented by `reportFsContentSourceAdapter` (fs).  
  - Infrastructure: publish adapters implement `IReportPublishPort`; content source adapter implements `IReportContentSourcePort`.  
  - App: `ReportService` (orchestration only: resolve content via port when `reportPath`, call publish port per platform, return `PublishResult`; no direct fs/HTTP).

---

## Input / Output (and behavior)

| Input | Expected output / behavior |
|-------|----------------------------|
| `{ content: "## Summary\n\nKey findings..." }`, `{ platforms: ['medium'] }` | `ReportService` calls the Medium publish adapter (via `IReportPublishPort.publish`) with that content; returns `{ medium: { success: true, postId: '…', url: '…' } }` when adapter succeeds. |
| `{ content: "Short post" }`, `{ platforms: ['x'] }` | Calls the X publish adapter via the port; returns `{ x: { success: true, postId: '…', url: '…' } }` when adapter succeeds. |
| `{ content: "..." }`, `{ platforms: ['medium','linkedin','x'] }` | Calls the publish adapter for each platform (same port interface); returns object with `medium`, `linkedin`, `x` keys; each key present with `success: true` or `success: false` and optional `error`. |
| `{ reportPath: "/path/to/2025-02-20.md" }`, options | Service reads file content (via a port or injectable fs), then same behavior as `{ content }` for that content. |
| `{ content: "" }` | Either skip publishing and return empty result, or return results with `success: false` and `error` for each attempted platform (spec: prefer returning per-platform failure with clear error, not throw). |
| `{ content: veryLongText }` for X (e.g. > 280 chars) | X adapter (or service) truncates or splits per platform rules; returns `{ x: { success: true, ... } }` if truncated publish succeeds, or `{ success: false, error: "..." }` if platform rejects. |
| Missing credentials for a platform | For that platform, return `{ [platform]: { success: false, error: 'Missing credentials' } }`; do not throw. |
| Adapter throws (network/auth error) | Catch and return `{ [platform]: { success: false, error: <message> } }`; do not throw from `publishReport`. |

---

## Edge cases

- **Empty content:** `content: ""` or file at `reportPath` is empty → no publish or explicit per-platform failure with reason.
- **Null / undefined:** `content` undefined when using `content` input → treat as error (return failure or throw with clear message); `reportPath` undefined when using `reportPath` → same.
- **Very long content:** Medium/LinkedIn may allow long posts; X has character limit (e.g. 280) → service or X adapter truncates or returns error; spec: truncate with indicator (e.g. "…") and publish.
- **Unicode / special characters:** Content may contain emoji, non-ASCII; adapters must handle encoding; tests use samples with Unicode.
- **Duplicate publish:** Idempotency not required for this spec; calling `publishReport` twice with same content may create two posts; document in invariants.
- **Missing report file:** When `reportPath` is provided and file does not exist → return error in result or throw; spec: prefer `{ error: 'Report file not found', reportPath }` in a generic way (e.g. single error result) and no platform calls.

---

## Error cases

- **Invalid input type:** `content` not a string when using content input → return or throw with clear message; same for `reportPath` not a string.
- **Invalid `platforms`:** Unknown platform in array → ignore or return `success: false` for that key with error "Unknown platform".
- **Failing preconditions:** Missing credentials for a requested platform → `success: false`, `error: 'Missing credentials'` for that platform.
- **Adapter failure:** Network error, 4xx/5xx, rate limit → adapter returns `{ success: false, error: string }`; service propagates in `PublishResult`.
- **File read failure:** When using `reportPath`, fs read fails → fail fast with clear error (no platform publishes).

---

## Invariants

- **Error style:** Never throw from `publishReport` for user input or adapter failures. Return `{ [platform]: { success: false, error: string } }` (or a single error result for preconditions like missing file). Validation errors (e.g. invalid `content` type) also return per-platform or single failure, not throw.
- **No throw from `publishReport` for adapter failures:** All adapter errors are caught and converted to `PlatformResult` with `success: false` and `error`.
- **Result shape:** Return value is always a plain object; keys are only requested platform names; each value is `{ success, postId?, url?, error? }`.
- **Idempotency:** Not required; calling `publishReport` twice with same content may produce two posts per platform.
- **Side effects:** Publishing is a side effect; adapters perform I/O; app layer remains orchestrator-only and does not touch fs or HTTP directly (uses ports). Content from `reportPath` is read via `IReportContentSourcePort` only.

---

## Success criteria (how this will be tested)

- **Pass:**  
  - For each input pair in the table, the actual `PublishResult` matches the expected shape and `success`/`error` as specified.  
  - Empty or invalid content yields no successful publish (or explicit failure per platform).  
  - Missing credentials yield `success: false` with an error message for that platform.  
  - Adapter throw is turned into `success: false` with `error` and does not throw from `publishReport`.
- **Coverage:**  
  - At least one test per row in Input/Output.  
  - Edge cases: empty content, null/undefined content, long content (X truncation), missing file.  
  - Error cases: invalid type, unknown platform, missing credentials, adapter throwing.
- **Test fails when:** `publishReport` throws on adapter failure; or result shape is missing a requested platform key; or `success: true` when credentials are missing.

---

## Test file hint (optional)

- `tests/business_modules/report/app/reportService.test.js` — main behavior and input/output.  
- `tests/business_modules/report/infrastructure/adapters/reportMediumAdapter.test.js` (and reportLinkedInAdapter, reportXAdapter) — each publish adapter implements `IReportPublishPort`; unit tests with **injected/mocked HTTP** (no real network).  
- `tests/business_modules/report/infrastructure/adapters/reportFsContentSourceAdapter.test.js` — content source adapter implements `IReportContentSourcePort`; unit tests with mocked or temp fs.  
- `tests/business_modules/report/domain/` — any value objects (e.g. `PublishResult`) if tested in isolation.
