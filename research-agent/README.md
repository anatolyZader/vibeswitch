# Research Analysis Agent (Fastify / Google Cloud Run)

This service is **stateless**: it receives payloads from the VibeSwitch extension and performs calculations and analysis on the provided data. The extension persists data locally (SQLite) and sends `{ current, history }` on each call; the agent does not persist anything.

## Contract: Ingest payload

The extension POSTs to `POST /ingest` with a JSON body:

- `current` – Latest full payload (timestamp, source, scoreData, antipatternBreakdown, tokenUsage, sonarMeasures, eslintMeasures, etc.)
- `history` – Array of past payloads (same shape), from the extension's SQLite store (e.g. last 7 days, up to N rows)

Each payload item may include: timestamp, source, currentMode, scoreData, antipatternBreakdown, tokenUsage, sonarMeasures, eslintMeasures, projectProgressMeasures.

Optional: `Authorization: Bearer <token>` (extension can set vibeswitch.research.agentApiKey).

## Response

- 200 – Body includes `accepted: true`, `timestamp`, `pointsUsed`, and optionally `findings`.

### Findings (profound statistics)

When the agent has at least 2 time points it returns **basic** findings (latest vs average) for `sonar.bugs` and `scoreData.total`. When it has at least 3 time points it also computes:

- **Correlations** (Pearson): e.g. awareness score vs Sonar bugs, token usage vs ESLint errors, score vs ESLint errors, comprehension-debt risk vs code smells. Only reported when |r| ≥ 0.3.
- **Regression**: simple linear regression of `scoreData.total` on `sonar.bugs` (slope and intercept; interpretation in text).
- **Trends**: direction (improving / stable / degrading) over time for `scoreData.total`, `sonar.bugs`, `eslintMeasures.errorCount`, and `projectProgressMeasures.planDeviation`.

Finding shapes:

- Basic: `{ metric, latest, average, sampleSize }`
- Correlation: `{ type: 'correlation', x, y, correlation, sampleSize, interpretation }`
- Regression: `{ type: 'regression', predictor, outcome, slope, intercept, sampleSize, interpretation }`
- Trend: `{ type: 'trend', metric, slope, direction, sampleSize, interpretation }`

- 4xx/5xx – Extension will log and retry on next poll

## Deployment (Google Cloud Run)

Build and push a container that runs this Fastify app. Set the service URL in the extension: `vibeswitch.research.agentUrl`. Enable research: `vibeswitch.research.enabled: true`.
