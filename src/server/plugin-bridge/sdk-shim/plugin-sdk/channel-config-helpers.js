// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/channel-config-helpers.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/channel-config-helpers.' + fn + '() not implemented in Bridge mode'); }
}

function mapAllowFromEntries() { _w('mapAllowFromEntries'); return undefined; }
function formatTrimmedAllowFromEntries() { _w('formatTrimmedAllowFromEntries'); return ""; }
function resolveOptionalConfigString() { _w('resolveOptionalConfigString'); return undefined; }
function adaptScopedAccountAccessor() { _w('adaptScopedAccountAccessor'); return undefined; }
function createScopedAccountConfigAccessors() { _w('createScopedAccountConfigAccessors'); return undefined; }
function createScopedChannelConfigBase() { _w('createScopedChannelConfigBase'); return undefined; }
function createScopedChannelConfigAdapter() { _w('createScopedChannelConfigAdapter'); return undefined; }
function createTopLevelChannelConfigBase() { _w('createTopLevelChannelConfigBase'); return undefined; }
function createTopLevelChannelConfigAdapter() { _w('createTopLevelChannelConfigAdapter'); return undefined; }
function createHybridChannelConfigBase() { _w('createHybridChannelConfigBase'); return undefined; }
function createHybridChannelConfigAdapter() { _w('createHybridChannelConfigAdapter'); return undefined; }
function createScopedDmSecurityResolver() { _w('createScopedDmSecurityResolver'); return undefined; }
function resolveWhatsAppConfigAllowFrom() { _w('resolveWhatsAppConfigAllowFrom'); return undefined; }
function formatWhatsAppConfigAllowFromEntries() { _w('formatWhatsAppConfigAllowFromEntries'); return ""; }
function resolveWhatsAppConfigDefaultTo() { _w('resolveWhatsAppConfigDefaultTo'); return undefined; }
function resolveIMessageConfigAllowFrom() { _w('resolveIMessageConfigAllowFrom'); return undefined; }
function resolveIMessageConfigDefaultTo() { _w('resolveIMessageConfigDefaultTo'); return undefined; }
function authorizeConfigWrite() { _w('authorizeConfigWrite'); return undefined; }
function canBypassConfigWritePolicy() { _w('canBypassConfigWritePolicy'); return false; }
function formatConfigWriteDeniedMessage() { _w('formatConfigWriteDeniedMessage'); return ""; }
function resolveChannelConfigWrites() { _w('resolveChannelConfigWrites'); return undefined; }
function buildAccountScopedDmSecurityPolicy() { _w('buildAccountScopedDmSecurityPolicy'); return undefined; }
function collectAllowlistProviderGroupPolicyWarnings() { _w('collectAllowlistProviderGroupPolicyWarnings'); return []; }
function collectAllowlistProviderRestrictSendersWarnings() { _w('collectAllowlistProviderRestrictSendersWarnings'); return []; }
function collectOpenGroupPolicyConfiguredRouteWarnings() { _w('collectOpenGroupPolicyConfiguredRouteWarnings'); return []; }
function collectOpenGroupPolicyRouteAllowlistWarnings() { _w('collectOpenGroupPolicyRouteAllowlistWarnings'); return []; }
function collectOpenProviderGroupPolicyWarnings() { _w('collectOpenProviderGroupPolicyWarnings'); return []; }

module.exports = {
  mapAllowFromEntries,
  formatTrimmedAllowFromEntries,
  resolveOptionalConfigString,
  adaptScopedAccountAccessor,
  createScopedAccountConfigAccessors,
  createScopedChannelConfigBase,
  createScopedChannelConfigAdapter,
  createTopLevelChannelConfigBase,
  createTopLevelChannelConfigAdapter,
  createHybridChannelConfigBase,
  createHybridChannelConfigAdapter,
  createScopedDmSecurityResolver,
  resolveWhatsAppConfigAllowFrom,
  formatWhatsAppConfigAllowFromEntries,
  resolveWhatsAppConfigDefaultTo,
  resolveIMessageConfigAllowFrom,
  resolveIMessageConfigDefaultTo,
  authorizeConfigWrite,
  canBypassConfigWritePolicy,
  formatConfigWriteDeniedMessage,
  resolveChannelConfigWrites,
  buildAccountScopedDmSecurityPolicy,
  collectAllowlistProviderGroupPolicyWarnings,
  collectAllowlistProviderRestrictSendersWarnings,
  collectOpenGroupPolicyConfiguredRouteWarnings,
  collectOpenGroupPolicyRouteAllowlistWarnings,
  collectOpenProviderGroupPolicyWarnings,
};
