// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/setup-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/setup-runtime.' + fn + '() not implemented in Bridge mode'); }
}

const DEFAULT_ACCOUNT_ID = undefined;
function createEnvPatchedAccountSetupAdapter() { _w('createEnvPatchedAccountSetupAdapter'); return undefined; }
function createAccountScopedAllowFromSection() { _w('createAccountScopedAllowFromSection'); return undefined; }
function createAccountScopedGroupAccessSection() { _w('createAccountScopedGroupAccessSection'); return undefined; }
function createLegacyCompatChannelDmPolicy() { _w('createLegacyCompatChannelDmPolicy'); return undefined; }
function createStandardChannelSetupStatus() { _w('createStandardChannelSetupStatus'); return undefined; }
function parseMentionOrPrefixedId() { _w('parseMentionOrPrefixedId'); return undefined; }
function patchChannelConfigForAccount() { _w('patchChannelConfigForAccount'); return undefined; }
function promptLegacyChannelAllowFromForAccount() { _w('promptLegacyChannelAllowFromForAccount'); return undefined; }
function resolveEntriesWithOptionalToken() { _w('resolveEntriesWithOptionalToken'); return undefined; }
function setSetupChannelEnabled() { _w('setSetupChannelEnabled'); return undefined; }
function createAllowlistSetupWizardProxy() { _w('createAllowlistSetupWizardProxy'); return undefined; }

module.exports = {
  DEFAULT_ACCOUNT_ID,
  createEnvPatchedAccountSetupAdapter,
  createAccountScopedAllowFromSection,
  createAccountScopedGroupAccessSection,
  createLegacyCompatChannelDmPolicy,
  createStandardChannelSetupStatus,
  parseMentionOrPrefixedId,
  patchChannelConfigForAccount,
  promptLegacyChannelAllowFromForAccount,
  resolveEntriesWithOptionalToken,
  setSetupChannelEnabled,
  createAllowlistSetupWizardProxy,
};
