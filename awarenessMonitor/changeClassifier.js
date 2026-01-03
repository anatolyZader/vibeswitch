/**
 * Change Classifier
 * Debounced aggregation and AI/user classification for text changes
 * 
 * PRIMARY DETECTION: Behavioral inference via heuristics (edit patterns, batch characteristics, temporal patterns)
 * - Aggregates rapid changes within a time window
 * - Analyzes batch characteristics (total size, range count, distribution, scatteredness)
 * - Detects AI-like patterns: large multi-line insertions, pure insertions, scattered edits
 * - **Rapid scattered changes**: Measures many scattered edits within short time window (strong AI signal)
 *   - AI agents often make many scattered edits very quickly (within seconds)
 *   - Humans typically make more focused, sequential edits
 *   - This temporal pattern is a key behavioral differentiator
 * - Distinguishes formatters from AI edits (many scattered changes with deletes across wide span)
 * - This is the reliable method since markers cannot be guaranteed to survive edit pipeline
 * 
 * SECONDARY SIGNAL: @ai marker (strong signal when present)
 * - Checks for @ai marker in various comment formats (// @ai, # @ai, <!-- @ai -->, etc.)
 * - When marker is present, it's a definitive signal (100% accurate)
 * - When marker is absent, we cannot assume human origin - must use behavioral inference
 * 
 * Strategy: Behavioral heuristics are primary. Markers are helpful hints that strengthen
 * confidence when present, but absence of marker does NOT mean human origin.
 * 
 * DESIGN IMPROVEMENT: Composable detector pipeline
 * - Each detector returns {scoreDelta, reason, label}
 * - Final classification combines scores to determine label with confidence
 * - Returns {label: 'ai'|'user'|'formatter'|'unknown', confidence: 0..1, reasons: string[]}
 * 
 * FIXED: Stores callback once per document to prevent double recording
 */

class ChangeClassifier {
    /**
     * @param {number} debounceMs - Debounce window in milliseconds
     * @param {Object} config - Classification configuration (mode-specific thresholds)
     */
    constructor(debounceMs = 200, config = null) {
        this.debounceMs = debounceMs;
        this.pendingChanges = new Map(); // document URI -> { changes: [], timer: null, lastChangeTime: 0, documentVersion: null, onClassified: null }
        this.maxPendingChanges = 200; // Cap pending changes per document (safety)
        
        // Default config (DEV mode - conservative)
        const defaultConfig = {
            // VIBE: more permissive (lower thresholds)
            // DEV: more conservative (higher thresholds)
            multiLineThreshold: 50,
            pureInsertionCount: 3,
            pureInsertionSize: 20,
            largeInsertionThreshold: 100,
            scatteredRangeCount: 5,
            scatteredChangeCount: 5,
            scatteredSizeThreshold: 200,
            formatterRangeCount: 8,
            formatterLineSpan: 50,
            aiLineSpan: 30,
            aiMultiLineSize: 50,
            // Rapid scattered changes: AI agents often make many scattered edits quickly
            rapidScatteredTimeWindow: 1000, // Time window in ms for rapid changes (1 second)
            rapidScatteredEventCount: 8, // Minimum number of events in time window (renamed from ChangeCount for clarity)
            rapidScatteredRangeCount: 6, // Minimum distinct line ranges for scattered pattern
            rapidScatteredMinSize: 50, // Minimum total size to avoid false positives on tiny edits
            rapidBurstChangeCount: 10, // Minimum number of changes for rapid burst branch (separate from event count)
            // Marker-only mode: if true, only use @ai marker, ignore heuristics
            // If false, use behavioral heuristics as primary with markers as strong signal when present
            markerOnly: false  // Default: use behavioral inference (heuristics) as primary method
        };
        
        // Fix: Sanitize user config BEFORE merging to ensure defaults always win
        // This prevents invalid values from overwriting defaults, then being deleted, leaving undefined
        const userConfig = config ? { ...config } : {};
        this._validateConfig(userConfig, defaultConfig);
        
        // Merge sanitized user config with defaults (defaults win for any missing/invalid keys)
        this.config = { ...defaultConfig, ...userConfig };
        
        // Freeze config to prevent accidental mutation
        Object.freeze(this.config);
        
        // Fix: Use strict boolean check (more explicit than || false)
        this.markerOnly = this.config.markerOnly === true;
    }
    
