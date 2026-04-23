// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/msteams.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/msteams.' + fn + '() not implemented in Bridge mode'); }
}

const msteamsSetupWizard = undefined;
const msteamsSetupAdapter = undefined;
function buildPendingHistoryContextFromMap() { _w('buildPendingHistoryContextFromMap'); return undefined; }
function clearHistoryEntriesIfEnabled() { _w('clearHistoryEntriesIfEnabled'); return undefined; }
const DEFAULT_GROUP_HISTORY_LIMIT = undefined;
function recordPendingHistoryEntryIfEnabled() { _w('recordPendingHistoryEntryIfEnabled'); return undefined; }
function isSilentReplyText() { _w('isSilentReplyText'); return false; }
const SILENT_REPLY_TOKEN = undefined;
function mergeAllowlist() { _w('mergeAllowlist'); return undefined; }
function summarizeMapping() { _w('summarizeMapping'); return undefined; }
function resolveControlCommandGate() { _w('resolveControlCommandGate'); return undefined; }
function resolveDualTextControlCommandGate() { _w('resolveDualTextControlCommandGate'); return undefined; }
function logInboundDrop() { _w('logInboundDrop'); return undefined; }
function logTypingFailure() { _w('logTypingFailure'); return undefined; }
function resolveMentionGating() { _w('resolveMentionGating'); return undefined; }
function formatAllowlistMatchMeta() { _w('formatAllowlistMatchMeta'); return ""; }
function resolveAllowlistMatchSimple() { _w('resolveAllowlistMatchSimple'); return undefined; }
function buildChannelKeyCandidates() { _w('buildChannelKeyCandidates'); return undefined; }
function normalizeChannelSlug() { _w('normalizeChannelSlug'); return ""; }
function resolveChannelEntryMatchWithFallback() { _w('resolveChannelEntryMatchWithFallback'); return undefined; }
function resolveNestedAllowlistDecision() { _w('resolveNestedAllowlistDecision'); return undefined; }
const buildChannelConfigSchema = undefined;
function resolveChannelMediaMaxBytes() { _w('resolveChannelMediaMaxBytes'); return undefined; }
function buildMediaPayload() { _w('buildMediaPayload'); return undefined; }
function addWildcardAllowFrom() { _w('addWildcardAllowFrom'); return undefined; }
function mergeAllowFromEntries() { _w('mergeAllowFromEntries'); return undefined; }
function setTopLevelChannelAllowFrom() { _w('setTopLevelChannelAllowFrom'); return undefined; }
function setTopLevelChannelDmPolicyWithAllowFrom() { _w('setTopLevelChannelDmPolicyWithAllowFrom'); return undefined; }
function setTopLevelChannelGroupPolicy() { _w('setTopLevelChannelGroupPolicy'); return undefined; }
function splitSetupEntries() { _w('splitSetupEntries'); return undefined; }
const PAIRING_APPROVED_MESSAGE = undefined;
function resolveOutboundMediaUrls() { _w('resolveOutboundMediaUrls'); return undefined; }
function resolveSendableOutboundReplyParts() { _w('resolveSendableOutboundReplyParts'); return undefined; }
function createChannelReplyPipeline() { _w('createChannelReplyPipeline'); return undefined; }
function isDangerousNameMatchingEnabled() { _w('isDangerousNameMatchingEnabled'); return false; }
function resolveToolsBySender() { _w('resolveToolsBySender'); return undefined; }
function resolveAllowlistProviderRuntimeGroupPolicy() { _w('resolveAllowlistProviderRuntimeGroupPolicy'); return undefined; }
function resolveDefaultGroupPolicy() { _w('resolveDefaultGroupPolicy'); return undefined; }
function hasConfiguredSecretInput() { _w('hasConfiguredSecretInput'); return false; }
function normalizeResolvedSecretInputString() { _w('normalizeResolvedSecretInputString'); return ""; }
function normalizeSecretInputString() { _w('normalizeSecretInputString'); return ""; }
const MSTeamsConfigSchema = undefined;
const DEFAULT_WEBHOOK_MAX_BODY_BYTES = undefined;
function fetchWithSsrFGuard() { _w('fetchWithSsrFGuard'); return undefined; }
function isPrivateIpAddress() { _w('isPrivateIpAddress'); return false; }
function detectMime() { _w('detectMime'); return undefined; }
function extensionForMime() { _w('extensionForMime'); return undefined; }
function getFileExtension() { _w('getFileExtension'); return undefined; }
function extractOriginalFilename() { _w('extractOriginalFilename'); return undefined; }
const emptyPluginConfigSchema = undefined;
const DEFAULT_ACCOUNT_ID = undefined;
function readStoreAllowFromForDmPolicy() { _w('readStoreAllowFromForDmPolicy'); return undefined; }
function resolveDmGroupAccessWithLists() { _w('resolveDmGroupAccessWithLists'); return undefined; }
function resolveEffectiveAllowFromLists() { _w('resolveEffectiveAllowFromLists'); return undefined; }
function evaluateSenderGroupAccessForPolicy() { _w('evaluateSenderGroupAccessForPolicy'); return undefined; }
function resolveSenderScopedGroupPolicy() { _w('resolveSenderScopedGroupPolicy'); return undefined; }
function formatDocsLink() { _w('formatDocsLink'); return ""; }
function sleep() { _w('sleep'); return undefined; }
function loadWebMedia() { _w('loadWebMedia'); return undefined; }
function keepHttpServerTaskAlive() { _w('keepHttpServerTaskAlive'); return undefined; }
function withFileLock() { _w('withFileLock'); return undefined; }
function dispatchReplyFromConfigWithSettledDispatcher() { _w('dispatchReplyFromConfigWithSettledDispatcher'); return undefined; }
function readJsonFileWithFallback() { _w('readJsonFileWithFallback'); return undefined; }
function writeJsonFileAtomically() { _w('writeJsonFileAtomically'); return undefined; }
function loadOutboundMediaFromUrl() { _w('loadOutboundMediaFromUrl'); return undefined; }
function createChannelPairingController() { _w('createChannelPairingController'); return undefined; }
function resolveInboundSessionEnvelopeContext() { _w('resolveInboundSessionEnvelopeContext'); return undefined; }
function buildHostnameAllowlistPolicyFromSuffixAllowlist() { _w('buildHostnameAllowlistPolicyFromSuffixAllowlist'); return undefined; }
function isHttpsUrlAllowedByHostnameSuffixAllowlist() { _w('isHttpsUrlAllowedByHostnameSuffixAllowlist'); return false; }
function normalizeHostnameSuffixAllowlist() { _w('normalizeHostnameSuffixAllowlist'); return ""; }
function buildBaseChannelStatusSummary() { _w('buildBaseChannelStatusSummary'); return undefined; }
function buildProbeChannelStatusSummary() { _w('buildProbeChannelStatusSummary'); return undefined; }
function buildRuntimeAccountStatusSnapshot() { _w('buildRuntimeAccountStatusSnapshot'); return undefined; }
function createDefaultChannelRuntimeState() { _w('createDefaultChannelRuntimeState'); return undefined; }
function normalizeStringEntries() { _w('normalizeStringEntries'); return ""; }

