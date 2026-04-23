// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/matrix.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/matrix.' + fn + '() not implemented in Bridge mode'); }
}

const matrixSetupWizard = undefined;
const matrixSetupAdapter = undefined;
function createActionGate() { _w('createActionGate'); return undefined; }
function jsonResult() { _w('jsonResult'); return undefined; }
function readNumberParam() { _w('readNumberParam'); return undefined; }
function readReactionParams() { _w('readReactionParams'); return undefined; }
function readStringArrayParam() { _w('readStringArrayParam'); return undefined; }
function readStringParam() { _w('readStringParam'); return undefined; }
function resolveAckReaction() { _w('resolveAckReaction'); return undefined; }
function compileAllowlist() { _w('compileAllowlist'); return undefined; }
function resolveCompiledAllowlistMatch() { _w('resolveCompiledAllowlistMatch'); return undefined; }
function resolveAllowlistCandidates() { _w('resolveAllowlistCandidates'); return undefined; }
function resolveAllowlistMatchByCandidates() { _w('resolveAllowlistMatchByCandidates'); return undefined; }
function addAllowlistUserEntriesFromConfigEntry() { _w('addAllowlistUserEntriesFromConfigEntry'); return undefined; }
function buildAllowlistResolutionSummary() { _w('buildAllowlistResolutionSummary'); return undefined; }
function canonicalizeAllowlistWithResolvedIds() { _w('canonicalizeAllowlistWithResolvedIds'); return undefined; }
function mergeAllowlist() { _w('mergeAllowlist'); return undefined; }
function patchAllowlistUsersInConfigEntries() { _w('patchAllowlistUsersInConfigEntries'); return undefined; }
function summarizeMapping() { _w('summarizeMapping'); return undefined; }
function resolveControlCommandGate() { _w('resolveControlCommandGate'); return undefined; }
function formatLocationText() { _w('formatLocationText'); return ""; }
function toLocationContext() { _w('toLocationContext'); return undefined; }
function logInboundDrop() { _w('logInboundDrop'); return undefined; }
function logTypingFailure() { _w('logTypingFailure'); return undefined; }
function formatAllowlistMatchMeta() { _w('formatAllowlistMatchMeta'); return ""; }
function buildChannelKeyCandidates() { _w('buildChannelKeyCandidates'); return undefined; }
function resolveChannelEntryMatch() { _w('resolveChannelEntryMatch'); return undefined; }
function createAccountListHelpers() { _w('createAccountListHelpers'); return undefined; }
function deleteAccountFromConfigSection() { _w('deleteAccountFromConfigSection'); return undefined; }
function setAccountEnabledInConfigSection() { _w('setAccountEnabledInConfigSection'); return undefined; }
const buildChannelConfigSchema = undefined;
function formatPairingApproveHint() { _w('formatPairingApproveHint'); return ""; }
function buildSingleChannelSecretPromptState() { _w('buildSingleChannelSecretPromptState'); return undefined; }
function addWildcardAllowFrom() { _w('addWildcardAllowFrom'); return undefined; }
function mergeAllowFromEntries() { _w('mergeAllowFromEntries'); return undefined; }
function promptAccountId() { _w('promptAccountId'); return undefined; }
function promptSingleChannelSecretInput() { _w('promptSingleChannelSecretInput'); return undefined; }
function setTopLevelChannelGroupPolicy() { _w('setTopLevelChannelGroupPolicy'); return undefined; }
const promptChannelAccessConfig = undefined;
const PAIRING_APPROVED_MESSAGE = undefined;
function applyAccountNameToChannelSection() { _w('applyAccountNameToChannelSection'); return undefined; }
function moveSingleAccountChannelSectionToDefaultAccount() { _w('moveSingleAccountChannelSectionToDefaultAccount'); return undefined; }
function createReplyPrefixOptions() { _w('createReplyPrefixOptions'); return undefined; }
function resolveThreadBindingFarewellText() { _w('resolveThreadBindingFarewellText'); return undefined; }
function resolveThreadBindingIdleTimeoutMsForChannel() { _w('resolveThreadBindingIdleTimeoutMsForChannel'); return undefined; }
function resolveThreadBindingMaxAgeMsForChannel() { _w('resolveThreadBindingMaxAgeMsForChannel'); return undefined; }
function setMatrixThreadBindingIdleTimeoutBySessionKey() { _w('setMatrixThreadBindingIdleTimeoutBySessionKey'); return undefined; }
function setMatrixThreadBindingMaxAgeBySessionKey() { _w('setMatrixThreadBindingMaxAgeBySessionKey'); return undefined; }
function createTypingCallbacks() { _w('createTypingCallbacks'); return undefined; }
function createChannelReplyPipeline() { _w('createChannelReplyPipeline'); return undefined; }
const GROUP_POLICY_BLOCKED_LABEL = undefined;
function resolveAllowlistProviderRuntimeGroupPolicy() { _w('resolveAllowlistProviderRuntimeGroupPolicy'); return undefined; }
function resolveDefaultGroupPolicy() { _w('resolveDefaultGroupPolicy'); return undefined; }
function warnMissingProviderGroupPolicyFallbackOnce() { _w('warnMissingProviderGroupPolicyFallbackOnce'); return undefined; }
const buildSecretInputSchema = undefined;
function hasConfiguredSecretInput() { _w('hasConfiguredSecretInput'); return false; }
function normalizeResolvedSecretInputString() { _w('normalizeResolvedSecretInputString'); return ""; }
function normalizeSecretInputString() { _w('normalizeSecretInputString'); return ""; }
const ToolPolicySchema = undefined;
const MarkdownConfigSchema = undefined;
function formatZonedTimestamp() { _w('formatZonedTimestamp'); return ""; }
function fetchWithSsrFGuard() { _w('fetchWithSsrFGuard'); return undefined; }
function getSessionBindingService() { _w('getSessionBindingService'); return undefined; }
function registerSessionBindingAdapter() { _w('registerSessionBindingAdapter'); return undefined; }
function unregisterSessionBindingAdapter() { _w('unregisterSessionBindingAdapter'); return undefined; }
function resolveOutboundSendDep() { _w('resolveOutboundSendDep'); return undefined; }
function isPrivateOrLoopbackHost() { _w('isPrivateOrLoopbackHost'); return false; }
function getAgentScopedMediaLocalRoots() { _w('getAgentScopedMediaLocalRoots'); return undefined; }
const emptyPluginConfigSchema = undefined;
function normalizePollInput() { _w('normalizePollInput'); return ""; }
const DEFAULT_ACCOUNT_ID = undefined;
function normalizeAccountId() { _w('normalizeAccountId'); return ""; }
function normalizeOptionalAccountId() { _w('normalizeOptionalAccountId'); return ""; }
function resolveAgentIdFromSessionKey() { _w('resolveAgentIdFromSessionKey'); return undefined; }
function normalizeStringEntries() { _w('normalizeStringEntries'); return ""; }
function formatDocsLink() { _w('formatDocsLink'); return ""; }
function redactSensitiveText() { _w('redactSensitiveText'); return undefined; }
function evaluateGroupRouteAccessForPolicy() { _w('evaluateGroupRouteAccessForPolicy'); return undefined; }
function resolveSenderScopedGroupPolicy() { _w('resolveSenderScopedGroupPolicy'); return undefined; }
function createChannelPairingController() { _w('createChannelPairingController'); return undefined; }
function readJsonFileWithFallback() { _w('readJsonFileWithFallback'); return undefined; }
function writeJsonFileAtomically() { _w('writeJsonFileAtomically'); return undefined; }
function formatResolvedUnresolvedNote() { _w('formatResolvedUnresolvedNote'); return ""; }
function runPluginCommandWithTimeout() { _w('runPluginCommandWithTimeout'); return undefined; }
function createLoggerBackedRuntime() { _w('createLoggerBackedRuntime'); return undefined; }
function resolveRuntimeEnv() { _w('resolveRuntimeEnv'); return undefined; }
function buildComputedAccountStatusSnapshot() { _w('buildComputedAccountStatusSnapshot'); return undefined; }
function buildProbeChannelStatusSummary() { _w('buildProbeChannelStatusSummary'); return undefined; }
function collectStatusIssuesFromLastError() { _w('collectStatusIssuesFromLastError'); return []; }
function findMatrixAccountEntry() { _w('findMatrixAccountEntry'); return undefined; }
function resolveConfiguredMatrixAccountIds() { _w('resolveConfiguredMatrixAccountIds'); return undefined; }
const resolveMatrixChannelConfig = undefined;
function resolveMatrixAccountStorageRoot() { _w('resolveMatrixAccountStorageRoot'); return undefined; }
function resolveMatrixCredentialsDir() { _w('resolveMatrixCredentialsDir'); return undefined; }
function resolveMatrixCredentialsPath() { _w('resolveMatrixCredentialsPath'); return undefined; }
function resolveMatrixLegacyFlatStoragePaths() { _w('resolveMatrixLegacyFlatStoragePaths'); return undefined; }
function resolveMatrixAccountStringValues() { _w('resolveMatrixAccountStringValues'); return undefined; }
function getMatrixScopedEnvVarNames() { _w('getMatrixScopedEnvVarNames'); return undefined; }
function requiresExplicitMatrixDefaultAccount() { _w('requiresExplicitMatrixDefaultAccount'); return undefined; }
function resolveMatrixDefaultOrOnlyAccountId() { _w('resolveMatrixDefaultOrOnlyAccountId'); return undefined; }

