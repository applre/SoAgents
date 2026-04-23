// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/nextcloud-talk.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/nextcloud-talk.' + fn + '() not implemented in Bridge mode'); }
}

function logInboundDrop() { _w('logInboundDrop'); return undefined; }
function resolveMentionGatingWithBypass() { _w('resolveMentionGatingWithBypass'); return undefined; }
function buildChannelKeyCandidates() { _w('buildChannelKeyCandidates'); return undefined; }
function normalizeChannelSlug() { _w('normalizeChannelSlug'); return ""; }
function resolveChannelEntryMatchWithFallback() { _w('resolveChannelEntryMatchWithFallback'); return undefined; }
function resolveNestedAllowlistDecision() { _w('resolveNestedAllowlistDecision'); return undefined; }
function deleteAccountFromConfigSection() { _w('deleteAccountFromConfigSection'); return undefined; }
function clearAccountEntryFields() { _w('clearAccountEntryFields'); return undefined; }
function setAccountEnabledInConfigSection() { _w('setAccountEnabledInConfigSection'); return undefined; }
const buildChannelConfigSchema = undefined;
function formatPairingApproveHint() { _w('formatPairingApproveHint'); return ""; }
function buildSingleChannelSecretPromptState() { _w('buildSingleChannelSecretPromptState'); return undefined; }
function addWildcardAllowFrom() { _w('addWildcardAllowFrom'); return undefined; }
function mergeAllowFromEntries() { _w('mergeAllowFromEntries'); return undefined; }
function promptSingleChannelSecretInput() { _w('promptSingleChannelSecretInput'); return undefined; }
function runSingleChannelSecretStep() { _w('runSingleChannelSecretStep'); return undefined; }
function setTopLevelChannelDmPolicyWithAllowFrom() { _w('setTopLevelChannelDmPolicyWithAllowFrom'); return undefined; }
function applyAccountNameToChannelSection() { _w('applyAccountNameToChannelSection'); return undefined; }
const patchScopedAccountConfig = undefined;
function createAccountListHelpers() { _w('createAccountListHelpers'); return undefined; }
function createChannelReplyPipeline() { _w('createChannelReplyPipeline'); return undefined; }
function mapAllowFromEntries() { _w('mapAllowFromEntries'); return undefined; }
function evaluateMatchedGroupAccessForPolicy() { _w('evaluateMatchedGroupAccessForPolicy'); return undefined; }
const GROUP_POLICY_BLOCKED_LABEL = undefined;
function resolveAllowlistProviderRuntimeGroupPolicy() { _w('resolveAllowlistProviderRuntimeGroupPolicy'); return undefined; }
function resolveDefaultGroupPolicy() { _w('resolveDefaultGroupPolicy'); return undefined; }
function warnMissingProviderGroupPolicyFallbackOnce() { _w('warnMissingProviderGroupPolicyFallbackOnce'); return undefined; }
const buildSecretInputSchema = undefined;
function hasConfiguredSecretInput() { _w('hasConfiguredSecretInput'); return false; }
function normalizeResolvedSecretInputString() { _w('normalizeResolvedSecretInputString'); return ""; }
function normalizeSecretInputString() { _w('normalizeSecretInputString'); return ""; }
const ToolPolicySchema = undefined;
const BlockStreamingCoalesceSchema = undefined;
const DmConfigSchema = undefined;
const DmPolicySchema = undefined;
const GroupPolicySchema = undefined;
const MarkdownConfigSchema = undefined;
function ReplyRuntimeConfigSchemaShape() { _w('ReplyRuntimeConfigSchemaShape'); return undefined; }
function requireOpenAllowFrom() { _w('requireOpenAllowFrom'); return undefined; }
function isRequestBodyLimitError() { _w('isRequestBodyLimitError'); return false; }
function readRequestBodyWithLimit() { _w('readRequestBodyWithLimit'); return undefined; }
function requestBodyErrorToText() { _w('requestBodyErrorToText'); return undefined; }
function waitForAbortSignal() { _w('waitForAbortSignal'); return undefined; }
function fetchWithSsrFGuard() { _w('fetchWithSsrFGuard'); return undefined; }
const emptyPluginConfigSchema = undefined;
const DEFAULT_ACCOUNT_ID = undefined;
function normalizeAccountId() { _w('normalizeAccountId'); return ""; }
function readStoreAllowFromForDmPolicy() { _w('readStoreAllowFromForDmPolicy'); return undefined; }
function resolveDmGroupAccessWithCommandGate() { _w('resolveDmGroupAccessWithCommandGate'); return undefined; }
function formatDocsLink() { _w('formatDocsLink'); return ""; }
function listConfiguredAccountIds() { _w('listConfiguredAccountIds'); return []; }
function resolveAccountWithDefaultFallback() { _w('resolveAccountWithDefaultFallback'); return undefined; }
function createChannelPairingController() { _w('createChannelPairingController'); return undefined; }
function createPersistentDedupe() { _w('createPersistentDedupe'); return undefined; }
function createNormalizedOutboundDeliverer() { _w('createNormalizedOutboundDeliverer'); return undefined; }
function deliverFormattedTextWithAttachments() { _w('deliverFormattedTextWithAttachments'); return undefined; }
function formatTextWithAttachmentLinks() { _w('formatTextWithAttachmentLinks'); return ""; }
function resolveOutboundMediaUrls() { _w('resolveOutboundMediaUrls'); return undefined; }
function dispatchInboundReplyWithBase() { _w('dispatchInboundReplyWithBase'); return undefined; }
function createLoggerBackedRuntime() { _w('createLoggerBackedRuntime'); return undefined; }
function buildBaseChannelStatusSummary() { _w('buildBaseChannelStatusSummary'); return undefined; }
function buildRuntimeAccountStatusSnapshot() { _w('buildRuntimeAccountStatusSnapshot'); return undefined; }

