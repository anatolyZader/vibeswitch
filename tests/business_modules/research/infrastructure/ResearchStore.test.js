/**
 * Tests: ResearchStore persist, getPayloadForAgent, and schema.
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const { createResearchStore, SCHEMA } = require('../../../../business_modules/research/infrastructure/ResearchStore');

function tempDbPath() {
    const dir = path.join(os.tmpdir(), `research-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'research.db');
}

describe('ResearchStore', () => {
    test('SCHEMA defines ingest_payloads and sonar_snapshots tables', () => {
        expect(SCHEMA).toContain('CREATE TABLE IF NOT EXISTS ingest_payloads');
        expect(SCHEMA).toContain('CREATE TABLE IF NOT EXISTS sonar_snapshots');
        expect(SCHEMA).toContain('payload_json');
    });

    test('persist inserts payload without sonarMeasures', async () => {
        const dbPath = tempDbPath();
        const store = await createResearchStore(dbPath);
        const payload = {
            timestamp: 1000,
            source: 'test',
            currentMode: 'dev',
            scoreData: { total: 50 },
            sonarMeasures: null
        };
        await store.persist(payload);
        const { current, history } = await store.getPayloadForAgent({ lastDays: 7, lastN: 50 });
        expect(current).not.toBeNull();
        expect(current.timestamp).toBe(1000);
        expect(current.scoreData).toEqual({ total: 50 });
        expect(history).toHaveLength(0);
        store.close();
    });

    test('persist inserts payload with sonarMeasures and creates sonar_snapshot', async () => {
        const dbPath = tempDbPath();
        const store = await createResearchStore(dbPath);
        const payload = {
            timestamp: 2000,
            source: 'test',
            currentMode: 'dev',
            scoreData: null,
            sonarMeasures: {
                bugs: 1,
                vulnerabilities: 0,
                code_smells: 5,
                duplicated_lines_density: 2.1,
                coverage: 80,
                ncloc: 1000,
                sonarApiAvailable: true
            }
        };
        await store.persist(payload);
        const { current } = await store.getPayloadForAgent({ lastDays: 7, lastN: 50 });
        expect(current).not.toBeNull();
        expect(current.sonarMeasures.bugs).toBe(1);
        expect(current.sonarMeasures.sonarApiAvailable).toBe(true);
        store.close();
    });

    test('getPayloadForAgent returns current as latest and history in descending order', async () => {
        const dbPath = tempDbPath();
        const store = await createResearchStore(dbPath);
        await store.persist({ timestamp: 100, source: 'a', currentMode: 'dev' });
        await store.persist({ timestamp: 200, source: 'b', currentMode: 'dev' });
        await store.persist({ timestamp: 300, source: 'c', currentMode: 'dev' });
        const { current, history } = await store.getPayloadForAgent({ lastDays: 7, lastN: 50 });
        expect(current).not.toBeNull();
        expect(current.timestamp).toBe(300);
        expect(current.source).toBe('c');
        expect(history).toHaveLength(2);
        expect(history[0].timestamp).toBe(200);
        expect(history[1].timestamp).toBe(100);
        store.close();
    });

    test('getPayloadForAgent respects lastN', async () => {
        const dbPath = tempDbPath();
        const store = await createResearchStore(dbPath);
        for (let i = 0; i < 5; i++) {
            await store.persist({ timestamp: 100 + i, source: `s${i}`, currentMode: 'dev' });
        }
        const { current, history } = await store.getPayloadForAgent({ lastDays: 7, lastN: 3 });
        expect(current).not.toBeNull();
        expect(current.timestamp).toBe(104);
        expect(history).toHaveLength(3);
        expect(history.map((p) => p.timestamp)).toEqual([103, 102, 101]);
        store.close();
    });

    test('close saves and closes db', async () => {
        const dbPath = tempDbPath();
        const store = await createResearchStore(dbPath);
        await store.persist({ timestamp: 1, source: 'x', currentMode: 'dev' });
        store.close();
        const store2 = await createResearchStore(dbPath);
        const { current } = await store2.getPayloadForAgent({ lastDays: 7, lastN: 10 });
        expect(current).not.toBeNull();
        expect(current.source).toBe('x');
        store2.close();
    });
});
