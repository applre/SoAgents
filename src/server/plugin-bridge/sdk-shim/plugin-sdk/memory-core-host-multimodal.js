// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/memory-core-host-multimodal.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/memory-core-host-multimodal.' + fn + '() not implemented in Bridge mode'); }
}

function isMemoryMultimodalEnabled() { _w('isMemoryMultimodalEnabled'); return false; }
function normalizeMemoryMultimodalSettings() { _w('normalizeMemoryMultimodalSettings'); return ""; }

module.exports = {
  isMemoryMultimodalEnabled,
  normalizeMemoryMultimodalSettings,
};
