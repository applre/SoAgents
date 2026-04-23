// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/slack-targets.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/slack-targets.' + fn + '() not implemented in Bridge mode'); }
}

function looksLikeSlackTargetId() { _w('looksLikeSlackTargetId'); return undefined; }
function normalizeSlackMessagingTarget() { _w('normalizeSlackMessagingTarget'); return ""; }
function parseSlackTarget() { _w('parseSlackTarget'); return undefined; }
function resolveSlackChannelId() { _w('resolveSlackChannelId'); return undefined; }

module.exports = {
  looksLikeSlackTargetId,
  normalizeSlackMessagingTarget,
  parseSlackTarget,
  resolveSlackChannelId,
};
