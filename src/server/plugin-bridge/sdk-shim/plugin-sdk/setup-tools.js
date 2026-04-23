// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/setup-tools.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/setup-tools.' + fn + '() not implemented in Bridge mode'); }
}

function formatCliCommand() { _w('formatCliCommand'); return ""; }
function detectBinary() { _w('detectBinary'); return undefined; }
function installSignalCli() { _w('installSignalCli'); return undefined; }
function formatDocsLink() { _w('formatDocsLink'); return ""; }

module.exports = {
  formatCliCommand,
  detectBinary,
  installSignalCli,
  formatDocsLink,
};
