// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/provider-zai-endpoint.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/provider-zai-endpoint.' + fn + '() not implemented in Bridge mode'); }
}

function detectZaiEndpoint() { _w('detectZaiEndpoint'); return undefined; }

module.exports = {
  detectZaiEndpoint,
};
