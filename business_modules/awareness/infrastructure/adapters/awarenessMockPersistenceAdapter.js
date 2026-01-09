/**
 * AwarenessMockPersistenceAdapter - Mock implementation of IAwarenessPersistencePort for testing
 * 
 * Provides in-memory storage for unit testing without requiring VS Code workspaceState.
 */

const IAwarenessPersistencePort = require('../../domain/ports/IAwarenessPersistencePort');

class AwarenessMockPersistenceAdapter extends IAwarenessPersistencePort {
    constructor() {
        super();
        this._storage = new Map();
    }
    
    async save(key, value) {
        this._storage.set(key, value);
        return Promise.resolve();
    }
    
    async load(key) {
        return Promise.resolve(this._storage.get(key));
    }
    
    async delete(key) {
        this._storage.delete(key);
        return Promise.resolve();
    }
    
    saveSync(key, value) {
        this._storage.set(key, value);
    }
    
    loadSync(key) {
        return this._storage.get(key);
    }
    
    // Test helpers
    clear() {
        this._storage.clear();
    }
    
    getAll() {
        return Object.fromEntries(this._storage);
    }
    
    has(key) {
        return this._storage.has(key);
    }
}

module.exports = AwarenessMockPersistenceAdapter;


