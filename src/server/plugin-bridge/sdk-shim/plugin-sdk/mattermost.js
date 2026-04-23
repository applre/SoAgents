// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/mattermost.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/mattermost.' + fn + '() not implemented in Bridge mode'); }
}

function formatInboundFromLabel() { _w('formatInboundFromLabel'); return ""; }
function buildPendingHistoryContextFromMap() { _w('buildPendingHistoryContextFromMap'); return undefined; }
function clearHistoryEntriesIfEnabled() { _w('clearHistoryEntriesIfEnabled'); return undefined; }
const DEFAULT_GROUP_HISTORY_LIMIT = undefined;
function recordPendingHistoryEntryIfEnabled() { _w('recordPendingHistoryEntryIfEnabled'); return undefined; }
function listSkillCommandsForAgents() { _w('listSkillCommandsForAgents'); return []; }
function resolveControlCommandGate() { _w('resolveControlCommandGate'); return undefined; }
function logInboundDrop() { _w('logInboundDrop'); return undefined; }
function logTypingFailure() { _w('logTypingFailure'); return undefined; }
function resolveAllowlistMatchSimple() { _w('resolveAllowlistMatchSimple'); return undefined; }
function normalizeProviderId() { _w('normalizeProviderId'); return ""; }
function buildModelsProviderData() { _w('buildModelsProviderData'); return undefined; }
function resolveStoredModelOverride() { _w('resolveStoredModelOverride'); return undefined; }
function deleteAccountFromConfigSection() { _w('deleteAccountFromConfigSection'); return undefined; }
function setAccountEnabledInConfigSection() { _w('setAccountEnabledInConfigSection'); return undefined; }
const buildChannelConfigSchema = undefined;
function formatPairingApproveHint() { _w('formatPairingApproveHint'); return ""; }
function resolveChannelMediaMaxBytes() { _w('resolveChannelMediaMaxBytes'); return undefined; }
function buildSingleChannelSecretPromptState() { _w('buildSingleChannelSecretPromptState'); return undefined; }
function promptSingleChannelSecretInput() { _w('promptSingleChannelSecretInput'); return undefined; }
function runSingleChannelSecretStep() { _w('runSingleChannelSecretStep'); return undefined; }
function applyAccountNameToChannelSection() { _w('applyAccountNameToChannelSection'); return undefined; }
function applySetupAccountConfigPatch() { _w('applySetupAccountConfigPatch'); return undefined; }
function migrateBaseNameToDefaultAccount() { _w('migrateBaseNameToDefaultAccount'); return undefined; }
function createAccountStatusSink() { _w('createAccountStatusSink'); return undefined; }
function buildComputedAccountStatusSnapshot() { _w('buildComputedAccountStatusSnapshot'); return undefined; }
function createAccountListHelpers() { _w('createAccountListHelpers'); return undefined; }
function createChannelReplyPipeline() { _w('createChannelReplyPipeline'); return undefined; }
function isDangerousNameMatchingEnabled() { _w('isDangerousNameMatchingEnabled'); return false; }
function loadSessionStore() { _w('loadSessionStore'); return undefined; }
function resolveStorePath() { _w('resolveStorePath'); return undefined; }
function resolveAllowlistProviderRuntimeGroupPolicy() { _w('resolveAllowlistProviderRuntimeGroupPolicy'); return undefined; }
function resolveDefaultGroupPolicy() { _w('resolveDefaultGroupPolicy'); return undefined; }
function warnMissingProviderGroupPolicyFallbackOnce() { _w('warnMissingProviderGroupPolicyFallbackOnce'); return undefined; }
const BlockStreamingCoalesceSchema = undefined;
const DmPolicySchema = undefined;
const GroupPolicySchema = undefined;
const MarkdownConfigSchema = undefined;
function requireOpenAllowFrom() { _w('requireOpenAllowFrom'); return undefined; }
function createDedupeCache() { _w('createDedupeCache'); return undefined; }
function parseStrictPositiveInteger() { _w('parseStrictPositiveInteger'); return undefined; }
function rawDataToString() { _w('rawDataToString'); return undefined; }
function isLoopbackHost() { _w('isLoopbackHost'); return false; }
function isTrustedProxyAddress() { _w('isTrustedProxyAddress'); return false; }
function resolveClientIp() { _w('resolveClientIp'); return undefined; }
function registerPluginHttpRoute() { _w('registerPluginHttpRoute'); return undefined; }
const emptyPluginConfigSchema = undefined;
const DEFAULT_ACCOUNT_ID = undefined;
function normalizeAccountId() { _w('normalizeAccountId'); return ""; }
function resolveThreadSessionKeys() { _w('resolveThreadSessionKeys'); return undefined; }
const DM_GROUP_ACCESS_REASON = undefined;
function readStoreAllowFromForDmPolicy() { _w('readStoreAllowFromForDmPolicy'); return undefined; }
function resolveDmGroupAccessWithLists() { _w('resolveDmGroupAccessWithLists'); return undefined; }
function resolveEffectiveAllowFromLists() { _w('resolveEffectiveAllowFromLists'); return undefined; }
function evaluateSenderGroupAccessForPolicy() { _w('evaluateSenderGroupAccessForPolicy'); return undefined; }
function buildAgentMediaPayload() { _w('buildAgentMediaPayload'); return undefined; }
function getAgentScopedMediaLocalRoots() { _w('getAgentScopedMediaLocalRoots'); return undefined; }
function loadOutboundMediaFromUrl() { _w('loadOutboundMediaFromUrl'); return undefined; }
function createChannelPairingController() { _w('createChannelPairingController'); return undefined; }
function isRequestBodyLimitError() { _w('isRequestBodyLimitError'); return false; }
function readRequestBodyWithLimit() { _w('readRequestBodyWithLimit'); return undefined; }

