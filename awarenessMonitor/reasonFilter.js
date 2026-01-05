/**
 * Reason Filter
 * Filters classification reasons by tag prefix based on final label
 */

/**
 * Filter reasons by reasonTag prefix based on final classification label
 * This reduces noise in logs and makes debugging easier
 * @param {Array<{tag: string|null, text: string}>} reasonObjects - Array of reason objects with tags
 * @param {string} label - Final classification label ('ai'|'user'|'formatter'|'unknown')
 * @returns {Array<string>} Filtered array of reason strings
 */
function filterReasons(reasonObjects, label) {
    return reasonObjects
        .filter(r => {
            if (!r.tag) return true; // Keep reasons without tags (e.g., marker detection)
            
            if (label === 'formatter') {
                return r.tag.startsWith('fmt:');
            } else if (label === 'ai') {
                return r.tag.startsWith('ai:');
            } else if (label === 'user') {
                return r.tag.startsWith('user:');
            }
            return true; // Keep all reasons for unknown
        })
        .map(r => r.text);
}

module.exports = {
    filterReasons
};

