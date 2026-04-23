// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/account-helpers.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/account-helpers.' + fn + '() not implemented in Bridge mode'); }
}

function createAccountListHelpers() { _w('createAccountListHelpers'); return undefined; }
function describeAccountSnapshot() { _w('describeAccountSnapshot'); return undefined; }
const mergeAccountConfig = undefined;
const resolveMergedAccountConfig = undefined;
function createAccountActionGate() { _w('createAccountActionGate'); return undefined; }

module.exports = {
  createAccountListHelpers,
  describeAccountSnapshot,
  mergeAccountConfig,
  resolveMergedAccountConfig,
  createAccountActionGate,
};
