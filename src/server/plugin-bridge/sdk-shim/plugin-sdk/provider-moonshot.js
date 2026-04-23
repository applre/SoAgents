// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/provider-moonshot.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/provider-moonshot.' + fn + '() not implemented in Bridge mode'); }
}

function createMoonshotThinkingWrapper() { _w('createMoonshotThinkingWrapper'); return undefined; }
function resolveMoonshotThinkingType() { _w('resolveMoonshotThinkingType'); return undefined; }

module.exports = {
  createMoonshotThinkingWrapper,
  resolveMoonshotThinkingType,
};
