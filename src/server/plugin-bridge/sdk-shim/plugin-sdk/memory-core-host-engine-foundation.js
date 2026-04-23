// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/memory-core-host-engine-foundation.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/memory-core-host-engine-foundation.' + fn + '() not implemented in Bridge mode'); }
}

function resolveAgentDir() { _w('resolveAgentDir'); return undefined; }
function resolveAgentWorkspaceDir() { _w('resolveAgentWorkspaceDir'); return undefined; }
function resolveDefaultAgentId() { _w('resolveDefaultAgentId'); return undefined; }
function resolveSessionAgentId() { _w('resolveSessionAgentId'); return undefined; }
const resolveMemorySearchConfig = undefined;
function parseDurationMs() { _w('parseDurationMs'); return undefined; }
const loadConfig = undefined;
function resolveStateDir() { _w('resolveStateDir'); return undefined; }
function resolveSessionTranscriptsDirForAgent() { _w('resolveSessionTranscriptsDirForAgent'); return undefined; }
function hasConfiguredSecretInput() { _w('hasConfiguredSecretInput'); return false; }
function normalizeResolvedSecretInputString() { _w('normalizeResolvedSecretInputString'); return ""; }
function writeFileWithinRoot() { _w('writeFileWithinRoot'); return undefined; }
function createSubsystemLogger() { _w('createSubsystemLogger'); return undefined; }
function detectMime() { _w('detectMime'); return undefined; }
function resolveGlobalSingleton() { _w('resolveGlobalSingleton'); return undefined; }
function onSessionTranscriptUpdate() { _w('onSessionTranscriptUpdate'); return undefined; }
function splitShellArgs() { _w('splitShellArgs'); return undefined; }
function runTasksWithConcurrency() { _w('runTasksWithConcurrency'); return undefined; }
function shortenHomeInString() { _w('shortenHomeInString'); return undefined; }
function shortenHomePath() { _w('shortenHomePath'); return undefined; }
function resolveUserPath() { _w('resolveUserPath'); return undefined; }
function truncateUtf16Safe() { _w('truncateUtf16Safe'); return undefined; }

module.exports = {
  resolveAgentDir,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
  resolveSessionAgentId,
  resolveMemorySearchConfig,
  parseDurationMs,
  loadConfig,
  resolveStateDir,
  resolveSessionTranscriptsDirForAgent,
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
  writeFileWithinRoot,
  createSubsystemLogger,
  detectMime,
  resolveGlobalSingleton,
  onSessionTranscriptUpdate,
  splitShellArgs,
  runTasksWithConcurrency,
  shortenHomeInString,
  shortenHomePath,
  resolveUserPath,
  truncateUtf16Safe,
};
