// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/provider-auth-result.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/provider-auth-result.' + fn + '() not implemented in Bridge mode'); }
}

function buildOauthProviderAuthResult() { _w('buildOauthProviderAuthResult'); return undefined; }

module.exports = {
  buildOauthProviderAuthResult,
};
