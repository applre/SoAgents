// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/zalo.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/zalo.' + fn + '() not implemented in Bridge mode'); }
}

function jsonResult() { _w('jsonResult'); return undefined; }
function readStringParam() { _w('readStringParam'); return undefined; }
function deleteAccountFromConfigSection() { _w('deleteAccountFromConfigSection'); return undefined; }
function setAccountEnabledInConfigSection() { _w('setAccountEnabledInConfigSection'); return undefined; }
function listDirectoryUserEntriesFromAllowFrom() { _w('listDirectoryUserEntriesFromAllowFrom'); return []; }
const buildChannelConfigSchema = undefined;
function formatPairingApproveHint() { _w('formatPairingApproveHint'); return ""; }
function buildSingleChannelSecretPromptState() { _w('buildSingleChannelSecretPromptState'); return undefined; }
function addWildcardAllowFrom() { _w('addWildcardAllowFrom'); return undefined; }
function mergeAllowFromEntries() { _w('mergeAllowFromEntries'); return undefined; }
function promptSingleChannelSecretInput() { _w('promptSingleChannelSecretInput'); return undefined; }
function runSingleChannelSecretStep() { _w('runSingleChannelSecretStep'); return undefined; }
function setTopLevelChannelDmPolicyWithAllowFrom() { _w('setTopLevelChannelDmPolicyWithAllowFrom'); return undefined; }
const PAIRING_APPROVED_MESSAGE = undefined;
function applyAccountNameToChannelSection() { _w('applyAccountNameToChannelSection'); return undefined; }
function applySetupAccountConfigPatch() { _w('applySetupAccountConfigPatch'); return undefined; }
function migrateBaseNameToDefaultAccount() { _w('migrateBaseNameToDefaultAccount'); return undefined; }
function createAccountListHelpers() { _w('createAccountListHelpers'); return undefined; }
function logTypingFailure() { _w('logTypingFailure'); return undefined; }
function createChannelReplyPipeline() { _w('createChannelReplyPipeline'); return undefined; }
function resolveDefaultGroupPolicy() { _w('resolveDefaultGroupPolicy'); return undefined; }
function resolveOpenProviderRuntimeGroupPolicy() { _w('resolveOpenProviderRuntimeGroupPolicy'); return undefined; }
function warnMissingProviderGroupPolicyFallbackOnce() { _w('warnMissingProviderGroupPolicyFallbackOnce'); return undefined; }
const buildSecretInputSchema = undefined;
function hasConfiguredSecretInput() { _w('hasConfiguredSecretInput'); return false; }
function normalizeResolvedSecretInputString() { _w('normalizeResolvedSecretInputString'); return ""; }
function normalizeSecretInputString() { _w('normalizeSecretInputString'); return ""; }
const MarkdownConfigSchema = undefined;
function waitForAbortSignal() { _w('waitForAbortSignal'); return undefined; }
function createDedupeCache() { _w('createDedupeCache'); return undefined; }
function resolveClientIp() { _w('resolveClientIp'); return undefined; }
const emptyPluginConfigSchema = undefined;
const DEFAULT_ACCOUNT_ID = undefined;
function normalizeAccountId() { _w('normalizeAccountId'); return ""; }
function formatAllowFromLowercase() { _w('formatAllowFromLowercase'); return ""; }
function isNormalizedSenderAllowed() { _w('isNormalizedSenderAllowed'); return false; }
function zaloSetupAdapter() { _w('zaloSetupAdapter'); return undefined; }
function zaloSetupWizard() { _w('zaloSetupWizard'); return undefined; }
function resolveDirectDmAuthorizationOutcome() { _w('resolveDirectDmAuthorizationOutcome'); return undefined; }
function resolveSenderCommandAuthorizationWithRuntime() { _w('resolveSenderCommandAuthorizationWithRuntime'); return undefined; }
function resolveChannelAccountConfigBasePath() { _w('resolveChannelAccountConfigBasePath'); return undefined; }
function evaluateSenderGroupAccess() { _w('evaluateSenderGroupAccess'); return undefined; }
function resolveInboundRouteEnvelopeBuilderWithRuntime() { _w('resolveInboundRouteEnvelopeBuilderWithRuntime'); return undefined; }
function createChannelPairingController() { _w('createChannelPairingController'); return undefined; }
function buildChannelSendResult() { _w('buildChannelSendResult'); return undefined; }
function deliverTextOrMediaReply() { _w('deliverTextOrMediaReply'); return undefined; }
function isNumericTargetId() { _w('isNumericTargetId'); return false; }
function resolveOutboundMediaUrls() { _w('resolveOutboundMediaUrls'); return undefined; }
function sendMediaWithLeadingCaption() { _w('sendMediaWithLeadingCaption'); return undefined; }
function sendPayloadWithChunkedTextAndMedia() { _w('sendPayloadWithChunkedTextAndMedia'); return undefined; }
function buildBaseAccountStatusSnapshot() { _w('buildBaseAccountStatusSnapshot'); return undefined; }
function buildTokenChannelStatusSummary() { _w('buildTokenChannelStatusSummary'); return undefined; }
function chunkTextForOutbound() { _w('chunkTextForOutbound'); return undefined; }
function extractToolSend() { _w('extractToolSend'); return undefined; }
function applyBasicWebhookRequestGuards() { _w('applyBasicWebhookRequestGuards'); return undefined; }
function createFixedWindowRateLimiter() { _w('createFixedWindowRateLimiter'); return undefined; }
function createWebhookAnomalyTracker() { _w('createWebhookAnomalyTracker'); return undefined; }
function readJsonWebhookBodyOrReject() { _w('readJsonWebhookBodyOrReject'); return undefined; }
function registerWebhookTarget() { _w('registerWebhookTarget'); return undefined; }
function registerWebhookTargetWithPluginRoute() { _w('registerWebhookTargetWithPluginRoute'); return undefined; }
function resolveSingleWebhookTarget() { _w('resolveSingleWebhookTarget'); return undefined; }
function resolveWebhookPath() { _w('resolveWebhookPath'); return undefined; }
function resolveWebhookTargetWithAuthOrRejectSync() { _w('resolveWebhookTargetWithAuthOrRejectSync'); return undefined; }
function resolveWebhookTargets() { _w('resolveWebhookTargets'); return undefined; }
const WEBHOOK_ANOMALY_COUNTER_DEFAULTS = undefined;
const WEBHOOK_RATE_LIMIT_DEFAULTS = undefined;
function withResolvedWebhookRequestPipeline() { _w('withResolvedWebhookRequestPipeline'); return undefined; }

