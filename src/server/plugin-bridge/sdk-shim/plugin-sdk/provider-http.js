// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/provider-http.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/provider-http.' + fn + '() not implemented in Bridge mode'); }
}

function assertOkOrThrowHttpError() { _w('assertOkOrThrowHttpError'); return undefined; }
function fetchWithTimeout() { _w('fetchWithTimeout'); return undefined; }
function fetchWithTimeoutGuarded() { _w('fetchWithTimeoutGuarded'); return undefined; }
function normalizeBaseUrl() { _w('normalizeBaseUrl'); return ""; }
function postJsonRequest() { _w('postJsonRequest'); return undefined; }
function postTranscriptionRequest() { _w('postTranscriptionRequest'); return undefined; }
function requireTranscriptionText() { _w('requireTranscriptionText'); return undefined; }

module.exports = {
  assertOkOrThrowHttpError,
  fetchWithTimeout,
  fetchWithTimeoutGuarded,
  normalizeBaseUrl,
  postJsonRequest,
  postTranscriptionRequest,
  requireTranscriptionText,
};
