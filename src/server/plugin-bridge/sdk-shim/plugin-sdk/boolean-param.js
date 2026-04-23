// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/boolean-param.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/boolean-param.' + fn + '() not implemented in Bridge mode'); }
}

function readBooleanParam() { _w('readBooleanParam'); return undefined; }

module.exports = {
  readBooleanParam,
};
