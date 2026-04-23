// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/state-paths.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/state-paths.' + fn + '() not implemented in Bridge mode'); }
}

function resolveOAuthDir() { _w('resolveOAuthDir'); return undefined; }
function resolveStateDir() { _w('resolveStateDir'); return undefined; }
const STATE_DIR = undefined;

module.exports = {
  resolveOAuthDir,
  resolveStateDir,
  STATE_DIR,
};
