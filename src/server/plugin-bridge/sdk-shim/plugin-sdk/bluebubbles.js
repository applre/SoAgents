// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/bluebubbles.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/bluebubbles.' + fn + '() not implemented in Bridge mode'); }
}

function resolveAckReaction() { _w('resolveAckReaction'); return undefined; }
function createActionGate() { _w('createActionGate'); return undefined; }
function jsonResult() { _w('jsonResult'); return undefined; }
function readNumberParam() { _w('readNumberParam'); return undefined; }
function readReactionParams() { _w('readReactionParams'); return undefined; }
function readStringParam() { _w('readStringParam'); return undefined; }
function evictOldHistoryKeys() { _w('evictOldHistoryKeys'); return undefined; }
function recordPendingHistoryEntryIfEnabled() { _w('recordPendingHistoryEntryIfEnabled'); return undefined; }
function resolveControlCommandGate() { _w('resolveControlCommandGate'); return undefined; }
function logAckFailure() { _w('logAckFailure'); return undefined; }
function logInboundDrop() { _w('logInboundDrop'); return undefined; }
function logTypingFailure() { _w('logTypingFailure'); return undefined; }
const BLUEBUBBLES_ACTION_NAMES = undefined;
const BLUEBUBBLES_ACTIONS = undefined;
function deleteAccountFromConfigSection() { _w('deleteAccountFromConfigSection'); return undefined; }
function setAccountEnabledInConfigSection() { _w('setAccountEnabledInConfigSection'); return undefined; }
const buildChannelConfigSchema = undefined;
function resolveBlueBubblesGroupRequireMention() { _w('resolveBlueBubblesGroupRequireMention'); return undefined; }
function resolveBlueBubblesGroupToolPolicy() { _w('resolveBlueBubblesGroupToolPolicy'); return undefined; }
function formatPairingApproveHint() { _w('formatPairingApproveHint'); return ""; }
function resolveChannelMediaMaxBytes() { _w('resolveChannelMediaMaxBytes'); return undefined; }
function addWildcardAllowFrom() { _w('addWildcardAllowFrom'); return undefined; }
function mergeAllowFromEntries() { _w('mergeAllowFromEntries'); return undefined; }
function setTopLevelChannelDmPolicyWithAllowFrom() { _w('setTopLevelChannelDmPolicyWithAllowFrom'); return undefined; }
const PAIRING_APPROVED_MESSAGE = undefined;
function applyAccountNameToChannelSection() { _w('applyAccountNameToChannelSection'); return undefined; }
function migrateBaseNameToDefaultAccount() { _w('migrateBaseNameToDefaultAccount'); return undefined; }
const patchScopedAccountConfig = undefined;
function createAccountListHelpers() { _w('createAccountListHelpers'); return undefined; }
function collectBlueBubblesStatusIssues() { _w('collectBlueBubblesStatusIssues'); return []; }
function createChannelReplyPipeline() { _w('createChannelReplyPipeline'); return undefined; }
const ToolPolicySchema = undefined;
const MarkdownConfigSchema = undefined;
function parseChatAllowTargetPrefixes() { _w('parseChatAllowTargetPrefixes'); return undefined; }
function parseChatTargetPrefixesOrThrow() { _w('parseChatTargetPrefixesOrThrow'); return undefined; }
function resolveServicePrefixedAllowTarget() { _w('resolveServicePrefixedAllowTarget'); return undefined; }
function resolveServicePrefixedTarget() { _w('resolveServicePrefixedTarget'); return undefined; }
function stripMarkdown() { _w('stripMarkdown'); return ""; }
function parseFiniteNumber() { _w('parseFiniteNumber'); return undefined; }
const emptyPluginConfigSchema = undefined;
const DEFAULT_ACCOUNT_ID = undefined;
function normalizeAccountId() { _w('normalizeAccountId'); return ""; }
const DM_GROUP_ACCESS_REASON = undefined;
function readStoreAllowFromForDmPolicy() { _w('readStoreAllowFromForDmPolicy'); return undefined; }
function resolveDmGroupAccessWithLists() { _w('resolveDmGroupAccessWithLists'); return undefined; }
function formatDocsLink() { _w('formatDocsLink'); return ""; }
function isAllowedParsedChatSender() { _w('isAllowedParsedChatSender'); return false; }
function readBooleanParam() { _w('readBooleanParam'); return undefined; }
function mapAllowFromEntries() { _w('mapAllowFromEntries'); return undefined; }
function createChannelPairingController() { _w('createChannelPairingController'); return undefined; }
function resolveRequestUrl() { _w('resolveRequestUrl'); return undefined; }
function buildComputedAccountStatusSnapshot() { _w('buildComputedAccountStatusSnapshot'); return undefined; }
function buildProbeChannelStatusSummary() { _w('buildProbeChannelStatusSummary'); return undefined; }
function extractToolSend() { _w('extractToolSend'); return undefined; }
const WEBHOOK_RATE_LIMIT_DEFAULTS = undefined;
function createFixedWindowRateLimiter() { _w('createFixedWindowRateLimiter'); return undefined; }
function createWebhookInFlightLimiter() { _w('createWebhookInFlightLimiter'); return undefined; }
function normalizeWebhookPath() { _w('normalizeWebhookPath'); return ""; }
function readWebhookBodyOrReject() { _w('readWebhookBodyOrReject'); return undefined; }
function registerWebhookTargetWithPluginRoute() { _w('registerWebhookTargetWithPluginRoute'); return undefined; }
function resolveRequestClientIp() { _w('resolveRequestClientIp'); return undefined; }
function resolveWebhookTargets() { _w('resolveWebhookTargets'); return undefined; }
function resolveWebhookTargetWithAuthOrRejectSync() { _w('resolveWebhookTargetWithAuthOrRejectSync'); return undefined; }
function withResolvedWebhookRequestPipeline() { _w('withResolvedWebhookRequestPipeline'); return undefined; }