module.exports = {
  jsonResult,
  readStringParam,
  deleteAccountFromConfigSection,
  setAccountEnabledInConfigSection,
  listDirectoryUserEntriesFromAllowFrom,
  buildChannelConfigSchema,
  formatPairingApproveHint,
  buildSingleChannelSecretPromptState,
  addWildcardAllowFrom,
  mergeAllowFromEntries,
  promptSingleChannelSecretInput,
  runSingleChannelSecretStep,
  setTopLevelChannelDmPolicyWithAllowFrom,
  PAIRING_APPROVED_MESSAGE,
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  migrateBaseNameToDefaultAccount,
  createAccountListHelpers,
  logTypingFailure,
  createChannelReplyPipeline,
  resolveDefaultGroupPolicy,
  resolveOpenProviderRuntimeGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
  buildSecretInputSchema,
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
  normalizeSecretInputString,
  MarkdownConfigSchema,
  waitForAbortSignal,
  createDedupeCache,
  resolveClientIp,
  emptyPluginConfigSchema,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  formatAllowFromLowercase,
  isNormalizedSenderAllowed,
  zaloSetupAdapter,
  zaloSetupWizard,
  resolveDirectDmAuthorizationOutcome,
  resolveSenderCommandAuthorizationWithRuntime,
  resolveChannelAccountConfigBasePath,
  evaluateSenderGroupAccess,
  resolveInboundRouteEnvelopeBuilderWithRuntime,
  createChannelPairingController,
  buildChannelSendResult,
  deliverTextOrMediaReply,
  isNumericTargetId,
  resolveOutboundMediaUrls,
  sendMediaWithLeadingCaption,
  sendPayloadWithChunkedTextAndMedia,
  buildBaseAccountStatusSnapshot,
  buildTokenChannelStatusSummary,
  chunkTextForOutbound,
  extractToolSend,
  applyBasicWebhookRequestGuards,
  createFixedWindowRateLimiter,
  createWebhookAnomalyTracker,
  readJsonWebhookBodyOrReject,
  registerWebhookTarget,
  registerWebhookTargetWithPluginRoute,
  resolveSingleWebhookTarget,
  resolveWebhookPath,
  resolveWebhookTargetWithAuthOrRejectSync,
  resolveWebhookTargets,
  WEBHOOK_ANOMALY_COUNTER_DEFAULTS,
  WEBHOOK_RATE_LIMIT_DEFAULTS,
  withResolvedWebhookRequestPipeline,
};
