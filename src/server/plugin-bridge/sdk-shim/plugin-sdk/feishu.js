// OpenClaw plugin-sdk/feishu shim for MyAgents Plugin Bridge
// Complete shim of all ~44 runtime symbols exported by openclaw/src/plugin-sdk/feishu.ts
// Source of truth: openclaw/src/plugin-sdk/feishu.ts (82-line re-export file)
// See: specs/research/openclaw_sdk_shim_analysis.md

import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, unlinkSync } from 'fs';
import { readFile } from 'fs/promises';

// ===== auto-reply/reply/history =====

export const DEFAULT_GROUP_HISTORY_LIMIT = 50;

export function buildPendingHistoryContextFromMap(params) {
  // In Bridge mode, Sidecar manages its own session history.
  // Just return the current message without history wrapping.
  return params.currentMessage;
}

export function clearHistoryEntriesIfEnabled(_params) {}

export function recordPendingHistoryEntryIfEnabled(_params) {
  return [];
}

// ===== channels/logging =====

export function logTypingFailure(_params) {}

// ===== channels/plugins/onboarding/helpers =====
// Bridge does not run the OpenClaw onboarding wizard.
// These stubs satisfy imports but are never meaningfully called.

export function buildSingleChannelSecretPromptState(params) {
  return {
    accountConfigured: params.accountConfigured,
    hasConfigToken: params.hasConfigToken,
    canUseEnv: false,
  };
}

export function addWildcardAllowFrom(allowFrom) {
  const next = (allowFrom ?? []).map((v) => String(v).trim()).filter(Boolean);
  if (!next.includes('*')) next.push('*');
  return next;
}

export function mergeAllowFromEntries(current, additions) {
  const merged = [...(current ?? []), ...additions].map((v) => String(v).trim()).filter(Boolean);
  return [...new Set(merged)];
}

export async function promptSingleChannelSecretInput(_params) {
  return { action: 'keep' };
}

export function setTopLevelChannelAllowFrom(params) {
  return params.cfg;
}

export function setTopLevelChannelDmPolicyWithAllowFrom(params) {
  return params.cfg;
}

export function setTopLevelChannelGroupPolicy(params) {
  return params.cfg;
}

export function splitOnboardingEntries(raw) {
  return raw.split(/[\n,;]+/g).map((e) => e.trim()).filter(Boolean);
}

// ===== channels/plugins/pairing-message =====

export const PAIRING_APPROVED_MESSAGE = 'Access approved. Send a message to start chatting.';

// ===== channels/reply-prefix =====

export function createReplyPrefixContext(_params) {
  const ctx = {};
  return {
    prefixContext: ctx,
    responsePrefix: undefined,
    enableSlackInteractiveReplies: undefined,
    responsePrefixContextProvider: () => ctx,
    onModelSelected: () => {},
  };
}

// ===== channels/typing =====

export function createTypingCallbacks(_params) {
  return {
    onReplyStart: async () => {},
    onIdle: () => {},
    onCleanup: () => {},
  };
}

// ===== config/runtime-group-policy =====

export function resolveAllowlistProviderRuntimeGroupPolicy(params) {
  return {
    groupPolicy: params.groupPolicy ?? 'allowlist',
    providerMissingFallbackApplied: !params.providerConfigPresent && params.groupPolicy === undefined,
  };
}

export function resolveDefaultGroupPolicy(cfg) {
  return cfg?.channels?.defaults?.groupPolicy;
}

export function resolveOpenProviderRuntimeGroupPolicy(params) {
  return {
    groupPolicy: params.groupPolicy ?? (params.providerConfigPresent ? 'open' : 'allowlist'),
    providerMissingFallbackApplied: !params.providerConfigPresent && params.groupPolicy === undefined,
  };
}

export function warnMissingProviderGroupPolicyFallbackOnce(_params) {
  return false;
}

// ===== config/types.secrets =====

export function hasConfiguredSecretInput(value, _defaults) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizeResolvedSecretInputString(params) {
  if (typeof params.value === 'string') {
    const t = params.value.trim();
    return t || undefined;
  }
  return undefined;
}

export function normalizeSecretInputString(value) {
  if (typeof value !== 'string') return undefined;
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}

// ===== plugin-sdk/secret-input-schema =====

export function buildSecretInputSchema() {
  // Minimal schema that accepts a plain string (most common case in Bridge mode)
  return {
    parse: (v) => v,
    safeParse: (v) => ({ success: true, data: v }),
    optional: () => ({ parse: (v) => v, safeParse: (v) => ({ success: true, data: v }) }),
  };
}

// ===== infra/dedupe =====
// Rust layer has its own 72h TTL dedup. This is a redundant safety layer.

export function createDedupeCache(options) {
  const cache = new Map();
  const ttl = options?.ttlMs ?? 60000;
  const maxSize = options?.maxSize ?? 10000;

  function evict(now) {
    if (cache.size <= maxSize) return;
    for (const [k, exp] of cache) {
      if (exp < now || cache.size > maxSize) cache.delete(k);
      if (cache.size <= maxSize) break;
    }
  }

  return {
    check(key, now) {
      const n = now ?? Date.now();
      const exp = cache.get(key);
      if (exp !== undefined && exp > n) return true; // duplicate
      cache.set(key, n + ttl);
      evict(n);
      return false; // first time
    },
    peek(key, now) {
      const n = now ?? Date.now();
      const exp = cache.get(key);
      return exp !== undefined && exp > n;
    },
    delete(key) { cache.delete(key); },
    clear() { cache.clear(); },
    size() { return cache.size; },
  };
}

// ===== infra/http-body =====
// Bridge uses Bun.serve, not raw IncomingMessage. These are no-ops.

