// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/provider-auth-api-key.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/provider-auth-api-key.' + fn + '() not implemented in Bridge mode'); }
}

function upsertAuthProfile() { _w('upsertAuthProfile'); return undefined; }
function formatApiKeyPreview() { _w('formatApiKeyPreview'); return ""; }
function normalizeApiKeyInput() { _w('normalizeApiKeyInput'); return ""; }
function validateApiKeyInput() { _w('validateApiKeyInput'); return undefined; }
function ensureApiKeyFromOptionEnvOrPrompt() { _w('ensureApiKeyFromOptionEnvOrPrompt'); return undefined; }
function normalizeSecretInputModeInput() { _w('normalizeSecretInputModeInput'); return ""; }
function promptSecretRefForSetup() { _w('promptSecretRefForSetup'); return undefined; }
function resolveSecretInputModeForEnvSelection() { _w('resolveSecretInputModeForEnvSelection'); return undefined; }
const applyAuthProfileConfig = undefined;
function buildApiKeyCredential() { _w('buildApiKeyCredential'); return undefined; }
function createProviderApiKeyAuthMethod() { _w('createProviderApiKeyAuthMethod'); return undefined; }
function normalizeOptionalSecretInput() { _w('normalizeOptionalSecretInput'); return ""; }
function normalizeSecretInput() { _w('normalizeSecretInput'); return ""; }

module.exports = {
  upsertAuthProfile,
  formatApiKeyPreview,
  normalizeApiKeyInput,
  validateApiKeyInput,
  ensureApiKeyFromOptionEnvOrPrompt,
  normalizeSecretInputModeInput,
  promptSecretRefForSetup,
  resolveSecretInputModeForEnvSelection,
  applyAuthProfileConfig,
  buildApiKeyCredential,
  createProviderApiKeyAuthMethod,
  normalizeOptionalSecretInput,
  normalizeSecretInput,
};
