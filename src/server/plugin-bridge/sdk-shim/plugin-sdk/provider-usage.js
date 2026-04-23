// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/provider-usage.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/provider-usage.' + fn + '() not implemented in Bridge mode'); }
}

function fetchClaudeUsage() { _w('fetchClaudeUsage'); return undefined; }
function fetchCodexUsage() { _w('fetchCodexUsage'); return undefined; }
function fetchGeminiUsage() { _w('fetchGeminiUsage'); return undefined; }
function fetchMinimaxUsage() { _w('fetchMinimaxUsage'); return undefined; }
function fetchZaiUsage() { _w('fetchZaiUsage'); return undefined; }
function clampPercent() { _w('clampPercent'); return undefined; }
const PROVIDER_LABELS = undefined;
function resolveLegacyPiAgentAccessToken() { _w('resolveLegacyPiAgentAccessToken'); return undefined; }
function buildUsageErrorSnapshot() { _w('buildUsageErrorSnapshot'); return undefined; }
function buildUsageHttpErrorSnapshot() { _w('buildUsageHttpErrorSnapshot'); return undefined; }
function fetchJson() { _w('fetchJson'); return undefined; }

module.exports = {
  fetchClaudeUsage,
  fetchCodexUsage,
  fetchGeminiUsage,
  fetchMinimaxUsage,
  fetchZaiUsage,
  clampPercent,
  PROVIDER_LABELS,
  resolveLegacyPiAgentAccessToken,
  buildUsageErrorSnapshot,
  buildUsageHttpErrorSnapshot,
  fetchJson,
};
