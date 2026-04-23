// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/media-understanding.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/media-understanding.' + fn + '() not implemented in Bridge mode'); }
}

function describeImageWithModel() { _w('describeImageWithModel'); return undefined; }
function describeImagesWithModel() { _w('describeImagesWithModel'); return undefined; }
function transcribeOpenAiCompatibleAudio() { _w('transcribeOpenAiCompatibleAudio'); return undefined; }

module.exports = {
  describeImageWithModel,
  describeImagesWithModel,
  transcribeOpenAiCompatibleAudio,
};
