// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/github-copilot-token.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/github-copilot-token.' + fn + '() not implemented in Bridge mode'); }
}

async function resolveCopilotApiToken() { _w('resolveCopilotApiToken'); return undefined; }
function deriveCopilotApiBaseUrlFromToken() { _w('deriveCopilotApiBaseUrlFromToken'); return undefined; }
const DEFAULT_COPILOT_API_BASE_URL = undefined;

module.exports = {
  resolveCopilotApiToken,
  deriveCopilotApiBaseUrlFromToken,
  DEFAULT_COPILOT_API_BASE_URL,
};
