# Spec: Report business module

Report business module for the Vibeswitch extension: receive report data from the research module and publish it to X.com, LinkedIn, and Medium.

**Principle:** A great spec defines not only functional requirements but **how those requirements will be tested**. Include edge cases, input-output pairs, and success criteria. That gives the agent everything it needs to produce meaningful tests—and you get exactly what you want covered.

---

## Contract

- **Name:** Report module — application service and ports for publishing report content to social platforms.
- **Signature / API:**
  - **ReportService:** `publishReport(input: ReportInput): Promise<PublishReportResult>`
  - **ReportInput:** `{ content?: string, contentPath?: string, platforms?: Platform[] }` — either `content` (in-memory) or `contentPath` (path to file to read) must be set; `platforms` defaults to `['x', 'linkedin', 'medium']`.
  - **PublishReportResult:** `{ ok: boolean, results: PlatformResult[], error?: string }` — one `PlatformResult` per requested platform: `{ platform, ok: boolean, publishedId?: string, error?: string }`.
  - **Ports:** `IReportContentSourcePort.read(path: string): Promise<string>`; `IReportPublishPort.publish(content: string, options?: PublishOptions): Promise<PublishOutcome>`.
- **Location:**
  - App: `business_modules/report/app/reportService.js`
  - Input: `business_modules/report/input/reportController.js` (optional; command/event handler that calls service)
  - Domain ports: `business_modules/report/domain/ports/IReportContentSourcePort.js`, `business_modules/report/domain/ports/IReportPublishPort.js`
  - Adapters: `business_modules/report/infrastructure/adapters/reportXAdapter.js`, `reportLinkedInAdapter.js`, `reportMediumAdapter.js`, `reportFsContentSourceAdapter.js` (optional)

---

## Naming (optional)

- **Function / module / API:** camelCase for functions and file names; PascalCase for domain types.
- **Parameters and options:** camelCase: `reportInput`, `platforms`, `contentPath`, `PublishReportResult`, `PlatformResult`.
- **Business module:** File names camelCase (`reportService.js`, `reportController.js`). Domain: PascalCase (`ReportInput`, `PlatformResult`, `PublishReportResult`, `ReportPublished`).
  - **Ports:** `IReportContentSourcePort`, `IReportPublishPort`. Files: `domain/ports/IReportContentSourcePort.js`, `domain/ports/IReportPublishPort.js`.
  - **Adapters:** `reportXAdapter.js`, `reportLinkedInAdapter.js`, `reportMediumAdapter.js`, `reportFsContentSourceAdapter.js` in `infrastructure/adapters/`.

---

## Business module (optional)

- **Module name:** `report`
- **Domain model (DDD):**
  - **Entities:** (None required for MVP; report is stateless publish flow.)
  - **Aggregates / aggregate roots:** (None for MVP.)
  - **Value objects:** `ReportInput` (content or contentPath + optional platforms), `PlatformResult` (platform, ok, publishedId?, error?), `PublishReportResult` (ok, results[], error?), `PublishOutcome` (ok, publishedId?, error?). Platform: `'x' | 'linkedin' | 'medium'`.
  - **Domain events:** `ReportPublished` (optional) — content published to a platform; can be emitted by app service for downstream listeners.
  - **Ports:**
    - **IReportContentSourcePort** — read report content from a source (e.g. file path). Method: `read(path: string): Promise<string>`. Implemented by `reportFsContentSourceAdapter.js` (read file from path).
    - **IReportPublishPort** — publish text content to one platform. Method: `publish(content: string, options?: { platform?: Platform }): Promise<PublishOutcome>`. Implemented by `reportXAdapter.js`, `reportLinkedInAdapter.js`, `reportMediumAdapter.js` (each adapter is bound to one platform).

---

## Input / Output (and behavior)

