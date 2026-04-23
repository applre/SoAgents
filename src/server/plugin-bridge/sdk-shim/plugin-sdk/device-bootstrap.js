// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/device-bootstrap.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/device-bootstrap.' + fn + '() not implemented in Bridge mode'); }
}

function approveDevicePairing() { _w('approveDevicePairing'); return undefined; }
function listDevicePairing() { _w('listDevicePairing'); return []; }
function clearDeviceBootstrapTokens() { _w('clearDeviceBootstrapTokens'); return undefined; }
function issueDeviceBootstrapToken() { _w('issueDeviceBootstrapToken'); return undefined; }
function revokeDeviceBootstrapToken() { _w('revokeDeviceBootstrapToken'); return undefined; }
function normalizeDeviceBootstrapProfile() { _w('normalizeDeviceBootstrapProfile'); return ""; }
const PAIRING_SETUP_BOOTSTRAP_PROFILE = undefined;
function sameDeviceBootstrapProfile() { _w('sameDeviceBootstrapProfile'); return undefined; }

module.exports = {
  approveDevicePairing,
  listDevicePairing,
  clearDeviceBootstrapTokens,
  issueDeviceBootstrapToken,
  revokeDeviceBootstrapToken,
  normalizeDeviceBootstrapProfile,
  PAIRING_SETUP_BOOTSTRAP_PROFILE,
  sameDeviceBootstrapProfile,
};
