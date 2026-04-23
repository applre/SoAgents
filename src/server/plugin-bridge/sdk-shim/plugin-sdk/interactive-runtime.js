// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/interactive-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/interactive-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function reduceInteractiveReply() { _w('reduceInteractiveReply'); return undefined; }
function hasInteractiveReplyBlocks() { _w('hasInteractiveReplyBlocks'); return false; }
function hasReplyChannelData() { _w('hasReplyChannelData'); return false; }
function hasReplyContent() { _w('hasReplyContent'); return false; }
function normalizeInteractiveReply() { _w('normalizeInteractiveReply'); return ""; }
function resolveInteractiveTextFallback() { _w('resolveInteractiveTextFallback'); return undefined; }

module.exports = {
  reduceInteractiveReply,
  hasInteractiveReplyBlocks,
  hasReplyChannelData,
  hasReplyContent,
  normalizeInteractiveReply,
  resolveInteractiveTextFallback,
};
