// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/imessage-core.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/imessage-core.' + fn + '() not implemented in Bridge mode'); }
}

const DEFAULT_ACCOUNT_ID = undefined;
const buildChannelConfigSchema = undefined;
function deleteAccountFromConfigSection() { _w('deleteAccountFromConfigSection'); return undefined; }
function getChatChannelMeta() { _w('getChatChannelMeta'); return undefined; }
function setAccountEnabledInConfigSection() { _w('setAccountEnabledInConfigSection'); return undefined; }
function formatTrimmedAllowFromEntries() { _w('formatTrimmedAllowFromEntries'); return ""; }
function resolveIMessageConfigAllowFrom() { _w('resolveIMessageConfigAllowFrom'); return undefined; }
function resolveIMessageConfigDefaultTo() { _w('resolveIMessageConfigDefaultTo'); return undefined; }
const IMessageConfigSchema = undefined;
function parseChatAllowTargetPrefixes() { _w('parseChatAllowTargetPrefixes'); return undefined; }
function parseChatTargetPrefixesOrThrow() { _w('parseChatTargetPrefixesOrThrow'); return undefined; }
function resolveServicePrefixedAllowTarget() { _w('resolveServicePrefixedAllowTarget'); return undefined; }
function resolveServicePrefixedTarget() { _w('resolveServicePrefixedTarget'); return undefined; }

module.exports = {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  deleteAccountFromConfigSection,
  getChatChannelMeta,
  setAccountEnabledInConfigSection,
  formatTrimmedAllowFromEntries,
  resolveIMessageConfigAllowFrom,
  resolveIMessageConfigDefaultTo,
  IMessageConfigSchema,
  parseChatAllowTargetPrefixes,
  parseChatTargetPrefixesOrThrow,
  resolveServicePrefixedAllowTarget,
  resolveServicePrefixedTarget,
};
