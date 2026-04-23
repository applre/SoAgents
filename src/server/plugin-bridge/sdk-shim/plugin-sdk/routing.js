/** Shim for openclaw/plugin-sdk/routing */

// --- Re-exports from routing/session-key ---

const DEFAULT_ACCOUNT_ID = 'default';
const DEFAULT_MAIN_KEY = 'main';

function normalizeAccountId(id) {
  if (!id || id === 'default') return DEFAULT_ACCOUNT_ID;
  return String(id).trim().toLowerCase();
}

function normalizeOptionalAccountId(id) {
  if (!id) return undefined;
  return normalizeAccountId(id);
}

function normalizeAgentId(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 'main';
  return trimmed.toLowerCase();
}

function sanitizeAgentId(value) {
  return normalizeAgentId(value);
}

function normalizeMainKey(value) {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed.toLowerCase() : DEFAULT_MAIN_KEY;
}

function buildAgentMainSessionKey(params) {
  const agentId = normalizeAgentId(params.agentId);
  const mainKey = normalizeMainKey(params.mainKey);
  return `agent:${agentId}:${mainKey}`;
}

function buildGroupHistoryKey(params) {
  const channel = (params.channel ?? '').trim().toLowerCase() || 'unknown';
  const accountId = normalizeAccountId(params.accountId);
  const peerId = (params.peerId ?? '').trim().toLowerCase() || 'unknown';
  return `${channel}:${accountId}:${params.peerKind}:${peerId}`;
}

function isCronSessionKey(key) {
  return typeof key === 'string' && key.startsWith('cron:');
}

function isSubagentSessionKey(key) {
  if (!key) return false;
  const parsed = parseAgentSessionKey(key);
  return parsed ? parsed.rest.includes(':subagent:') : false;
}

function parseAgentSessionKey(key) {
  if (!key) return null;
  const trimmed = key.trim();
  if (!trimmed.startsWith('agent:')) return null;
  const parts = trimmed.slice('agent:'.length);
  const colonIdx = parts.indexOf(':');
  if (colonIdx < 0) return null;
  const agentId = parts.slice(0, colonIdx);
  const rest = parts.slice(colonIdx + 1);
  if (!agentId || !rest) return null;
  return { agentId, rest };
}

function resolveAgentIdFromSessionKey(sessionKey) {
  const parsed = parseAgentSessionKey(sessionKey);
  return normalizeAgentId(parsed?.agentId ?? 'main');
}

function resolveThreadSessionKeys(params) {
  const threadId = (params.threadId ?? '').trim();
  if (!threadId) {
    return { sessionKey: params.baseSessionKey, parentSessionKey: undefined };
  }
  const normalized = (params.normalizeThreadId ?? ((v) => v.toLowerCase()))(threadId);
  const useSuffix = params.useSuffix ?? true;
  const sessionKey = useSuffix
    ? `${params.baseSessionKey}:thread:${normalized}`
    : params.baseSessionKey;
  return { sessionKey, parentSessionKey: params.parentSessionKey };
}

// --- Re-exports from routing/resolve-route ---

function buildAgentSessionKey(params) {
  const channel = (params.channel ?? '').trim().toLowerCase() || 'unknown';
  const peer = params.peer;
  const peerKind = peer?.kind ?? 'direct';
  const peerId = peer ? ((peer.id ?? '').trim() || 'unknown').toLowerCase() : null;
  if (peerKind === 'direct' || !peerId) {
    return buildAgentMainSessionKey({ agentId: params.agentId, mainKey: DEFAULT_MAIN_KEY });
  }
  return `agent:${normalizeAgentId(params.agentId)}:${channel}:${peerKind}:${peerId}`;
}

function deriveLastRoutePolicy(params) {
  return params.sessionKey === params.mainSessionKey ? 'main' : 'session';
}

