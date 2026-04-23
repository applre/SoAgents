// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/cli-backend.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/cli-backend.' + fn + '() not implemented in Bridge mode'); }
}

const CLI_FRESH_WATCHDOG_DEFAULTS = undefined;
const CLI_RESUME_WATCHDOG_DEFAULTS = undefined;

module.exports = {
  CLI_FRESH_WATCHDOG_DEFAULTS,
  CLI_RESUME_WATCHDOG_DEFAULTS,
};