    /**
     * Validate and sanitize classifier configuration to prevent silent misclassification
     * Fix: Sanitizes user config BEFORE merge to ensure defaults always win
     * @param {Object} config - User configuration to validate (will be mutated)
     * @param {Object} defaultConfig - Default configuration (for reference)
     * @private
     */
    _validateConfig(config, defaultConfig = {}) {
        const errors = [];
        const sanitized = [];
        
        // Thresholds must be positive numbers
        const thresholdKeys = [
            'multiLineThreshold', 'pureInsertionCount', 'pureInsertionSize',
            'largeInsertionThreshold', 'scatteredRangeCount', 'scatteredChangeCount',
            'scatteredSizeThreshold', 'formatterRangeCount', 'formatterLineSpan',
            'aiLineSpan', 'aiMultiLineSize', 'rapidScatteredTimeWindow',
            'rapidScatteredEventCount', 'rapidScatteredRangeCount', 'rapidScatteredMinSize',
            'rapidBurstChangeCount'
        ];
        
        // Fix: Sanitize invalid values (delete them so defaults win) instead of just warning
        for (const key of thresholdKeys) {
            if (config[key] !== undefined && (typeof config[key] !== 'number' || config[key] < 0)) {
                errors.push(`${key} must be a non-negative number, got: ${config[key]}`);
                delete config[key]; // Remove invalid value so default wins
                sanitized.push(key);
            }
        }
        
        // Boolean flags
        if (config.markerOnly !== undefined && typeof config.markerOnly !== 'boolean') {
            errors.push(`markerOnly must be a boolean, got: ${config.markerOnly}`);
            delete config.markerOnly; // Remove invalid value so default wins
            sanitized.push('markerOnly');
        }
        
        if (errors.length > 0) {
            const errorMsg = `Invalid ChangeClassifier config:\n${errors.join('\n')}\nSanitized keys: ${sanitized.join(', ')}`;
            console.warn(`[ChangeClassifier] ${errorMsg}`);
            // Invalid values have been deleted, so defaults will be used via merge
        }
        
        return { errors, sanitized };
    }

    /**
     * Add a batch of changes from a TextDocumentChangeEvent
     * FIXED: Accepts whole event, stores callback once per document
     * @param {vscode.TextDocumentChangeEvent} event - Text document change event
     * @param {Function} onClassified - Callback with (document, classification, aggregatedChanges)
     *   - classification: {label: 'ai'|'user'|'formatter'|'unknown', confidence: 0..1, reasons: string[]}
     */
    addEvent(event, onClassified) {
        if (!event || !event.contentChanges || event.contentChanges.length === 0) {
            return;
        }
        
        const uri = event.document.uri.toString();
        const now = Date.now();
        
        if (!this.pendingChanges.has(uri)) {
            this.pendingChanges.set(uri, {
                changes: [],
                eventTimestamps: [], // Track one timestamp per event (for rapid change detection)
                eventRangeSets: [], // Track range set per event (for scattered pattern detection)
                eventChangeCounts: [], // Track number of changes per event (for cleanup)
                timer: null,
                lastChangeTime: 0,
                firstChangeTime: 0, // Track first change time for temporal analysis
                documentVersion: null, // Track document version to detect drift
                batchStartVersion: null, // Fix: Track version when batch started (for proper drift detection)
                onClassified: null,
                document: null // Store document reference for flush
            });
        }
        
        const pending = this.pendingChanges.get(uri);
        
        // Store callback once per document (prevents double recording)
        // Use latest callback if provided, otherwise keep existing
        if (onClassified) {
            pending.onClassified = onClassified;
        }
        pending.document = event.document; // Update document reference
        pending.documentVersion = event.document.version;
        
        // Track first change time and version if this is the first batch
        if (pending.changes.length === 0) {
            pending.firstChangeTime = now;
            pending.batchStartVersion = event.document.version; // Fix: Store version when batch started
        }
        
        // Track line-based range set for this event (for scatteredness detection)
        // Fix: Use line keys instead of character-precise keys for more stable scatteredness signal
        const eventRangeSet = new Set();
        for (const change of event.contentChanges) {
            // Use line-based key to reduce noise from character-level variations
            const lineKey = `${change.range.start.line}-${change.range.end.line}`;
            eventRangeSet.add(lineKey);
        }
        
        // Add all changes from event as one batch
        for (const change of event.contentChanges) {
            // Cap pending changes per document (safety)
            if (pending.changes.length >= this.maxPendingChanges) {
                // Drop oldest change
                pending.changes.shift();
                // Check if we've removed all changes from the first event
                if (pending.eventChangeCounts.length > 0) {
                    pending.eventChangeCounts[0]--;
                    if (pending.eventChangeCounts[0] <= 0) {
                        // Remove the first event's metadata
                        pending.eventChangeCounts.shift();
                        pending.eventTimestamps.shift();
                        pending.eventRangeSets.shift();
                        // Update first change time if we removed the first event
                        if (pending.eventTimestamps.length > 0) {
                            pending.firstChangeTime = pending.eventTimestamps[0];
                        }
                    }
                }
            }
            pending.changes.push(change);
        }
        
        // Track one timestamp per event (not per change)
        pending.eventTimestamps.push(now);
        pending.eventRangeSets.push(eventRangeSet);
        pending.eventChangeCounts.push(event.contentChanges.length);
        
        pending.lastChangeTime = now;
        
        // Clear existing timer
        if (pending.timer) {
            clearTimeout(pending.timer);
            pending.timer = null; // Clear timer ref
        }
        
        // Set new timer
        pending.timer = setTimeout(() => {
            this._classifyAndEmit(uri);
        }, this.debounceMs);
    }