export function installRequestBodyLimitGuard(_req, _res, _options) {
  return { dispose: () => {}, isTripped: () => false, code: () => null };
}

export async function readJsonBodyWithLimit(_req, _options) {
  return { ok: true, value: {} };
}

// ===== infra/net/fetch-guard =====

export async function fetchWithSsrFGuard({ url, init }) {
  const response = await fetch(url, init || {});
  return { response, release: async () => {} };
}

// ===== plugins/config-schema =====

export function emptyPluginConfigSchema() {
  return { type: 'object', properties: {}, additionalProperties: false };
}

// ===== routing/session-key =====

export const DEFAULT_ACCOUNT_ID = 'default';

export function normalizeAgentId(value) {
  const t = (value ?? '').trim();
  return t ? t.toLowerCase() : 'main';
}

// ===== terminal/links =====

export function formatDocsLink(path, label) {
  const url = path.trim().startsWith('http')
    ? path.trim()
    : 'https://docs.openclaw.ai' + (path.startsWith('/') ? path : '/' + path);
  return label ?? url;
}

// ===== plugin-sdk/group-access =====

export function evaluateSenderGroupAccessForPolicy() {
  return { allowed: true };
}

// ===== plugin-sdk/agent-media-payload =====

export function buildAgentMediaPayload(mediaList) {
  const first = mediaList?.[0];
  const paths = (mediaList ?? []).map((m) => m.path);
  return {
    MediaPath: first?.path,
    MediaType: first?.contentType ?? undefined,
    MediaUrl: first?.path,
    MediaPaths: paths.length ? paths : undefined,
    MediaUrls: paths.length ? paths : undefined,
  };
}

// ===== plugin-sdk/json-store =====

export async function readJsonFileWithFallback(filePath, fallback) {
  try {
    const data = await readFile(filePath, 'utf-8');
    return { value: JSON.parse(data), exists: true };
  } catch {
    return { value: fallback, exists: false };
  }
}

// ===== plugin-sdk/pairing-access =====
// Bridge doesn't use OpenClaw's pairing system.

export function createScopedPairingAccess(params) {
  return {
    accountId: params.accountId,
    readAllowFromStore: async () => ({ allowFrom: [] }),
    readStoreForDmPolicy: async () => ({ allowFrom: [] }),
    upsertPairingRequest: async () => ({ code: '', created: false }),
  };
}

// ===== pairing/pairing-challenge =====

export async function issuePairingChallenge(params) {
  const { code, created } = await params.upsertPairingRequest({
    id: params.senderId,
    meta: params.meta,
  });
  return { created, code: created ? code : undefined };
}

// ===== plugin-sdk/persistent-dedupe =====
// Disk-backed dedup. In Bridge mode, Rust layer handles persistent dedup.

export function createPersistentDedupe(options) {
  const memory = createDedupeCache({
    ttlMs: options?.ttlMs ?? 72 * 3600 * 1000,
    maxSize: options?.memoryMaxSize ?? 5000,
  });
  return {
    checkAndRecord: async (key) => memory.check(key),
    warmup: async () => 0,
    clearMemory: () => memory.clear(),
    memorySize: () => memory.size(),
  };
}

// ===== plugin-sdk/status-helpers =====

export function createDefaultChannelRuntimeState(accountId, extra) {
  return {
    accountId,
    running: false,
    lastStartAt: null,
    lastStopAt: null,
    lastError: null,
    ...(extra ?? {}),
  };
}

export function buildBaseChannelStatusSummary(s) {
  return {
    configured: s.configured ?? false,
    running: s.running ?? false,
    lastStartAt: s.lastStartAt ?? null,
    lastStopAt: s.lastStopAt ?? null,
    lastError: s.lastError ?? null,
  };
}

export function buildProbeChannelStatusSummary(s, extra) {
  return {
    ...buildBaseChannelStatusSummary(s),
    ...(extra ?? {}),
    probe: s.probe,
    lastProbeAt: s.lastProbeAt ?? null,
  };
}

export function buildRuntimeAccountStatusSnapshot(params) {
  return {
    running: params.runtime?.running ?? false,
    lastStartAt: params.runtime?.lastStartAt ?? null,
    lastStopAt: params.runtime?.lastStopAt ?? null,
    lastError: params.runtime?.lastError ?? null,
    probe: params.probe,
  };
}

// ===== plugin-sdk/webhook-memory-guards =====

export const WEBHOOK_RATE_LIMIT_DEFAULTS = Object.freeze({
  windowMs: 60000,
  maxRequests: 120,
  maxTrackedKeys: 4096,
});

export const WEBHOOK_ANOMALY_COUNTER_DEFAULTS = Object.freeze({
  maxTrackedKeys: 4096,
  ttlMs: 6 * 60 * 60000, // 6 hours
  logEvery: 25,
});

export function createFixedWindowRateLimiter(_options) {
  // Bridge's rate limiting is handled by the Rust layer.
  return {
    isRateLimited: () => false,
    size: () => 0,
    clear: () => {},
  };
}

export function createWebhookAnomalyTracker(_options) {
  return {
    record: () => 0,
    size: () => 0,
    clear: () => {},
  };
}

// ===== plugin-sdk/webhook-request-guards =====

export function applyBasicWebhookRequestGuards(_params) {
  return true; // Allow all requests through in Bridge mode
}

// ===== plugin-sdk/temp-path =====

export async function withTempDownloadPath(ext, callback) {
  const dir = join(tmpdir(), 'myagents-bridge-media');
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `dl-${Date.now()}${ext || ''}`);
  try {
    return await callback(filePath);
  } finally {
    try { unlinkSync(filePath); } catch {}
  }
}
