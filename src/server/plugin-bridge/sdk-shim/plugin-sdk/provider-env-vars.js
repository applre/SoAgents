// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/provider-env-vars.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/provider-env-vars.' + fn + '() not implemented in Bridge mode'); }
}

function listKnownProviderAuthEnvVarNames() { _w('listKnownProviderAuthEnvVarNames'); return []; }
function omitEnvKeysCaseInsensitive() { _w('omitEnvKeysCaseInsensitive'); return undefined; }

module.exports = {
  listKnownProviderAuthEnvVarNames,
  omitEnvKeysCaseInsensitive,
};
