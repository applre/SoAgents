// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/setup-adapter-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/setup-adapter-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function createEnvPatchedAccountSetupAdapter() { _w('createEnvPatchedAccountSetupAdapter'); return undefined; }

module.exports = {
  createEnvPatchedAccountSetupAdapter,
};
