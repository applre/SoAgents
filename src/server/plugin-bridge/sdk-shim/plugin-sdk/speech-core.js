// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/speech-core.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/speech-core.' + fn + '() not implemented in Bridge mode'); }
}

function normalizeApplyTextNormalization() { _w('normalizeApplyTextNormalization'); return ""; }
function normalizeLanguageCode() { _w('normalizeLanguageCode'); return ""; }
function normalizeSeed() { _w('normalizeSeed'); return ""; }
function requireInRange() { _w('requireInRange'); return undefined; }
function parseTtsDirectives() { _w('parseTtsDirectives'); return undefined; }

module.exports = {
  normalizeApplyTextNormalization,
  normalizeLanguageCode,
  normalizeSeed,
  requireInRange,
  parseTtsDirectives,
};
