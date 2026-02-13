/**
 * ResearchDbAdapter: SQLite persistence for research time-series and analysis results.
 * Uses sql.js (pure JS) for cross-platform compatibility.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const RESEARCH_DIR = path.join(os.homedir(), '.vibeswitch', 'research');
const DEFAULT_DB_PATH = path.join(RESEARCH_DIR, 'research.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS time_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  session_id TEXT,
  measure_name TEXT NOT NULL,
  value REAL NOT NULL,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_ts_timestamp ON time_series(timestamp);
CREATE INDEX IF NOT EXISTS idx_ts_measure ON time_series(measure_name);

CREATE TABLE IF NOT EXISTS analysis_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  method TEXT NOT NULL,
  design TEXT,
  equations TEXT,
  findings TEXT,
  p_values_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ar_run ON analysis_results(run_id);

CREATE TABLE IF NOT EXISTS literature_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  sources_json TEXT,
  summary TEXT,
  relevance TEXT
);
CREATE INDEX IF NOT EXISTS idx_ls_date ON literature_summaries(date);
`;

/**
 * @param {string} [dbPath]
 * @returns {Promise<ResearchDbAdapter>}
 */
async function createResearchDbAdapter(dbPath) {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();

    const targetPath = dbPath || DEFAULT_DB_PATH;
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    let db;
    if (fs.existsSync(targetPath)) {
        const buffer = fs.readFileSync(targetPath);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    db.exec(SCHEMA);

    return new ResearchDbAdapter(db, targetPath);
}

class ResearchDbAdapter {
    constructor(db, dbPath) {
        this._db = db;
        this._dbPath = dbPath;
    }

    _save() {
        const data = this._db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this._dbPath, buffer);
    }

    /**
     * @param {{ timestamp: string, sessionId?: string, measureName: string, value: number, metadata?: object }}
     */
    insertTimeSeries({ timestamp, sessionId, measureName, value, metadata }) {
        const metadataJson = metadata ? JSON.stringify(metadata) : null;
        this._db.run(
            'INSERT INTO time_series (timestamp, session_id, measure_name, value, metadata_json) VALUES (?, ?, ?, ?, ?)',
            [timestamp, sessionId || null, measureName, value, metadataJson]
        );
        this._save();
    }

    /**
     * @param {{ measureNames?: string[], since?: string, limit?: number }}
     * @returns {Array<{ timestamp: string, session_id: string|null, measure_name: string, value: number }>}
     */
    queryTimeSeries({ measureNames, since, limit }) {
        let sql = 'SELECT timestamp, session_id, measure_name, value FROM time_series WHERE 1=1';
        const params = [];

        if (since) {
            sql += ' AND timestamp >= ?';
            params.push(since);
        }
        if (measureNames && measureNames.length > 0) {
            sql += ' AND measure_name IN (' + measureNames.map(() => '?').join(',') + ')';
            params.push(...measureNames);
        }
        sql += ' ORDER BY timestamp ASC';
        if (limit && limit > 0) {
            sql += ' LIMIT ?';
            params.push(limit);
        }

        const stmt = this._db.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
            const row = stmt.getAsObject();
            rows.push({
                timestamp: row.timestamp,
                session_id: row.session_id,
                measure_name: row.measure_name,
                value: row.value
            });
        }
        stmt.free();
        return rows;
    }

    /**
     * @param {{ runId: string, method: string, design?: string, equations?: string, findings?: string, pValues?: object }}
     */
    insertAnalysisResult({ runId, method, design, equations, findings, pValues }) {
        const pValuesJson = pValues ? JSON.stringify(pValues) : null;
        const createdAt = new Date().toISOString();
        this._db.run(
            'INSERT INTO analysis_results (run_id, method, design, equations, findings, p_values_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [runId, method, design || null, equations || null, findings || null, pValuesJson, createdAt]
        );
        this._save();
    }

    /**
     * @param {{ date: string, sources?: object[], summary?: string, relevance?: string }}
     */
    insertLiteratureSummary({ date, sources, summary, relevance }) {
        const sourcesJson = sources ? JSON.stringify(sources) : null;
        this._db.run(
            'INSERT INTO literature_summaries (date, sources_json, summary, relevance) VALUES (?, ?, ?, ?)',
            [date, sourcesJson, summary || null, relevance || null]
        );
        this._save();
    }

    close() {
        this._save();
        this._db.close();
    }
}

module.exports = {
    createResearchDbAdapter,
    RESEARCH_DIR,
    DEFAULT_DB_PATH
};
