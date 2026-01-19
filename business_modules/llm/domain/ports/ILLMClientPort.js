/**
 * ILLMClientPort (interface)
 *
 * Adapters implement `analyzeBatch({ prompt, schema, timeoutMs })`.
 * Must return a plain JS object matching the Insight schema, or null.
 *
 * Note: This is a lightweight JS "interface" for Ports & Adapters consistency.
 */
class ILLMClientPort {
    // eslint-disable-next-line no-unused-vars
    async analyzeBatch({ prompt, schema, timeoutMs }) {
        throw new Error('ILLMClientPort.analyzeBatch not implemented');
    }
}

module.exports = ILLMClientPort;

