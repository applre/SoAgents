// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/whatsapp-shared.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/whatsapp-shared.' + fn + '() not implemented in Bridge mode'); }
}

function createWhatsAppOutboundBase() { _w('createWhatsAppOutboundBase'); return undefined; }
function resolveWhatsAppGroupIntroHint() { _w('resolveWhatsAppGroupIntroHint'); return undefined; }
function resolveWhatsAppMentionStripRegexes() { _w('resolveWhatsAppMentionStripRegexes'); return undefined; }
function looksLikeWhatsAppTargetId() { _w('looksLikeWhatsAppTargetId'); return undefined; }
function normalizeWhatsAppAllowFromEntries() { _w('normalizeWhatsAppAllowFromEntries'); return ""; }
function normalizeWhatsAppMessagingTarget() { _w('normalizeWhatsAppMessagingTarget'); return ""; }
function resolveWhatsAppHeartbeatRecipients() { _w('resolveWhatsAppHeartbeatRecipients'); return undefined; }
function isWhatsAppGroupJid() { _w('isWhatsAppGroupJid'); return false; }
function isWhatsAppUserTarget() { _w('isWhatsAppUserTarget'); return false; }
function normalizeWhatsAppTarget() { _w('normalizeWhatsAppTarget'); return ""; }

module.exports = {
  createWhatsAppOutboundBase,
  resolveWhatsAppGroupIntroHint,
  resolveWhatsAppMentionStripRegexes,
  looksLikeWhatsAppTargetId,
  normalizeWhatsAppAllowFromEntries,
  normalizeWhatsAppMessagingTarget,
  resolveWhatsAppHeartbeatRecipients,
  isWhatsAppGroupJid,
  isWhatsAppUserTarget,
  normalizeWhatsAppTarget,
};