    /**
     * Classify aggregated changes and emit result
     * @private
     */
    _classifyAndEmit(uri) {
        const pending = this.pendingChanges.get(uri);
        if (!pending || pending.changes.length === 0) {
            if (pending && pending.timer) {
                clearTimeout(pending.timer);
                pending.timer = null;
            }
            this.pendingChanges.delete(uri);
            return;
        }
        
        const changes = pending.changes;
        const eventTimestamps = pending.eventTimestamps || [];
        const eventRangeSets = pending.eventRangeSets || [];
        const document = pending.document;
        const onClassified = pending.onClassified;
        const documentVersion = pending.documentVersion;
        
        // Fix: Check document version drift - compare against batch start version (when accumulation began)
        // This detects if document changed during the entire debounce window, not just since last event
        const batchStartVersion = pending.batchStartVersion || documentVersion;
        const versionDrift = document && document.version !== batchStartVersion;
        const classification = this._classify(changes, eventTimestamps, eventRangeSets, pending.firstChangeTime);
        
        // Fix: Cap confidence when version drifted (more conservative than scaling)
        // This prevents high-confidence classifications on stale data
        if (versionDrift) {
            const originalConfidence = classification.confidence;
            classification.confidence = Math.min(classification.confidence, 0.6); // Cap at 0.6
            if (originalConfidence > 0.6) {
                // Fix: Add reason tag for consistency with reasonTag filtering system
                classification.reasons.push('meta:version_drift document version drifted during classification (confidence capped)');
            }
        }
        
        // Clear timer ref
        if (pending.timer) {
            clearTimeout(pending.timer);
            pending.timer = null;
        }
        
        // Clear pending
        this.pendingChanges.delete(uri);
        
        // Emit classification (single callback, prevents double recording)
        // ALWAYS use classification object format (single protocol)
        if (onClassified && document) {
            onClassified(document, classification, changes);
        }
    }

    /**
     * Check if changes contain @ai marker (primary signal for AI-generated code)
     * @param {Array<vscode.TextDocumentContentChangeEvent>} changes - Aggregated changes
     * @returns {boolean} True if @ai marker is found
     * @private
     */
    _hasAIMarker(changes) {
        // Check for @ai marker in various comment formats
        // FIXED: CSS pattern was too strict, now uses flexible block comment matching
        // Fix: HTML marker regex should be case-insensitive and more flexible
        const markerPatterns = [
            /\/\/\s*@ai/i,                    // JavaScript/TypeScript/Java/C/C++/C#
            /#\s*@ai/i,                        // Python/Shell/Bash
            /<!--[\s\S]*?@ai[\s\S]*?-->/i,     // HTML/XML/Markdown - Fix: case-insensitive and flexible whitespace
            /--\s*@ai/i,                       // SQL
            /\/\*[\s\S]*?@ai[\s\S]*?\*\//i     // CSS - FIXED: flexible block comment matching
        ];
        
        for (const change of changes) {
            const text = change.text;
            for (const pattern of markerPatterns) {
                if (pattern.test(text)) {
                    return true;
                }
            }
        }
        // NOTE: Markers may exist in untouched context (AI edits elsewhere)
        // Currently only checking inserted text - could be enhanced to check document context
        return false;
    }

