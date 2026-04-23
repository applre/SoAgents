// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/irc.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/irc.' + fn + '() not implemented in Bridge mode'); }
}

function resolveControlCommandGate() { _w('resolveControlCommandGate'); return undefined; }
function logInboundDrop() { _w('logInboundDrop'); return undefined; }
function deleteAccountFromConfigSection() { _w('deleteAccountFromConfigSection'); return undefined; }
function setAccountEnabledInConfigSection() { _w('setAccountEnabledInConfigSection'); return undefined; }
function createAccountListHelpers() { _w('createAccountListHelpers'); return undefined; }
const buildChannelConfigSchema = undefined;
function formatPairingApproveHint() { _w('formatPairingApproveHint'); return ""; }
function parseOptionalDelimitedEntries() { _w('parseOptionalDelimitedEntries'); return undefined; }
function addWildcardAllowFrom() { _w('addWildcardAllowFrom'); return undefined; }
function setTopLevelChannelAllowFrom() { _w('setTopLevelChannelAllowFrom'); return undefined; }
function setTopLevelChannelDmPolicyWithAllowFrom() { _w('setTopLevelChannelDmPolicyWithAllowFrom'); return undefined; }
const PAIRING_APPROVED_MESSAGE = undefined;
const patchScopedAccountConfig = undefined;
function getChatChannelMeta() { _w('getChatChannelMeta'); return undefined; }
function createChannelReplyPipeline() { _w('createChannelReplyPipeline'); return undefined; }
function isDangerousNameMatchingEnabled() { _w('isDangerousNameMatchingEnabled'); return false; }
const GROUP_POLICY_BLOCKED_LABEL = undefined;
function resolveAllowlistProviderRuntimeGroupPolicy() { _w('resolveAllowlistProviderRuntimeGroupPolicy'); return undefined; }
function resolveDefaultGroupPolicy() { _w('resolveDefaultGroupPolicy'); return undefined; }
function warnMissingProviderGroupPolicyFallbackOnce() { _w('warnMissingProviderGroupPolicyFallbackOnce'); return undefined; }
function normalizeResolvedSecretInputString() { _w('normalizeResolvedSecretInputString'); return ""; }
const ToolPolicySchema = undefined;
const BlockStreamingCoalesceSchema = undefined;
const DmConfigSchema = undefined;
const DmPolicySchema = undefined;
const GroupPolicySchema = undefined;
const MarkdownConfigSchema = undefined;
function ReplyRuntimeConfigSchemaShape() { _w('ReplyRuntimeConfigSchemaShape'); return undefined; }
function requireOpenAllowFrom() { _w('requireOpenAllowFrom'); return undefined; }
const emptyPluginConfigSchema = undefined;
const DEFAULT_ACCOUNT_ID = undefined;
function createAccountStatusSink() { _w('createAccountStatusSink'); return undefined; }
function runPassiveAccountLifecycle() { _w('runPassiveAccountLifecycle'); return undefined; }
function listIrcAccountIds() { _w('listIrcAccountIds'); return []; }
function resolveDefaultIrcAccountId() { _w('resolveDefaultIrcAccountId'); return undefined; }
function resolveIrcAccount() { _w('resolveIrcAccount'); return undefined; }
function readStoreAllowFromForDmPolicy() { _w('readStoreAllowFromForDmPolicy'); return undefined; }
function resolveEffectiveAllowFromLists() { _w('resolveEffectiveAllowFromLists'); return undefined; }
function formatDocsLink() { _w('formatDocsLink'); return ""; }
function createChannelPairingController() { _w('createChannelPairingController'); return undefined; }
function dispatchInboundReplyWithBase() { _w('dispatchInboundReplyWithBase'); return undefined; }
function ircSetupAdapter() { _w('ircSetupAdapter'); return undefined; }
function ircSetupWizard() { _w('ircSetupWizard'); return undefined; }
function createNormalizedOutboundDeliverer() { _w('createNormalizedOutboundDeliverer'); return undefined; }
function deliverFormattedTextWithAttachments() { _w('deliverFormattedTextWithAttachments'); return undefined; }
function formatTextWithAttachmentLinks() { _w('formatTextWithAttachmentLinks'); return ""; }
function resolveOutboundMediaUrls() { _w('resolveOutboundMediaUrls'); return undefined; }
function createLoggerBackedRuntime() { _w('createLoggerBackedRuntime'); return undefined; }
function buildBaseAccountStatusSnapshot() { _w('buildBaseAccountStatusSnapshot'); return undefined; }
function buildBaseChannelStatusSummary() { _w('buildBaseChannelStatusSummary'); return undefined; }

module.exports = {
  resolveControlCommandGate,
  logInboundDrop,
  deleteAccountFromConfigSection,
  setAccountEnabledInConfigSection,
  createAccountListHelpers,
  buildChannelConfigSchema,
  formatPairingApproveHint,
  parseOptionalDelimitedEntries,
  addWildcardAllowFrom,
  setTopLevelChannelAllowFrom,
  setTopLevelChannelDmPolicyWithAllowFrom,
  PAIRING_APPROVED_MESSAGE,
  patchScopedAccountConfig,
  getChatChannelMeta,
  createChannelReplyPipeline,
  isDangerousNameMatchingEnabled,
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
  normalizeResolvedSecretInputString,
  ToolPolicySchema,
  BlockStreamingCoalesceSchema,
  DmConfigSchema,
  DmPolicySchema,
  GroupPolicySchema,
  MarkdownConfigSchema,
  ReplyRuntimeConfigSchemaShape,
  requireOpenAllowFrom,
  emptyPluginConfigSchema,
  DEFAULT_ACCOUNT_ID,
  createAccountStatusSink,
  runPassiveAccountLifecycle,
  listIrcAccountIds,
  resolveDefaultIrcAccountId,
  resolveIrcAccount,
  readStoreAllowFromForDmPolicy,
  resolveEffectiveAllowFromLists,
  formatDocsLink,
  createChannelPairingController,
  dispatchInboundReplyWithBase,
  ircSetupAdapter,
  ircSetupWizard,
  createNormalizedOutboundDeliverer,
  deliverFormattedTextWithAttachments,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
  createLoggerBackedRuntime,
  buildBaseAccountStatusSnapshot,
  buildBaseChannelStatusSummary,
};
