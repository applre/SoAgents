// OpenClaw plugin-sdk root shim for MyAgents Plugin Bridge
// Covers all runtime symbols imported by installed plugins from 'openclaw/plugin-sdk'

import crypto from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chmodSync, lstatSync, mkdirSync, unlinkSync } from 'node:fs';
import { open as fsOpen, readFile as fsReadFile, rm as fsRm } from 'node:fs/promises';

// ===== Config helpers (used by QQBot + others) =====

export function emptyPluginConfigSchema() {
  return { type: 'object', properties: {}, additionalProperties: false };
}

export function applyAccountNameToChannelSection(config, section, name) {
  if (!config) config = {};
  if (!config[section]) config[section] = {};
  config[section].name = name;
  return config;
}

export function deleteAccountFromConfigSection(config, section) {
  if (config && config[section]) delete config[section];
  return config || {};
}

export function setAccountEnabledInConfigSection(config, section, enabled) {
  if (!config) config = {};
  if (!config[section]) config[section] = {};
  config[section].enabled = enabled;
  return config;
}

// ===== Account ID =====

export const DEFAULT_ACCOUNT_ID = 'default';

export function normalizeAccountId(id) {
  if (!id || id === 'default') return DEFAULT_ACCOUNT_ID;
  return String(id).trim().toLowerCase();
}

// ===== History =====

export const DEFAULT_GROUP_HISTORY_LIMIT = 50;

export function buildPendingHistoryContextFromMap(params) {
  return params.currentMessage;
}

export function clearHistoryEntriesIfEnabled(_params) {}

export function recordPendingHistoryEntryIfEnabled(_params) {
  return [];
}

// ===== Pairing =====

export const PAIRING_APPROVED_MESSAGE = 'Access approved. Send a message to start chatting.';

// ===== Reply / Typing =====

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

export function createTypingCallbacks(_params) {
  return { onReplyStart: async () => {}, onIdle: () => {}, onCleanup: () => {} };
}

export function logTypingFailure(_params) {}

// ===== Tokens =====

export const SILENT_REPLY_TOKEN = 'NO_REPLY';

// ===== Session / Routing =====

export function normalizeAgentId(value) {
  const t = (value ?? '').trim();
  return t ? t.toLowerCase() : 'main';
}