    /**
     * Classify aggregated changes with rich output
     * PRIMARY: Behavioral inference via heuristics (edit patterns, batch characteristics, temporal patterns)
     * SECONDARY: @ai marker (strong signal when present, but cannot be relied upon)
     * 
     * Strategy: Behavioral heuristics are the primary detection method. Markers are
     * helpful hints that strengthen confidence when present, but absence of marker
     * does NOT mean human origin - we must use behavioral inference.
     * 
     * DESIGN IMPROVEMENT: Returns rich classification result for debugging and tuning
     * @param {Array<vscode.TextDocumentContentChangeEvent>} changes - Aggregated changes
     * @param {Array<number>} eventTimestamps - Timestamps for each event (for temporal analysis)
     * @param {Array<Set>} eventRangeSets - Range sets for each event (for scattered pattern detection)
     * @param {number} firstChangeTime - Timestamp of first change in batch
     * @returns {{label: 'ai'|'user'|'formatter'|'unknown', confidence: number, reasons: string[]}} Classification result
     * @private
     */
    _classify(changes, eventTimestamps = [], eventRangeSets = [], firstChangeTime = null) {
        if (changes.length === 0) {
            return { label: 'unknown', confidence: 0, reasons: ['no changes'] };
        }
        
        let aiScore = 0;
        let formatterScore = 0;
        let userScore = 0;
        
        // STRONG SIGNAL: Check for @ai marker (definitive when present)
        // Fix: Return reason (singular) for consistency with detectors, no tag (marker is special)
        if (this._hasAIMarker(changes)) {
            return {
                label: 'ai',
                confidence: 1.0,
                reasons: ['@ai marker found in changes'],
                reason: '@ai marker found in changes' // For consistency with detector pattern
            };
        }
        
        // If marker-only mode is enabled, skip heuristics entirely
        // Fix: Return unknown (not user) when no marker found - "no marker" ≠ "user"
        if (this.markerOnly) {
            return {
                label: 'unknown',
                confidence: 0.2,
                reasons: ['marker-only mode: no marker found']
            };
        }
        
        // PRIMARY DETECTION: Behavioral inference via heuristics
        // This is the reliable method since markers cannot be guaranteed
        // Aggregate metrics for all detectors
        const metrics = this._calculateMetrics(changes, eventTimestamps, eventRangeSets, firstChangeTime);
        
        // Fix: Clean detector API - remove reasons parameter (detectors don't use it)
        // Run composable detectors in pipeline
        const detectors = [
            () => this._detectFormatter(metrics),
            () => this._detectRapidScattered(metrics),
            () => this._detectLargeInsertion(metrics),
            () => this._detectMultiLineInsertion(metrics),
            () => this._detectPureInsertions(metrics),
            () => this._detectScatteredEdits(metrics),
            () => this._detectSmallEdits(metrics)
        ];
        
        // Run all detectors and accumulate scores
        // Fix: Store reasons as paired objects to prevent misalignment
        // Some detectors may return reason without reasonTag (e.g., marker detection)
        const reasonObjects = [];
        for (const detector of detectors) {
            const result = detector();
            if (!result) continue;
            
            if (result.label === 'formatter') {
                formatterScore += result.score;
            } else if (result.label === 'ai') {
                aiScore += result.score;
            } else if (result.label === 'user') {
                userScore += result.score;
            }
            
            if (result.reason) {
                reasonObjects.push({ tag: result.reasonTag || null, text: result.reason });
            }
        }
        
        // Determine final label based on scores
        const maxScore = Math.max(aiScore, formatterScore, userScore);
        let label = 'unknown';
        let confidence = 0;
        
        if (formatterScore > aiScore && formatterScore > userScore && formatterScore > 0.5) {
            label = 'formatter';
            confidence = Math.min(formatterScore, 1.0);
        } else if (aiScore > userScore && aiScore > 0.3) {
            label = 'ai';
            confidence = Math.min(aiScore, 1.0);
        } else if (userScore > 0) {
            // Fix: Only label 'user' when we have positive user evidence
            label = 'user';
            confidence = Math.max(0.3, Math.min(userScore, 1.0));
        } else {
            // Fix: If all scores are 0, return 'unknown' (not 'user')
            // This matches the documented behavior where 'unknown' exists
            label = 'unknown';
            confidence = 0.2;
        }
        
        // Fix: Filter reasons by reasonTag prefix (stable, won't drift with phrasing changes)
        // This reduces noise in logs and makes debugging easier
        const filteredReasons = reasonObjects
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
        
        return { label, confidence, reasons: filteredReasons };
    }
    
