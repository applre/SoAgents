// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/llm-task.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/llm-task.' + fn + '() not implemented in Bridge mode'); }
}

function definePluginEntry() { _w('definePluginEntry'); return undefined; }
function resolvePreferredOpenClawTmpDir() { _w('resolvePreferredOpenClawTmpDir'); return undefined; }
function formatThinkingLevels() { _w('formatThinkingLevels'); return ""; }
function formatXHighModelHint() { _w('formatXHighModelHint'); return ""; }
function normalizeThinkLevel() { _w('normalizeThinkLevel'); return ""; }
function supportsXHighThinking() { _w('supportsXHighThinking'); return false; }

module.exports = {
  definePluginEntry,
  resolvePreferredOpenClawTmpDir,
  formatThinkingLevels,
  formatXHighModelHint,
  normalizeThinkLevel,
  supportsXHighThinking,
};
