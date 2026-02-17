/**
 * SonarCloud Web API client - Fetches project measures for research/dashboard.
 * Read-only; assumes analysis is done in CI or manually. Uses Bearer token auth.
 */

const DEFAULT_BASE_URL = 'https://sonarcloud.io/api';
const METRIC_KEYS = 'bugs,vulnerabilities,code_smells,duplicated_lines_density,coverage,ncloc';

/**
 * Parse Sonar measures API response into a flat object.
 * @param {Object} data - JSON response from api/measures/component
 * @returns {{ bugs: number, vulnerabilities: number, code_smells: number, duplicated_lines_density: number, coverage: number, ncloc: number }}
 */
function parseMeasuresResponse(data) {
    const out = {
        bugs: 0,
        vulnerabilities: 0,
        code_smells: 0,
        duplicated_lines_density: 0,
        coverage: 0,
        ncloc: 0
    };
    if (!data || typeof data !== 'object') return out;
    const component = data.component || data;
    const measures = component.measures || [];
    if (!Array.isArray(measures)) return out;
    for (const m of measures) {
        const key = m.metric;
        const val = m.value != null ? m.value : (m.period && m.period.value != null ? m.period.value : null);
        if (key && (typeof val === 'number' || (typeof val === 'string' && /^[\d.]+$/.test(val)))) {
            const num = typeof val === 'number' ? val : parseFloat(val);
            if (key in out) out[key] = num;
        }
    }
    return out;
}

/**
 * Create a SonarCloud API client.
 * @param {Object} opts - { getToken: () => Promise<string|null>, getProjectKey: () => Promise<string|null>, getBranch: () => Promise<string|null|undefined>, baseUrl?: string, loggerPort?: { error } }
 * @returns {{ fetchMeasures: () => Promise<{ bugs: number, vulnerabilities: number, code_smells: number, duplicated_lines_density: number, coverage: number, ncloc: number, sonarApiAvailable: boolean }> }}
 */
function createSonarCloudClient(opts) {
    const getToken = opts && opts.getToken ? opts.getToken : async () => null;
    const getProjectKey = opts && opts.getProjectKey ? opts.getProjectKey : async () => null;
    const getBranch = opts && opts.getBranch ? opts.getBranch : async () => undefined;
    const baseUrl = (opts && opts.baseUrl) || DEFAULT_BASE_URL;
    const logger = opts && opts.loggerPort ? opts.loggerPort : null;

    /**
     * Fetch project measures from SonarCloud.
     * @returns {Promise<{ bugs: number, vulnerabilities: number, code_smells: number, duplicated_lines_density: number, coverage: number, ncloc: number, sonarApiAvailable: boolean }>}
     */
    async function fetchMeasures() {
        const token = await getToken().catch(() => null);
        const projectKey = await getProjectKey().catch(() => null);
        if (!token || typeof token !== 'string' || !projectKey || typeof projectKey !== 'string') {
            return {
                bugs: 0,
                vulnerabilities: 0,
                code_smells: 0,
                duplicated_lines_density: 0,
                coverage: 0,
                ncloc: 0,
                sonarApiAvailable: false
            };
        }
        const branch = await getBranch().catch(() => undefined);
        const url = new URL(`${baseUrl.replace(/\/$/, '')}/measures/component`);
        url.searchParams.set('component', projectKey);
        url.searchParams.set('metricKeys', METRIC_KEYS);
        if (branch && typeof branch === 'string' && branch.trim()) {
            url.searchParams.set('branch', branch.trim());
        }
        try {
            const res = await fetch(url.toString(), {
                method: 'GET',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.status === 429) {
                if (logger && logger.error) logger.error('SonarCloud API rate limited (429)');
                return {
                    bugs: 0,
                    vulnerabilities: 0,
                    code_smells: 0,
                    duplicated_lines_density: 0,
                    coverage: 0,
                    ncloc: 0,
                    sonarApiAvailable: false
                };
            }
            if (res.status === 404 || !res.ok) {
                if (logger && logger.error) logger.error('SonarCloud API non-OK', res.status);
                return {
                    bugs: 0,
                    vulnerabilities: 0,
                    code_smells: 0,
                    duplicated_lines_density: 0,
                    coverage: 0,
                    ncloc: 0,
                    sonarApiAvailable: false
                };
            }
            const data = await res.json().catch(() => ({}));
            const measures = parseMeasuresResponse(data);
            return {
                ...measures,
                sonarApiAvailable: true
            };
        } catch (err) {
            if (logger && logger.error) logger.error('SonarCloud API fetch failed', err);
            return {
                bugs: 0,
                vulnerabilities: 0,
                code_smells: 0,
                duplicated_lines_density: 0,
                coverage: 0,
                ncloc: 0,
                sonarApiAvailable: false
            };
        }
    }

    return { fetchMeasures };
}

module.exports = {
    createSonarCloudClient,
    parseMeasuresResponse,
    DEFAULT_BASE_URL,
    METRIC_KEYS
};
