// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/ssrf-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/ssrf-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function closeDispatcher() { _w('closeDispatcher'); return undefined; }
function createPinnedDispatcher() { _w('createPinnedDispatcher'); return undefined; }
function resolvePinnedHostnameWithPolicy() { _w('resolvePinnedHostnameWithPolicy'); return undefined; }
function assertHttpUrlTargetsPrivateNetwork() { _w('assertHttpUrlTargetsPrivateNetwork'); return undefined; }
function ssrfPolicyFromAllowPrivateNetwork() { _w('ssrfPolicyFromAllowPrivateNetwork'); return undefined; }

module.exports = {
  closeDispatcher,
  createPinnedDispatcher,
  resolvePinnedHostnameWithPolicy,
  assertHttpUrlTargetsPrivateNetwork,
  ssrfPolicyFromAllowPrivateNetwork,
};
