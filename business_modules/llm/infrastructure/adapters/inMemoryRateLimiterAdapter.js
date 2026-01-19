/**
 * InMemoryRateLimiterAdapter
 *
 * Simple token budget:
 * - per-minute window
 * - per-day window
 *
 * This is intentionally small and deterministic for extension usage.
 */

class InMemoryRateLimiterAdapter {
    constructor({ maxPerMinute = 6, maxPerDay = 200 } = {}) {
        this.maxPerMinute = maxPerMinute;
        this.maxPerDay = maxPerDay;

        this._minuteWindowStart = 0;
        this._minuteUsed = 0;

        this._dayKey = null;
        this._dayUsed = 0;
    }

    _currentDayKey(now) {
        const d = new Date(now);
        // YYYY-MM-DD (local)
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    async tryConsume({ cost = 1, now = Date.now() }) {
        const c = Math.max(1, Number(cost) || 1);

        // Minute window
        if (!this._minuteWindowStart || (now - this._minuteWindowStart) >= 60_000) {
            this._minuteWindowStart = now;
            this._minuteUsed = 0;
        }

        // Day window
        const dayKey = this._currentDayKey(now);
        if (this._dayKey !== dayKey) {
            this._dayKey = dayKey;
            this._dayUsed = 0;
        }

        if ((this._minuteUsed + c) > this.maxPerMinute) return false;
        if ((this._dayUsed + c) > this.maxPerDay) return false;

        this._minuteUsed += c;
        this._dayUsed += c;
        return true;
    }
}

module.exports = InMemoryRateLimiterAdapter;