export function resolveThreadSessionKeys(params) {
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

// ===== Allow-from / Authorization =====

export function isNormalizedSenderAllowed(params) {
  const normalizedAllow = (params.allowFrom ?? [])
    .map((e) => String(e).trim())
    .filter(Boolean)
    .map((e) => params.stripPrefixRe ? e.replace(params.stripPrefixRe, '') : e)
    .map((e) => e.toLowerCase());
  if (normalizedAllow.length === 0) return false;
  if (normalizedAllow.includes('*')) return true;
  const sender = String(params.senderId).trim().toLowerCase();
  return normalizedAllow.includes(sender);
}

export function formatAllowFromLowercase(params) {
  return (params.allowFrom ?? [])
    .map((e) => String(e).trim())
    .filter(Boolean)
    .map((e) => params.stripPrefixRe ? e.replace(params.stripPrefixRe, '') : e)
    .map((e) => e.toLowerCase());
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

export async function resolveSenderCommandAuthorization(params) {
  return {
    shouldComputeAuth: false,
    effectiveAllowFrom: params.configuredAllowFrom ?? [],
    effectiveGroupAllowFrom: params.configuredGroupAllowFrom ?? [],
    senderAllowedForCommands: true,
    commandAuthorized: undefined,
  };
}

// ===== Tool helpers =====

export function extractToolSend(args, expectedAction = 'sendMessage') {
  const action = typeof args.action === 'string' ? args.action.trim() : '';
  if (action !== expectedAction) return null;
  const to = typeof args.to === 'string' ? args.to : undefined;
  if (!to) return null;
  const accountId = typeof args.accountId === 'string' ? args.accountId.trim() : undefined;
  const threadIdRaw = typeof args.threadId === 'string'
    ? args.threadId.trim()
    : typeof args.threadId === 'number' ? String(args.threadId) : '';
  const threadId = threadIdRaw.length > 0 ? threadIdRaw : undefined;
  return { to, accountId, threadId };
}

export function jsonResult(payload) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

function readParamRaw(params, key) {
  if (Object.hasOwn(params, key)) return params[key];
  const snake = key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
  if (snake !== key && Object.hasOwn(params, snake)) return params[snake];
  return undefined;
}

export function readStringParam(params, key, options = {}) {
  const { required = false, trim = true, label = key, allowEmpty = false } = options;
  const raw = readParamRaw(params, key);
  if (typeof raw !== 'string') {
    if (required) throw new Error(`${label} required`);
    return undefined;
  }
  const value = trim ? raw.trim() : raw;
  if (!value && !allowEmpty) {
    if (required) throw new Error(`${label} required`);
    return undefined;
  }
  return value;
}

export function readReactionParams(params, options) {
  const emojiKey = options.emojiKey ?? 'emoji';
  const removeKey = options.removeKey ?? 'remove';
  const remove = typeof params[removeKey] === 'boolean' ? params[removeKey] : false;
  const emoji = readStringParam(params, emojiKey, { required: true, allowEmpty: true });
  if (remove && !emoji) throw new Error(options.removeErrorMessage);
  return { emoji, remove, isEmpty: !emoji };
}

// ===== Temp path =====

export function buildRandomTempFilePath(params) {
  const prefix = (params.prefix || 'tmp').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'tmp';
  let ext = '';
  if (params.extension) {
    const raw = params.extension.startsWith('.') ? params.extension : `.${params.extension}`;
    const token = (raw.match(/[a-zA-Z0-9._-]+$/)?.[0] ?? '').replace(/^[._-]+/, '');
    if (token) ext = `.${token}`;
  }
  const now = typeof params.now === 'number' && Number.isFinite(params.now) ? Math.trunc(params.now) : Date.now();
  const uuid = params.uuid?.trim() || crypto.randomUUID();
  const root = params.tmpDir ?? join(tmpdir(), 'myagents-bridge-media');
  mkdirSync(root, { recursive: true });
  return join(root, `${prefix}-${now}-${uuid}${ext}`);
}

// ===== Docs link =====

export function formatDocsLink(path, label) {
  const url = path.trim().startsWith('http')
    ? path.trim()
    : 'https://docs.openclaw.ai' + (path.startsWith('/') ? path : '/' + path);
  return label ?? url;
}

// ===== Channel config schema (used by WeChat + others at module level) =====
// Source: openclaw/src/channels/plugins/config-schema.ts

export function buildChannelConfigSchema(schema) {
  // Zod v4 exposes .toJSONSchema(); Zod v3 does not.
  if (schema && typeof schema.toJSONSchema === 'function') {
    try {
      return {
        schema: schema.toJSONSchema({
          target: 'draft-07',
          unrepresentable: 'any',
        }),
      };
    } catch {
      // fall through to fallback
    }
  }
  // Compatibility fallback for Zod v3 schemas
  return {
    schema: {
      type: 'object',
      additionalProperties: true,
    },
  };
}

// ===== Command authorization with runtime (used by WeChat inbound pipeline) =====
// Source: openclaw/src/plugin-sdk/command-auth.ts

export async function resolveSenderCommandAuthorizationWithRuntime(params) {
  // Thin wrapper: extract functions from params.runtime and delegate to
  // resolveSenderCommandAuthorization. In Bridge mode, MyAgents handles
  // access control at Rust layer, so the base function already returns
  // senderAllowedForCommands: true.
  return resolveSenderCommandAuthorization({
    ...params,
    shouldComputeCommandAuthorized: params.runtime?.shouldComputeCommandAuthorized
      ?? (() => false),
    resolveCommandAuthorizedFromAuthorizers: params.runtime?.resolveCommandAuthorizedFromAuthorizers
      ?? (() => true),
  });
}

// ===== Direct DM authorization outcome (used by WeChat inbound pipeline) =====
// Source: openclaw/src/plugin-sdk/command-auth.ts

export function resolveDirectDmAuthorizationOutcome(params) {
  if (params.isGroup) {
    return 'allowed';
  }
  if (params.dmPolicy === 'disabled') {
    return 'disabled';
  }
  if (params.dmPolicy !== 'open' && !params.senderAllowedForCommands) {
    return 'unauthorized';
  }
  return 'allowed';
}

// ===== Preferred OpenClaw tmp dir (used by WeChat media pipeline) =====
// Source: openclaw/src/infra/tmp-openclaw-dir.ts
// Simplified for Bridge mode — same security: no symlinks, uid-owned, mode 0o700.

const POSIX_OPENCLAW_TMP_DIR = '/tmp/openclaw';

function _isSecureDirForUser(dirPath) {
  try {
    const stat = lstatSync(dirPath);
    // Must be a real directory (not a symlink)
    if (!stat.isDirectory() || stat.isSymbolicLink()) return false;
    // Must be owned by current user
    if (typeof process.getuid === 'function' && stat.uid !== process.getuid()) return false;
    // Must not have group/other write bits
    if ((stat.mode & 0o022) !== 0) return false;
    return true;
  } catch {
    return false;
  }
}

export function resolvePreferredOpenClawTmpDir() {
  // On Windows, fall back to os.tmpdir()
  if (process.platform === 'win32') {
    const dir = join(tmpdir(), 'openclaw');
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  // Try preferred path /tmp/openclaw
  try {
    const stat = lstatSync(POSIX_OPENCLAW_TMP_DIR);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      // Exists and is a directory — verify ownership and permissions
      if (_isSecureDirForUser(POSIX_OPENCLAW_TMP_DIR)) {
        return POSIX_OPENCLAW_TMP_DIR;
      }
      // Try to repair permissions
      try {
        chmodSync(POSIX_OPENCLAW_TMP_DIR, 0o700);
        if (_isSecureDirForUser(POSIX_OPENCLAW_TMP_DIR)) return POSIX_OPENCLAW_TMP_DIR;
      } catch { /* fall through */ }
    }
  } catch (err) {
    // "missing" — try to create it
    if (err.code === 'ENOENT') {
      try {
        mkdirSync(POSIX_OPENCLAW_TMP_DIR, { recursive: true, mode: 0o700 });
        chmodSync(POSIX_OPENCLAW_TMP_DIR, 0o700);
        return POSIX_OPENCLAW_TMP_DIR;
      } catch { /* fall through */ }
    }
  }

  // Fallback: /tmp/openclaw-{uid} or os.tmpdir()/openclaw-{uid}
  const uid = typeof process.getuid === 'function' ? process.getuid() : process.pid;
  const fallback = join(tmpdir(), `openclaw-${uid}`);
  mkdirSync(fallback, { recursive: true, mode: 0o700 });
  return fallback;
}

// ===== Strip markdown (used by WeChat outbound message formatting) =====
// Source: openclaw/src/line/markdown-to-line.ts

export function stripMarkdown(text) {
  let result = text;

  // Remove bold: **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, '$1');
  result = result.replace(/__(.+?)__/g, '$1');

  // Remove italic: *text* or _text_ (but not already-processed bold)
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1');
  result = result.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '$1');

  // Remove strikethrough: ~~text~~
  result = result.replace(/~~(.+?)~~/g, '$1');

  // Remove headers: # Title, ## Title, etc.
  result = result.replace(/^#{1,6}\s+(.+)$/gm, '$1');

  // Remove blockquotes: > text
  result = result.replace(/^>\s?(.*)$/gm, '$1');

  // Remove horizontal rules: ---, ***, ___
  result = result.replace(/^[-*_]{3,}$/gm, '');

  // Remove inline code: `code`
  result = result.replace(/`([^`]+)`/g, '$1');

  // Clean up extra whitespace
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.trim();

  return result;
}

// ===== File lock (used by WeChat credential file access) =====
// Source: openclaw/src/plugin-sdk/file-lock.ts
// Re-entrant within the same process via a global held-locks map.

const HELD_LOCKS_KEY = Symbol.for('openclaw.fileLockHeldLocks');
function _getHeldLocks() {
  if (!process[HELD_LOCKS_KEY]) process[HELD_LOCKS_KEY] = new Map();
  return process[HELD_LOCKS_KEY];
}

function _isPidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function _isStaleLock(lockPath, staleMs) {
  try {
    const stat = lstatSync(lockPath);
    if (Date.now() - stat.mtimeMs > staleMs) return true;
    // Try to read PID from lock file and check if alive
    const content = await fsReadFile(lockPath, 'utf8').catch(() => '');
    if (content) {
      try {
        const data = JSON.parse(content);
        if (data.pid && !_isPidAlive(data.pid)) return true;
      } catch { /* corrupt lock file — treat as stale */ return true; }
    }
    return false;
  } catch {
    return true;
  }
}

function _computeDelay(retries, attempt) {
  const base = retries.minTimeout ?? 100;
  const factor = retries.factor ?? 2;
  const max = retries.maxTimeout ?? 5000;
  let delay = Math.min(base * Math.pow(factor, attempt), max);
  if (retries.randomize !== false) delay *= 0.5 + Math.random() * 0.5;
  return delay;
}

async function _releaseHeldLock(normalizedFile) {
  const heldLocks = _getHeldLocks();
  const held = heldLocks.get(normalizedFile);
  if (!held) return;
  held.count -= 1;
  if (held.count <= 0) {
    heldLocks.delete(normalizedFile);
    try { await held.handle.close(); } catch { /* best-effort */ }
    try { unlinkSync(held.lockPath); } catch { /* best-effort */ }
  }
}

async function acquireFileLock(filePath, options) {
  const { resolve: pathResolve } = await import('node:path');
  const { realpath } = await import('node:fs/promises');
  let normalizedFile;
  try {
    normalizedFile = await realpath(filePath);
  } catch {
    normalizedFile = pathResolve(filePath);
  }
  const lockPath = `${normalizedFile}.lock`;

  // Re-entrant: if this process already holds the lock, increment counter
  const heldLocks = _getHeldLocks();
  const held = heldLocks.get(normalizedFile);
  if (held) {
    held.count += 1;
    return { lockPath, release: () => _releaseHeldLock(normalizedFile) };
  }

  const staleMs = options?.stale ?? 30000;
  const retries = options?.retries ?? { retries: 10, factor: 2, minTimeout: 100, maxTimeout: 5000 };
  const attempts = Math.max(1, (retries.retries ?? 10) + 1);

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const handle = await fsOpen(lockPath, 'wx'); // exclusive create
      await handle.writeFile(
        JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }, null, 2),
        'utf8',
      );
      heldLocks.set(normalizedFile, { count: 1, handle, lockPath });
      return { lockPath, release: () => _releaseHeldLock(normalizedFile) };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      // Check stale lock
      if (await _isStaleLock(lockPath, staleMs)) {
        await fsRm(lockPath, { force: true }).catch(() => undefined);
        continue;
      }
      if (attempt >= attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, _computeDelay(retries, attempt)));
    }
  }
  throw new Error(`file lock timeout for ${normalizedFile}`);
}

export async function withFileLock(filePath, options, fn) {
  const lock = await acquireFileLock(filePath, options);
  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
