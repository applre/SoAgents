// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/account-resolution.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/account-resolution.' + fn + '() not implemented in Bridge mode'); }
}

function resolveAccountWithDefaultFallback() { _w('resolveAccountWithDefaultFallback'); return undefined; }
function listConfiguredAccountIds() { _w('listConfiguredAccountIds'); return []; }
function createAccountActionGate() { _w('createAccountActionGate'); return undefined; }
function createAccountListHelpers() { _w('createAccountListHelpers'); return undefined; }
function describeAccountSnapshot() { _w('describeAccountSnapshot'); return undefined; }
function listCombinedAccountIds() { _w('listCombinedAccountIds'); return []; }
const mergeAccountConfig = undefined;
function resolveListedDefaultAccountId() { _w('resolveListedDefaultAccountId'); return undefined; }
const resolveMergedAccountConfig = undefined;
function normalizeChatType() { _w('normalizeChatType'); return ""; }
function resolveAccountEntry() { _w('resolveAccountEntry'); return undefined; }
function resolveNormalizedAccountEntry() { _w('resolveNormalizedAccountEntry'); return undefined; }
const DEFAULT_ACCOUNT_ID = undefined;
function normalizeAccountId() { _w('normalizeAccountId'); return ""; }
function normalizeOptionalAccountId() { _w('normalizeOptionalAccountId'); return ""; }
function normalizeE164() { _w('normalizeE164'); return ""; }
function pathExists() { _w('pathExists'); return undefined; }
function resolveUserPath() { _w('resolveUserPath'); return undefined; }
function resolveDiscordAccount() { _w('resolveDiscordAccount'); return undefined; }
function resolveSlackAccount() { _w('resolveSlackAccount'); return undefined; }
function resolveTelegramAccount() { _w('resolveTelegramAccount'); return undefined; }
function resolveSignalAccount() { _w('resolveSignalAccount'); return undefined; }

module.exports = {
  resolveAccountWithDefaultFallback,
  listConfiguredAccountIds,
  createAccountActionGate,
  createAccountListHelpers,
  describeAccountSnapshot,
  listCombinedAccountIds,
  mergeAccountConfig,
  resolveListedDefaultAccountId,
  resolveMergedAccountConfig,
  normalizeChatType,
  resolveAccountEntry,
  resolveNormalizedAccountEntry,
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  normalizeOptionalAccountId,
  normalizeE164,
  pathExists,
  resolveUserPath,
  resolveDiscordAccount,
  resolveSlackAccount,
  resolveTelegramAccount,
  resolveSignalAccount,
};
