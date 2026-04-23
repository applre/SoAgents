// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/directory-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/directory-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function createChannelDirectoryAdapter() { _w('createChannelDirectoryAdapter'); return undefined; }
function createEmptyChannelDirectoryAdapter() { _w('createEmptyChannelDirectoryAdapter'); return undefined; }
function emptyChannelDirectoryList() { _w('emptyChannelDirectoryList'); return undefined; }
function nullChannelDirectorySelf() { _w('nullChannelDirectorySelf'); return undefined; }
function applyDirectoryQueryAndLimit() { _w('applyDirectoryQueryAndLimit'); return undefined; }
function collectNormalizedDirectoryIds() { _w('collectNormalizedDirectoryIds'); return []; }
function createInspectedDirectoryEntriesLister() { _w('createInspectedDirectoryEntriesLister'); return undefined; }
function createResolvedDirectoryEntriesLister() { _w('createResolvedDirectoryEntriesLister'); return undefined; }
function listDirectoryEntriesFromSources() { _w('listDirectoryEntriesFromSources'); return []; }
function listDirectoryGroupEntriesFromMapKeys() { _w('listDirectoryGroupEntriesFromMapKeys'); return []; }
function listDirectoryGroupEntriesFromMapKeysAndAllowFrom() { _w('listDirectoryGroupEntriesFromMapKeysAndAllowFrom'); return []; }
function listInspectedDirectoryEntriesFromSources() { _w('listInspectedDirectoryEntriesFromSources'); return []; }
function listResolvedDirectoryEntriesFromSources() { _w('listResolvedDirectoryEntriesFromSources'); return []; }
function listResolvedDirectoryGroupEntriesFromMapKeys() { _w('listResolvedDirectoryGroupEntriesFromMapKeys'); return []; }
function listResolvedDirectoryUserEntriesFromAllowFrom() { _w('listResolvedDirectoryUserEntriesFromAllowFrom'); return []; }
function listDirectoryUserEntriesFromAllowFrom() { _w('listDirectoryUserEntriesFromAllowFrom'); return []; }
function listDirectoryUserEntriesFromAllowFromAndMapKeys() { _w('listDirectoryUserEntriesFromAllowFromAndMapKeys'); return []; }
function toDirectoryEntries() { _w('toDirectoryEntries'); return undefined; }
function createRuntimeDirectoryLiveAdapter() { _w('createRuntimeDirectoryLiveAdapter'); return undefined; }
function inspectReadOnlyChannelAccount() { _w('inspectReadOnlyChannelAccount'); return undefined; }

module.exports = {
  createChannelDirectoryAdapter,
  createEmptyChannelDirectoryAdapter,
  emptyChannelDirectoryList,
  nullChannelDirectorySelf,
  applyDirectoryQueryAndLimit,
  collectNormalizedDirectoryIds,
  createInspectedDirectoryEntriesLister,
  createResolvedDirectoryEntriesLister,
  listDirectoryEntriesFromSources,
  listDirectoryGroupEntriesFromMapKeys,
  listDirectoryGroupEntriesFromMapKeysAndAllowFrom,
  listInspectedDirectoryEntriesFromSources,
  listResolvedDirectoryEntriesFromSources,
  listResolvedDirectoryGroupEntriesFromMapKeys,
  listResolvedDirectoryUserEntriesFromAllowFrom,
  listDirectoryUserEntriesFromAllowFrom,
  listDirectoryUserEntriesFromAllowFromAndMapKeys,
  toDirectoryEntries,
  createRuntimeDirectoryLiveAdapter,
  inspectReadOnlyChannelAccount,
};
