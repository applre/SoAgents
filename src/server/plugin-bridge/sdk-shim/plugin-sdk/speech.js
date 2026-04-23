// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/speech.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/speech.' + fn + '() not implemented in Bridge mode'); }
}

function parseTtsDirectives() { _w('parseTtsDirectives'); return undefined; }

module.exports = {
  parseTtsDirectives,
};
