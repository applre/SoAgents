// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/telegram-core.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/telegram-core.' + fn + '() not implemented in Bridge mode'); }
}

const emptyPluginConfigSchema = undefined;
const DEFAULT_ACCOUNT_ID = undefined;
function normalizeAccountId() { _w('normalizeAccountId'); return ""; }
function parseTelegramTopicConversation() { _w('parseTelegramTopicConversation'); return undefined; }
function clearAccountEntryFields() { _w('clearAccountEntryFields'); return undefined; }
function resolveTelegramPollVisibility() { _w('resolveTelegramPollVisibility'); return undefined; }
const PAIRING_APPROVED_MESSAGE = undefined;
function applyAccountNameToChannelSection() { _w('applyAccountNameToChannelSection'); return undefined; }
const buildChannelConfigSchema = undefined;
function deleteAccountFromConfigSection() { _w('deleteAccountFromConfigSection'); return undefined; }
function formatPairingApproveHint() { _w('formatPairingApproveHint'); return ""; }
function getChatChannelMeta() { _w('getChatChannelMeta'); return undefined; }
function migrateBaseNameToDefaultAccount() { _w('migrateBaseNameToDefaultAccount'); return undefined; }
function setAccountEnabledInConfigSection() { _w('setAccountEnabledInConfigSection'); return undefined; }
function projectCredentialSnapshotFields() { _w('projectCredentialSnapshotFields'); return undefined; }
function resolveConfiguredFromCredentialStatuses() { _w('resolveConfiguredFromCredentialStatuses'); return undefined; }
function resolveAllowlistProviderRuntimeGroupPolicy() { _w('resolveAllowlistProviderRuntimeGroupPolicy'); return undefined; }
function resolveDefaultGroupPolicy() { _w('resolveDefaultGroupPolicy'); return undefined; }
function jsonResult() { _w('jsonResult'); return undefined; }
function readNumberParam() { _w('readNumberParam'); return undefined; }
function readReactionParams() { _w('readReactionParams'); return undefined; }
function readStringArrayParam() { _w('readStringArrayParam'); return undefined; }
function readStringOrNumberParam() { _w('readStringOrNumberParam'); return undefined; }
function readStringParam() { _w('readStringParam'); return undefined; }
const TelegramConfigSchema = undefined;
function resolvePollMaxSelections() { _w('resolvePollMaxSelections'); return undefined; }
function buildTokenChannelStatusSummary() { _w('buildTokenChannelStatusSummary'); return undefined; }

module.exports = {
  emptyPluginConfigSchema,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  parseTelegramTopicConversation,
  clearAccountEntryFields,
  resolveTelegramPollVisibility,
  PAIRING_APPROVED_MESSAGE,
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  getChatChannelMeta,
  migrateBaseNameToDefaultAccount,
  setAccountEnabledInConfigSection,
  projectCredentialSnapshotFields,
  resolveConfiguredFromCredentialStatuses,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringArrayParam,
  readStringOrNumberParam,
  readStringParam,
  TelegramConfigSchema,
  resolvePollMaxSelections,
  buildTokenChannelStatusSummary,
};
