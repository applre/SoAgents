// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/speech-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/speech-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function listSpeechVoices() { _w('listSpeechVoices'); return []; }
function textToSpeech() { _w('textToSpeech'); return undefined; }
function textToSpeechTelephony() { _w('textToSpeechTelephony'); return undefined; }

module.exports = {
  listSpeechVoices,
  textToSpeech,
  textToSpeechTelephony,
};
