/**
 * Verification Signal Detector
 * Detects evidence of user verification/validation after AI code insertion
 * 
 * Tracks:
 * - Test file modifications (user modified test file after AI insertion)
 * - File navigation (user navigated to other files after insertion - search/tracing proxy)
 * - Save events (user saved file after insertion)
 * 
 * This is used for risk-based debt calculation: lack of verification increases debt.
 */

const { isTestFile } = require('./fileCriticality');

/**
 * Track verification signals for suggestions
 * This service maintains a registry of file events to detect verification patterns
 */
class VerificationSignalDetector {
    constructor() {
        // Track file modifications by URI and timestamp
        this.fileModifications = new Map(); // uri -> Array<{timestamp, type}>
        
        // Track file navigation events (focus changes)
        this.fileNavigations = new Map(); // uri -> Array<{timestamp, fromUri, toUri}>
        
        // Track save events
        this.saveEvents = new Map(); // uri -> Array<{timestamp}>
        
        // Track suggestions awaiting verification
        this.pendingSuggestions = new Map(); // suggestionId -> {suggestion, fileUri, timestamp}
    }
    
    /**
     * Register a suggestion for verification tracking
     * @param {Suggestion} suggestion - Suggestion entity
     */
    registerSuggestion(suggestion) {
        if (!suggestion || !suggestion.id) return;
        this.pendingSuggestions.set(suggestion.id, {
            suggestion,
            fileUri: suggestion.document,
            timestamp: suggestion.timestamp || Date.now()
        });
    }
    
    /**
     * Record a file modification event
     * @param {string} fileUri - File URI that was modified
     * @param {string} type - Event type ('edit', 'save', 'focus')
     */
    recordFileEvent(fileUri, type = 'edit') {
        if (!fileUri) return;
        
        const timestamp = Date.now();
        
        if (type === 'save') {
            if (!this.saveEvents.has(fileUri)) {
                this.saveEvents.set(fileUri, []);
            }
            this.saveEvents.get(fileUri).push({ timestamp });
        } else if (type === 'focus' || type === 'navigation') {
            // Navigation tracking is handled separately via recordNavigation
            return;
        } else {
            // Regular edit
            if (!this.fileModifications.has(fileUri)) {
                this.fileModifications.set(fileUri, []);
            }
            this.fileModifications.get(fileUri).push({ timestamp, type });
        }
        
        // Check if this event verifies any pending suggestions
        this._checkVerificationSignals(fileUri, timestamp, type);
    }
    
    /**
     * Record a file navigation event (focus change)
     * @param {string} fromUri - Source file URI (null if first file)
     * @param {string} toUri - Target file URI
     */
    recordNavigation(fromUri, toUri) {
        if (!toUri) return;
        
        const timestamp = Date.now();
        
        if (!this.fileNavigations.has(toUri)) {
            this.fileNavigations.set(toUri, []);
        }
        this.fileNavigations.get(toUri).push({ timestamp, fromUri, toUri });
        
        // Check if this navigation verifies any pending suggestions
        this._checkVerificationSignals(toUri, timestamp, 'navigation');
    }
    
    /**
     * Check if file events verify pending suggestions
     * @private
     */
    _checkVerificationSignals(fileUri, eventTimestamp, eventType) {
        const verificationWindowMs = 5 * 60 * 1000; // 5 minutes
        const saveWindowMs = 1 * 60 * 1000; // 1 minute for saves
        const navigationWindowMs = 2 * 60 * 1000; // 2 minutes for navigation
        
        for (const [suggestionId, pending] of this.pendingSuggestions.entries()) {
            const suggestion = pending.suggestion;
            const timeSinceInsert = eventTimestamp - pending.timestamp;
            
            // Check test file modification
            if (eventType === 'edit' && isTestFile(fileUri) && timeSinceInsert < verificationWindowMs) {
                suggestion.updateVerificationSignals({ testFileModified: true });
            }
            
            // Check save after insert
            if (eventType === 'save' && fileUri === pending.fileUri && timeSinceInsert < saveWindowMs) {
                suggestion.updateVerificationSignals({ saveAfterInsert: true });
            }
            
            // Check navigation after insert (user navigated away and back, or to related files)
            if (eventType === 'navigation' && timeSinceInsert < navigationWindowMs) {
                // If user navigated to a different file after insertion, it's a verification signal
                if (fileUri !== pending.fileUri) {
                    suggestion.updateVerificationSignals({ navigationAfterInsert: true });
                }
            }
        }
    }
    
