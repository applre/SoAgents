// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/diagnostics-otel.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/diagnostics-otel.' + fn + '() not implemented in Bridge mode'); }
}

function emitDiagnosticEvent() { _w('emitDiagnosticEvent'); return undefined; }
function onDiagnosticEvent() { _w('onDiagnosticEvent'); return undefined; }
function registerLogTransport() { _w('registerLogTransport'); return undefined; }
function redactSensitiveText() { _w('redactSensitiveText'); return undefined; }
const emptyPluginConfigSchema = undefined;

module.exports = {
  emitDiagnosticEvent,
  onDiagnosticEvent,
  registerLogTransport,
  redactSensitiveText,
  emptyPluginConfigSchema,
};
