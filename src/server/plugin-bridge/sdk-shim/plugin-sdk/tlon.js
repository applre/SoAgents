// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/tlon.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/tlon.' + fn + '() not implemented in Bridge mode'); }
}

const tlonSetupAdapter = undefined;
const tlonSetupWizard = undefined;
const buildChannelConfigSchema = undefined;
function applyAccountNameToChannelSection() { _w('applyAccountNameToChannelSection'); return undefined; }
const patchScopedAccountConfig = undefined;
function createChannelReplyPipeline() { _w('createChannelReplyPipeline'); return undefined; }
function createDedupeCache() { _w('createDedupeCache'); return undefined; }
function fetchWithSsrFGuard() { _w('fetchWithSsrFGuard'); return undefined; }
function isBlockedHostnameOrIp() { _w('isBlockedHostnameOrIp'); return false; }
function SsrFBlockedError() { _w('SsrFBlockedError'); return undefined; }
const emptyPluginConfigSchema = undefined;
const DEFAULT_ACCOUNT_ID = undefined;
function normalizeAccountId() { _w('normalizeAccountId'); return ""; }
function buildComputedAccountStatusSnapshot() { _w('buildComputedAccountStatusSnapshot'); return undefined; }
function formatDocsLink() { _w('formatDocsLink'); return ""; }
function createLoggerBackedRuntime() { _w('createLoggerBackedRuntime'); return undefined; }

module.exports = {
  tlonSetupAdapter,
  tlonSetupWizard,
  buildChannelConfigSchema,
  applyAccountNameToChannelSection,
  patchScopedAccountConfig,
  createChannelReplyPipeline,
  createDedupeCache,
  fetchWithSsrFGuard,
  isBlockedHostnameOrIp,
  SsrFBlockedError,
  emptyPluginConfigSchema,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  buildComputedAccountStatusSnapshot,
  formatDocsLink,
  createLoggerBackedRuntime,
};
