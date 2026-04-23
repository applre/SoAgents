// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/line.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/line.' + fn + '() not implemented in Bridge mode'); }
}

const DEFAULT_ACCOUNT_ID = undefined;
const buildChannelConfigSchema = undefined;
const emptyPluginConfigSchema = undefined;
function clearAccountEntryFields() { _w('clearAccountEntryFields'); return undefined; }
function resolveAllowlistProviderRuntimeGroupPolicy() { _w('resolveAllowlistProviderRuntimeGroupPolicy'); return undefined; }
function resolveDefaultGroupPolicy() { _w('resolveDefaultGroupPolicy'); return undefined; }
function buildComputedAccountStatusSnapshot() { _w('buildComputedAccountStatusSnapshot'); return undefined; }
function buildTokenChannelStatusSummary() { _w('buildTokenChannelStatusSummary'); return undefined; }
function listLineAccountIds() { _w('listLineAccountIds'); return []; }
function normalizeAccountId() { _w('normalizeAccountId'); return ""; }
function resolveDefaultLineAccountId() { _w('resolveDefaultLineAccountId'); return undefined; }
function resolveLineAccount() { _w('resolveLineAccount'); return undefined; }
const LineConfigSchema = undefined;
function createActionCard() { _w('createActionCard'); return undefined; }
function createAgendaCard() { _w('createAgendaCard'); return undefined; }
function createAppleTvRemoteCard() { _w('createAppleTvRemoteCard'); return undefined; }
function createDeviceControlCard() { _w('createDeviceControlCard'); return undefined; }
function createEventCard() { _w('createEventCard'); return undefined; }
function createImageCard() { _w('createImageCard'); return undefined; }
function createInfoCard() { _w('createInfoCard'); return undefined; }
function createListCard() { _w('createListCard'); return undefined; }
function createMediaPlayerCard() { _w('createMediaPlayerCard'); return undefined; }
function createReceiptCard() { _w('createReceiptCard'); return undefined; }
function processLineMessage() { _w('processLineMessage'); return undefined; }

module.exports = {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  emptyPluginConfigSchema,
  clearAccountEntryFields,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  buildComputedAccountStatusSnapshot,
  buildTokenChannelStatusSummary,
  listLineAccountIds,
  normalizeAccountId,
  resolveDefaultLineAccountId,
  resolveLineAccount,
  LineConfigSchema,
  createActionCard,
  createAgendaCard,
  createAppleTvRemoteCard,
  createDeviceControlCard,
  createEventCard,
  createImageCard,
  createInfoCard,
  createListCard,
  createMediaPlayerCard,
  createReceiptCard,
  processLineMessage,
};
