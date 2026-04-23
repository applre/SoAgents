// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/channel-targets.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/channel-targets.' + fn + '() not implemented in Bridge mode'); }
}

function applyChannelMatchMeta() { _w('applyChannelMatchMeta'); return undefined; }
function buildChannelKeyCandidates() { _w('buildChannelKeyCandidates'); return undefined; }
function normalizeChannelSlug() { _w('normalizeChannelSlug'); return ""; }
function resolveChannelEntryMatch() { _w('resolveChannelEntryMatch'); return undefined; }
function resolveChannelEntryMatchWithFallback() { _w('resolveChannelEntryMatchWithFallback'); return undefined; }
const resolveChannelMatchConfig = undefined;
function resolveNestedAllowlistDecision() { _w('resolveNestedAllowlistDecision'); return undefined; }
function buildMessagingTarget() { _w('buildMessagingTarget'); return undefined; }
function ensureTargetId() { _w('ensureTargetId'); return undefined; }
function normalizeTargetId() { _w('normalizeTargetId'); return ""; }
function parseAtUserTarget() { _w('parseAtUserTarget'); return undefined; }
function parseMentionPrefixOrAtUserTarget() { _w('parseMentionPrefixOrAtUserTarget'); return undefined; }
function parseTargetMention() { _w('parseTargetMention'); return undefined; }
function parseTargetPrefix() { _w('parseTargetPrefix'); return undefined; }
function parseTargetPrefixes() { _w('parseTargetPrefixes'); return undefined; }
function requireTargetKind() { _w('requireTargetKind'); return undefined; }
function buildUnresolvedTargetResults() { _w('buildUnresolvedTargetResults'); return undefined; }
function resolveTargetsWithOptionalToken() { _w('resolveTargetsWithOptionalToken'); return undefined; }

module.exports = {
  applyChannelMatchMeta,
  buildChannelKeyCandidates,
  normalizeChannelSlug,
  resolveChannelEntryMatch,
  resolveChannelEntryMatchWithFallback,
  resolveChannelMatchConfig,
  resolveNestedAllowlistDecision,
  buildMessagingTarget,
  ensureTargetId,
  normalizeTargetId,
  parseAtUserTarget,
  parseMentionPrefixOrAtUserTarget,
  parseTargetMention,
  parseTargetPrefix,
  parseTargetPrefixes,
  requireTargetKind,
  buildUnresolvedTargetResults,
  resolveTargetsWithOptionalToken,
};
