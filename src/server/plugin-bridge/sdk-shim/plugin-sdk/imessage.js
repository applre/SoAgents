// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/imessage.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/imessage.' + fn + '() not implemented in Bridge mode'); }
}

const DEFAULT_ACCOUNT_ID = undefined;
const PAIRING_APPROVED_MESSAGE = undefined;
function applyAccountNameToChannelSection() { _w('applyAccountNameToChannelSection'); return undefined; }
const buildChannelConfigSchema = undefined;
function deleteAccountFromConfigSection() { _w('deleteAccountFromConfigSection'); return undefined; }
const emptyPluginConfigSchema = undefined;
function formatPairingApproveHint() { _w('formatPairingApproveHint'); return ""; }
function getChatChannelMeta() { _w('getChatChannelMeta'); return undefined; }
function migrateBaseNameToDefaultAccount() { _w('migrateBaseNameToDefaultAccount'); return undefined; }
function normalizeAccountId() { _w('normalizeAccountId'); return ""; }
function setAccountEnabledInConfigSection() { _w('setAccountEnabledInConfigSection'); return undefined; }
function detectBinary() { _w('detectBinary'); return undefined; }
function formatDocsLink() { _w('formatDocsLink'); return ""; }
function formatTrimmedAllowFromEntries() { _w('formatTrimmedAllowFromEntries'); return ""; }
function resolveIMessageConfigAllowFrom() { _w('resolveIMessageConfigAllowFrom'); return undefined; }
function resolveIMessageConfigDefaultTo() { _w('resolveIMessageConfigDefaultTo'); return undefined; }
function looksLikeIMessageTargetId() { _w('looksLikeIMessageTargetId'); return undefined; }
function normalizeIMessageMessagingTarget() { _w('normalizeIMessageMessagingTarget'); return ""; }
function resolveAllowlistProviderRuntimeGroupPolicy() { _w('resolveAllowlistProviderRuntimeGroupPolicy'); return undefined; }
function resolveDefaultGroupPolicy() { _w('resolveDefaultGroupPolicy'); return undefined; }
function resolveIMessageGroupRequireMention() { _w('resolveIMessageGroupRequireMention'); return undefined; }
function resolveIMessageGroupToolPolicy() { _w('resolveIMessageGroupToolPolicy'); return undefined; }
const IMessageConfigSchema = undefined;
function resolveChannelMediaMaxBytes() { _w('resolveChannelMediaMaxBytes'); return undefined; }
function buildComputedAccountStatusSnapshot() { _w('buildComputedAccountStatusSnapshot'); return undefined; }
function collectStatusIssuesFromLastError() { _w('collectStatusIssuesFromLastError'); return []; }
function monitorIMessageProvider() { _w('monitorIMessageProvider'); return undefined; }
function probeIMessage() { _w('probeIMessage'); return undefined; }
function sendMessageIMessage() { _w('sendMessageIMessage'); return undefined; }

module.exports = {
  DEFAULT_ACCOUNT_ID,
  PAIRING_APPROVED_MESSAGE,
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  deleteAccountFromConfigSection,
  emptyPluginConfigSchema,
  formatPairingApproveHint,
  getChatChannelMeta,
  migrateBaseNameToDefaultAccount,
  normalizeAccountId,
  setAccountEnabledInConfigSection,
  detectBinary,
  formatDocsLink,
  formatTrimmedAllowFromEntries,
  resolveIMessageConfigAllowFrom,
  resolveIMessageConfigDefaultTo,
  looksLikeIMessageTargetId,
  normalizeIMessageMessagingTarget,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  resolveIMessageGroupRequireMention,
  resolveIMessageGroupToolPolicy,
  IMessageConfigSchema,
  resolveChannelMediaMaxBytes,
  buildComputedAccountStatusSnapshot,
  collectStatusIssuesFromLastError,
  monitorIMessageProvider,
  probeIMessage,
  sendMessageIMessage,
};
