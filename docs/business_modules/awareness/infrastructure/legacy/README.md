# Legacy Persistence Utilities

This directory contains legacy persistence utilities that are being phased out in favor of the Ports and Adapters pattern.

## Files

- **persistInContext.js**: Legacy workspace/global state persistence using VS Code's storage APIs
- **persistInSystem.js**: Legacy file system persistence using VS Code's storage URIs

## Migration Status

These utilities are still used as fallbacks in:
- `DebtManager` - Falls back to `PersistInContext` if no persistence adapter is provided
- `userStats.js` - Uses `PersistInSystem` for telemetry storage

## Future Work

These should eventually be replaced with proper adapters implementing `IPersistencePort`:
- `WorkspaceStateAdapter` - Already exists and implements `IPersistencePort`
- Consider creating a `FileSystemPersistenceAdapter` for file-based storage needs

## Deprecation Notice

⚠️ **These utilities are deprecated**. New code should use the persistence adapter pattern via `IPersistencePort`.

