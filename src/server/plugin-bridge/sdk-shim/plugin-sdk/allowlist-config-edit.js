// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/allowlist-config-edit.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/allowlist-config-edit.' + fn + '() not implemented in Bridge mode'); }
}

function resolveDmGroupAllowlistConfigPaths() { _w('resolveDmGroupAllowlistConfigPaths'); return undefined; }
function resolveLegacyDmAllowlistConfigPaths() { _w('resolveLegacyDmAllowlistConfigPaths'); return undefined; }
function readConfiguredAllowlistEntries() { _w('readConfiguredAllowlistEntries'); return undefined; }
function collectAllowlistOverridesFromRecord() { _w('collectAllowlistOverridesFromRecord'); return []; }
function collectNestedAllowlistOverridesFromRecord() { _w('collectNestedAllowlistOverridesFromRecord'); return []; }
function createFlatAllowlistOverrideResolver() { _w('createFlatAllowlistOverrideResolver'); return undefined; }
function createNestedAllowlistOverrideResolver() { _w('createNestedAllowlistOverrideResolver'); return undefined; }
function createAccountScopedAllowlistNameResolver() { _w('createAccountScopedAllowlistNameResolver'); return undefined; }
function buildAccountScopedAllowlistConfigEditor() { _w('buildAccountScopedAllowlistConfigEditor'); return undefined; }
function buildDmGroupAccountAllowlistAdapter() { _w('buildDmGroupAccountAllowlistAdapter'); return undefined; }
function buildLegacyDmAccountAllowlistAdapter() { _w('buildLegacyDmAccountAllowlistAdapter'); return undefined; }

module.exports = {
  resolveDmGroupAllowlistConfigPaths,
  resolveLegacyDmAllowlistConfigPaths,
  readConfiguredAllowlistEntries,
  collectAllowlistOverridesFromRecord,
  collectNestedAllowlistOverridesFromRecord,
  createFlatAllowlistOverrideResolver,
  createNestedAllowlistOverrideResolver,
  createAccountScopedAllowlistNameResolver,
  buildAccountScopedAllowlistConfigEditor,
  buildDmGroupAccountAllowlistAdapter,
  buildLegacyDmAccountAllowlistAdapter,
};
