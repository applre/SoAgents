// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/image-generation-core.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/image-generation-core.' + fn + '() not implemented in Bridge mode'); }
}

function resolveApiKeyForProvider() { _w('resolveApiKeyForProvider'); return undefined; }
function normalizeGoogleModelId() { _w('normalizeGoogleModelId'); return ""; }
function parseGeminiAuth() { _w('parseGeminiAuth'); return undefined; }
const OPENAI_DEFAULT_IMAGE_MODEL = undefined;

module.exports = {
  resolveApiKeyForProvider,
  normalizeGoogleModelId,
  parseGeminiAuth,
  OPENAI_DEFAULT_IMAGE_MODEL,
};
