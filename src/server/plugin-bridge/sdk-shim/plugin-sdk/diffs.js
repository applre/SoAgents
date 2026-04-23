// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/diffs.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/diffs.' + fn + '() not implemented in Bridge mode'); }
}

function definePluginEntry() { _w('definePluginEntry'); return undefined; }
function resolvePreferredOpenClawTmpDir() { _w('resolvePreferredOpenClawTmpDir'); return undefined; }

module.exports = {
  definePluginEntry,
  resolvePreferredOpenClawTmpDir,
};
