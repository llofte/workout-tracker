export function useClaude() {
  return {
    parseWhiteboard: async (_imageBase64) => null,
    suggestWeight: async (_movementName, _history) => null,
    askTrends: async (_question, _sessions) => null,
    loading: false,
    error: null,
  }
}
