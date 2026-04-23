// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/memory-core.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/memory-core.' + fn + '() not implemented in Bridge mode'); }
}

function getMemorySearchManager() { _w('getMemorySearchManager'); return undefined; }
function MemoryIndexManager() { _w('MemoryIndexManager'); return undefined; }
const DEFAULT_PI_COMPACTION_RESERVE_TOKENS_FLOOR = undefined;
const emptyPluginConfigSchema = undefined;
function jsonResult() { _w('jsonResult'); return undefined; }
const loadConfig = undefined;
function parseAgentSessionKey() { _w('parseAgentSessionKey'); return undefined; }
function parseNonNegativeByteSize() { _w('parseNonNegativeByteSize'); return undefined; }
function readNumberParam() { _w('readNumberParam'); return undefined; }
function readStringParam() { _w('readStringParam'); return undefined; }
function resolveCronStyleNow() { _w('resolveCronStyleNow'); return undefined; }
function resolveDefaultAgentId() { _w('resolveDefaultAgentId'); return undefined; }
const resolveMemorySearchConfig = undefined;
function resolveSessionAgentId() { _w('resolveSessionAgentId'); return undefined; }
function resolveSessionTranscriptsDirForAgent() { _w('resolveSessionTranscriptsDirForAgent'); return undefined; }
function resolveStateDir() { _w('resolveStateDir'); return undefined; }
const SILENT_REPLY_TOKEN = undefined;
function colorize() { _w('colorize'); return undefined; }
function defaultRuntime() { _w('defaultRuntime'); return undefined; }
function formatDocsLink() { _w('formatDocsLink'); return ""; }
function formatErrorMessage() { _w('formatErrorMessage'); return ""; }
function formatHelpExamples() { _w('formatHelpExamples'); return ""; }
function isRich() { _w('isRich'); return false; }
function isVerbose() { _w('isVerbose'); return false; }
function resolveCommandSecretRefsViaGateway() { _w('resolveCommandSecretRefsViaGateway'); return undefined; }
function setVerbose() { _w('setVerbose'); return undefined; }
function shortenHomeInString() { _w('shortenHomeInString'); return undefined; }
function shortenHomePath() { _w('shortenHomePath'); return undefined; }
function theme() { _w('theme'); return undefined; }
function withManager() { _w('withManager'); return undefined; }
function withProgress() { _w('withProgress'); return undefined; }
function withProgressTotals() { _w('withProgressTotals'); return undefined; }
function listMemoryFiles() { _w('listMemoryFiles'); return []; }
function normalizeExtraMemoryPaths() { _w('normalizeExtraMemoryPaths'); return ""; }
function readAgentMemoryFile() { _w('readAgentMemoryFile'); return undefined; }
const resolveMemoryBackendConfig = undefined;

module.exports = {
  getMemorySearchManager,
  MemoryIndexManager,
  DEFAULT_PI_COMPACTION_RESERVE_TOKENS_FLOOR,
  emptyPluginConfigSchema,
  jsonResult,
  loadConfig,
  parseAgentSessionKey,
  parseNonNegativeByteSize,
  readNumberParam,
  readStringParam,
  resolveCronStyleNow,
  resolveDefaultAgentId,
  resolveMemorySearchConfig,
  resolveSessionAgentId,
  resolveSessionTranscriptsDirForAgent,
  resolveStateDir,
  SILENT_REPLY_TOKEN,
  colorize,
  defaultRuntime,
  formatDocsLink,
  formatErrorMessage,
  formatHelpExamples,
  isRich,
  isVerbose,
  resolveCommandSecretRefsViaGateway,
  setVerbose,
  shortenHomeInString,
  shortenHomePath,
  theme,
  withManager,
  withProgress,
  withProgressTotals,
  listMemoryFiles,
  normalizeExtraMemoryPaths,
  readAgentMemoryFile,
  resolveMemoryBackendConfig,
};
