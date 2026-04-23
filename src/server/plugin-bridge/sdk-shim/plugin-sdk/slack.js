// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/slack.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/slack.' + fn + '() not implemented in Bridge mode'); }
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
function formatDocsLink() { _w('formatDocsLink'); return ""; }
function projectCredentialSnapshotFields() { _w('projectCredentialSnapshotFields'); return undefined; }
function resolveConfiguredFromCredentialStatuses() { _w('resolveConfiguredFromCredentialStatuses'); return undefined; }
function resolveConfiguredFromRequiredCredentialStatuses() { _w('resolveConfiguredFromRequiredCredentialStatuses'); return undefined; }
function looksLikeSlackTargetId() { _w('looksLikeSlackTargetId'); return undefined; }
function normalizeSlackMessagingTarget() { _w('normalizeSlackMessagingTarget'); return ""; }
const listSlackDirectoryGroupsFromConfig = undefined;
const listSlackDirectoryPeersFromConfig = undefined;
function resolveDefaultGroupPolicy() { _w('resolveDefaultGroupPolicy'); return undefined; }
function resolveOpenProviderRuntimeGroupPolicy() { _w('resolveOpenProviderRuntimeGroupPolicy'); return undefined; }
function resolveSlackGroupRequireMention() { _w('resolveSlackGroupRequireMention'); return undefined; }
function resolveSlackGroupToolPolicy() { _w('resolveSlackGroupToolPolicy'); return undefined; }
const SlackConfigSchema = undefined;
function buildComputedAccountStatusSnapshot() { _w('buildComputedAccountStatusSnapshot'); return undefined; }
function listEnabledSlackAccounts() { _w('listEnabledSlackAccounts'); return []; }
function listSlackAccountIds() { _w('listSlackAccountIds'); return []; }
function resolveDefaultSlackAccountId() { _w('resolveDefaultSlackAccountId'); return undefined; }
function resolveSlackReplyToMode() { _w('resolveSlackReplyToMode'); return undefined; }
function isSlackInteractiveRepliesEnabled() { _w('isSlackInteractiveRepliesEnabled'); return false; }
function inspectSlackAccount() { _w('inspectSlackAccount'); return undefined; }
function parseSlackTarget() { _w('parseSlackTarget'); return undefined; }
function resolveSlackChannelId() { _w('resolveSlackChannelId'); return undefined; }
function extractSlackToolSend() { _w('extractSlackToolSend'); return undefined; }
function listSlackMessageActions() { _w('listSlackMessageActions'); return []; }
function buildSlackThreadingToolContext() { _w('buildSlackThreadingToolContext'); return undefined; }
function resolveSlackAutoThreadId() { _w('resolveSlackAutoThreadId'); return undefined; }
function parseSlackBlocksInput() { _w('parseSlackBlocksInput'); return undefined; }
function handleSlackHttpRequest() { _w('handleSlackHttpRequest'); return undefined; }
function createSlackWebClient() { _w('createSlackWebClient'); return undefined; }
function normalizeAllowListLower() { _w('normalizeAllowListLower'); return ""; }
function handleSlackAction() { _w('handleSlackAction'); return undefined; }
function listSlackDirectoryGroupsLive() { _w('listSlackDirectoryGroupsLive'); return []; }
function listSlackDirectoryPeersLive() { _w('listSlackDirectoryPeersLive'); return []; }
function monitorSlackProvider() { _w('monitorSlackProvider'); return undefined; }
function probeSlack() { _w('probeSlack'); return undefined; }
function resolveSlackChannelAllowlist() { _w('resolveSlackChannelAllowlist'); return undefined; }
function resolveSlackUserAllowlist() { _w('resolveSlackUserAllowlist'); return undefined; }
function sendMessageSlack() { _w('sendMessageSlack'); return undefined; }
function deleteSlackMessage() { _w('deleteSlackMessage'); return undefined; }
function downloadSlackFile() { _w('downloadSlackFile'); return undefined; }
function editSlackMessage() { _w('editSlackMessage'); return undefined; }
function getSlackMemberInfo() { _w('getSlackMemberInfo'); return undefined; }
function listSlackEmojis() { _w('listSlackEmojis'); return []; }
function listSlackPins() { _w('listSlackPins'); return []; }
function listSlackReactions() { _w('listSlackReactions'); return []; }
function pinSlackMessage() { _w('pinSlackMessage'); return undefined; }
function reactSlackMessage() { _w('reactSlackMessage'); return undefined; }
function readSlackMessages() { _w('readSlackMessages'); return undefined; }
function removeOwnSlackReactions() { _w('removeOwnSlackReactions'); return undefined; }
function removeSlackReaction() { _w('removeSlackReaction'); return undefined; }
function sendSlackMessage() { _w('sendSlackMessage'); return undefined; }
function unpinSlackMessage() { _w('unpinSlackMessage'); return undefined; }
function recordSlackThreadParticipation() { _w('recordSlackThreadParticipation'); return undefined; }

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
  formatDocsLink,
  projectCredentialSnapshotFields,
  resolveConfiguredFromCredentialStatuses,
  resolveConfiguredFromRequiredCredentialStatuses,
  looksLikeSlackTargetId,
  normalizeSlackMessagingTarget,
  listSlackDirectoryGroupsFromConfig,
  listSlackDirectoryPeersFromConfig,
  resolveDefaultGroupPolicy,
  resolveOpenProviderRuntimeGroupPolicy,
  resolveSlackGroupRequireMention,
  resolveSlackGroupToolPolicy,
  SlackConfigSchema,
  buildComputedAccountStatusSnapshot,
  listEnabledSlackAccounts,
  listSlackAccountIds,
  resolveDefaultSlackAccountId,
  resolveSlackReplyToMode,
  isSlackInteractiveRepliesEnabled,
  inspectSlackAccount,
  parseSlackTarget,
  resolveSlackChannelId,
  extractSlackToolSend,
  listSlackMessageActions,
  buildSlackThreadingToolContext,
  resolveSlackAutoThreadId,
  parseSlackBlocksInput,
  handleSlackHttpRequest,
  createSlackWebClient,
  normalizeAllowListLower,
  handleSlackAction,
  listSlackDirectoryGroupsLive,
  listSlackDirectoryPeersLive,
  monitorSlackProvider,
  probeSlack,
  resolveSlackChannelAllowlist,
  resolveSlackUserAllowlist,
  sendMessageSlack,
  deleteSlackMessage,
  downloadSlackFile,
  editSlackMessage,
  getSlackMemberInfo,
  listSlackEmojis,
  listSlackPins,
  listSlackReactions,
  pinSlackMessage,
  reactSlackMessage,
  readSlackMessages,
  removeOwnSlackReactions,
  removeSlackReaction,
  sendSlackMessage,
  unpinSlackMessage,
  recordSlackThreadParticipation,
};
