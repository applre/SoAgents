// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/memory-core-host-secret.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/memory-core-host-secret.' + fn + '() not implemented in Bridge mode'); }
}

function hasConfiguredMemorySecretInput() { _w('hasConfiguredMemorySecretInput'); return false; }
function resolveMemorySecretInputString() { _w('resolveMemorySecretInputString'); return undefined; }

module.exports = {
  hasConfiguredMemorySecretInput,
  resolveMemorySecretInputString,
};
