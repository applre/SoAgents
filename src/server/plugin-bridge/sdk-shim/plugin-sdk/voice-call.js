// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/voice-call.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/voice-call.' + fn + '() not implemented in Bridge mode'); }
}

function definePluginEntry() { _w('definePluginEntry'); return undefined; }
const TtsAutoSchema = undefined;
const TtsConfigSchema = undefined;
const TtsModeSchema = undefined;
const TtsProviderSchema = undefined;
function isRequestBodyLimitError() { _w('isRequestBodyLimitError'); return false; }
function readRequestBodyWithLimit() { _w('readRequestBodyWithLimit'); return undefined; }
function requestBodyErrorToText() { _w('requestBodyErrorToText'); return undefined; }
function fetchWithSsrFGuard() { _w('fetchWithSsrFGuard'); return undefined; }
function sleep() { _w('sleep'); return undefined; }

module.exports = {
  definePluginEntry,
  TtsAutoSchema,
  TtsConfigSchema,
  TtsModeSchema,
  TtsProviderSchema,
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
  fetchWithSsrFGuard,
  sleep,
};
