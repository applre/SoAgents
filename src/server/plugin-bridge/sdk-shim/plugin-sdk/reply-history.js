/** Shim for openclaw/plugin-sdk/reply-history */

const DEFAULT_GROUP_HISTORY_LIMIT = 50;
const MAX_HISTORY_KEYS = 1000;

function evictOldHistoryKeys(historyMap, maxKeys) {
  const limit = maxKeys ?? MAX_HISTORY_KEYS;
  if (historyMap.size <= limit) return;
  const keysToDelete = historyMap.size - limit;
  const iterator = historyMap.keys();
  for (let i = 0; i < keysToDelete; i++) {
    const key = iterator.next().value;
    if (key !== undefined) historyMap.delete(key);
  }
}

function buildHistoryContext(params) {
  const lineBreak = params.lineBreak ?? '\n';
  if (!params.historyText?.trim()) return params.currentMessage;
  return [
    '[Chat messages since your last reply - for context]',
    params.historyText,
    '',
    '[Current message you must respond to]',
    params.currentMessage,
  ].join(lineBreak);
}

function buildHistoryContextFromEntries(params) {
  const entries = params.entries ?? [];
  if (entries.length === 0) return params.currentMessage;
  const lines = entries.map((e) => `${e.sender}: ${e.body}`);
  return buildHistoryContext({
    historyText: lines.join('\n'),
    currentMessage: params.currentMessage,
    lineBreak: params.lineBreak,
  });
}

function buildHistoryContextFromMap(params) {
  const key = params.key ?? params.historyKey;
  const map = params.historyMap ?? params.map;
  if (!key || !map) return params.currentMessage;
  const entries = map.get(key) ?? [];
  return buildHistoryContextFromEntries({
    entries,
    currentMessage: params.currentMessage,
    lineBreak: params.lineBreak,
  });
}

function buildPendingHistoryContextFromMap(params) {
  // Same as buildHistoryContextFromMap — pending entries are stored in the same map
  // by recordPendingHistoryEntry. Returning only currentMessage would drop
  // "messages since your last reply" context in group chats.
  return buildHistoryContextFromMap(params);
}

function clearHistoryEntries(params) {
  const key = params.key ?? params.historyKey;
  const map = params.historyMap ?? params.map;
  if (key && map) map.delete(key);
}

function clearHistoryEntriesIfEnabled(params) {
  clearHistoryEntries(params);
}

function recordPendingHistoryEntry(params) {
  const key = params.key ?? params.historyKey;
  const map = params.historyMap ?? params.map;
  if (!key || !map) return [];
  const entries = map.get(key) ?? [];
  // openclaw-lark passes the full history object as params.entry (with sender, body, etc.)
  // Fall back to params.sender/params.body for callers that pass flat fields.
  const entry = params.entry
    ? { ...params.entry, timestamp: params.entry.timestamp ?? Date.now() }
    : { sender: params.sender, body: params.body, timestamp: Date.now() };
  entries.push(entry);
  const limit = params.limit ?? DEFAULT_GROUP_HISTORY_LIMIT;
  while (entries.length > limit) entries.shift();
  map.set(key, entries);
  return entries;
}

function recordPendingHistoryEntryIfEnabled(params) {
  return recordPendingHistoryEntry(params);
}

module.exports = {
  DEFAULT_GROUP_HISTORY_LIMIT,
  buildHistoryContext,
  buildHistoryContextFromEntries,
  buildHistoryContextFromMap,
  buildPendingHistoryContextFromMap,
  clearHistoryEntries,
  clearHistoryEntriesIfEnabled,
  evictOldHistoryKeys,
  recordPendingHistoryEntry,
  recordPendingHistoryEntryIfEnabled,
};