module.exports = {
  msteamsSetupWizard,
  msteamsSetupAdapter,
  buildPendingHistoryContextFromMap,
  clearHistoryEntriesIfEnabled,
  DEFAULT_GROUP_HISTORY_LIMIT,
  recordPendingHistoryEntryIfEnabled,
  isSilentReplyText,
  SILENT_REPLY_TOKEN,
  mergeAllowlist,
  summarizeMapping,
  resolveControlCommandGate,
  resolveDualTextControlCommandGate,
  logInboundDrop,
  logTypingFailure,
  resolveMentionGating,
  formatAllowlistMatchMeta,
  resolveAllowlistMatchSimple,
  buildChannelKeyCandidates,
  normalizeChannelSlug,
  resolveChannelEntryMatchWithFallback,
  resolveNestedAllowlistDecision,
  buildChannelConfigSchema,
  resolveChannelMediaMaxBytes,
  buildMediaPayload,
  addWildcardAllowFrom,
  mergeAllowFromEntries,
  setTopLevelChannelAllowFrom,
  setTopLevelChannelDmPolicyWithAllowFrom,
  setTopLevelChannelGroupPolicy,
  splitSetupEntries,
  PAIRING_APPROVED_MESSAGE,
  resolveOutboundMediaUrls,
  resolveSendableOutboundReplyParts,
  createChannelReplyPipeline,
  isDangerousNameMatchingEnabled,
  resolveToolsBySender,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
  normalizeSecretInputString,
  MSTeamsConfigSchema,
  DEFAULT_WEBHOOK_MAX_BODY_BYTES,
  fetchWithSsrFGuard,
  isPrivateIpAddress,
  detectMime,
  extensionForMime,
  getFileExtension,
  extractOriginalFilename,
  emptyPluginConfigSchema,
  DEFAULT_ACCOUNT_ID,
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithLists,
  resolveEffectiveAllowFromLists,
  evaluateSenderGroupAccessForPolicy,
  resolveSenderScopedGroupPolicy,
  formatDocsLink,
  sleep,
  loadWebMedia,
  keepHttpServerTaskAlive,
  withFileLock,
  dispatchReplyFromConfigWithSettledDispatcher,
  readJsonFileWithFallback,
  writeJsonFileAtomically,
  loadOutboundMediaFromUrl,
  createChannelPairingController,
  resolveInboundSessionEnvelopeContext,
  buildHostnameAllowlistPolicyFromSuffixAllowlist,
  isHttpsUrlAllowedByHostnameSuffixAllowlist,
  normalizeHostnameSuffixAllowlist,
  buildBaseChannelStatusSummary,
  buildProbeChannelStatusSummary,
  buildRuntimeAccountStatusSnapshot,
  createDefaultChannelRuntimeState,
  normalizeStringEntries,
};
