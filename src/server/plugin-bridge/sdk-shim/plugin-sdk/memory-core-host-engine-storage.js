// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/memory-core-host-engine-storage.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/memory-core-host-engine-storage.' + fn + '() not implemented in Bridge mode'); }
}

function buildFileEntry() { _w('buildFileEntry'); return undefined; }
function buildMultimodalChunkForIndexing() { _w('buildMultimodalChunkForIndexing'); return undefined; }
function chunkMarkdown() { _w('chunkMarkdown'); return undefined; }
function cosineSimilarity() { _w('cosineSimilarity'); return undefined; }
function ensureDir() { _w('ensureDir'); return undefined; }
function hashText() { _w('hashText'); return undefined; }
function listMemoryFiles() { _w('listMemoryFiles'); return []; }
function normalizeExtraMemoryPaths() { _w('normalizeExtraMemoryPaths'); return ""; }
function parseEmbedding() { _w('parseEmbedding'); return undefined; }
function remapChunkLines() { _w('remapChunkLines'); return undefined; }
function runWithConcurrency() { _w('runWithConcurrency'); return undefined; }
function readMemoryFile() { _w('readMemoryFile'); return undefined; }
const resolveMemoryBackendConfig = undefined;
const ensureMemoryIndexSchema = undefined;
function loadSqliteVecExtension() { _w('loadSqliteVecExtension'); return undefined; }
function requireNodeSqlite() { _w('requireNodeSqlite'); return undefined; }
function isFileMissingError() { _w('isFileMissingError'); return false; }
function statRegularFile() { _w('statRegularFile'); return undefined; }

module.exports = {
  buildFileEntry,
  buildMultimodalChunkForIndexing,
  chunkMarkdown,
  cosineSimilarity,
  ensureDir,
  hashText,
  listMemoryFiles,
  normalizeExtraMemoryPaths,
  parseEmbedding,
  remapChunkLines,
  runWithConcurrency,
  readMemoryFile,
  resolveMemoryBackendConfig,
  ensureMemoryIndexSchema,
  loadSqliteVecExtension,
  requireNodeSqlite,
  isFileMissingError,
  statRegularFile,
};
