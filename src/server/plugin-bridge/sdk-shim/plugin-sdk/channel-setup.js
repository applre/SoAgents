// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/channel-setup.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/channel-setup.' + fn + '() not implemented in Bridge mode'); }
}

function createOptionalChannelSetupSurface() { _w('createOptionalChannelSetupSurface'); return undefined; }
const DEFAULT_ACCOUNT_ID = undefined;
function createTopLevelChannelDmPolicy() { _w('createTopLevelChannelDmPolicy'); return undefined; }
function formatDocsLink() { _w('formatDocsLink'); return ""; }
function setSetupChannelEnabled() { _w('setSetupChannelEnabled'); return undefined; }
function splitSetupEntries() { _w('splitSetupEntries'); return undefined; }
function createOptionalChannelSetupAdapter() { _w('createOptionalChannelSetupAdapter'); return undefined; }
function createOptionalChannelSetupWizard() { _w('createOptionalChannelSetupWizard'); return undefined; }

module.exports = {
  createOptionalChannelSetupSurface,
  DEFAULT_ACCOUNT_ID,
  createTopLevelChannelDmPolicy,
  formatDocsLink,
  setSetupChannelEnabled,
  splitSetupEntries,
  createOptionalChannelSetupAdapter,
  createOptionalChannelSetupWizard,
};
