// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/outbound-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/outbound-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function createRuntimeOutboundDelegates() { _w('createRuntimeOutboundDelegates'); return undefined; }
function resolveOutboundSendDep() { _w('resolveOutboundSendDep'); return undefined; }
function resolveAgentOutboundIdentity() { _w('resolveAgentOutboundIdentity'); return undefined; }

module.exports = {
  createRuntimeOutboundDelegates,
  resolveOutboundSendDep,
  resolveAgentOutboundIdentity,
};
