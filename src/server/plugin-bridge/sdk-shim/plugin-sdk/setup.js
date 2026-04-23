/** Shim for openclaw/plugin-sdk/setup */

// --- routing/session-key re-exports ---

const DEFAULT_ACCOUNT_ID = 'default';

function normalizeAccountId(id) {
  if (!id || id === 'default') return DEFAULT_ACCOUNT_ID;
  return String(id).trim().toLowerCase();
}

// --- cli/command-format ---

function formatCliCommand(_cmd) { return ''; }

// --- plugins/setup-binary ---

async function detectBinary(_name) { return null; }

// --- plugins/signal-cli-install ---

async function installSignalCli(_params) { return false; }

// --- terminal/links ---

function formatDocsLink(path, label) {
  const url = path.trim().startsWith('http')
    ? path.trim()
    : 'https://docs.openclaw.ai' + (path.startsWith('/') ? path : '/' + path);
  return label ?? url;
}

// --- config/types.secrets ---

function hasConfiguredSecretInput(_input) { return false; }
function normalizeSecretInputString(value) {
  if (!value) return undefined;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || undefined;
}

// --- utils ---

function normalizeE164(raw) {
  const trimmed = (typeof raw === 'string' ? raw : String(raw ?? '')).trim();
  if (!trimmed) return '';
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

function pathExists(_path) { return false; }

// --- channels/plugins/setup-helpers ---

function applyAccountNameToChannelSection(config, section, name) {
  if (!config) config = {};
  if (!config[section]) config[section] = {};
  config[section].name = name;
  return config;
}

function applySetupAccountConfigPatch(_params) { return {}; }
function createEnvPatchedAccountSetupAdapter(_params) { return {}; }
function createPatchedAccountSetupAdapter(_params) { return {}; }
function migrateBaseNameToDefaultAccount(_params) { return {}; }
function patchScopedAccountConfig(_params) { return {}; }
function prepareScopedSetupConfig(_params) { return {}; }

// --- channels/plugins/setup-wizard-helpers (large set of stubs) ---

function addWildcardAllowFrom(allowFrom) {
  const next = (allowFrom ?? []).map((v) => String(v).trim()).filter(Boolean);
  if (!next.includes('*')) next.push('*');
  return next;
}

function buildSingleChannelSecretPromptState() { return {}; }
function createAccountScopedAllowFromSection() { return {}; }
function createAccountScopedGroupAccessSection() { return {}; }
function createAllowFromSection() { return {}; }
function createLegacyCompatChannelDmPolicy() { return 'open'; }
function createNestedChannelParsedAllowFromPrompt() { return {}; }
function createPromptParsedAllowFromForAccount() { return {}; }
function createStandardChannelSetupStatus() { return { configured: false }; }
function createNestedChannelAllowFromSetter() { return () => {}; }
function createNestedChannelDmPolicy() { return 'open'; }
function createNestedChannelDmPolicySetter() { return () => {}; }
function createTopLevelChannelAllowFromSetter() { return () => {}; }
function createTopLevelChannelDmPolicy() { return 'open'; }
function createTopLevelChannelDmPolicySetter() { return () => {}; }
function createTopLevelChannelGroupPolicySetter() { return () => {}; }
function createTopLevelChannelParsedAllowFromPrompt() { return {}; }

function mergeAllowFromEntries(current, additions) {
  const merged = [...(current ?? []), ...(additions ?? [])].map((v) => String(v).trim()).filter(Boolean);
  return [...new Set(merged)];
}

function normalizeAllowFromEntries(entries) { return (entries ?? []).map((e) => String(e).trim()).filter(Boolean); }
function noteChannelLookupFailure() {}
function noteChannelLookupSummary() {}
function parseMentionOrPrefixedId(_input) { return undefined; }
function parseSetupEntriesAllowingWildcard(_input) { return []; }
function parseSetupEntriesWithParser(_input) { return []; }
function patchNestedChannelConfigSection() { return {}; }
function patchTopLevelChannelConfigSection() { return {}; }
function patchChannelConfigForAccount() { return {}; }
function promptLegacyChannelAllowFrom() { return []; }
function promptLegacyChannelAllowFromForAccount() { return []; }
function promptParsedAllowFromForAccount() { return []; }
function promptParsedAllowFromForScopedChannel() { return []; }
function promptSingleChannelSecretInput() { return undefined; }
function promptResolvedAllowFrom() { return []; }
function resolveParsedAllowFromEntries() { return []; }
function resolveEntriesWithOptionalToken() { return []; }
function resolveSetupAccountId() { return DEFAULT_ACCOUNT_ID; }
function resolveGroupAllowlistWithLookupNotes() { return { entries: [], notes: [] }; }
function runSingleChannelSecretStep() { return Promise.resolve(); }
function setAccountAllowFromForChannel() {}
function setAccountDmAllowFromForChannel() {}
function setAccountGroupPolicyForChannel() {}
function setChannelDmPolicyWithAllowFrom() {}
function setLegacyChannelDmPolicyWithAllowFrom() {}
function setNestedChannelAllowFrom() {}
function setNestedChannelDmPolicyWithAllowFrom() {}
function setSetupChannelEnabled() {}
function setTopLevelChannelAllowFrom() {}
function setTopLevelChannelDmPolicyWithAllowFrom() {}
function setTopLevelChannelGroupPolicy() {}
function splitSetupEntries(input) { return (input ?? '').split(',').map((e) => e.trim()).filter(Boolean); }

// --- channels/plugins/setup-wizard-proxy ---

function createAllowlistSetupWizardProxy() { return {}; }
function createDelegatedFinalize() { return async () => {}; }
function createDelegatedPrepare() { return async () => {}; }
function createDelegatedResolveConfigured() { return () => false; }
function createDelegatedSetupWizardProxy() { return {}; }

// --- channels/plugins/setup-wizard-binary ---

function createCliPathTextInput() { return {}; }
function createDelegatedSetupWizardStatusResolvers() { return {}; }
function createDelegatedTextInputShouldPrompt() { return () => true; }
function createDetectedBinaryStatus() { return { detected: false }; }

// --- plugin-sdk/resolution-notes ---

function formatResolvedUnresolvedNote(params) {
  if (params.resolved.length === 0 && params.unresolved.length === 0) return undefined;
  return [
    params.resolved.length > 0 ? `Resolved: ${params.resolved.join(', ')}` : undefined,
    params.unresolved.length > 0 ? `Unresolved (kept as typed): ${params.unresolved.join(', ')}` : undefined,
  ].filter(Boolean).join('\n');
}

module.exports = {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  formatCliCommand,
  detectBinary,
  installSignalCli,
  formatDocsLink,
  hasConfiguredSecretInput,
  normalizeSecretInputString,
  normalizeE164,
  pathExists,
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  createEnvPatchedAccountSetupAdapter,
  createPatchedAccountSetupAdapter,
  migrateBaseNameToDefaultAccount,
  patchScopedAccountConfig,
  prepareScopedSetupConfig,
  addWildcardAllowFrom,
  buildSingleChannelSecretPromptState,
  createAccountScopedAllowFromSection,
  createAccountScopedGroupAccessSection,
  createAllowFromSection,
  createLegacyCompatChannelDmPolicy,
  createNestedChannelParsedAllowFromPrompt,
  createPromptParsedAllowFromForAccount,
  createStandardChannelSetupStatus,
  createNestedChannelAllowFromSetter,
  createNestedChannelDmPolicy,
  createNestedChannelDmPolicySetter,
  createTopLevelChannelAllowFromSetter,
  createTopLevelChannelDmPolicy,
  createTopLevelChannelDmPolicySetter,
  createTopLevelChannelGroupPolicySetter,
  createTopLevelChannelParsedAllowFromPrompt,
  mergeAllowFromEntries,
  normalizeAllowFromEntries,
  noteChannelLookupFailure,
  noteChannelLookupSummary,
  parseMentionOrPrefixedId,
  parseSetupEntriesAllowingWildcard,
  parseSetupEntriesWithParser,
  patchNestedChannelConfigSection,
  patchTopLevelChannelConfigSection,
  patchChannelConfigForAccount,
  promptLegacyChannelAllowFrom,
  promptLegacyChannelAllowFromForAccount,
  promptParsedAllowFromForAccount,
  promptParsedAllowFromForScopedChannel,
  promptSingleChannelSecretInput,
  promptResolvedAllowFrom,
  resolveParsedAllowFromEntries,
  resolveEntriesWithOptionalToken,
  resolveSetupAccountId,
  resolveGroupAllowlistWithLookupNotes,
  runSingleChannelSecretStep,
  setAccountAllowFromForChannel,
  setAccountDmAllowFromForChannel,
  setAccountGroupPolicyForChannel,
  setChannelDmPolicyWithAllowFrom,
  setLegacyChannelDmPolicyWithAllowFrom,
  setNestedChannelAllowFrom,
  setNestedChannelDmPolicyWithAllowFrom,
  setSetupChannelEnabled,
  setTopLevelChannelAllowFrom,
  setTopLevelChannelDmPolicyWithAllowFrom,
  setTopLevelChannelGroupPolicy,
  splitSetupEntries,
  createAllowlistSetupWizardProxy,
  createDelegatedFinalize,
  createDelegatedPrepare,
  createDelegatedResolveConfigured,
  createDelegatedSetupWizardProxy,
  createCliPathTextInput,
  createDelegatedSetupWizardStatusResolvers,
  createDelegatedTextInputShouldPrompt,
  createDetectedBinaryStatus,
  formatResolvedUnresolvedNote,
};
