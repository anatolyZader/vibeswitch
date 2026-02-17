# Research External Agent Contract

Objective code quality data (Sonar, ESLint, token usage, extension metrics) is **gathered and persisted** by the research business module in the extension (SQLite at `~/.vibeswitch/research/research.db`). **Calculations and analysis** are performed by a **stateless** Fastify app (e.g. Google Cloud Run); the agent does not persist data.

## Flow

1. **Extension (research module):** When `vibeswitch.research.enabled` and `vibeswitch.research.agentUrl` are set, the research service periodically gathers a payload, **persists it to local SQLite**, then reads from the store (e.g. last 7 days, last N rows) and POSTs `{ current, history }` to `{agentUrl}/ingest`.
2. **External service (Fastify/Cloud Run):** Receives the payload at `POST /ingest`, **does not persist**; runs analysis on the provided `current` and `history`. Returns 200 with body that may include `findings`, `pointsUsed`.
3. **Extension:** Does not perform analysis; it collects, persists locally, and sends data from the store.

## Payload shape (POST /ingest)

- `current` – Latest full payload (timestamp, source, currentMode, scoreData, antipatternBreakdown, tokenUsage, sonarMeasures, eslintMeasures, etc.).
- `history` – Array of past payloads (same shape), from the extension SQLite (e.g. last 7 days, up to 50 rows). See `research-agent/README.md` and `research-agent/server.js`.

## Configuration

- `vibeswitch.research.enabled` – Turn on research data gathering and sending.
- `vibeswitch.research.agentUrl` – Base URL of the agent (e.g. `https://xxx.run.app`).
- `vibeswitch.research.pollIntervalMs` – How often to send (default 5 min).
- Optional: store API key in secret `vibeswitch.research.agentApiKey` for `Authorization: Bearer` on ingest requests.

## Key files (extension)

- `business_modules/research/app/ResearchDataService.js` – Gathers payload, persists to store, reads current + history, sends via client.
- `business_modules/research/infrastructure/ResearchStore.js` – SQLite persistence (ingest_payloads, sonar_snapshots); `createResearchStore`, `persist`, `getPayloadForAgent`.
- `business_modules/research/infrastructure/ResearchAgentClient.js` – HTTP client for POST /ingest.
- `compositionRoot.js` – Composes research service with getDbPath (default ~/.vibeswitch/research/research.db).
- `extension.js` – Starts researchService on activate, stops on deactivate.
