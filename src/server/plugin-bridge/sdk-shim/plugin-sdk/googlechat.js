// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/googlechat.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/googlechat.' + fn + '() not implemented in Bridge mode'); }
}

function resolveGoogleChatGroupRequireMention() { _w('resolveGoogleChatGroupRequireMention'); return undefined; }
const googlechatSetupAdapter = undefined;
const googlechatSetupWizard = undefined;
function createActionGate() { _w('createActionGate'); return undefined; }
function jsonResult() { _w('jsonResult'); return undefined; }
function readNumberParam() { _w('readNumberParam'); return undefined; }
function readReactionParams() { _w('readReactionParams'); return undefined; }
function readStringParam() { _w('readStringParam'); return undefined; }
function resolveMentionGatingWithBypass() { _w('resolveMentionGatingWithBypass'); return undefined; }
function deleteAccountFromConfigSection() { _w('deleteAccountFromConfigSection'); return undefined; }
function setAccountEnabledInConfigSection() { _w('setAccountEnabledInConfigSection'); return undefined; }
function listDirectoryGroupEntriesFromMapKeys() { _w('listDirectoryGroupEntriesFromMapKeys'); return []; }
function listDirectoryUserEntriesFromAllowFrom() { _w('listDirectoryUserEntriesFromAllowFrom'); return []; }
function buildComputedAccountStatusSnapshot() { _w('buildComputedAccountStatusSnapshot'); return undefined; }
const buildChannelConfigSchema = undefined;
function createAccountStatusSink() { _w('createAccountStatusSink'); return undefined; }
function runPassiveAccountLifecycle() { _w('runPassiveAccountLifecycle'); return undefined; }
function formatPairingApproveHint() { _w('formatPairingApproveHint'); return ""; }
function resolveChannelMediaMaxBytes() { _w('resolveChannelMediaMaxBytes'); return undefined; }
function addWildcardAllowFrom() { _w('addWildcardAllowFrom'); return undefined; }
function mergeAllowFromEntries() { _w('mergeAllowFromEntries'); return undefined; }
function splitSetupEntries() { _w('splitSetupEntries'); return undefined; }
function setTopLevelChannelDmPolicyWithAllowFrom() { _w('setTopLevelChannelDmPolicyWithAllowFrom'); return undefined; }
const PAIRING_APPROVED_MESSAGE = undefined;
function applyAccountNameToChannelSection() { _w('applyAccountNameToChannelSection'); return undefined; }
function applySetupAccountConfigPatch() { _w('applySetupAccountConfigPatch'); return undefined; }
function migrateBaseNameToDefaultAccount() { _w('migrateBaseNameToDefaultAccount'); return undefined; }
function createAccountListHelpers() { _w('createAccountListHelpers'); return undefined; }
function getChatChannelMeta() { _w('getChatChannelMeta'); return undefined; }
function createChannelReplyPipeline() { _w('createChannelReplyPipeline'); return undefined; }
function isDangerousNameMatchingEnabled() { _w('isDangerousNameMatchingEnabled'); return false; }
const GROUP_POLICY_BLOCKED_LABEL = undefined;
function resolveAllowlistProviderRuntimeGroupPolicy() { _w('resolveAllowlistProviderRuntimeGroupPolicy'); return undefined; }
function resolveDefaultGroupPolicy() { _w('resolveDefaultGroupPolicy'); return undefined; }
function warnMissingProviderGroupPolicyFallbackOnce() { _w('warnMissingProviderGroupPolicyFallbackOnce'); return undefined; }
function isSecretRef() { _w('isSecretRef'); return false; }
const GoogleChatConfigSchema = undefined;
function fetchWithSsrFGuard() { _w('fetchWithSsrFGuard'); return undefined; }
function missingTargetError() { _w('missingTargetError'); return undefined; }
const emptyPluginConfigSchema = undefined;
const DEFAULT_ACCOUNT_ID = undefined;
function normalizeAccountId() { _w('normalizeAccountId'); return ""; }
function resolveDmGroupAccessWithLists() { _w('resolveDmGroupAccessWithLists'); return undefined; }
function formatDocsLink() { _w('formatDocsLink'); return ""; }
function resolveInboundRouteEnvelopeBuilderWithRuntime() { _w('resolveInboundRouteEnvelopeBuilderWithRuntime'); return undefined; }
function createChannelPairingController() { _w('createChannelPairingController'); return undefined; }
function evaluateGroupRouteAccessForPolicy() { _w('evaluateGroupRouteAccessForPolicy'); return undefined; }
function resolveSenderScopedGroupPolicy() { _w('resolveSenderScopedGroupPolicy'); return undefined; }
function extractToolSend() { _w('extractToolSend'); return undefined; }
function beginWebhookRequestPipelineOrReject() { _w('beginWebhookRequestPipelineOrReject'); return undefined; }
function createWebhookInFlightLimiter() { _w('createWebhookInFlightLimiter'); return undefined; }
function readJsonWebhookBodyOrReject() { _w('readJsonWebhookBodyOrReject'); return undefined; }
function registerWebhookTargetWithPluginRoute() { _w('registerWebhookTargetWithPluginRoute'); return undefined; }
function resolveWebhookPath() { _w('resolveWebhookPath'); return undefined; }
function resolveWebhookTargetWithAuthOrReject() { _w('resolveWebhookTargetWithAuthOrReject'); return undefined; }
function resolveWebhookTargets() { _w('resolveWebhookTargets'); return undefined; }
function withResolvedWebhookRequestPipeline() { _w('withResolvedWebhookRequestPipeline'); return undefined; }

module.exports = {
  resolveGoogleChatGroupRequireMention,
  googlechatSetupAdapter,
  googlechatSetupWizard,
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringParam,
  resolveMentionGatingWithBypass,
  deleteAccountFromConfigSection,
  setAccountEnabledInConfigSection,
  listDirectoryGroupEntriesFromMapKeys,
  listDirectoryUserEntriesFromAllowFrom,
  buildComputedAccountStatusSnapshot,
  buildChannelConfigSchema,
  createAccountStatusSink,
  runPassiveAccountLifecycle,
  formatPairingApproveHint,
  resolveChannelMediaMaxBytes,
  addWildcardAllowFrom,
  mergeAllowFromEntries,
  splitSetupEntries,
  setTopLevelChannelDmPolicyWithAllowFrom,
  PAIRING_APPROVED_MESSAGE,
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  migrateBaseNameToDefaultAccount,
  createAccountListHelpers,
  getChatChannelMeta,
  createChannelReplyPipeline,
  isDangerousNameMatchingEnabled,
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
  isSecretRef,
  GoogleChatConfigSchema,
  fetchWithSsrFGuard,
  missingTargetError,
  emptyPluginConfigSchema,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  resolveDmGroupAccessWithLists,
  formatDocsLink,
  resolveInboundRouteEnvelopeBuilderWithRuntime,
  createChannelPairingController,
  evaluateGroupRouteAccessForPolicy,
  resolveSenderScopedGroupPolicy,
  extractToolSend,
  beginWebhookRequestPipelineOrReject,
  createWebhookInFlightLimiter,
  readJsonWebhookBodyOrReject,
  registerWebhookTargetWithPluginRoute,
  resolveWebhookPath,
  resolveWebhookTargetWithAuthOrReject,
  resolveWebhookTargets,
  withResolvedWebhookRequestPipeline,
};
