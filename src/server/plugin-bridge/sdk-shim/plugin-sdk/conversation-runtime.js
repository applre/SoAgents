// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/conversation-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/conversation-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function createConversationBindingRecord() { _w('createConversationBindingRecord'); return undefined; }
function getConversationBindingCapabilities() { _w('getConversationBindingCapabilities'); return undefined; }
function listSessionBindingRecords() { _w('listSessionBindingRecords'); return []; }
function resolveConversationBindingRecord() { _w('resolveConversationBindingRecord'); return undefined; }
function touchConversationBindingRecord() { _w('touchConversationBindingRecord'); return undefined; }
function unbindConversationBindingRecord() { _w('unbindConversationBindingRecord'); return undefined; }
function ensureConfiguredBindingRouteReady() { _w('ensureConfiguredBindingRouteReady'); return undefined; }
function resolveConfiguredBindingRoute() { _w('resolveConfiguredBindingRoute'); return undefined; }
function primeConfiguredBindingRegistry() { _w('primeConfiguredBindingRegistry'); return undefined; }
function resolveConfiguredBinding() { _w('resolveConfiguredBinding'); return undefined; }
function resolveConfiguredBindingRecord() { _w('resolveConfiguredBindingRecord'); return undefined; }
function resolveConfiguredBindingRecordBySessionKey() { _w('resolveConfiguredBindingRecordBySessionKey'); return undefined; }
function resolveConfiguredBindingRecordForConversation() { _w('resolveConfiguredBindingRecordForConversation'); return undefined; }
function ensureConfiguredBindingTargetReady() { _w('ensureConfiguredBindingTargetReady'); return undefined; }
function ensureConfiguredBindingTargetSession() { _w('ensureConfiguredBindingTargetSession'); return undefined; }
function resetConfiguredBindingTargetInPlace() { _w('resetConfiguredBindingTargetInPlace'); return undefined; }
function resolveConversationLabel() { _w('resolveConversationLabel'); return undefined; }
function recordInboundSession() { _w('recordInboundSession'); return undefined; }
function recordInboundSessionMetaSafe() { _w('recordInboundSessionMetaSafe'); return undefined; }
function resolveThreadBindingConversationIdFromBindingId() { _w('resolveThreadBindingConversationIdFromBindingId'); return undefined; }
function createScopedAccountReplyToModeResolver() { _w('createScopedAccountReplyToModeResolver'); return undefined; }
function createStaticReplyToModeResolver() { _w('createStaticReplyToModeResolver'); return undefined; }
function createTopLevelChannelReplyToModeResolver() { _w('createTopLevelChannelReplyToModeResolver'); return undefined; }
function formatThreadBindingDurationLabel() { _w('formatThreadBindingDurationLabel'); return ""; }
function resolveThreadBindingFarewellText() { _w('resolveThreadBindingFarewellText'); return undefined; }
function resolveThreadBindingIntroText() { _w('resolveThreadBindingIntroText'); return undefined; }
function resolveThreadBindingThreadName() { _w('resolveThreadBindingThreadName'); return undefined; }
const DISCORD_THREAD_BINDING_CHANNEL = undefined;
const MATRIX_THREAD_BINDING_CHANNEL = undefined;
function formatThreadBindingDisabledError() { _w('formatThreadBindingDisabledError'); return ""; }
function resolveThreadBindingEffectiveExpiresAt() { _w('resolveThreadBindingEffectiveExpiresAt'); return undefined; }
function resolveThreadBindingIdleTimeoutMs() { _w('resolveThreadBindingIdleTimeoutMs'); return undefined; }
function resolveThreadBindingIdleTimeoutMsForChannel() { _w('resolveThreadBindingIdleTimeoutMsForChannel'); return undefined; }
function resolveThreadBindingLifecycle() { _w('resolveThreadBindingLifecycle'); return undefined; }
function resolveThreadBindingMaxAgeMs() { _w('resolveThreadBindingMaxAgeMs'); return undefined; }
function resolveThreadBindingMaxAgeMsForChannel() { _w('resolveThreadBindingMaxAgeMsForChannel'); return undefined; }
function resolveThreadBindingsEnabled() { _w('resolveThreadBindingsEnabled'); return undefined; }
function resolveThreadBindingSpawnPolicy() { _w('resolveThreadBindingSpawnPolicy'); return undefined; }
function SessionBindingError() { _w('SessionBindingError'); return undefined; }
function getSessionBindingService() { _w('getSessionBindingService'); return undefined; }
function isSessionBindingError() { _w('isSessionBindingError'); return false; }
function registerSessionBindingAdapter() { _w('registerSessionBindingAdapter'); return undefined; }
function unregisterSessionBindingAdapter() { _w('unregisterSessionBindingAdapter'); return undefined; }
function resolvePairingIdLabel() { _w('resolvePairingIdLabel'); return undefined; }
function buildPluginBindingApprovalCustomId() { _w('buildPluginBindingApprovalCustomId'); return undefined; }
function buildPluginBindingDeclinedText() { _w('buildPluginBindingDeclinedText'); return undefined; }
function buildPluginBindingErrorText() { _w('buildPluginBindingErrorText'); return undefined; }
function buildPluginBindingResolvedText() { _w('buildPluginBindingResolvedText'); return undefined; }
function buildPluginBindingUnavailableText() { _w('buildPluginBindingUnavailableText'); return undefined; }
function detachPluginConversationBinding() { _w('detachPluginConversationBinding'); return undefined; }
function getCurrentPluginConversationBinding() { _w('getCurrentPluginConversationBinding'); return undefined; }
function hasShownPluginBindingFallbackNotice() { _w('hasShownPluginBindingFallbackNotice'); return false; }
function isPluginOwnedBindingMetadata() { _w('isPluginOwnedBindingMetadata'); return false; }
function isPluginOwnedSessionBindingRecord() { _w('isPluginOwnedSessionBindingRecord'); return false; }
function markPluginBindingFallbackNoticeShown() { _w('markPluginBindingFallbackNoticeShown'); return undefined; }
function parsePluginBindingApprovalCustomId() { _w('parsePluginBindingApprovalCustomId'); return undefined; }
function requestPluginConversationBinding() { _w('requestPluginConversationBinding'); return undefined; }
function resolvePluginConversationBindingApproval() { _w('resolvePluginConversationBindingApproval'); return undefined; }
function toPluginConversationBinding() { _w('toPluginConversationBinding'); return undefined; }
function resolvePinnedMainDmOwnerFromAllowlist() { _w('resolvePinnedMainDmOwnerFromAllowlist'); return undefined; }
async function issuePairingChallenge() { _w('issuePairingChallenge'); return undefined; }
function buildPairingReply() { _w('buildPairingReply'); return undefined; }
async function readLegacyChannelAllowFromStore() { _w('readLegacyChannelAllowFromStore'); return undefined; }
async function readChannelAllowFromStore() { _w('readChannelAllowFromStore'); return undefined; }
async function addChannelAllowFromStoreEntry() { _w('addChannelAllowFromStoreEntry'); return undefined; }
async function removeChannelAllowFromStoreEntry() { _w('removeChannelAllowFromStoreEntry'); return undefined; }
async function listChannelPairingRequests() { _w('listChannelPairingRequests'); return []; }
async function upsertChannelPairingRequest() { _w('upsertChannelPairingRequest'); return undefined; }
async function approveChannelPairingCode() { _w('approveChannelPairingCode'); return undefined; }
function resolveChannelAllowFromPath() { _w('resolveChannelAllowFromPath'); return undefined; }
function readLegacyChannelAllowFromStoreSync() { _w('readLegacyChannelAllowFromStoreSync'); return undefined; }
function readChannelAllowFromStoreSync() { _w('readChannelAllowFromStoreSync'); return undefined; }
function clearPairingAllowFromReadCacheForTest() { _w('clearPairingAllowFromReadCacheForTest'); return undefined; }

