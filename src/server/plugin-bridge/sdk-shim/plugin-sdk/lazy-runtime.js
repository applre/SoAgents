// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/lazy-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/lazy-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function createLazyRuntimeModule() { _w('createLazyRuntimeModule'); return undefined; }
function createLazyRuntimeMethod() { _w('createLazyRuntimeMethod'); return undefined; }
function createLazyRuntimeMethodBinder() { _w('createLazyRuntimeMethodBinder'); return undefined; }
function createLazyRuntimeNamedExport() { _w('createLazyRuntimeNamedExport'); return undefined; }
function createLazyRuntimeSurface() { _w('createLazyRuntimeSurface'); return undefined; }

module.exports = {
  createLazyRuntimeModule,
  createLazyRuntimeMethod,
  createLazyRuntimeMethodBinder,
  createLazyRuntimeNamedExport,
  createLazyRuntimeSurface,
};
