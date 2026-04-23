// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/memory-core-host-runtime-core.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/memory-core-host-runtime-core.' + fn + '() not implemented in Bridge mode'); }
}

function resolveCronStyleNow() { _w('resolveCronStyleNow'); return undefined; }
const DEFAULT_PI_COMPACTION_RESERVE_TOKENS_FLOOR = undefined;
function resolveDefaultAgentId() { _w('resolveDefaultAgentId'); return undefined; }
function resolveSessionAgentId() { _w('resolveSessionAgentId'); return undefined; }
const resolveMemorySearchConfig = undefined;
function jsonResult() { _w('jsonResult'); return undefined; }
function readNumberParam() { _w('readNumberParam'); return undefined; }
function readStringParam() { _w('readStringParam'); return undefined; }
const SILENT_REPLY_TOKEN = undefined;
function parseNonNegativeByteSize() { _w('parseNonNegativeByteSize'); return undefined; }
const loadConfig = undefined;
function resolveStateDir() { _w('resolveStateDir'); return undefined; }
function resolveSessionTranscriptsDirForAgent() { _w('resolveSessionTranscriptsDirForAgent'); return undefined; }
const emptyPluginConfigSchema = undefined;
function parseAgentSessionKey() { _w('parseAgentSessionKey'); return undefined; }

module.exports = {
  resolveCronStyleNow,
  DEFAULT_PI_COMPACTION_RESERVE_TOKENS_FLOOR,
  resolveDefaultAgentId,
  resolveSessionAgentId,
  resolveMemorySearchConfig,
  jsonResult,
  readNumberParam,
  readStringParam,
  SILENT_REPLY_TOKEN,
  parseNonNegativeByteSize,
  loadConfig,
  resolveStateDir,
  resolveSessionTranscriptsDirForAgent,
  emptyPluginConfigSchema,
  parseAgentSessionKey,
};