module.exports = {
  createConversationBindingRecord,
  getConversationBindingCapabilities,
  listSessionBindingRecords,
  resolveConversationBindingRecord,
  touchConversationBindingRecord,
  unbindConversationBindingRecord,
  ensureConfiguredBindingRouteReady,
  resolveConfiguredBindingRoute,
  primeConfiguredBindingRegistry,
  resolveConfiguredBinding,
  resolveConfiguredBindingRecord,
  resolveConfiguredBindingRecordBySessionKey,
  resolveConfiguredBindingRecordForConversation,
  ensureConfiguredBindingTargetReady,
  ensureConfiguredBindingTargetSession,
  resetConfiguredBindingTargetInPlace,
  resolveConversationLabel,
  recordInboundSession,
  recordInboundSessionMetaSafe,
  resolveThreadBindingConversationIdFromBindingId,
  createScopedAccountReplyToModeResolver,
  createStaticReplyToModeResolver,
  createTopLevelChannelReplyToModeResolver,
  formatThreadBindingDurationLabel,
  resolveThreadBindingFarewellText,
  resolveThreadBindingIntroText,
  resolveThreadBindingThreadName,
  DISCORD_THREAD_BINDING_CHANNEL,
  MATRIX_THREAD_BINDING_CHANNEL,
  formatThreadBindingDisabledError,
  resolveThreadBindingEffectiveExpiresAt,
  resolveThreadBindingIdleTimeoutMs,
  resolveThreadBindingIdleTimeoutMsForChannel,
  resolveThreadBindingLifecycle,
  resolveThreadBindingMaxAgeMs,
  resolveThreadBindingMaxAgeMsForChannel,
  resolveThreadBindingsEnabled,
  resolveThreadBindingSpawnPolicy,
  SessionBindingError,
  getSessionBindingService,
  isSessionBindingError,
  registerSessionBindingAdapter,
  unregisterSessionBindingAdapter,
  resolvePairingIdLabel,
  buildPluginBindingApprovalCustomId,
  buildPluginBindingDeclinedText,
  buildPluginBindingErrorText,
  buildPluginBindingResolvedText,
  buildPluginBindingUnavailableText,
  detachPluginConversationBinding,
  getCurrentPluginConversationBinding,
  hasShownPluginBindingFallbackNotice,
  isPluginOwnedBindingMetadata,
  isPluginOwnedSessionBindingRecord,
  markPluginBindingFallbackNoticeShown,
  parsePluginBindingApprovalCustomId,
  requestPluginConversationBinding,
  resolvePluginConversationBindingApproval,
  toPluginConversationBinding,
  resolvePinnedMainDmOwnerFromAllowlist,
  issuePairingChallenge,
  buildPairingReply,
  readLegacyChannelAllowFromStore,
  readChannelAllowFromStore,
  addChannelAllowFromStoreEntry,
  removeChannelAllowFromStoreEntry,
  listChannelPairingRequests,
  upsertChannelPairingRequest,
  approveChannelPairingCode,
  resolveChannelAllowFromPath,
  readLegacyChannelAllowFromStoreSync,
  readChannelAllowFromStoreSync,
  clearPairingAllowFromReadCacheForTest,
};
