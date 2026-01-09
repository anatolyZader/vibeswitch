/**
 * FilePath - Value object for file paths
 * 
 * Encapsulates file path validation and normalization.
 */

class FilePath {
    constructor(value) {
        if (!value || typeof value !== 'string') {
            throw new Error('FilePath must be a non-empty string');
        }
        this.value = value.trim();
        if (this.value.length === 0) {
            throw new Error('FilePath cannot be empty');
        }
    }

    equals(other) {
        return other instanceof FilePath && this.value === other.value;
    }

    toString() {
        return this.value;
    }

    /**
     * Get the file name (last segment of path)
     * @returns {string} File name
     */
    getFileName() {
        const parts = this.value.split(/[/\\]/);
        return parts[parts.length - 1];
    }

    /**
     * Get the directory path
     * @returns {string} Directory path
     */
    getDirectory() {
        const lastSlash = Math.max(this.value.lastIndexOf('/'), this.value.lastIndexOf('\\'));
        if (lastSlash === -1) return '';
        return this.value.substring(0, lastSlash);
    }
}

module.exports = FilePath;

