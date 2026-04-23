// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/gateway-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/gateway-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function GatewayClient() { _w('GatewayClient'); return undefined; }
function createOperatorApprovalsGatewayClient() { _w('createOperatorApprovalsGatewayClient'); return undefined; }
function createConnectedChannelStatusPatch() { _w('createConnectedChannelStatusPatch'); return undefined; }

module.exports = {
  GatewayClient,
  createOperatorApprovalsGatewayClient,
  createConnectedChannelStatusPatch,
};