| Input | Expected output / behavior |
|-------|-----------------------------|
| `{ content: "Hello world" }` | `{ ok: true, results: [ { platform: 'x', ok: true, ... }, { platform: 'linkedin', ok: true, ... }, { platform: 'medium', ok: true, ... } ] }` (all three adapters invoked; exact publishedId depends on adapter) |
| `{ content: "Hello", platforms: ['x'] }` | `{ ok: true, results: [ { platform: 'x', ok: true, ... } ] }` — only X adapter invoked |
| `{ contentPath: "/path/to/report.md" }` and content source returns `"# Report"` | Same as first row: content resolved via IReportContentSourcePort, then published to all three |
| `{ contentPath: "/path/to/report.md" }` and content source throws | `{ ok: false, results: [], error: "..." }` — no publish calls |
| `{ content: "Hello" }` and one adapter (e.g. LinkedIn) fails | `{ ok: false, results: [ { platform: 'x', ok: true }, { platform: 'linkedin', ok: false, error: "..." }, { platform: 'medium', ok: true } ], error?: "..." }` — partial success; results reflect per-platform outcome |
| `{}` (no content, no contentPath) | `{ ok: false, results: [], error: "Missing content or contentPath" }` (or equivalent validation error) |
| `{ content: "", platforms: ["x"] }` | Service may accept (adapter may reject) or reject with validation error; spec: allow empty string and let adapter decide — result per platform |

---

## Edge cases and corner cases

- **Edge cases:** Empty string `content`; `contentPath` pointing to missing file; `contentPath` pointing to empty file; `platforms` empty array (no-op: `{ ok: true, results: [] }`); `platforms` with duplicate entries (dedupe and publish once per platform); very long content (platform character limits — adapters may truncate or fail; document in adapter contract); Unicode and special characters in content.
- **Corner cases:** Both `content` and `contentPath` set (prefer `content` and ignore `contentPath`, or reject with validation error — spec: prefer `content`); one platform fails mid-way (other platforms still attempted; result aggregates all); content source throws after partial publish (already-published platforms remain in results; error recorded).

---

## Error cases

- **Validation:** Missing both `content` and `contentPath` → return `{ ok: false, results: [], error: "..." }` (no throw).
- **Content source:** `contentPath` given but IReportContentSourcePort.read throws (e.g. file not found) → return `{ ok: false, results: [], error: "..." }` (or propagate; spec: catch and return result with error message).
- **Invalid types:** `content` not a string when provided → treat as validation error and return failed result.
- **Invalid platform name:** Unknown value in `platforms` (e.g. `'twitter'`) → skip that entry or return validation error; spec: skip unknown platforms and only invoke known adapters.

---

## Invariants

- **Idempotency:** Calling `publishReport` twice with the same input may result in two separate posts on each platform (no implicit dedupe unless adapter/platform supports it).
- **Side effects:** Publishing is a side effect; each adapter performs I/O (network). Service does not mutate ReportInput.
- **Determinism:** For the same input and same adapter responses, output shape is deterministic; order of `results` is defined (e.g. same order as `platforms` or fixed order).

---

## Success criteria (how this will be tested)

- **Pass:** All input/output pairs in the table above pass; validation errors return failed result object (no unhandled throw); partial failure returns `ok: false` with per-platform results; empty `platforms` returns success with empty results.
- **Coverage:** Every row in Input/Output; edge cases (empty content, missing file, empty platforms, duplicates); error cases (validation, content source throw, single adapter failure); port methods called with expected arguments when mocked.
- **Test fails when:** Service throws on invalid input instead of returning failed result; or a platform adapter is invoked when not in `platforms`; or content source is not used when only `contentPath` is provided.

---

## Test levels (optional)

- **Unit (default):** ReportService with mocked IReportContentSourcePort and IReportPublishPort (one mock per platform). Cover: all Input/Output rows, edge cases, error cases; verify correct adapter called per platform and content/contentPath resolution.
- **Integration (optional):** Service + real reportFsContentSourceAdapter with temp file; assert read then publish flow and that adapters receive correct content. Adapters can use injected HTTP/fetch (no real network).
- **E2E:** Not required for this spec.

---

## Test file hint (optional)

- **Unit:** `tests/business_modules/report/app/reportService.test.js`
- **Unit (adapters):** `tests/business_modules/report/infrastructure/adapters/reportXAdapter.test.js`, `reportLinkedInAdapter.test.js`, `reportMediumAdapter.test.js` (each tests adapter in isolation with mocked HTTP/secrets).
