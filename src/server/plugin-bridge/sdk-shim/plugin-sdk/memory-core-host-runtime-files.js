// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/memory-core-host-runtime-files.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/memory-core-host-runtime-files.' + fn + '() not implemented in Bridge mode'); }
}

function listMemoryFiles() { _w('listMemoryFiles'); return []; }
function normalizeExtraMemoryPaths() { _w('normalizeExtraMemoryPaths'); return ""; }
function readAgentMemoryFile() { _w('readAgentMemoryFile'); return undefined; }
const resolveMemoryBackendConfig = undefined;

module.exports = {
  listMemoryFiles,
  normalizeExtraMemoryPaths,
  readAgentMemoryFile,
  resolveMemoryBackendConfig,
};
