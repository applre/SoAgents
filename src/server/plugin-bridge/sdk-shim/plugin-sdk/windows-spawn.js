// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/windows-spawn.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/windows-spawn.' + fn + '() not implemented in Bridge mode'); }
}

function resolveWindowsExecutablePath() { _w('resolveWindowsExecutablePath'); return undefined; }
function resolveWindowsSpawnProgramCandidate() { _w('resolveWindowsSpawnProgramCandidate'); return undefined; }
function applyWindowsSpawnProgramPolicy() { _w('applyWindowsSpawnProgramPolicy'); return undefined; }
function resolveWindowsSpawnProgram() { _w('resolveWindowsSpawnProgram'); return undefined; }
function materializeWindowsSpawnProgram() { _w('materializeWindowsSpawnProgram'); return undefined; }

module.exports = {
  resolveWindowsExecutablePath,
  resolveWindowsSpawnProgramCandidate,
  applyWindowsSpawnProgramPolicy,
  resolveWindowsSpawnProgram,
  materializeWindowsSpawnProgram,
};
