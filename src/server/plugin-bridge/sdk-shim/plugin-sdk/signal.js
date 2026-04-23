// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/signal.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/signal.' + fn + '() not implemented in Bridge mode'); }
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
function formatCliCommand() { _w('formatCliCommand'); return ""; }
function formatDocsLink() { _w('formatDocsLink'); return ""; }
function looksLikeSignalTargetId() { _w('looksLikeSignalTargetId'); return undefined; }
function normalizeSignalMessagingTarget() { _w('normalizeSignalMessagingTarget'); return ""; }
function detectBinary() { _w('detectBinary'); return undefined; }
function installSignalCli() { _w('installSignalCli'); return undefined; }
function resolveAllowlistProviderRuntimeGroupPolicy() { _w('resolveAllowlistProviderRuntimeGroupPolicy'); return undefined; }
function resolveDefaultGroupPolicy() { _w('resolveDefaultGroupPolicy'); return undefined; }
const SignalConfigSchema = undefined;
function normalizeE164() { _w('normalizeE164'); return ""; }
function resolveChannelMediaMaxBytes() { _w('resolveChannelMediaMaxBytes'); return undefined; }
function buildBaseAccountStatusSnapshot() { _w('buildBaseAccountStatusSnapshot'); return undefined; }
function buildBaseChannelStatusSummary() { _w('buildBaseChannelStatusSummary'); return undefined; }
function collectStatusIssuesFromLastError() { _w('collectStatusIssuesFromLastError'); return []; }
function createDefaultChannelRuntimeState() { _w('createDefaultChannelRuntimeState'); return undefined; }
function listEnabledSignalAccounts() { _w('listEnabledSignalAccounts'); return []; }
function listSignalAccountIds() { _w('listSignalAccountIds'); return []; }
function resolveDefaultSignalAccountId() { _w('resolveDefaultSignalAccountId'); return undefined; }
function monitorSignalProvider() { _w('monitorSignalProvider'); return undefined; }
function probeSignal() { _w('probeSignal'); return undefined; }
function resolveSignalReactionLevel() { _w('resolveSignalReactionLevel'); return undefined; }
function removeReactionSignal() { _w('removeReactionSignal'); return undefined; }
function sendReactionSignal() { _w('sendReactionSignal'); return undefined; }
function sendMessageSignal() { _w('sendMessageSignal'); return undefined; }
function signalMessageActions() { _w('signalMessageActions'); return undefined; }

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
  formatCliCommand,
  formatDocsLink,
  looksLikeSignalTargetId,
  normalizeSignalMessagingTarget,
  detectBinary,
  installSignalCli,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  SignalConfigSchema,
  normalizeE164,
  resolveChannelMediaMaxBytes,
  buildBaseAccountStatusSnapshot,
  buildBaseChannelStatusSummary,
  collectStatusIssuesFromLastError,
  createDefaultChannelRuntimeState,
  listEnabledSignalAccounts,
  listSignalAccountIds,
  resolveDefaultSignalAccountId,
  monitorSignalProvider,
  probeSignal,
  resolveSignalReactionLevel,
  removeReactionSignal,
  sendReactionSignal,
  sendMessageSignal,
  signalMessageActions,
};