    /**
     * Detect verification signals for a specific suggestion
     * @param {Suggestion} suggestion - Suggestion entity
     * @returns {Object} Verification signals object
     */
    detectVerificationSignals(suggestion) {
        if (!suggestion || !suggestion.document) {
            return {
                testFileModified: false,
                navigationAfterInsert: false,
                saveAfterInsert: false,
                hasVerification: false
            };
        }
        
        const fileUri = suggestion.document;
        const insertTime = suggestion.timestamp || Date.now();
        const now = Date.now();
        const verificationWindowMs = 5 * 60 * 1000; // 5 minutes
        
        let testFileModified = false;
        let navigationAfterInsert = false;
        let saveAfterInsert = false;
        
        // Check test file modifications
        for (const [uri, modifications] of this.fileModifications.entries()) {
            if (isTestFile(uri)) {
                for (const mod of modifications) {
                    const timeSinceInsert = mod.timestamp - insertTime;
                    if (timeSinceInsert > 0 && timeSinceInsert < verificationWindowMs) {
                        testFileModified = true;
                        break;
                    }
                }
            }
            if (testFileModified) break;
        }
        
        // Check save events
        const saves = this.saveEvents.get(fileUri) || [];
        for (const save of saves) {
            const timeSinceInsert = save.timestamp - insertTime;
            if (timeSinceInsert > 0 && timeSinceInsert < 1 * 60 * 1000) { // 1 minute window
                saveAfterInsert = true;
                break;
            }
        }
        
        // Check navigation events
        const navigations = this.fileNavigations.get(fileUri) || [];
        for (const nav of navigations) {
            const timeSinceInsert = nav.timestamp - insertTime;
            if (timeSinceInsert > 0 && timeSinceInsert < 2 * 60 * 1000 && nav.fromUri !== fileUri) {
                navigationAfterInsert = true;
                break;
            }
        }
        
        const hasVerification = testFileModified || navigationAfterInsert || saveAfterInsert;
        
        return {
            testFileModified,
            navigationAfterInsert,
            saveAfterInsert,
            hasVerification
        };
    }
    
    /**
     * Clean up old events (older than 1 hour)
     */
    cleanup() {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        // Clean file modifications
        for (const [uri, modifications] of this.fileModifications.entries()) {
            const filtered = modifications.filter(m => m.timestamp > oneHourAgo);
            if (filtered.length === 0) {
                this.fileModifications.delete(uri);
            } else {
                this.fileModifications.set(uri, filtered);
            }
        }
        
        // Clean navigations
        for (const [uri, navigations] of this.fileNavigations.entries()) {
            const filtered = navigations.filter(n => n.timestamp > oneHourAgo);
            if (filtered.length === 0) {
                this.fileNavigations.delete(uri);
            } else {
                this.fileNavigations.set(uri, filtered);
            }
        }
        
        // Clean save events
        for (const [uri, saves] of this.saveEvents.entries()) {
            const filtered = saves.filter(s => s.timestamp > oneHourAgo);
            if (filtered.length === 0) {
                this.saveEvents.delete(uri);
            } else {
                this.saveEvents.set(uri, filtered);
            }
        }
        
        // Clean resolved suggestions (older than 1 hour)
        for (const [suggestionId, pending] of this.pendingSuggestions.entries()) {
            const age = Date.now() - pending.timestamp;
            if (age > oneHourAgo || (pending.suggestion && !pending.suggestion.isPending())) {
                this.pendingSuggestions.delete(suggestionId);
            }
        }
    }
}

module.exports = VerificationSignalDetector;
