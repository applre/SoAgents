// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/webhook-path.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/webhook-path.' + fn + '() not implemented in Bridge mode'); }
}

function normalizeWebhookPath() { _w('normalizeWebhookPath'); return ""; }
function resolveWebhookPath() { _w('resolveWebhookPath'); return undefined; }

module.exports = {
  normalizeWebhookPath,
  resolveWebhookPath,
};