    /**
     * Calculate metrics from changes for detector analysis
     * @private
     */
    _calculateMetrics(changes, eventTimestamps, eventRangeSets, firstChangeTime) {
        let totalInserted = 0;
        let totalDeleted = 0;
        let hasMultiLine = false;
        let pureInsertionCount = 0;
        let distinctRanges = new Set();
        const startLines = [];
        const endLines = [];
        
        for (const change of changes) {
            const inserted = change.text.length;
            const deleted = change.rangeLength;
            
            totalInserted += inserted;
            totalDeleted += deleted;
            
            if (change.text.includes('\n')) {
                hasMultiLine = true;
            }
            
            if (deleted === 0 && inserted > 0) {
                pureInsertionCount++;
            }
            
            // Use line-based key for scatteredness detection (more stable than character-precise)
            const lineKey = `${change.range.start.line}-${change.range.end.line}`;
            distinctRanges.add(lineKey);
            
            startLines.push(change.range.start.line);
            endLines.push(change.range.end.line);
        }
        
        // Fix: maxLineSpan should consider both start and end lines
        const allLines = [...startLines, ...endLines];
        const maxLineSpan = allLines.length > 0 
            ? Math.max(...allLines) - Math.min(...allLines)
            : 0;
        
        // Fix: Count whitespace-only changes instead of whitespace ratio
        // This avoids false positives on normal code (which naturally contains whitespace)
        // Fix: Only count insertions of whitespace (deletions have empty text but aren't whitespace-only)
        let whitespaceOnlyChangeCount = 0;
        for (const change of changes) {
            if (change.text.length > 0 && change.text.trim().length === 0) {
                whitespaceOnlyChangeCount++;
            }
        }
        const whitespaceOnlyChangeRatio = changes.length > 0 
            ? whitespaceOnlyChangeCount / changes.length 
            : 0;
        
        // Calculate temporal metrics using event timestamps (not per-change timestamps)
        // Fix: Track events, not individual changes, for true "rapid scattered" detection
        const timeWindow = this.config.rapidScatteredTimeWindow || 1000;
        let rapidEventCount = 0;
        let rapidRangeSet = new Set();
        let burstDurationMs = 0;
        
        if (eventTimestamps.length > 0 && firstChangeTime) {
            const lastEventTime = eventTimestamps[eventTimestamps.length - 1];
            burstDurationMs = lastEventTime - firstChangeTime;
            
            let maxRapidEventCount = 0;
            let maxRapidRanges = new Set();
            
            // Find the window with the most events
            for (let i = 0; i < eventTimestamps.length; i++) {
                const windowStart = eventTimestamps[i];
                const windowEnd = windowStart + timeWindow;
                let windowEventCount = 0;
                const windowRanges = new Set();
                
                // Count events in this window and aggregate their ranges
                for (let j = i; j < eventTimestamps.length; j++) {
                    if (eventTimestamps[j] <= windowEnd) {
                        windowEventCount++;
                        // Aggregate ranges from this event
                        if (j < eventRangeSets.length) {
                            for (const rangeKey of eventRangeSets[j]) {
                                windowRanges.add(rangeKey);
                            }
                        }
                    } else {
                        break;
                    }
                }
                
                if (windowEventCount > maxRapidEventCount) {
                    maxRapidEventCount = windowEventCount;
                    maxRapidRanges = windowRanges;
                }
            }
            
            rapidEventCount = maxRapidEventCount;
            rapidRangeSet = maxRapidRanges;
        }
        
        return {
            totalInserted,
            totalDeleted,
            hasMultiLine,
            pureInsertionCount,
            distinctRanges,
            distinctRangeCount: distinctRanges.size,
            maxLineSpan,
            whitespaceOnlyChangeRatio,
            rapidEventCount,
            rapidRangeSet,
            rapidRangeCount: rapidRangeSet.size,
            burstDurationMs,
            changeCount: changes.length
        };
    }
    
