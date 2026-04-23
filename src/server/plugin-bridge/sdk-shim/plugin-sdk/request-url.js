// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/request-url.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/request-url.' + fn + '() not implemented in Bridge mode'); }
}

function resolveRequestUrl() { _w('resolveRequestUrl'); return undefined; }

module.exports = {
  resolveRequestUrl,
};
