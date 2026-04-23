// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/web-media.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/web-media.' + fn + '() not implemented in Bridge mode'); }
}

function getDefaultLocalRoots() { _w('getDefaultLocalRoots'); return undefined; }
function LocalMediaAccessError() { _w('LocalMediaAccessError'); return undefined; }
function loadWebMedia() { _w('loadWebMedia'); return undefined; }
function loadWebMediaRaw() { _w('loadWebMediaRaw'); return undefined; }
function optimizeImageToJpeg() { _w('optimizeImageToJpeg'); return undefined; }
function optimizeImageToPng() { _w('optimizeImageToPng'); return undefined; }

module.exports = {
  getDefaultLocalRoots,
  LocalMediaAccessError,
  loadWebMedia,
  loadWebMediaRaw,
  optimizeImageToJpeg,
  optimizeImageToPng,
};
