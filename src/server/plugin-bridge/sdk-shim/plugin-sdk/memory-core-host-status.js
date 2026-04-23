// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/memory-core-host-status.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/memory-core-host-status.' + fn + '() not implemented in Bridge mode'); }
}

function resolveMemoryCacheSummary() { _w('resolveMemoryCacheSummary'); return undefined; }
function resolveMemoryFtsState() { _w('resolveMemoryFtsState'); return undefined; }
function resolveMemoryVectorState() { _w('resolveMemoryVectorState'); return undefined; }

module.exports = {
  resolveMemoryCacheSummary,
  resolveMemoryFtsState,
  resolveMemoryVectorState,
};