function resolveAgentRoute(input) {
  const channel = (input.channel ?? '').trim().toLowerCase();
  const accountId = normalizeAccountId(input.accountId);
  const agentId = normalizeAgentId('main');
  const peer = input.peer ?? null;
  const sessionKey = buildAgentSessionKey({ agentId, channel, accountId, peer });
  const mainSessionKey = buildAgentMainSessionKey({ agentId, mainKey: DEFAULT_MAIN_KEY });
  return {
    agentId,
    channel,
    accountId,
    sessionKey,
    mainSessionKey,
    lastRoutePolicy: deriveLastRoutePolicy({ sessionKey, mainSessionKey }),
    matchedBy: 'default',
  };
}

function resolveInboundLastRouteSessionKey(params) {
  return params.route.lastRoutePolicy === 'main' ? params.route.mainSessionKey : params.sessionKey;
}

// --- Re-exports from routing/account-lookup ---

function resolveAccountEntry(accounts, accountId) {
  if (!accounts || typeof accounts !== 'object') return undefined;
  if (Object.hasOwn(accounts, accountId)) return accounts[accountId];
  const normalized = accountId.toLowerCase();
  const matchKey = Object.keys(accounts).find((k) => k.toLowerCase() === normalized);
  return matchKey ? accounts[matchKey] : undefined;
}

// --- Re-exports from routing/bindings ---

function listBoundAccountIds(_cfg, _channelId) { return []; }
function resolveDefaultAgentBoundAccountId(_cfg, _channelId) { return null; }

// --- Re-exports from routing/default-account-warnings ---

function formatSetExplicitDefaultInstruction(channelKey) {
  return `Set channels.${channelKey}.defaultAccount or add channels.${channelKey}.accounts.default`;
}

function formatSetExplicitDefaultToConfiguredInstruction(params) {
  return `Set channels.${params.channelKey}.defaultAccount to one of these accounts, or add channels.${params.channelKey}.accounts.default`;
}

// --- Re-exports from infra/outbound/base-session-key ---

function buildOutboundBaseSessionKey(params) {
  return buildAgentSessionKey({
    agentId: params.agentId,
    channel: params.channel,
    accountId: params.accountId,
    peer: params.peer,
  });
}

// --- Re-exports from infra/outbound/thread-id ---

function normalizeOutboundThreadId(value) {
  if (value == null) return undefined;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined;
    return String(Math.trunc(value));
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

// --- Re-exports from utils/message-channel ---

function normalizeMessageChannel(raw) {
  const normalized = raw?.trim().toLowerCase();
  if (!normalized) return undefined;
  return normalized;
}

function resolveGatewayMessageChannel(raw) {
  return normalizeMessageChannel(raw);
}

module.exports = {
  // routing/session-key
  buildAgentMainSessionKey,
  DEFAULT_ACCOUNT_ID,
  DEFAULT_MAIN_KEY,
  buildGroupHistoryKey,
  isCronSessionKey,
  isSubagentSessionKey,
  normalizeAccountId,
  normalizeAgentId,
  normalizeMainKey,
  normalizeOptionalAccountId,
  parseAgentSessionKey,
  resolveAgentIdFromSessionKey,
  resolveThreadSessionKeys,
  sanitizeAgentId,
  // routing/resolve-route
  buildAgentSessionKey,
  deriveLastRoutePolicy,
  resolveAgentRoute,
  resolveInboundLastRouteSessionKey,
  // routing/account-lookup
  resolveAccountEntry,
  // routing/bindings
  listBoundAccountIds,
  resolveDefaultAgentBoundAccountId,
  // routing/default-account-warnings
  formatSetExplicitDefaultInstruction,
  formatSetExplicitDefaultToConfiguredInstruction,
  // infra/outbound
  buildOutboundBaseSessionKey,
  normalizeOutboundThreadId,
  // utils/message-channel
  normalizeMessageChannel,
  resolveGatewayMessageChannel,
};
