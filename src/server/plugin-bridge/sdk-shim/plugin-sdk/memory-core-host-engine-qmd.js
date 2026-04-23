// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/memory-core-host-engine-qmd.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/memory-core-host-engine-qmd.' + fn + '() not implemented in Bridge mode'); }
}

function extractKeywords() { _w('extractKeywords'); return undefined; }
function isQueryStopWordToken() { _w('isQueryStopWordToken'); return false; }
function buildSessionEntry() { _w('buildSessionEntry'); return undefined; }
function listSessionFilesForAgent() { _w('listSessionFilesForAgent'); return []; }
function sessionPathForFile() { _w('sessionPathForFile'); return undefined; }
function parseQmdQueryJson() { _w('parseQmdQueryJson'); return undefined; }
function deriveQmdScopeChannel() { _w('deriveQmdScopeChannel'); return undefined; }
function deriveQmdScopeChatType() { _w('deriveQmdScopeChatType'); return undefined; }
function isQmdScopeAllowed() { _w('isQmdScopeAllowed'); return false; }
function resolveCliSpawnInvocation() { _w('resolveCliSpawnInvocation'); return undefined; }
function runCliCommand() { _w('runCliCommand'); return undefined; }

module.exports = {
  extractKeywords,
  isQueryStopWordToken,
  buildSessionEntry,
  listSessionFilesForAgent,
  sessionPathForFile,
  parseQmdQueryJson,
  deriveQmdScopeChannel,
  deriveQmdScopeChatType,
  isQmdScopeAllowed,
  resolveCliSpawnInvocation,
  runCliCommand,
};
