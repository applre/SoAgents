// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/provider-auth.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/provider-auth.' + fn + '() not implemented in Bridge mode'); }
}

const CLAUDE_CLI_PROFILE_ID = undefined;
const CODEX_CLI_PROFILE_ID = undefined;
function ensureAuthProfileStore() { _w('ensureAuthProfileStore'); return undefined; }
function listProfilesForProvider() { _w('listProfilesForProvider'); return []; }
function upsertAuthProfile() { _w('upsertAuthProfile'); return undefined; }
function readClaudeCliCredentialsCached() { _w('readClaudeCliCredentialsCached'); return undefined; }
function suggestOAuthProfileIdForLegacyDefault() { _w('suggestOAuthProfileIdForLegacyDefault'); return undefined; }
const MINIMAX_OAUTH_MARKER = undefined;
function resolveOAuthApiKeyMarker() { _w('resolveOAuthApiKeyMarker'); return undefined; }
function resolveNonEnvSecretRefApiKeyMarker() { _w('resolveNonEnvSecretRefApiKeyMarker'); return undefined; }
function requireApiKey() { _w('requireApiKey'); return undefined; }
function resolveApiKeyForProvider() { _w('resolveApiKeyForProvider'); return undefined; }
function formatApiKeyPreview() { _w('formatApiKeyPreview'); return ""; }
function normalizeApiKeyInput() { _w('normalizeApiKeyInput'); return ""; }
function validateApiKeyInput() { _w('validateApiKeyInput'); return undefined; }
function ensureApiKeyFromOptionEnvOrPrompt() { _w('ensureApiKeyFromOptionEnvOrPrompt'); return undefined; }
function normalizeSecretInputModeInput() { _w('normalizeSecretInputModeInput'); return ""; }
function promptSecretRefForSetup() { _w('promptSecretRefForSetup'); return undefined; }
function resolveSecretInputModeForEnvSelection() { _w('resolveSecretInputModeForEnvSelection'); return undefined; }
function buildTokenProfileId() { _w('buildTokenProfileId'); return undefined; }
function validateAnthropicSetupToken() { _w('validateAnthropicSetupToken'); return undefined; }
const applyAuthProfileConfig = undefined;
function buildApiKeyCredential() { _w('buildApiKeyCredential'); return undefined; }
function createProviderApiKeyAuthMethod() { _w('createProviderApiKeyAuthMethod'); return undefined; }
function coerceSecretRef() { _w('coerceSecretRef'); return undefined; }
function resolveDefaultSecretProviderAlias() { _w('resolveDefaultSecretProviderAlias'); return undefined; }
function resolveRequiredHomeDir() { _w('resolveRequiredHomeDir'); return undefined; }
function normalizeOptionalSecretInput() { _w('normalizeOptionalSecretInput'); return ""; }
function normalizeSecretInput() { _w('normalizeSecretInput'); return ""; }
function listKnownProviderAuthEnvVarNames() { _w('listKnownProviderAuthEnvVarNames'); return []; }
function omitEnvKeysCaseInsensitive() { _w('omitEnvKeysCaseInsensitive'); return undefined; }
function buildOauthProviderAuthResult() { _w('buildOauthProviderAuthResult'); return undefined; }
function generatePkceVerifierChallenge() { _w('generatePkceVerifierChallenge'); return undefined; }
function toFormUrlEncoded() { _w('toFormUrlEncoded'); return undefined; }

module.exports = {
  CLAUDE_CLI_PROFILE_ID,
  CODEX_CLI_PROFILE_ID,
  ensureAuthProfileStore,
  listProfilesForProvider,
  upsertAuthProfile,
  readClaudeCliCredentialsCached,
  suggestOAuthProfileIdForLegacyDefault,
  MINIMAX_OAUTH_MARKER,
  resolveOAuthApiKeyMarker,
  resolveNonEnvSecretRefApiKeyMarker,
  requireApiKey,
  resolveApiKeyForProvider,
  formatApiKeyPreview,
  normalizeApiKeyInput,
  validateApiKeyInput,
  ensureApiKeyFromOptionEnvOrPrompt,
  normalizeSecretInputModeInput,
  promptSecretRefForSetup,
  resolveSecretInputModeForEnvSelection,
  buildTokenProfileId,
  validateAnthropicSetupToken,
  applyAuthProfileConfig,
  buildApiKeyCredential,
  createProviderApiKeyAuthMethod,
  coerceSecretRef,
  resolveDefaultSecretProviderAlias,
  resolveRequiredHomeDir,
  normalizeOptionalSecretInput,
  normalizeSecretInput,
  listKnownProviderAuthEnvVarNames,
  omitEnvKeysCaseInsensitive,
  buildOauthProviderAuthResult,
  generatePkceVerifierChallenge,
  toFormUrlEncoded,
};
