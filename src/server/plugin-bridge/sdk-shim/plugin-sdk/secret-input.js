// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/secret-input.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/secret-input.' + fn + '() not implemented in Bridge mode'); }
}

function buildOptionalSecretInputSchema() { _w('buildOptionalSecretInputSchema'); return undefined; }
function buildSecretInputArraySchema() { _w('buildSecretInputArraySchema'); return undefined; }
const buildSecretInputSchema = undefined;
function hasConfiguredSecretInput() { _w('hasConfiguredSecretInput'); return false; }
function normalizeResolvedSecretInputString() { _w('normalizeResolvedSecretInputString'); return ""; }
function normalizeSecretInput() { _w('normalizeSecretInput'); return ""; }
function normalizeSecretInputString() { _w('normalizeSecretInputString'); return ""; }

module.exports = {
  buildOptionalSecretInputSchema,
  buildSecretInputArraySchema,
  buildSecretInputSchema,
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
  normalizeSecretInput,
  normalizeSecretInputString,
};