module.exports = {
  logInboundDrop,
  resolveMentionGatingWithBypass,
  buildChannelKeyCandidates,
  normalizeChannelSlug,
  resolveChannelEntryMatchWithFallback,
  resolveNestedAllowlistDecision,
  deleteAccountFromConfigSection,
  clearAccountEntryFields,
  setAccountEnabledInConfigSection,
  buildChannelConfigSchema,
  formatPairingApproveHint,
  buildSingleChannelSecretPromptState,
  addWildcardAllowFrom,
  mergeAllowFromEntries,
  promptSingleChannelSecretInput,
  runSingleChannelSecretStep,
  setTopLevelChannelDmPolicyWithAllowFrom,
  applyAccountNameToChannelSection,
  patchScopedAccountConfig,
  createAccountListHelpers,
  createChannelReplyPipeline,
  mapAllowFromEntries,
  evaluateMatchedGroupAccessForPolicy,
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
  buildSecretInputSchema,
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
  normalizeSecretInputString,
  ToolPolicySchema,
  BlockStreamingCoalesceSchema,
  DmConfigSchema,
  DmPolicySchema,
  GroupPolicySchema,
  MarkdownConfigSchema,
  ReplyRuntimeConfigSchemaShape,
  requireOpenAllowFrom,
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
  waitForAbortSignal,
  fetchWithSsrFGuard,
  emptyPluginConfigSchema,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithCommandGate,
  formatDocsLink,
  listConfiguredAccountIds,
  resolveAccountWithDefaultFallback,
  createChannelPairingController,
  createPersistentDedupe,
  createNormalizedOutboundDeliverer,
  deliverFormattedTextWithAttachments,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
  dispatchInboundReplyWithBase,
  createLoggerBackedRuntime,
  buildBaseChannelStatusSummary,
  buildRuntimeAccountStatusSnapshot,
};
