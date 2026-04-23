// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/provider-google.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/provider-google.' + fn + '() not implemented in Bridge mode'); }
}

function normalizeGoogleModelId() { _w('normalizeGoogleModelId'); return ""; }
const DEFAULT_GOOGLE_API_BASE_URL = undefined;
function normalizeGoogleApiBaseUrl() { _w('normalizeGoogleApiBaseUrl'); return ""; }
function parseGeminiAuth() { _w('parseGeminiAuth'); return undefined; }
function createGoogleThinkingPayloadWrapper() { _w('createGoogleThinkingPayloadWrapper'); return undefined; }
function sanitizeGoogleThinkingPayload() { _w('sanitizeGoogleThinkingPayload'); return ""; }
function applyGoogleGeminiModelDefault() { _w('applyGoogleGeminiModelDefault'); return undefined; }
const GOOGLE_GEMINI_DEFAULT_MODEL = undefined;

module.exports = {
  normalizeGoogleModelId,
  DEFAULT_GOOGLE_API_BASE_URL,
  normalizeGoogleApiBaseUrl,
  parseGeminiAuth,
  createGoogleThinkingPayloadWrapper,
  sanitizeGoogleThinkingPayload,
  applyGoogleGeminiModelDefault,
  GOOGLE_GEMINI_DEFAULT_MODEL,
};
