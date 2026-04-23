// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/config-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/config-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function getRuntimeConfigSnapshot() { _w('getRuntimeConfigSnapshot'); return undefined; }
const loadConfig = undefined;
function readConfigFileSnapshotForWrite() { _w('readConfigFileSnapshotForWrite'); return undefined; }
function writeConfigFile() { _w('writeConfigFile'); return undefined; }
function logConfigUpdated() { _w('logConfigUpdated'); return undefined; }
const updateConfig = undefined;
function resolveChannelModelOverride() { _w('resolveChannelModelOverride'); return undefined; }
function resolveMarkdownTableMode() { _w('resolveMarkdownTableMode'); return undefined; }
function resolveChannelGroupPolicy() { return { allowed: true, allowlistEnabled: false }; }
function resolveChannelGroupRequireMention() { return false; }
const GROUP_POLICY_BLOCKED_LABEL = undefined;
function resolveAllowlistProviderRuntimeGroupPolicy() { _w('resolveAllowlistProviderRuntimeGroupPolicy'); return undefined; }
function resolveDefaultGroupPolicy() { _w('resolveDefaultGroupPolicy'); return undefined; }
function resolveOpenProviderRuntimeGroupPolicy() { _w('resolveOpenProviderRuntimeGroupPolicy'); return undefined; }
function warnMissingProviderGroupPolicyFallbackOnce() { _w('warnMissingProviderGroupPolicyFallbackOnce'); return undefined; }
function isNativeCommandsExplicitlyDisabled() { _w('isNativeCommandsExplicitlyDisabled'); return false; }
function resolveNativeCommandsEnabled() { _w('resolveNativeCommandsEnabled'); return undefined; }
function resolveNativeSkillsEnabled() { _w('resolveNativeSkillsEnabled'); return undefined; }
const TELEGRAM_COMMAND_NAME_PATTERN = undefined;
function normalizeTelegramCommandName() { _w('normalizeTelegramCommandName'); return ""; }
function resolveTelegramCustomCommands() { _w('resolveTelegramCustomCommands'); return undefined; }
function mapStreamingModeToSlackLegacyDraftStreamMode() { _w('mapStreamingModeToSlackLegacyDraftStreamMode'); return undefined; }
function resolveDiscordPreviewStreamMode() { _w('resolveDiscordPreviewStreamMode'); return undefined; }
function resolveSlackNativeStreaming() { _w('resolveSlackNativeStreaming'); return undefined; }
function resolveSlackStreamingMode() { _w('resolveSlackStreamingMode'); return undefined; }
function resolveTelegramPreviewStreamMode() { _w('resolveTelegramPreviewStreamMode'); return undefined; }
const resolveActiveTalkProviderConfig = undefined;
function resolveAgentMaxConcurrent() { _w('resolveAgentMaxConcurrent'); return undefined; }
function loadCronStore() { _w('loadCronStore'); return undefined; }
function resolveCronStorePath() { _w('resolveCronStorePath'); return undefined; }
function saveCronStore() { _w('saveCronStore'); return undefined; }
function applyModelOverrideToSessionEntry() { _w('applyModelOverrideToSessionEntry'); return undefined; }
function coerceSecretRef() { _w('coerceSecretRef'); return undefined; }
function loadSessionStore() { _w('loadSessionStore'); return undefined; }
function readSessionUpdatedAt() { _w('readSessionUpdatedAt'); return undefined; }
function recordSessionMetaFromInbound() { _w('recordSessionMetaFromInbound'); return undefined; }
function resolveSessionKey() { _w('resolveSessionKey'); return undefined; }
function resolveStorePath() { _w('resolveStorePath'); return undefined; }
function updateLastRoute() { _w('updateLastRoute'); return undefined; }
function updateSessionStore() { _w('updateSessionStore'); return undefined; }
function resolveGroupSessionKey() { _w('resolveGroupSessionKey'); return undefined; }
function evaluateSessionFreshness() { _w('evaluateSessionFreshness'); return undefined; }
const resolveChannelResetConfig = undefined;
function resolveSessionResetPolicy() { _w('resolveSessionResetPolicy'); return undefined; }
function resolveSessionResetType() { _w('resolveSessionResetType'); return undefined; }
function resolveThreadFlag() { _w('resolveThreadFlag'); return undefined; }
function resolveSessionStoreEntry() { _w('resolveSessionStoreEntry'); return undefined; }
function isDangerousNameMatchingEnabled() { _w('isDangerousNameMatchingEnabled'); return false; }
function resolveDangerousNameMatchingEnabled() { _w('resolveDangerousNameMatchingEnabled'); return undefined; }

module.exports = {
  getRuntimeConfigSnapshot,
  loadConfig,
  readConfigFileSnapshotForWrite,
  writeConfigFile,
  logConfigUpdated,
  updateConfig,
  resolveChannelModelOverride,
  resolveMarkdownTableMode,
  resolveChannelGroupPolicy,
  resolveChannelGroupRequireMention,
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  resolveOpenProviderRuntimeGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
  isNativeCommandsExplicitlyDisabled,
  resolveNativeCommandsEnabled,
  resolveNativeSkillsEnabled,
  TELEGRAM_COMMAND_NAME_PATTERN,
  normalizeTelegramCommandName,
  resolveTelegramCustomCommands,
  mapStreamingModeToSlackLegacyDraftStreamMode,
  resolveDiscordPreviewStreamMode,
  resolveSlackNativeStreaming,
  resolveSlackStreamingMode,
  resolveTelegramPreviewStreamMode,
  resolveActiveTalkProviderConfig,
  resolveAgentMaxConcurrent,
  loadCronStore,
  resolveCronStorePath,
  saveCronStore,
  applyModelOverrideToSessionEntry,
  coerceSecretRef,
  loadSessionStore,
  readSessionUpdatedAt,
  recordSessionMetaFromInbound,
  resolveSessionKey,
  resolveStorePath,
  updateLastRoute,
  updateSessionStore,
  resolveGroupSessionKey,
  evaluateSessionFreshness,
  resolveChannelResetConfig,
  resolveSessionResetPolicy,
  resolveSessionResetType,
  resolveThreadFlag,
  resolveSessionStoreEntry,
  isDangerousNameMatchingEnabled,
  resolveDangerousNameMatchingEnabled,
};
