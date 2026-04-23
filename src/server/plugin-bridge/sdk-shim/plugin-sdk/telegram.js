// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/telegram.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/telegram.' + fn + '() not implemented in Bridge mode'); }
}

const emptyPluginConfigSchema = undefined;
const DEFAULT_ACCOUNT_ID = undefined;
function normalizeAccountId() { _w('normalizeAccountId'); return ""; }
function parseTelegramTopicConversation() { _w('parseTelegramTopicConversation'); return undefined; }
function clearAccountEntryFields() { _w('clearAccountEntryFields'); return undefined; }
function resolveTelegramPollVisibility() { _w('resolveTelegramPollVisibility'); return undefined; }
const PAIRING_APPROVED_MESSAGE = undefined;
function applyAccountNameToChannelSection() { _w('applyAccountNameToChannelSection'); return undefined; }
const buildChannelConfigSchema = undefined;
function deleteAccountFromConfigSection() { _w('deleteAccountFromConfigSection'); return undefined; }
function formatPairingApproveHint() { _w('formatPairingApproveHint'); return ""; }
function getChatChannelMeta() { _w('getChatChannelMeta'); return undefined; }
function migrateBaseNameToDefaultAccount() { _w('migrateBaseNameToDefaultAccount'); return undefined; }
function setAccountEnabledInConfigSection() { _w('setAccountEnabledInConfigSection'); return undefined; }
function projectCredentialSnapshotFields() { _w('projectCredentialSnapshotFields'); return undefined; }
function resolveConfiguredFromCredentialStatuses() { _w('resolveConfiguredFromCredentialStatuses'); return undefined; }
function resolveAllowlistProviderRuntimeGroupPolicy() { _w('resolveAllowlistProviderRuntimeGroupPolicy'); return undefined; }
function resolveDefaultGroupPolicy() { _w('resolveDefaultGroupPolicy'); return undefined; }
function jsonResult() { _w('jsonResult'); return undefined; }
function readNumberParam() { _w('readNumberParam'); return undefined; }
function readReactionParams() { _w('readReactionParams'); return undefined; }
function readStringArrayParam() { _w('readStringArrayParam'); return undefined; }
function readStringOrNumberParam() { _w('readStringOrNumberParam'); return undefined; }
function readStringParam() { _w('readStringParam'); return undefined; }
const TelegramConfigSchema = undefined;
function resolvePollMaxSelections() { _w('resolvePollMaxSelections'); return undefined; }
function buildTokenChannelStatusSummary() { _w('buildTokenChannelStatusSummary'); return undefined; }
function buildBrowseProvidersButton() { _w('buildBrowseProvidersButton'); return undefined; }
function buildModelsKeyboard() { _w('buildModelsKeyboard'); return undefined; }
function buildProviderKeyboard() { _w('buildProviderKeyboard'); return undefined; }
function calculateTotalPages() { _w('calculateTotalPages'); return undefined; }
function createTelegramActionGate() { _w('createTelegramActionGate'); return undefined; }
function fetchTelegramChatId() { _w('fetchTelegramChatId'); return undefined; }
function getCacheStats() { _w('getCacheStats'); return undefined; }
function getModelsPageSize() { _w('getModelsPageSize'); return undefined; }
function inspectTelegramAccount() { _w('inspectTelegramAccount'); return undefined; }
function isTelegramExecApprovalApprover() { _w('isTelegramExecApprovalApprover'); return false; }
function isTelegramExecApprovalClientEnabled() { _w('isTelegramExecApprovalClientEnabled'); return false; }
function listTelegramAccountIds() { _w('listTelegramAccountIds'); return []; }
const listTelegramDirectoryGroupsFromConfig = undefined;
const listTelegramDirectoryPeersFromConfig = undefined;
function looksLikeTelegramTargetId() { _w('looksLikeTelegramTargetId'); return undefined; }
function lookupTelegramChatId() { _w('lookupTelegramChatId'); return undefined; }
function normalizeTelegramMessagingTarget() { _w('normalizeTelegramMessagingTarget'); return ""; }
function parseTelegramReplyToMessageId() { _w('parseTelegramReplyToMessageId'); return undefined; }
function parseTelegramThreadId() { _w('parseTelegramThreadId'); return undefined; }
function resolveTelegramAutoThreadId() { _w('resolveTelegramAutoThreadId'); return undefined; }
function resolveTelegramGroupRequireMention() { _w('resolveTelegramGroupRequireMention'); return undefined; }
function resolveTelegramGroupToolPolicy() { _w('resolveTelegramGroupToolPolicy'); return undefined; }
function resolveTelegramInlineButtonsScope() { _w('resolveTelegramInlineButtonsScope'); return undefined; }
function resolveTelegramPollActionGateState() { _w('resolveTelegramPollActionGateState'); return undefined; }
function resolveTelegramReactionLevel() { _w('resolveTelegramReactionLevel'); return undefined; }
function resolveTelegramTargetChatType() { _w('resolveTelegramTargetChatType'); return undefined; }
function searchStickers() { _w('searchStickers'); return undefined; }
function sendTelegramPayloadMessages() { _w('sendTelegramPayloadMessages'); return undefined; }
function isNumericTelegramUserId() { _w('isNumericTelegramUserId'); return false; }
function normalizeTelegramAllowFromEntry() { _w('normalizeTelegramAllowFromEntry'); return ""; }
function auditTelegramGroupMembership() { _w('auditTelegramGroupMembership'); return undefined; }
function buildTelegramExecApprovalPendingPayload() { _w('buildTelegramExecApprovalPendingPayload'); return undefined; }
function collectTelegramUnmentionedGroupIds() { _w('collectTelegramUnmentionedGroupIds'); return []; }
function createForumTopicTelegram() { _w('createForumTopicTelegram'); return undefined; }
function deleteMessageTelegram() { _w('deleteMessageTelegram'); return undefined; }
function editForumTopicTelegram() { _w('editForumTopicTelegram'); return undefined; }
function editMessageReplyMarkupTelegram() { _w('editMessageReplyMarkupTelegram'); return undefined; }
function editMessageTelegram() { _w('editMessageTelegram'); return undefined; }
function monitorTelegramProvider() { _w('monitorTelegramProvider'); return undefined; }
function pinMessageTelegram() { _w('pinMessageTelegram'); return undefined; }
function probeTelegram() { _w('probeTelegram'); return undefined; }
function reactMessageTelegram() { _w('reactMessageTelegram'); return undefined; }
function renameForumTopicTelegram() { _w('renameForumTopicTelegram'); return undefined; }
function resolveTelegramToken() { _w('resolveTelegramToken'); return undefined; }
function sendMessageTelegram() { _w('sendMessageTelegram'); return undefined; }
function sendPollTelegram() { _w('sendPollTelegram'); return undefined; }
function sendStickerTelegram() { _w('sendStickerTelegram'); return undefined; }
function sendTypingTelegram() { _w('sendTypingTelegram'); return undefined; }
function setTelegramThreadBindingIdleTimeoutBySessionKey() { _w('setTelegramThreadBindingIdleTimeoutBySessionKey'); return undefined; }
function setTelegramThreadBindingMaxAgeBySessionKey() { _w('setTelegramThreadBindingMaxAgeBySessionKey'); return undefined; }
function shouldSuppressTelegramExecApprovalForwardingFallback() { _w('shouldSuppressTelegramExecApprovalForwardingFallback'); return false; }
function telegramMessageActions() { _w('telegramMessageActions'); return undefined; }
function unpinMessageTelegram() { _w('unpinMessageTelegram'); return undefined; }
function buildTelegramGroupPeerId() { _w('buildTelegramGroupPeerId'); return undefined; }
function parseTelegramTarget() { _w('parseTelegramTarget'); return undefined; }

