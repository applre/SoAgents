// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/media-understanding-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/media-understanding-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function describeImageFile() { _w('describeImageFile'); return undefined; }
function describeImageFileWithModel() { _w('describeImageFileWithModel'); return undefined; }
function describeVideoFile() { _w('describeVideoFile'); return undefined; }
function runMediaUnderstandingFile() { _w('runMediaUnderstandingFile'); return undefined; }
function transcribeAudioFile() { _w('transcribeAudioFile'); return undefined; }

module.exports = {
  describeImageFile,
  describeImageFileWithModel,
  describeVideoFile,
  runMediaUnderstandingFile,
  transcribeAudioFile,
};
