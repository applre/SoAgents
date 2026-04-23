// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/channel-reply-pipeline.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/channel-reply-pipeline.' + fn + '() not implemented in Bridge mode'); }
}

function createChannelReplyPipeline() { _w('createChannelReplyPipeline'); return undefined; }

module.exports = {
  createChannelReplyPipeline,
};
