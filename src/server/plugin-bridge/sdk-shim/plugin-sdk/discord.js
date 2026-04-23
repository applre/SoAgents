// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/discord.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/discord.' + fn + '() not implemented in Bridge mode'); }
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
function resolveDefaultGroupPolicy() { _w('resolveDefaultGroupPolicy'); return undefined; }
function resolveOpenProviderRuntimeGroupPolicy() { _w('resolveOpenProviderRuntimeGroupPolicy'); return undefined; }
const listDiscordDirectoryGroupsFromConfig = undefined;
const listDiscordDirectoryPeersFromConfig = undefined;
function resolveDiscordGroupRequireMention() { _w('resolveDiscordGroupRequireMention'); return undefined; }
function resolveDiscordGroupToolPolicy() { _w('resolveDiscordGroupToolPolicy'); return undefined; }
const DiscordConfigSchema = undefined;
function buildComputedAccountStatusSnapshot() { _w('buildComputedAccountStatusSnapshot'); return undefined; }
function buildTokenChannelStatusSummary() { _w('buildTokenChannelStatusSummary'); return undefined; }
function buildDiscordComponentMessage() { _w('buildDiscordComponentMessage'); return undefined; }
function createDiscordActionGate() { _w('createDiscordActionGate'); return undefined; }
function listDiscordAccountIds() { _w('listDiscordAccountIds'); return []; }
function resolveDiscordAccount() { _w('resolveDiscordAccount'); return undefined; }
function resolveDefaultDiscordAccountId() { _w('resolveDefaultDiscordAccountId'); return undefined; }
function inspectDiscordAccount() { _w('inspectDiscordAccount'); return undefined; }
function looksLikeDiscordTargetId() { _w('looksLikeDiscordTargetId'); return undefined; }
function normalizeDiscordMessagingTarget() { _w('normalizeDiscordMessagingTarget'); return ""; }
function normalizeDiscordOutboundTarget() { _w('normalizeDiscordOutboundTarget'); return ""; }
function collectDiscordAuditChannelIds() { _w('collectDiscordAuditChannelIds'); return []; }
function collectDiscordStatusIssues() { _w('collectDiscordStatusIssues'); return []; }
const DISCORD_DEFAULT_INBOUND_WORKER_TIMEOUT_MS = undefined;
const DISCORD_DEFAULT_LISTENER_TIMEOUT_MS = undefined;
function normalizeExplicitDiscordSessionKey() { _w('normalizeExplicitDiscordSessionKey'); return ""; }
function autoBindSpawnedDiscordSubagent() { _w('autoBindSpawnedDiscordSubagent'); return undefined; }
function getThreadBindingManager() { _w('getThreadBindingManager'); return undefined; }
function listThreadBindingsBySessionKey() { _w('listThreadBindingsBySessionKey'); return []; }
function resolveThreadBindingIdleTimeoutMs() { _w('resolveThreadBindingIdleTimeoutMs'); return undefined; }
function resolveThreadBindingInactivityExpiresAt() { _w('resolveThreadBindingInactivityExpiresAt'); return undefined; }
function resolveThreadBindingMaxAgeExpiresAt() { _w('resolveThreadBindingMaxAgeExpiresAt'); return undefined; }
function resolveThreadBindingMaxAgeMs() { _w('resolveThreadBindingMaxAgeMs'); return undefined; }
function setThreadBindingIdleTimeoutBySessionKey() { _w('setThreadBindingIdleTimeoutBySessionKey'); return undefined; }
function setThreadBindingMaxAgeBySessionKey() { _w('setThreadBindingMaxAgeBySessionKey'); return undefined; }
function unbindThreadBindingsBySessionKey() { _w('unbindThreadBindingsBySessionKey'); return undefined; }
function getGateway() { _w('getGateway'); return undefined; }
function getPresence() { _w('getPresence'); return undefined; }
function readDiscordComponentSpec() { _w('readDiscordComponentSpec'); return undefined; }
function resolveDiscordChannelId() { _w('resolveDiscordChannelId'); return undefined; }
function addRoleDiscord() { _w('addRoleDiscord'); return undefined; }
function auditDiscordChannelPermissions() { _w('auditDiscordChannelPermissions'); return undefined; }
function banMemberDiscord() { _w('banMemberDiscord'); return undefined; }
function createChannelDiscord() { _w('createChannelDiscord'); return undefined; }
function createScheduledEventDiscord() { _w('createScheduledEventDiscord'); return undefined; }
function createThreadDiscord() { _w('createThreadDiscord'); return undefined; }
function deleteChannelDiscord() { _w('deleteChannelDiscord'); return undefined; }
function editDiscordComponentMessage() { _w('editDiscordComponentMessage'); return undefined; }
function registerBuiltDiscordComponentMessage() { _w('registerBuiltDiscordComponentMessage'); return undefined; }
function deleteMessageDiscord() { _w('deleteMessageDiscord'); return undefined; }
function editChannelDiscord() { _w('editChannelDiscord'); return undefined; }
function editMessageDiscord() { _w('editMessageDiscord'); return undefined; }
function fetchChannelInfoDiscord() { _w('fetchChannelInfoDiscord'); return undefined; }
function fetchChannelPermissionsDiscord() { _w('fetchChannelPermissionsDiscord'); return undefined; }
function fetchMemberInfoDiscord() { _w('fetchMemberInfoDiscord'); return undefined; }
function fetchMessageDiscord() { _w('fetchMessageDiscord'); return undefined; }
function fetchReactionsDiscord() { _w('fetchReactionsDiscord'); return undefined; }
function fetchRoleInfoDiscord() { _w('fetchRoleInfoDiscord'); return undefined; }
function fetchVoiceStatusDiscord() { _w('fetchVoiceStatusDiscord'); return undefined; }
function hasAnyGuildPermissionDiscord() { _w('hasAnyGuildPermissionDiscord'); return false; }
function kickMemberDiscord() { _w('kickMemberDiscord'); return undefined; }
function listDiscordDirectoryGroupsLive() { _w('listDiscordDirectoryGroupsLive'); return []; }
function listDiscordDirectoryPeersLive() { _w('listDiscordDirectoryPeersLive'); return []; }
function listGuildChannelsDiscord() { _w('listGuildChannelsDiscord'); return []; }
function listGuildEmojisDiscord() { _w('listGuildEmojisDiscord'); return []; }
function listPinsDiscord() { _w('listPinsDiscord'); return []; }
function listScheduledEventsDiscord() { _w('listScheduledEventsDiscord'); return []; }
function listThreadsDiscord() { _w('listThreadsDiscord'); return []; }
function monitorDiscordProvider() { _w('monitorDiscordProvider'); return undefined; }
function moveChannelDiscord() { _w('moveChannelDiscord'); return undefined; }
function pinMessageDiscord() { _w('pinMessageDiscord'); return undefined; }
function probeDiscord() { _w('probeDiscord'); return undefined; }
function reactMessageDiscord() { _w('reactMessageDiscord'); return undefined; }
function readMessagesDiscord() { _w('readMessagesDiscord'); return undefined; }
function removeChannelPermissionDiscord() { _w('removeChannelPermissionDiscord'); return undefined; }
function removeOwnReactionsDiscord() { _w('removeOwnReactionsDiscord'); return undefined; }
function removeReactionDiscord() { _w('removeReactionDiscord'); return undefined; }
function removeRoleDiscord() { _w('removeRoleDiscord'); return undefined; }
function resolveDiscordChannelAllowlist() { _w('resolveDiscordChannelAllowlist'); return undefined; }
function resolveDiscordUserAllowlist() { _w('resolveDiscordUserAllowlist'); return undefined; }
function searchMessagesDiscord() { _w('searchMessagesDiscord'); return undefined; }
function sendDiscordComponentMessage() { _w('sendDiscordComponentMessage'); return undefined; }
function sendMessageDiscord() { _w('sendMessageDiscord'); return undefined; }
function sendPollDiscord() { _w('sendPollDiscord'); return undefined; }
function sendTypingDiscord() { _w('sendTypingDiscord'); return undefined; }
function sendStickerDiscord() { _w('sendStickerDiscord'); return undefined; }
function sendVoiceMessageDiscord() { _w('sendVoiceMessageDiscord'); return undefined; }
function setChannelPermissionDiscord() { _w('setChannelPermissionDiscord'); return undefined; }
function timeoutMemberDiscord() { _w('timeoutMemberDiscord'); return undefined; }
function unpinMessageDiscord() { _w('unpinMessageDiscord'); return undefined; }
function uploadEmojiDiscord() { _w('uploadEmojiDiscord'); return undefined; }
function uploadStickerDiscord() { _w('uploadStickerDiscord'); return undefined; }
function discordMessageActions() { _w('discordMessageActions'); return undefined; }
function resolveDiscordOutboundSessionRoute() { _w('resolveDiscordOutboundSessionRoute'); return undefined; }

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
  resolveDefaultGroupPolicy,
  resolveOpenProviderRuntimeGroupPolicy,
  listDiscordDirectoryGroupsFromConfig,
  listDiscordDirectoryPeersFromConfig,
  resolveDiscordGroupRequireMention,
  resolveDiscordGroupToolPolicy,
  DiscordConfigSchema,
  buildComputedAccountStatusSnapshot,
  buildTokenChannelStatusSummary,
  buildDiscordComponentMessage,
  createDiscordActionGate,
  listDiscordAccountIds,
  resolveDiscordAccount,
  resolveDefaultDiscordAccountId,
  inspectDiscordAccount,
  looksLikeDiscordTargetId,
  normalizeDiscordMessagingTarget,
  normalizeDiscordOutboundTarget,
  collectDiscordAuditChannelIds,
  collectDiscordStatusIssues,
  DISCORD_DEFAULT_INBOUND_WORKER_TIMEOUT_MS,
  DISCORD_DEFAULT_LISTENER_TIMEOUT_MS,
  normalizeExplicitDiscordSessionKey,
  autoBindSpawnedDiscordSubagent,
  getThreadBindingManager,
  listThreadBindingsBySessionKey,
  resolveThreadBindingIdleTimeoutMs,
  resolveThreadBindingInactivityExpiresAt,
  resolveThreadBindingMaxAgeExpiresAt,
  resolveThreadBindingMaxAgeMs,
  setThreadBindingIdleTimeoutBySessionKey,
  setThreadBindingMaxAgeBySessionKey,
  unbindThreadBindingsBySessionKey,
  getGateway,
  getPresence,
  readDiscordComponentSpec,
  resolveDiscordChannelId,
  addRoleDiscord,
  auditDiscordChannelPermissions,
  banMemberDiscord,
  createChannelDiscord,
  createScheduledEventDiscord,
  createThreadDiscord,
  deleteChannelDiscord,
  editDiscordComponentMessage,
  registerBuiltDiscordComponentMessage,
  deleteMessageDiscord,
  editChannelDiscord,
  editMessageDiscord,
  fetchChannelInfoDiscord,
  fetchChannelPermissionsDiscord,
  fetchMemberInfoDiscord,
  fetchMessageDiscord,
  fetchReactionsDiscord,
  fetchRoleInfoDiscord,
  fetchVoiceStatusDiscord,
  hasAnyGuildPermissionDiscord,
  kickMemberDiscord,
  listDiscordDirectoryGroupsLive,
  listDiscordDirectoryPeersLive,
  listGuildChannelsDiscord,
  listGuildEmojisDiscord,
  listPinsDiscord,
  listScheduledEventsDiscord,
  listThreadsDiscord,
  monitorDiscordProvider,
  moveChannelDiscord,
  pinMessageDiscord,
  probeDiscord,
  reactMessageDiscord,
  readMessagesDiscord,
  removeChannelPermissionDiscord,
  removeOwnReactionsDiscord,
  removeReactionDiscord,
  removeRoleDiscord,
  resolveDiscordChannelAllowlist,
  resolveDiscordUserAllowlist,
  searchMessagesDiscord,
  sendDiscordComponentMessage,
  sendMessageDiscord,
  sendPollDiscord,
  sendTypingDiscord,
  sendStickerDiscord,
  sendVoiceMessageDiscord,
  setChannelPermissionDiscord,
  timeoutMemberDiscord,
  unpinMessageDiscord,
  uploadEmojiDiscord,
  uploadStickerDiscord,
  discordMessageActions,
  resolveDiscordOutboundSessionRoute,
};
