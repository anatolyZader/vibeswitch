/**
 * DebtClearedEvent - Domain event for debt clearance
 * 
 * Published when review debt is cleared (user reviews all pending files).
 */

class DebtClearedEvent {
    constructor({ clearedFiles, totalDebtCleared, occurredAt = new Date() }) {
        this.clearedFiles = clearedFiles || [];
        this.totalDebtCleared = totalDebtCleared;
        this.occurredAt = occurredAt;
        this.eventType = 'DebtClearedEvent';
    }

    toJSON() {
        return {
            eventType: this.eventType,
            clearedFiles: this.clearedFiles,
            totalDebtCleared: this.totalDebtCleared,
            occurredAt: this.occurredAt.toISOString()
        };
    }
}

module.exports = DebtClearedEvent;