    /**
     * Detector: Formatter pattern (many scattered changes with high whitespace ratio)
     * @private
     */
    _detectFormatter(metrics) {
        // Fix: Use whitespace-only change ratio instead of whitespace character ratio
        // This avoids false positives on normal code (which naturally contains whitespace)
        // Fix: Add guard for small inserted text per change (formatters typically have small inserts)
        // Fix: Also detect formatters with moderate whitespace ratio but strong other signals
        const avgInsertedPerChange = metrics.changeCount > 0 ? metrics.totalInserted / metrics.changeCount : 0;
        const formatterMaxAvgInsert = 30; // Formatters typically insert small amounts per change
        
        // Primary signal: high whitespace-only ratio
        const hasHighWhitespaceRatio = metrics.whitespaceOnlyChangeRatio > 0.6;
        
        // Secondary signal: formatter characteristics (many ranges, wide span, small inserts, both deletes and inserts)
        const hasFormatterCharacteristics = 
            metrics.distinctRangeCount >= this.config.formatterRangeCount && 
            metrics.maxLineSpan >= this.config.formatterLineSpan &&
            metrics.totalDeleted > 0 && // Formatters typically have deletes
            (metrics.totalInserted <= 500 || avgInsertedPerChange <= formatterMaxAvgInsert);
        
        // Detect formatter if: (high whitespace ratio) OR (formatter characteristics with moderate whitespace)
        if (hasFormatterCharacteristics) {
            const whitespaceThreshold = hasHighWhitespaceRatio ? 0.6 : 0.3; // Lower threshold if other signals are strong
            if (metrics.whitespaceOnlyChangeRatio > whitespaceThreshold) {
                return {
                    label: 'formatter',
                    score: hasHighWhitespaceRatio ? 0.9 : 0.7, // Lower confidence if whitespace ratio is moderate
                    reason: `formatter pattern: ${metrics.distinctRangeCount} ranges, ${metrics.maxLineSpan} line span, ${(metrics.whitespaceOnlyChangeRatio * 100).toFixed(0)}% whitespace-only changes, avg ${avgInsertedPerChange.toFixed(0)} chars/change`,
                    reasonTag: 'fmt:whitespace' // Fix: Add tag for stable filtering
                };
            }
        }
        return null;
    }
    
    /**
     * Detector: Rapid scattered changes (strong AI signal)
     * @private
     */
    _detectRapidScattered(metrics) {
        // Fix: Use event count instead of change count (events are what matter for "rapid")
        if (metrics.rapidEventCount >= this.config.rapidScatteredEventCount &&
            metrics.rapidRangeCount >= this.config.rapidScatteredRangeCount &&
            metrics.totalInserted >= this.config.rapidScatteredMinSize) {
            return {
                label: 'ai',
                score: 0.8,
                reason: `rapid scattered: ${metrics.rapidEventCount} events in ${this.config.rapidScatteredTimeWindow}ms window across ${metrics.rapidRangeCount} ranges`,
                reasonTag: 'ai:rapid_scattered' // Fix: Add tag for stable filtering
            };
        }
        
        // Fix: Require at least 2 events for rapid burst (avoid false positives from single large events)
        // Fix: Use separate rapidBurstChangeCount threshold (not rapidScatteredEventCount)
        // Fix: Require rapidRangeCount >= 2 to reduce false positives from tight loop editing one place
        if (metrics.rapidEventCount >= 2 && metrics.burstDurationMs > 0 && metrics.burstDurationMs <= 1200 &&
            metrics.rapidRangeCount >= 2 && // Guard: require scatteredness even in burst branch
            metrics.distinctRangeCount >= this.config.rapidScatteredRangeCount &&
            metrics.changeCount >= (this.config.rapidBurstChangeCount || 10) &&
            metrics.totalInserted >= this.config.rapidScatteredMinSize) {
            return {
                label: 'ai',
                score: 0.7,
                reason: `rapid burst: ${metrics.rapidEventCount} events, ${metrics.changeCount} changes in ${metrics.burstDurationMs}ms`,
                reasonTag: 'ai:rapid_burst' // Fix: Add tag for stable filtering
            };
        }
        return null;
    }
    
