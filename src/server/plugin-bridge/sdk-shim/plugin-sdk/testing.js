// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/testing.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/testing.' + fn + '() not implemented in Bridge mode'); }
}

async function createWindowsCmdShimFixture() { _w('createWindowsCmdShimFixture'); return undefined; }
function installCommonResolveTargetErrorCases() { _w('installCommonResolveTargetErrorCases'); return undefined; }
function removeAckReactionAfterReply() { _w('removeAckReactionAfterReply'); return undefined; }
function shouldAckReaction() { _w('shouldAckReaction'); return false; }

module.exports = {
  createWindowsCmdShimFixture,
  installCommonResolveTargetErrorCases,
  removeAckReactionAfterReply,
  shouldAckReaction,
};
