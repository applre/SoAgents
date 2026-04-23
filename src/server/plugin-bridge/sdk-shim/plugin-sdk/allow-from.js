/** Shim for openclaw/plugin-sdk/allow-from */

// --- Re-exports from channels/allowlist-match ---

function formatAllowlistMatchMeta(match) {
  return `matchKey=${match?.matchKey ?? 'none'} matchSource=${match?.matchSource ?? 'none'}`;
}

function compileAllowlist(entries) {
  const set = new Set((entries ?? []).filter(Boolean));
  return { set, wildcard: set.has('*') };
}

function resolveAllowlistCandidates(params) {
  for (const candidate of (params.candidates ?? [])) {
    if (!candidate.value) continue;
    if (params.compiledAllowlist.set.has(candidate.value)) {
      return { allowed: true, matchKey: candidate.value, matchSource: candidate.source };
    }
  }
  return { allowed: false };
}

function resolveCompiledAllowlistMatch(params) {
  if (params.compiledAllowlist.set.size === 0) return { allowed: false };
  if (params.compiledAllowlist.wildcard) return { allowed: true, matchKey: '*', matchSource: 'wildcard' };
  return resolveAllowlistCandidates(params);
}

function resolveAllowlistMatchByCandidates(params) {
  return resolveCompiledAllowlistMatch({
    compiledAllowlist: compileAllowlist(params.allowList),
    candidates: params.candidates,
  });
}

function resolveAllowlistMatchSimple(params) {
  const compiled = compileAllowlist(
    (params.allowFrom ?? []).map((e) => String(e).trim().toLowerCase()).filter(Boolean),
  );
  if (compiled.set.size === 0) return { allowed: false };
  if (compiled.wildcard) return { allowed: true, matchKey: '*', matchSource: 'wildcard' };
  const senderId = String(params.senderId).toLowerCase();
  const senderName = params.senderName?.toLowerCase();
  const candidates = [{ value: senderId, source: 'id' }];
  if (params.allowNameMatching === true && senderName) {
    candidates.push({ value: senderName, source: 'name' });
  }
  return resolveAllowlistCandidates({ compiledAllowlist: compiled, candidates });
}

// --- Re-exports from channels/allow-from ---

function firstDefined(...values) {
  for (const value of values) {
    if (typeof value !== 'undefined') return value;
  }
  return undefined;
}

function isSenderIdAllowed(allow, senderId, allowWhenEmpty) {
  if (!allow.hasEntries) return allowWhenEmpty;
  if (allow.hasWildcard) return true;
  if (!senderId) return false;
  return allow.entries.includes(senderId);
}

function mergeDmAllowFromSources(params) {
  const storeEntries = params.dmPolicy === 'allowlist' ? [] : (params.storeAllowFrom ?? []);
  return [...(params.allowFrom ?? []), ...storeEntries]
    .map((v) => String(v).trim())
    .filter(Boolean);
}

function resolveGroupAllowFromSources(params) {
  const explicitGroupAllowFrom =
    Array.isArray(params.groupAllowFrom) && params.groupAllowFrom.length > 0
      ? params.groupAllowFrom
      : undefined;
  const scoped = explicitGroupAllowFrom
    ? explicitGroupAllowFrom
    : params.fallbackToAllowFrom === false
      ? []
      : (params.allowFrom ?? []);
  return scoped.map((v) => String(v).trim()).filter(Boolean);
}

// --- Re-exports from channels/allowlists/resolve-utils ---

function addAllowlistUserEntriesFromConfigEntry(_params) { return []; }
function buildAllowlistResolutionSummary(resolvedUsers, _opts) {
  const resolvedMap = new Map(resolvedUsers.map((e) => [e.input, e]));
  const resolvedOk = (e) => Boolean(e.resolved && e.id);
  const mapping = resolvedUsers.filter(resolvedOk).map((e) => `${e.input}->${e.id}`);
  const additions = resolvedUsers.filter(resolvedOk).map((e) => e.id).filter(Boolean);
  const unresolved = resolvedUsers.filter((e) => !resolvedOk(e)).map((e) => e.input);
  return { resolvedMap, mapping, unresolved, additions };
}
function canonicalizeAllowlistWithResolvedIds(params) {
  return (params.existing ?? []).map((e) => {
    const trimmed = String(e).trim();
    if (!trimmed) return null;
    if (trimmed === '*') return trimmed;
    const resolved = params.resolvedMap.get(trimmed);
    return resolved?.resolved && resolved.id ? resolved.id : trimmed;
  }).filter(Boolean);
}
function mergeAllowlist(params) {
  const all = [...(params.existing ?? []).map((e) => String(e).trim()), ...params.additions];
  return [...new Set(all.filter(Boolean))];
}
function patchAllowlistUsersInConfigEntries(params) { return { ...params.entries }; }
function summarizeMapping(mapping) { return (mapping ?? []).join(', '); }

