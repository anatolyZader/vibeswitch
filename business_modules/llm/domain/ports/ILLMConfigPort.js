/**
 * ILLMConfigPort (interface)
 *
 * Provides configuration for the LLM module (enabled/provider/budgets/privacy).
 * Keep it separate from VS Code APIs for testability.
 */
class ILLMConfigPort {
    getConfig() {
        throw new Error('ILLMConfigPort.getConfig not implemented');
    }
}

module.exports = ILLMConfigPort;