    /**
     * Detector: Large multi-line insertions in localized area
     * @private
     */
    _detectMultiLineInsertion(metrics) {
        // Fix: Use multiLineThreshold to require minimum multi-line size
        if (metrics.hasMultiLine && 
            metrics.totalInserted >= this.config.multiLineThreshold &&
            metrics.totalInserted >= this.config.aiMultiLineSize &&
            metrics.maxLineSpan <= this.config.aiLineSpan) {
            return {
                label: 'ai',
                score: 0.7,
                reason: `large multi-line insertion: ${metrics.totalInserted} chars, ${metrics.maxLineSpan} line span`,
                reasonTag: 'ai:multi_line' // Fix: Add tag for stable filtering
            };
        }
        return null;
    }
    
    /**
     * Detector: Multiple pure insertions (no deletes)
     * @private
     */
    _detectPureInsertions(metrics) {
        if (metrics.pureInsertionCount >= this.config.pureInsertionCount && 
            metrics.totalInserted > this.config.pureInsertionSize &&
            metrics.totalDeleted === 0) {
            return {
                label: 'ai',
                score: 0.6,
                reason: `pure insertions: ${metrics.pureInsertionCount} insertions, ${metrics.totalInserted} chars`,
                reasonTag: 'ai:pure_insertions' // Fix: Add tag for stable filtering
            };
        }
        return null;
    }
    
    /**
     * Detector: Large single insertion
     * @private
     */
    _detectLargeInsertion(metrics) {
        if (metrics.totalInserted > this.config.largeInsertionThreshold && metrics.totalDeleted === 0) {
            return {
                label: 'ai',
                score: 0.6,
                reason: `large insertion: ${metrics.totalInserted} chars`,
                reasonTag: 'ai:large_insertion' // Fix: Add tag for stable filtering
            };
        }
        return null;
    }
    
    /**
     * Detector: Scattered edits (could be formatter or AI)
     * @private
     */
    _detectScatteredEdits(metrics) {
        if (metrics.distinctRangeCount >= this.config.scatteredRangeCount && 
            metrics.changeCount >= this.config.scatteredChangeCount) {
            if (metrics.totalInserted > this.config.scatteredSizeThreshold) {
                return {
                    label: 'ai',
                    score: 0.5,
                    reason: `scattered edits: ${metrics.distinctRangeCount} ranges, ${metrics.totalInserted} chars`,
                    reasonTag: 'ai:scattered' // Fix: Add tag for stable filtering
                };
            }
        }
        return null;
    }
    
    /**
     * Detector: Small edits (likely user formatting)
     * @private
     */
    _detectSmallEdits(metrics) {
        if (metrics.hasMultiLine && metrics.totalInserted < 20) {
            return {
                label: 'user',
                score: 0.4,
                reason: `small multi-line edit: ${metrics.totalInserted} chars (likely formatting)`,
                reasonTag: 'user:small_edit' // Fix: Add tag for stable filtering
            };
        }
        return null;
    }
    
    /**
     * Legacy method for backward compatibility
     * @private
     */
    _classifyAsAI(changes, eventTimestamps = [], eventRangeSets = [], firstChangeTime = null) {
        const result = this._classify(changes, eventTimestamps, eventRangeSets, firstChangeTime);
        return result.label === 'ai';
    }
    
    /**
     * Public method for testing - classifies changes and returns rich result
     * @param {Array<vscode.TextDocumentContentChangeEvent>} changes - Aggregated changes
     * @param {Array<number>} eventTimestamps - Timestamps for each event (optional)
     * @param {Array<Set>} eventRangeSets - Range sets for each event (optional)
     * @param {number} firstChangeTime - Timestamp of first change (optional)
     * @returns {{label: 'ai'|'user'|'formatter'|'unknown', confidence: number, reasons: string[]}} Classification result
     */
    classify(changes, eventTimestamps = [], eventRangeSets = [], firstChangeTime = null) {
        return this._classify(changes, eventTimestamps, eventRangeSets, firstChangeTime);
    }

