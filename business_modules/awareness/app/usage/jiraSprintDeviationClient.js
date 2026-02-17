/**
 * Jira sprint deviation client - Schedule anchor (dates and terms).
 * Fetches active sprint from Jira Cloud and computes deviation from schedule (story points done vs in sprint).
 */
const https = require('https');
const http = require('http');

function request(url, authHeader) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const opts = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: authHeader || '' }
    };
    const req = mod.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(body));
          else reject(new Error(res.statusCode + ' ' + body.slice(0, 200)));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function createJiraSprintDeviationClient(opts) {
  const getBaseUrl = opts && opts.getBaseUrl ? opts.getBaseUrl : () => '';
  const getBoardId = opts && opts.getBoardId ? opts.getBoardId : () => '';
  const getAuthHeader = opts && opts.getAuthHeader ? opts.getAuthHeader : async () => null;
  const getStoryPointsField = opts && opts.getStoryPointsField ? opts.getStoryPointsField : () => 'customfield_10016';
  const logger = opts && opts.loggerPort ? opts.loggerPort : null;

  async function fetchMeasures() {
    const baseUrl = getBaseUrl();
    const boardId = getBoardId();
    const auth = await getAuthHeader().catch(() => null);
    if (!baseUrl || !boardId || !auth) return null;
    const base = baseUrl.replace(/\/?$/, '');
    const storyField = getStoryPointsField() || 'customfield_10016';
    try {
      const sprints = await request(base + '/rest/agile/1.0/board/' + encodeURIComponent(boardId) + '/sprint?state=active', auth);
      const values = sprints && sprints.values;
      if (!values || values.length === 0) return null;
      const active = values[0];
      const sprintId = active.id;
      const sprintName = active.name || '';
      const issuesRes = await request(base + '/rest/agile/1.0/sprint/' + sprintId + '/issue?fields=status,' + storyField + '&maxResults=200', auth);
      const issues = issuesRes && issuesRes.issues ? issuesRes.issues : [];
      let planned = 0;
      let done = 0;
      for (const issue of issues) {
        const fields = issue.fields || {};
        const sp = fields[storyField];
        const pts = typeof sp === 'number' ? sp : (typeof sp === 'string' && /^\d+(\.\d+)?$/.test(sp) ? parseFloat(sp) : 0);
        if (!isNaN(pts) && pts > 0) planned += pts;
        const status = fields.status;
        const category = status && status.statusCategory ? status.statusCategory.key : '';
        if (category === 'done' && !isNaN(pts) && pts > 0) done += pts;
      }
      if (planned <= 0) return { deviation0To100: 0, storyPointsPlanned: 0, storyPointsDone: 0, sprintName };
      const deviation0To100 = Math.min(100, Math.round(100 * (1 - done / planned)));
      return { deviation0To100, storyPointsPlanned: planned, storyPointsDone: done, sprintName };
    } catch (err) {
      if (logger && logger.error) logger.error('Jira sprint deviation: request failed', err);
      return null;
    }
  }
  return { fetchMeasures };
}

module.exports = { createJiraSprintDeviationClient };
