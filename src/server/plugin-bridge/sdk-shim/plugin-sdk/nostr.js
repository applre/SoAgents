// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/nostr.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/nostr.' + fn + '() not implemented in Bridge mode'); }
}

const nostrSetupAdapter = undefined;
const nostrSetupWizard = undefined;
const buildChannelConfigSchema = undefined;
function formatPairingApproveHint() { _w('formatPairingApproveHint'); return ""; }
function createChannelReplyPipeline() { _w('createChannelReplyPipeline'); return undefined; }
function createDirectDmPreCryptoGuardPolicy() { _w('createDirectDmPreCryptoGuardPolicy'); return undefined; }
function dispatchInboundDirectDmWithRuntime() { _w('dispatchInboundDirectDmWithRuntime'); return undefined; }
function createPreCryptoDirectDmAuthorizer() { _w('createPreCryptoDirectDmAuthorizer'); return undefined; }
function resolveInboundDirectDmAccessWithRuntime() { _w('resolveInboundDirectDmAccessWithRuntime'); return undefined; }
const MarkdownConfigSchema = undefined;
function readJsonBodyWithLimit() { _w('readJsonBodyWithLimit'); return undefined; }
function requestBodyErrorToText() { _w('requestBodyErrorToText'); return undefined; }
function isBlockedHostnameOrIp() { _w('isBlockedHostnameOrIp'); return false; }
const emptyPluginConfigSchema = undefined;
const DEFAULT_ACCOUNT_ID = undefined;
function buildComputedAccountStatusSnapshot() { _w('buildComputedAccountStatusSnapshot'); return undefined; }
function collectStatusIssuesFromLastError() { _w('collectStatusIssuesFromLastError'); return []; }
function createDefaultChannelRuntimeState() { _w('createDefaultChannelRuntimeState'); return undefined; }
function createFixedWindowRateLimiter() { _w('createFixedWindowRateLimiter'); return undefined; }
function mapAllowFromEntries() { _w('mapAllowFromEntries'); return undefined; }

module.exports = {
  nostrSetupAdapter,
  nostrSetupWizard,
  buildChannelConfigSchema,
  formatPairingApproveHint,
  createChannelReplyPipeline,
  createDirectDmPreCryptoGuardPolicy,
  dispatchInboundDirectDmWithRuntime,
  createPreCryptoDirectDmAuthorizer,
  resolveInboundDirectDmAccessWithRuntime,
  MarkdownConfigSchema,
  readJsonBodyWithLimit,
  requestBodyErrorToText,
  isBlockedHostnameOrIp,
  emptyPluginConfigSchema,
  DEFAULT_ACCOUNT_ID,
  buildComputedAccountStatusSnapshot,
  collectStatusIssuesFromLastError,
  createDefaultChannelRuntimeState,
  createFixedWindowRateLimiter,
  mapAllowFromEntries,
};
