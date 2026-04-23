// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/group-access.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/group-access.' + fn + '() not implemented in Bridge mode'); }
}

function resolveSenderScopedGroupPolicy() { _w('resolveSenderScopedGroupPolicy'); return undefined; }
function evaluateGroupRouteAccessForPolicy() { _w('evaluateGroupRouteAccessForPolicy'); return undefined; }
function evaluateMatchedGroupAccessForPolicy() { _w('evaluateMatchedGroupAccessForPolicy'); return undefined; }
function evaluateSenderGroupAccessForPolicy() { _w('evaluateSenderGroupAccessForPolicy'); return undefined; }
function evaluateSenderGroupAccess() { _w('evaluateSenderGroupAccess'); return undefined; }

module.exports = {
  resolveSenderScopedGroupPolicy,
  evaluateGroupRouteAccessForPolicy,
  evaluateMatchedGroupAccessForPolicy,
  evaluateSenderGroupAccessForPolicy,
  evaluateSenderGroupAccess,
};
