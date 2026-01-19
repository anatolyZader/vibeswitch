/**
 * AwarenessLLMInsightService
 *
 * Phase A: "semantic labeler" for change batches.
 * - Takes minimal batch metadata (no full files)
 * - Returns a validated InsightBundle (JSON-only contract)
 * - Uses cache + rate limiting + privacy controls
 */

const crypto = require('crypto');
const { normalizeInsight, INSIGHT_SCHEMA } = require('./insightSchema');

class AwarenessLLMInsightService {
    /**
     * @param {Object} deps
     * @param {ILLMClientPort} deps.llmClientPort
     * @param {ILLMConfigPort} deps.configPort
     * @param {ICachePort} deps.cachePort
     * @param {IRateLimiterPort} deps.rateLimiterPort
     * @param {InsightStore} deps.insightStore
     * @param {ILoggerPort|null} deps.loggerPort
     */
    constructor({
        llmClientPort,
        configPort,
        cachePort,
        rateLimiterPort,
        insightStore,
        loggerPort = null
    }) {
        this.llmClientPort = llmClientPort;
        this.configPort = configPort;
        this.cachePort = cachePort;
        this.rateLimiterPort = rateLimiterPort;
        this.insightStore = insightStore;
        this.loggerPort = loggerPort;
    }

    _hash(obj) {
        const s = JSON.stringify(obj);
        return crypto.createHash('sha1').update(s).digest('hex');
    }

    _redact(text) {
        if (!text) return '';
        let out = String(text);
        // Very cheap redactions (best-effort, not perfect).
        out = out.replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*['"][^'"]+['"]/gi, '$1:"[REDACTED]"');
        out = out.replace(/(Bearer\s+)[A-Za-z0-9\-\._~\+\/]+=*/gi, '$1[REDACTED]');
        return out;
    }

    _buildPrompt(batch, cfg) {
        const {
            file,
            classification,
            metrics,
            diffBullets,
            snippet
        } = batch;

        // JSON-only contract. Keep it short and bounded.
        const payload = {
            task: 'Analyze a code change batch and return JSON only matching schema.',
            schema: INSIGHT_SCHEMA,
            input: {
                file,
                classification: {
                    label: classification?.label || 'unknown',
                    confidence: classification?.confidence ?? 0,
                    reasons: Array.isArray(classification?.reasons) ? classification.reasons.slice(0, 10) : []
                },
                metrics,
                diff_bullets: Array.isArray(diffBullets) ? diffBullets.slice(0, cfg.maxDiffBullets || 8) : [],
                snippet: cfg.sendSnippets ? this._redact(snippet || '').slice(0, cfg.snippetCharLimit || 400) : undefined
            },
            rules: [
                'Return JSON only. No markdown, no prose outside JSON.',
                'Do not assume external context; if unsure use "uncertain"/"unknown" with low confidence.',
                'Never include raw code in output.'
            ]
        };

        return JSON.stringify(payload);
    }

    /**
     * Analyze a change batch (async, eventual enrichment).
     *
     * @param {Object} batch
     * @param {string} batch.uri
     * @param {string} batch.file
     * @param {Object} batch.classification
     * @param {Object} batch.metrics
     * @param {string[]} batch.diffBullets
     * @param {string} [batch.snippet]
     * @param {string} [batch.batchId]
     * @returns {Promise<Object|null>} InsightBundle or null
     */
    async analyzeBatch(batch) {
        const cfg = this.configPort?.getConfig?.() || { enabled: false };
        if (!cfg.enabled) return null;

        // Only trigger on AI-labeled or high-signal batches by default.
        const label = batch?.classification?.label;
        const isAI = label === 'ai';
        const inserted = batch?.metrics?.inserted ?? 0;
        const deleted = batch?.metrics?.deleted ?? 0;
        const size = (Number(inserted) || 0) + (Number(deleted) || 0);

        const shouldAnalyze =
            (cfg.triggerOnAI !== false && isAI) ||
            (cfg.triggerOnLargeBatches === true && size >= (cfg.largeBatchThreshold || 800));

        if (!shouldAnalyze) return null;

        const fingerprint = this._hash({
            uri: batch.uri,
            file: batch.file,
            label,
            metrics: batch.metrics,
            diffBullets: cfg.sendDiffBullets ? (batch.diffBullets || []).slice(0, cfg.maxDiffBullets || 8) : []
        });

        const cacheKey = `vibeswitch.llm.insight.v1.${fingerprint}`;
        const cached = await this.cachePort.get(cacheKey);
        if (cached) {
            // Re-emit into store for scoring if needed.
            this.insightStore?.record({ fileUri: batch.uri, insight: cached, batchId: batch.batchId });
            return cached;
        }

        const budgetOk = await this.rateLimiterPort.tryConsume({
            key: 'llm:insight',
            cost: 1
        });
        if (!budgetOk) return null;

        const prompt = this._buildPrompt(batch, cfg);
        let raw;
        try {
            raw = await this.llmClientPort.analyzeBatch({
                prompt,
                schema: INSIGHT_SCHEMA,
                timeoutMs: cfg.timeoutMs || 8000
            });
        } catch (err) {
            if (this.loggerPort?.error) {
                this.loggerPort.error('LLMInsightService: analyzeBatch error', err);
            }
            return null;
        }

        const insight = normalizeInsight(raw);
        if (!insight) return null;

        await this.cachePort.set(cacheKey, insight, { ttlMs: cfg.cacheTtlMs || (24 * 60 * 60 * 1000) });
        this.insightStore?.record({ fileUri: batch.uri, insight, batchId: batch.batchId });

        if (this.loggerPort?.debug) {
            this.loggerPort.debug(`LLMInsightService: insight stored for ${batch.file}`, 'llm:insight');
        }

        return insight;
    }
}

module.exports = AwarenessLLMInsightService;

