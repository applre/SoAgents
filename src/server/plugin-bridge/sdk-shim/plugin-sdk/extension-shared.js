// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/extension-shared.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/extension-shared.' + fn + '() not implemented in Bridge mode'); }
}

async function runStoppablePassiveMonitor() { _w('runStoppablePassiveMonitor'); return undefined; }
function buildPassiveChannelStatusSummary() { _w('buildPassiveChannelStatusSummary'); return undefined; }
function buildPassiveProbedChannelStatusSummary() { _w('buildPassiveProbedChannelStatusSummary'); return undefined; }
function buildTrafficStatusSummary() { _w('buildTrafficStatusSummary'); return undefined; }
function resolveLoggerBackedRuntime() { _w('resolveLoggerBackedRuntime'); return undefined; }
function requireChannelOpenAllowFrom() { _w('requireChannelOpenAllowFrom'); return undefined; }
function readStatusIssueFields() { _w('readStatusIssueFields'); return undefined; }
function coerceStatusIssueAccountId() { _w('coerceStatusIssueAccountId'); return undefined; }
function createDeferred() { _w('createDeferred'); return undefined; }
const safeParseJsonWithSchema = undefined;
const safeParseWithSchema = undefined;

module.exports = {
  runStoppablePassiveMonitor,
  buildPassiveChannelStatusSummary,
  buildPassiveProbedChannelStatusSummary,
  buildTrafficStatusSummary,
  resolveLoggerBackedRuntime,
  requireChannelOpenAllowFrom,
  readStatusIssueFields,
  coerceStatusIssueAccountId,
  createDeferred,
  safeParseJsonWithSchema,
  safeParseWithSchema,
};