module.exports = {
  formatInboundFromLabel,
  buildPendingHistoryContextFromMap,
  clearHistoryEntriesIfEnabled,
  DEFAULT_GROUP_HISTORY_LIMIT,
  recordPendingHistoryEntryIfEnabled,
  listSkillCommandsForAgents,
  resolveControlCommandGate,
  logInboundDrop,
  logTypingFailure,
  resolveAllowlistMatchSimple,
  normalizeProviderId,
  buildModelsProviderData,
  resolveStoredModelOverride,
  deleteAccountFromConfigSection,
  setAccountEnabledInConfigSection,
  buildChannelConfigSchema,
  formatPairingApproveHint,
  resolveChannelMediaMaxBytes,
  buildSingleChannelSecretPromptState,
  promptSingleChannelSecretInput,
  runSingleChannelSecretStep,
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  migrateBaseNameToDefaultAccount,
  createAccountStatusSink,
  buildComputedAccountStatusSnapshot,
  createAccountListHelpers,
  createChannelReplyPipeline,
  isDangerousNameMatchingEnabled,
  loadSessionStore,
  resolveStorePath,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
  BlockStreamingCoalesceSchema,
  DmPolicySchema,
  GroupPolicySchema,
  MarkdownConfigSchema,
  requireOpenAllowFrom,
  createDedupeCache,
  parseStrictPositiveInteger,
  rawDataToString,
  isLoopbackHost,
  isTrustedProxyAddress,
  resolveClientIp,
  registerPluginHttpRoute,
  emptyPluginConfigSchema,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  resolveThreadSessionKeys,
  DM_GROUP_ACCESS_REASON,
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithLists,
  resolveEffectiveAllowFromLists,
  evaluateSenderGroupAccessForPolicy,
  buildAgentMediaPayload,
  getAgentScopedMediaLocalRoots,
  loadOutboundMediaFromUrl,
  createChannelPairingController,
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
};