module.exports = {
  resolveAckReaction,
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringParam,
  evictOldHistoryKeys,
  recordPendingHistoryEntryIfEnabled,
  resolveControlCommandGate,
  logAckFailure,
  logInboundDrop,
  logTypingFailure,
  BLUEBUBBLES_ACTION_NAMES,
  BLUEBUBBLES_ACTIONS,
  deleteAccountFromConfigSection,
  setAccountEnabledInConfigSection,
  buildChannelConfigSchema,
  resolveBlueBubblesGroupRequireMention,
  resolveBlueBubblesGroupToolPolicy,
  formatPairingApproveHint,
  resolveChannelMediaMaxBytes,
  addWildcardAllowFrom,
  mergeAllowFromEntries,
  setTopLevelChannelDmPolicyWithAllowFrom,
  PAIRING_APPROVED_MESSAGE,
  applyAccountNameToChannelSection,
  migrateBaseNameToDefaultAccount,
  patchScopedAccountConfig,
  createAccountListHelpers,
  collectBlueBubblesStatusIssues,
  createChannelReplyPipeline,
  ToolPolicySchema,
  MarkdownConfigSchema,
  parseChatAllowTargetPrefixes,
  parseChatTargetPrefixesOrThrow,
  resolveServicePrefixedAllowTarget,
  resolveServicePrefixedTarget,
  stripMarkdown,
  parseFiniteNumber,
  emptyPluginConfigSchema,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  DM_GROUP_ACCESS_REASON,
  readStoreAllowFromForDmPolicy,
  resolveDmGroupAccessWithLists,
  formatDocsLink,
  isAllowedParsedChatSender,
  readBooleanParam,
  mapAllowFromEntries,
  createChannelPairingController,
  resolveRequestUrl,
  buildComputedAccountStatusSnapshot,
  buildProbeChannelStatusSummary,
  extractToolSend,
  WEBHOOK_RATE_LIMIT_DEFAULTS,
  createFixedWindowRateLimiter,
  createWebhookInFlightLimiter,
  normalizeWebhookPath,
  readWebhookBodyOrReject,
  registerWebhookTargetWithPluginRoute,
  resolveRequestClientIp,
  resolveWebhookTargets,
  resolveWebhookTargetWithAuthOrRejectSync,
  withResolvedWebhookRequestPipeline,
};
