// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/line-core.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/line-core.' + fn + '() not implemented in Bridge mode'); }
}

function createTopLevelChannelDmPolicy() { _w('createTopLevelChannelDmPolicy'); return undefined; }
const DEFAULT_ACCOUNT_ID = undefined;
function setSetupChannelEnabled() { _w('setSetupChannelEnabled'); return undefined; }
function setTopLevelChannelDmPolicyWithAllowFrom() { _w('setTopLevelChannelDmPolicyWithAllowFrom'); return undefined; }
function splitSetupEntries() { _w('splitSetupEntries'); return undefined; }
function formatDocsLink() { _w('formatDocsLink'); return ""; }
function listLineAccountIds() { _w('listLineAccountIds'); return []; }
function normalizeAccountId() { _w('normalizeAccountId'); return ""; }
function resolveDefaultLineAccountId() { _w('resolveDefaultLineAccountId'); return undefined; }
function resolveLineAccount() { _w('resolveLineAccount'); return undefined; }
function resolveExactLineGroupConfigKey() { _w('resolveExactLineGroupConfigKey'); return undefined; }
const LineConfigSchema = undefined;
function createActionCard() { _w('createActionCard'); return undefined; }
function createImageCard() { _w('createImageCard'); return undefined; }
function createInfoCard() { _w('createInfoCard'); return undefined; }
function createListCard() { _w('createListCard'); return undefined; }
function createReceiptCard() { _w('createReceiptCard'); return undefined; }
function processLineMessage() { _w('processLineMessage'); return undefined; }

module.exports = {
  createTopLevelChannelDmPolicy,
  DEFAULT_ACCOUNT_ID,
  setSetupChannelEnabled,
  setTopLevelChannelDmPolicyWithAllowFrom,
  splitSetupEntries,
  formatDocsLink,
  listLineAccountIds,
  normalizeAccountId,
  resolveDefaultLineAccountId,
  resolveLineAccount,
  resolveExactLineGroupConfigKey,
  LineConfigSchema,
  createActionCard,
  createImageCard,
  createInfoCard,
  createListCard,
  createReceiptCard,
  processLineMessage,
};
