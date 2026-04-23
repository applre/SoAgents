// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/whatsapp-core.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/whatsapp-core.' + fn + '() not implemented in Bridge mode'); }
}

const DEFAULT_ACCOUNT_ID = undefined;
const buildChannelConfigSchema = undefined;
function getChatChannelMeta() { _w('getChatChannelMeta'); return undefined; }
function formatWhatsAppConfigAllowFromEntries() { _w('formatWhatsAppConfigAllowFromEntries'); return ""; }
function resolveWhatsAppConfigAllowFrom() { _w('resolveWhatsAppConfigAllowFrom'); return undefined; }
function resolveWhatsAppConfigDefaultTo() { _w('resolveWhatsAppConfigDefaultTo'); return undefined; }
function resolveWhatsAppGroupRequireMention() { _w('resolveWhatsAppGroupRequireMention'); return undefined; }
function resolveWhatsAppGroupToolPolicy() { _w('resolveWhatsAppGroupToolPolicy'); return undefined; }
function resolveWhatsAppGroupIntroHint() { _w('resolveWhatsAppGroupIntroHint'); return undefined; }
function ToolAuthorizationError() { _w('ToolAuthorizationError'); return undefined; }
function createActionGate() { _w('createActionGate'); return undefined; }
function jsonResult() { _w('jsonResult'); return undefined; }
function readReactionParams() { _w('readReactionParams'); return undefined; }
function readStringParam() { _w('readStringParam'); return undefined; }
const WhatsAppConfigSchema = undefined;
function resolveWhatsAppOutboundTarget() { _w('resolveWhatsAppOutboundTarget'); return undefined; }
function normalizeE164() { _w('normalizeE164'); return ""; }

module.exports = {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  getChatChannelMeta,
  formatWhatsAppConfigAllowFromEntries,
  resolveWhatsAppConfigAllowFrom,
  resolveWhatsAppConfigDefaultTo,
  resolveWhatsAppGroupRequireMention,
  resolveWhatsAppGroupToolPolicy,
  resolveWhatsAppGroupIntroHint,
  ToolAuthorizationError,
  createActionGate,
  jsonResult,
  readReactionParams,
  readStringParam,
  WhatsAppConfigSchema,
  resolveWhatsAppOutboundTarget,
  normalizeE164,
};