module.exports = {
  emptyPluginConfigSchema,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  parseTelegramTopicConversation,
  clearAccountEntryFields,
  resolveTelegramPollVisibility,
  PAIRING_APPROVED_MESSAGE,
  applyAccountNameToChannelSection,
  buildChannelConfigSchema,
  deleteAccountFromConfigSection,
  formatPairingApproveHint,
  getChatChannelMeta,
  migrateBaseNameToDefaultAccount,
  setAccountEnabledInConfigSection,
  projectCredentialSnapshotFields,
  resolveConfiguredFromCredentialStatuses,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringArrayParam,
  readStringOrNumberParam,
  readStringParam,
  TelegramConfigSchema,
  resolvePollMaxSelections,
  buildTokenChannelStatusSummary,
  buildBrowseProvidersButton,
  buildModelsKeyboard,
  buildProviderKeyboard,
  calculateTotalPages,
  createTelegramActionGate,
  fetchTelegramChatId,
  getCacheStats,
  getModelsPageSize,
  inspectTelegramAccount,
  isTelegramExecApprovalApprover,
  isTelegramExecApprovalClientEnabled,
  listTelegramAccountIds,
  listTelegramDirectoryGroupsFromConfig,
  listTelegramDirectoryPeersFromConfig,
  looksLikeTelegramTargetId,
  lookupTelegramChatId,
  normalizeTelegramMessagingTarget,
  parseTelegramReplyToMessageId,
  parseTelegramThreadId,
  resolveTelegramAutoThreadId,
  resolveTelegramGroupRequireMention,
  resolveTelegramGroupToolPolicy,
  resolveTelegramInlineButtonsScope,
  resolveTelegramPollActionGateState,
  resolveTelegramReactionLevel,
  resolveTelegramTargetChatType,
  searchStickers,
  sendTelegramPayloadMessages,
  isNumericTelegramUserId,
  normalizeTelegramAllowFromEntry,
  auditTelegramGroupMembership,
  buildTelegramExecApprovalPendingPayload,
  collectTelegramUnmentionedGroupIds,
  createForumTopicTelegram,
  deleteMessageTelegram,
  editForumTopicTelegram,
  editMessageReplyMarkupTelegram,
  editMessageTelegram,
  monitorTelegramProvider,
  pinMessageTelegram,
  probeTelegram,
  reactMessageTelegram,
  renameForumTopicTelegram,
  resolveTelegramToken,
  sendMessageTelegram,
  sendPollTelegram,
  sendStickerTelegram,
  sendTypingTelegram,
  setTelegramThreadBindingIdleTimeoutBySessionKey,
  setTelegramThreadBindingMaxAgeBySessionKey,
  shouldSuppressTelegramExecApprovalForwardingFallback,
  telegramMessageActions,
  unpinMessageTelegram,
  buildTelegramGroupPeerId,
  parseTelegramTarget,
};
