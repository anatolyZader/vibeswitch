/**
 * Fetches recent posts from X (Twitter) for configured accounts (e.g. @karpathy).
 * Uses Twitter API v2: user by username -> user id -> tweets. Requires Bearer token in getBearerToken().
 * Returns normalized items: { title, link, summary, source, date }.
 */

const TWITTER_API_BASE = 'https://api.twitter.com/2';

/**
 * Resolve username to user id.
 * @param {string} username - e.g. 'karpathy'
 * @param {(url: string, opts?: RequestInit) => Promise<Response>} fetchFn
 * @param {string} bearerToken
 * @returns {Promise<string|null>}
 */
async function getUserIdByUsername(username, fetchFn, bearerToken) {
    const url = `${TWITTER_API_BASE}/users/by/username/${encodeURIComponent(username)}`;
    const res = await fetchFn(url, {
        headers: { Authorization: `Bearer ${bearerToken}` }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data && data.data && data.data.id) ? data.data.id : null;
}

/**
 * Fetch recent tweets for a user id.
 * @param {string} userId
 * @param {(url: string, opts?: RequestInit) => Promise<Response>} fetchFn
 * @param {string} bearerToken
 * @param {number} maxResults
 * @returns {Promise<Array<{ id: string, text: string, created_at: string }>>}
 */
async function getUserTweets(userId, fetchFn, bearerToken, maxResults = 10) {
    const url = `${TWITTER_API_BASE}/users/${userId}/tweets?max_results=${Math.min(maxResults, 10)}&tweet.fields=created_at`;
    const res = await fetchFn(url, {
        headers: { Authorization: `Bearer ${bearerToken}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    const tweets = (data && data.data) ? data.data : [];
    return tweets.map((t) => ({ id: t.id, text: t.text || '', created_at: t.created_at || '' }));
}

/**
 * Fetch X (Twitter) insights for configured usernames (e.g. @karpathy).
 * @param {{ usernames?: string[], getBearerToken?: () => Promise<string|null>, maxPerUser?: number, fetchFn?: (url: string, opts?: RequestInit) => Promise<Response> }} [opts]
 * @returns {Promise<Array<{ title: string, link: string, summary: string, source: string, date: string }>>}
 */
async function fetchX(opts = {}) {
    const usernames = (opts && opts.usernames) && opts.usernames.length ? opts.usernames : ['karpathy'];
    const getBearerToken = (opts && opts.getBearerToken) || (async () => null);
    const maxPerUser = (opts && opts.maxPerUser) != null ? opts.maxPerUser : 5;
    const fetchFn = (opts && opts.fetchFn) || (typeof fetch === 'function' ? fetch : null);
    const token = await getBearerToken().catch(() => null);
    if (!token || !fetchFn) {
        return [];
    }
    const items = [];
    for (const username of usernames) {
        const userId = await getUserIdByUsername(username, fetchFn, token);
        if (!userId) continue;
        const tweets = await getUserTweets(userId, fetchFn, token, maxPerUser);
        for (const t of tweets) {
            items.push({
                title: `@${username}: ${(t.text || '').slice(0, 80)}${t.text && t.text.length > 80 ? '…' : ''}`,
                link: `https://x.com/${username}/status/${t.id}`,
                summary: (t.text || '').slice(0, 500),
                source: 'x',
                date: t.created_at || ''
            });
        }
    }
    return items;
}

module.exports = {
    fetchX,
    getUserIdByUsername,
    getUserTweets
};
