/**
 * ResearchStore - Centralized SQLite persistence for research ingest history.
 * Stores full payloads and flattened sonar_snapshots for querying. Used by ResearchDataService
 * to persist every gather and to build payloads (current + history) for the research agent.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_DB_DIR = path.join(os.homedir(), '.vibeswitch', 'research');
const DEFAULT_DB_PATH = path.join(DEFAULT_DB_DIR, 'research.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ingest_payloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at TEXT NOT NULL,
  timestamp INTEGER,
  source TEXT,
  current_mode TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ingest_received ON ingest_payloads(received_at);
CREATE INDEX IF NOT EXISTS idx_ingest_timestamp ON ingest_payloads(timestamp);

CREATE TABLE IF NOT EXISTS sonar_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at TEXT NOT NULL,
  payload_id INTEGER,
  bugs REAL,
  vulnerabilities REAL,
  code_smells REAL,
  duplicated_lines_density REAL,
  coverage REAL,
  ncloc REAL,
  sonar_api_available INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (payload_id) REFERENCES ingest_payloads(id)
);
CREATE INDEX IF NOT EXISTS idx_sonar_received ON sonar_snapshots(received_at);
`;

/**
 * Create the research store (async; loads sql.js and opens or creates DB).
 * @param {string} [dbPath] - Path to SQLite file. Default: ~/.vibeswitch/research/research.db
 * @param {{ loggerPort?: { error?: (msg: string, err?: Error) => void } }} [opts]
 * @returns {Promise<{ persist: (payload: Object) => Promise<void>, getPayloadForAgent: (opts?: { lastDays?: number, lastN?: number }) => Promise<{ current: Object|null, history: Object[] }>, close: () => void }>}
 */
async function createResearchStore(dbPath, opts) {
    const logger = opts && opts.loggerPort;
    const targetPath = dbPath || DEFAULT_DB_PATH;
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();

    let db;
    if (fs.existsSync(targetPath)) {
        try {
            const buffer = fs.readFileSync(targetPath);
            db = new SQL.Database(buffer);
        } catch (err) {
            if (logger && logger.error) logger.error('ResearchStore: failed to load DB', err);
            db = new SQL.Database();
        }
    } else {
        db = new SQL.Database();
    }

    db.exec(SCHEMA);

    function save() {
        try {
            const data = db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(targetPath, buffer);
        } catch (err) {
            if (logger && logger.error) logger.error('ResearchStore: failed to save DB', err);
        }
    }

    /**
     * Persist one ingest payload and optional flattened sonar row.
     * @param {Object} payload - Full payload (timestamp, source, scoreData, sonarMeasures, etc.)
     */
    async function persist(payload) {
        const receivedAt = new Date().toISOString();
        const payloadJson = JSON.stringify(payload);

        db.run(
            'INSERT INTO ingest_payloads (received_at, timestamp, source, current_mode, payload_json) VALUES (?, ?, ?, ?, ?)',
            [
                receivedAt,
                payload.timestamp != null ? payload.timestamp : null,
                payload.source || null,
                payload.currentMode || null,
                payloadJson
            ]
        );
        const row = db.exec('SELECT last_insert_rowid() as id');
        const payloadId = row.length && row[0].values[0] ? row[0].values[0][0] : null;

        const sonar = payload.sonarMeasures;
        if (sonar && typeof sonar === 'object') {
            db.run(
                'INSERT INTO sonar_snapshots (received_at, payload_id, bugs, vulnerabilities, code_smells, duplicated_lines_density, coverage, ncloc, sonar_api_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    receivedAt,
                    payloadId,
                    sonar.bugs != null ? sonar.bugs : null,
                    sonar.vulnerabilities != null ? sonar.vulnerabilities : null,
                    sonar.code_smells != null ? sonar.code_smells : null,
                    sonar.duplicated_lines_density != null ? sonar.duplicated_lines_density : null,
                    sonar.coverage != null ? sonar.coverage : null,
                    sonar.ncloc != null ? sonar.ncloc : null,
                    sonar.sonarApiAvailable === true ? 1 : 0
                ]
            );
        }

        save();
    }

    /**
     * Read from store and build payload for the agent: { current: latest, history: [...] }.
     * @param {{ lastDays?: number, lastN?: number }} [opts] - lastDays: include rows from last N days (default 7). lastN: max number of history rows (default 50).
     * @returns {Promise<{ current: Object|null, history: Object[] }>}
     */
    async function getPayloadForAgent(opts) {
        const lastDays = opts && opts.lastDays != null ? opts.lastDays : 7;
        const lastN = opts && opts.lastN != null ? opts.lastN : 50;

        const since = new Date(Date.now() - lastDays * 24 * 60 * 60 * 1000).toISOString();
        const stmt = db.prepare(
            'SELECT id, payload_json, received_at FROM ingest_payloads WHERE received_at >= ? ORDER BY received_at DESC LIMIT ?'
        );
        stmt.bind([since, lastN + 1]);
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.get());
        }
        stmt.free();

        const parsed = rows.map((row) => {
            try {
                return JSON.parse(row[1]);
            } catch (_) {
                return null;
            }
        }).filter(Boolean);

        const current = parsed.length > 0 ? parsed[0] : null;
        const history = parsed.length > 1 ? parsed.slice(1) : [];
        return { current, history };
    }

    function close() {
        save();
        db.close();
    }

    return { persist, getPayloadForAgent, close };
}

module.exports = {
    createResearchStore,
    DEFAULT_DB_PATH,
    DEFAULT_DB_DIR,
    SCHEMA
};
