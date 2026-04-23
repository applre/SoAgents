// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/channel-pairing.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/channel-pairing.' + fn + '() not implemented in Bridge mode'); }
}

function createChannelPairingChallengeIssuer() { _w('createChannelPairingChallengeIssuer'); return undefined; }
function createChannelPairingController() { _w('createChannelPairingController'); return undefined; }
function createLoggedPairingApprovalNotifier() { _w('createLoggedPairingApprovalNotifier'); return undefined; }
function createPairingPrefixStripper() { _w('createPairingPrefixStripper'); return undefined; }
function createTextPairingAdapter() { _w('createTextPairingAdapter'); return undefined; }

module.exports = {
  createChannelPairingChallengeIssuer,
  createChannelPairingController,
  createLoggedPairingApprovalNotifier,
  createPairingPrefixStripper,
  createTextPairingAdapter,
};
