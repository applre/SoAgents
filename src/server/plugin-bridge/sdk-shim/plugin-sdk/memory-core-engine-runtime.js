// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/memory-core-engine-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/memory-core-engine-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function getMemorySearchManager() { _w('getMemorySearchManager'); return undefined; }
function MemoryIndexManager() { _w('MemoryIndexManager'); return undefined; }

module.exports = {
  getMemorySearchManager,
  MemoryIndexManager,
};
