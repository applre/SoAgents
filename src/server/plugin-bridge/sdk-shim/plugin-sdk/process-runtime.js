// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/process-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/process-runtime.' + fn + '() not implemented in Bridge mode'); }
}

async function runExec() { _w('runExec'); return undefined; }
async function runCommandWithTimeout() { _w('runCommandWithTimeout'); return undefined; }
function shouldSpawnWithShell() { _w('shouldSpawnWithShell'); return false; }
function resolveCommandEnv() { _w('resolveCommandEnv'); return undefined; }

module.exports = {
  runExec,
  runCommandWithTimeout,
  shouldSpawnWithShell,
  resolveCommandEnv,
};