module.exports = {
  matrixSetupWizard,
  matrixSetupAdapter,
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringArrayParam,
  readStringParam,
  resolveAckReaction,
  compileAllowlist,
  resolveCompiledAllowlistMatch,
  resolveAllowlistCandidates,
  resolveAllowlistMatchByCandidates,
  addAllowlistUserEntriesFromConfigEntry,
  buildAllowlistResolutionSummary,
  canonicalizeAllowlistWithResolvedIds,
  mergeAllowlist,
  patchAllowlistUsersInConfigEntries,
  summarizeMapping,
  resolveControlCommandGate,
  formatLocationText,
  toLocationContext,
  logInboundDrop,
  logTypingFailure,
  formatAllowlistMatchMeta,
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
  createAccountListHelpers,
  deleteAccountFromConfigSection,
  setAccountEnabledInConfigSection,
  buildChannelConfigSchema,
  formatPairingApproveHint,
  buildSingleChannelSecretPromptState,
  addWildcardAllowFrom,
  mergeAllowFromEntries,
  promptAccountId,
  promptSingleChannelSecretInput,
  setTopLevelChannelGroupPolicy,
  promptChannelAccessConfig,
  PAIRING_APPROVED_MESSAGE,
  applyAccountNameToChannelSection,
  moveSingleAccountChannelSectionToDefaultAccount,
  createReplyPrefixOptions,
  resolveThreadBindingFarewellText,
  resolveThreadBindingIdleTimeoutMsForChannel,
  resolveThreadBindingMaxAgeMsForChannel,
  setMatrixThreadBindingIdleTimeoutBySessionKey,
  setMatrixThreadBindingMaxAgeBySessionKey,
  createTypingCallbacks,
  createChannelReplyPipeline,
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
  buildSecretInputSchema,
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
  normalizeSecretInputString,
  ToolPolicySchema,
  MarkdownConfigSchema,
  formatZonedTimestamp,
  fetchWithSsrFGuard,
  getSessionBindingService,
  registerSessionBindingAdapter,
  unregisterSessionBindingAdapter,
  resolveOutboundSendDep,
  isPrivateOrLoopbackHost,
  getAgentScopedMediaLocalRoots,
  emptyPluginConfigSchema,
  normalizePollInput,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  normalizeOptionalAccountId,
  resolveAgentIdFromSessionKey,
  normalizeStringEntries,
  formatDocsLink,
  redactSensitiveText,
  evaluateGroupRouteAccessForPolicy,
  resolveSenderScopedGroupPolicy,
  createChannelPairingController,
  readJsonFileWithFallback,
  writeJsonFileAtomically,
  formatResolvedUnresolvedNote,
  runPluginCommandWithTimeout,
  createLoggerBackedRuntime,
  resolveRuntimeEnv,
  buildComputedAccountStatusSnapshot,
  buildProbeChannelStatusSummary,
  collectStatusIssuesFromLastError,
  findMatrixAccountEntry,
  resolveConfiguredMatrixAccountIds,
  resolveMatrixChannelConfig,
  resolveMatrixAccountStorageRoot,
  resolveMatrixCredentialsDir,
  resolveMatrixCredentialsPath,
  resolveMatrixLegacyFlatStoragePaths,
  resolveMatrixAccountStringValues,
  getMatrixScopedEnvVarNames,
  requiresExplicitMatrixDefaultAccount,
  resolveMatrixDefaultOrOnlyAccountId,
};