    /**
     * Force classification of pending changes for a document (for cleanup/flush)
     * Fix: Support silent mode to prevent emission during cleanup
     * @param {vscode.TextDocument} document - The document
     * @param {Function|Object} onClassifiedOrOptions - Optional callback or options {emit: boolean}
     *   - If Function: callback to use (uses stored if not provided)
     *   - If Object: {emit: false} for silent flush (cleanup without recording)
     */
    flush(document, onClassifiedOrOptions) {
        if (!document) return;
        
        const uri = document.uri.toString();
        const pending = this.pendingChanges.get(uri);
        if (pending) {
            if (pending.timer) {
                clearTimeout(pending.timer);
                pending.timer = null;
            }
            
            // Fix: Support silent mode for cleanup without emission
            const options = typeof onClassifiedOrOptions === 'object' && onClassifiedOrOptions !== null ? onClassifiedOrOptions : null;
            const onClassified = typeof onClassifiedOrOptions === 'function' ? onClassifiedOrOptions : null;
            const shouldEmit = options ? (options.emit !== false) : true; // Default to true for backward compatibility
            
            if (onClassified) {
                pending.onClassified = onClassified;
            }
            
            pending.document = document; // Update document reference
            
            if (shouldEmit) {
                this._classifyAndEmit(uri);
            } else {
                // Silent flush: just clear without emitting
                this.pendingChanges.delete(uri);
            }
        }
    }

    /**
     * Flush all pending changes (for cleanup on extension stop)
     * FIXED: Actually calls callbacks before clearing
     * IMPORTANT: Callbacks should respect "formatter is neutral" rule - formatter classifications
     * should not trigger user edit recording or suggestion adaptation marking.
     * @param {Function} onClassified - Optional callback for all flushed documents
     *   - Callback signature: (document, classification, changes)
     *   - classification: {label: 'ai'|'user'|'formatter'|'unknown', confidence: 0..1, reasons: string[]}
     *   - Callbacks should handle formatter classifications as neutral (do nothing)
     */
    flushAll(onClassified) {
        const uris = Array.from(this.pendingChanges.keys());
        for (const uri of uris) {
            const pending = this.pendingChanges.get(uri);
            if (pending) {
                if (pending.timer) {
                    clearTimeout(pending.timer);
                    pending.timer = null;
                }
                // Use provided callback or stored callback
                if (onClassified) {
                    pending.onClassified = onClassified;
                }
                // Emit if we have document and callback
                if (pending.document && pending.onClassified) {
                    const changes = pending.changes;
                    const eventTimestamps = pending.eventTimestamps || [];
                    const eventRangeSets = pending.eventRangeSets || [];
                    const classification = this._classify(changes, eventTimestamps, eventRangeSets, pending.firstChangeTime);
                    
                    // Fix: Apply version drift cap (same logic as _classifyAndEmit)
                    // Prevents high-confidence classifications from stale batches during shutdown
                    // Compare against batch start version (when accumulation began)
                    const batchStartVersion = pending.batchStartVersion || pending.documentVersion;
                    const versionDrift = pending.document && pending.document.version !== batchStartVersion;
                    if (versionDrift) {
                        const originalConfidence = classification.confidence;
                        classification.confidence = Math.min(classification.confidence, 0.6); // Cap at 0.6
                        if (originalConfidence > 0.6) {
                            // Fix: Add reason tag for consistency with reasonTag filtering system
                            classification.reasons.push('meta:version_drift document version drifted during classification (confidence capped)');
                        }
                    }
                    
                    // ALWAYS use classification object format (single protocol)
                    pending.onClassified(pending.document, classification, changes);
                }
            }
        }
        this.pendingChanges.clear();
    }

    /**
     * Clear all pending changes (for cleanup)
     */
    clear() {
        for (const pending of this.pendingChanges.values()) {
            if (pending.timer) {
                clearTimeout(pending.timer);
                pending.timer = null;
            }
        }
        this.pendingChanges.clear();
    }

    /**
     * Calculate statistics about pending changes
     * @returns {Object} Statistics object with counts and metrics
     */
    getStatistics() {
        const stats = {
            totalDocuments: this.pendingChanges.size,
            totalPendingChanges: 0,
            documentsWithTimers: 0,
            averageChangesPerDocument: 0
        };

        for (const pending of this.pendingChanges.values()) {
            stats.totalPendingChanges += pending.changes.length;
            if (pending.timer) {
                stats.documentsWithTimers++;
            }
        }

        if (stats.totalDocuments > 0) {
            stats.averageChangesPerDocument = Math.round(
                stats.totalPendingChanges / stats.totalDocuments
            );
        }

        return stats;
    }

}

module.exports = ChangeClassifier;
