// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/cli-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/cli-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function stylePromptTitle() { _w('stylePromptTitle'); return undefined; }
function formatCliCommand() { _w('formatCliCommand'); return ""; }
function parseDurationMs() { _w('parseDurationMs'); return undefined; }
function waitForever() { _w('waitForever'); return undefined; }
function readVersionFromPackageJsonForModuleUrl() { _w('readVersionFromPackageJsonForModuleUrl'); return undefined; }
function readVersionFromBuildInfoForModuleUrl() { _w('readVersionFromBuildInfoForModuleUrl'); return undefined; }
function resolveVersionFromModuleUrl() { _w('resolveVersionFromModuleUrl'); return undefined; }
function resolveBinaryVersion() { _w('resolveBinaryVersion'); return undefined; }
function resolveUsableRuntimeVersion() { _w('resolveUsableRuntimeVersion'); return undefined; }
function resolveRuntimeServiceVersion() { _w('resolveRuntimeServiceVersion'); return undefined; }
function resolveCompatibilityHostVersion() { _w('resolveCompatibilityHostVersion'); return undefined; }
const RUNTIME_SERVICE_VERSION_FALLBACK = undefined;
const VERSION = undefined;

module.exports = {
  stylePromptTitle,
  formatCliCommand,
  parseDurationMs,
  waitForever,
  readVersionFromPackageJsonForModuleUrl,
  readVersionFromBuildInfoForModuleUrl,
  resolveVersionFromModuleUrl,
  resolveBinaryVersion,
  resolveUsableRuntimeVersion,
  resolveRuntimeServiceVersion,
  resolveCompatibilityHostVersion,
  RUNTIME_SERVICE_VERSION_FALLBACK,
  VERSION,
};
