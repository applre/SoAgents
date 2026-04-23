// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/matrix-runtime-heavy.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/matrix-runtime-heavy.' + fn + '() not implemented in Bridge mode'); }
}

function ensureConfiguredAcpBindingReady() { _w('ensureConfiguredAcpBindingReady'); return undefined; }
function resolveConfiguredAcpBindingRecord() { _w('resolveConfiguredAcpBindingRecord'); return undefined; }
function maybeCreateMatrixMigrationSnapshot() { _w('maybeCreateMatrixMigrationSnapshot'); return undefined; }
function dispatchReplyFromConfigWithSettledDispatcher() { _w('dispatchReplyFromConfigWithSettledDispatcher'); return undefined; }

module.exports = {
  ensureConfiguredAcpBindingReady,
  resolveConfiguredAcpBindingRecord,
  maybeCreateMatrixMigrationSnapshot,
  dispatchReplyFromConfigWithSettledDispatcher,
};
