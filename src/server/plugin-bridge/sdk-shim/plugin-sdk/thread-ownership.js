// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/thread-ownership.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/thread-ownership.' + fn + '() not implemented in Bridge mode'); }
}

function definePluginEntry() { _w('definePluginEntry'); return undefined; }
function fetchWithSsrFGuard() { _w('fetchWithSsrFGuard'); return undefined; }
function ssrfPolicyFromAllowPrivateNetwork() { _w('ssrfPolicyFromAllowPrivateNetwork'); return undefined; }

module.exports = {
  definePluginEntry,
  fetchWithSsrFGuard,
  ssrfPolicyFromAllowPrivateNetwork,
};
