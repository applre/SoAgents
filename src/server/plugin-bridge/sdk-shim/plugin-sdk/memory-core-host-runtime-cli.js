// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/memory-core-host-runtime-cli.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/memory-core-host-runtime-cli.' + fn + '() not implemented in Bridge mode'); }
}

function formatErrorMessage() { _w('formatErrorMessage'); return ""; }
function withManager() { _w('withManager'); return undefined; }
function formatHelpExamples() { _w('formatHelpExamples'); return ""; }
function resolveCommandSecretRefsViaGateway() { _w('resolveCommandSecretRefsViaGateway'); return undefined; }
function withProgress() { _w('withProgress'); return undefined; }
function withProgressTotals() { _w('withProgressTotals'); return undefined; }
function defaultRuntime() { _w('defaultRuntime'); return undefined; }
function formatDocsLink() { _w('formatDocsLink'); return ""; }
function colorize() { _w('colorize'); return undefined; }
function isRich() { _w('isRich'); return false; }
function theme() { _w('theme'); return undefined; }
function isVerbose() { _w('isVerbose'); return false; }
function setVerbose() { _w('setVerbose'); return undefined; }
function shortenHomeInString() { _w('shortenHomeInString'); return undefined; }
function shortenHomePath() { _w('shortenHomePath'); return undefined; }

module.exports = {
  formatErrorMessage,
  withManager,
  formatHelpExamples,
  resolveCommandSecretRefsViaGateway,
  withProgress,
  withProgressTotals,
  defaultRuntime,
  formatDocsLink,
  colorize,
  isRich,
  theme,
  isVerbose,
  setVerbose,
  shortenHomeInString,
  shortenHomePath,
};
