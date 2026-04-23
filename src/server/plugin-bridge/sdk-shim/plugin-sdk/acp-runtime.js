// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/acp-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/acp-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function getAcpSessionManager() { _w('getAcpSessionManager'); return undefined; }
function AcpRuntimeError() { _w('AcpRuntimeError'); return undefined; }
function isAcpRuntimeError() { _w('isAcpRuntimeError'); return false; }
function getAcpRuntimeBackend() { _w('getAcpRuntimeBackend'); return undefined; }
function registerAcpRuntimeBackend() { _w('registerAcpRuntimeBackend'); return undefined; }
function requireAcpRuntimeBackend() { _w('requireAcpRuntimeBackend'); return undefined; }
function unregisterAcpRuntimeBackend() { _w('unregisterAcpRuntimeBackend'); return undefined; }
function readAcpSessionEntry() { _w('readAcpSessionEntry'); return undefined; }

module.exports = {
  getAcpSessionManager,
  AcpRuntimeError,
  isAcpRuntimeError,
  getAcpRuntimeBackend,
  registerAcpRuntimeBackend,
  requireAcpRuntimeBackend,
  unregisterAcpRuntimeBackend,
  readAcpSessionEntry,
};