// --- Locally defined functions ---

function formatAllowFromLowercase(params) {
  return (params.allowFrom ?? [])
    .map((e) => String(e).trim())
    .filter(Boolean)
    .map((e) => params.stripPrefixRe ? e.replace(params.stripPrefixRe, '') : e)
    .map((e) => e.toLowerCase());
}

function formatNormalizedAllowFromEntries(params) {
  return (params.allowFrom ?? [])
    .map((e) => String(e).trim())
    .filter(Boolean)
    .map((e) => params.normalizeEntry(e))
    .filter((e) => Boolean(e));
}

function isNormalizedSenderAllowed(params) {
  const normalizedAllow = formatAllowFromLowercase({
    allowFrom: params.allowFrom,
    stripPrefixRe: params.stripPrefixRe,
  });
  if (normalizedAllow.length === 0) return false;
  if (normalizedAllow.includes('*')) return true;
  const sender = String(params.senderId).trim().toLowerCase();
  return normalizedAllow.includes(sender);
}

function isAllowedParsedChatSender(params) {
  const allowFrom = (params.allowFrom ?? []).map((e) => String(e).trim());
  if (allowFrom.length === 0) return false;
  if (allowFrom.includes('*')) return true;
  const senderNormalized = params.normalizeSender(params.sender);
  const chatId = params.chatId ?? undefined;
  const chatGuid = params.chatGuid?.trim();
  const chatIdentifier = params.chatIdentifier?.trim();
  for (const entry of allowFrom) {
    if (!entry) continue;
    const parsed = params.parseAllowTarget(entry);
    if (parsed.kind === 'chat_id' && chatId !== undefined && parsed.chatId === chatId) return true;
    if (parsed.kind === 'chat_guid' && chatGuid && parsed.chatGuid === chatGuid) return true;
    if (parsed.kind === 'chat_identifier' && chatIdentifier && parsed.chatIdentifier === chatIdentifier) return true;
    if (parsed.kind === 'handle' && senderNormalized && parsed.handle === senderNormalized) return true;
  }
  return false;
}

function mapBasicAllowlistResolutionEntries(entries) {
  return (entries ?? []).map((e) => ({
    input: e.input,
    resolved: e.resolved,
    id: e.id,
    name: e.name,
    note: e.note,
  }));
}

async function mapAllowlistResolutionInputs(params) {
  const results = [];
  for (const input of (params.inputs ?? [])) {
    results.push(await params.mapInput(input));
  }
  return results;
}

module.exports = {
  // channels/allowlist-match
  compileAllowlist,
  formatAllowlistMatchMeta,
  resolveAllowlistCandidates,
  resolveAllowlistMatchByCandidates,
  resolveAllowlistMatchSimple,
  resolveCompiledAllowlistMatch,
  // channels/allow-from
  firstDefined,
  isSenderIdAllowed,
  mergeDmAllowFromSources,
  resolveGroupAllowFromSources,
  // channels/allowlists/resolve-utils
  addAllowlistUserEntriesFromConfigEntry,
  buildAllowlistResolutionSummary,
  canonicalizeAllowlistWithResolvedIds,
  mergeAllowlist,
  patchAllowlistUsersInConfigEntries,
  summarizeMapping,
  // local
  formatAllowFromLowercase,
  formatNormalizedAllowFromEntries,
  isNormalizedSenderAllowed,
  isAllowedParsedChatSender,
  mapBasicAllowlistResolutionEntries,
  mapAllowlistResolutionInputs,
};
