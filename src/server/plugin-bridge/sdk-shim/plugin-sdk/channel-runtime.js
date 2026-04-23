/** Shim for openclaw/plugin-sdk/channel-runtime */

// --- Re-exports from channels/chat-type ---

function normalizeChatType(raw) {
  const value = raw?.trim().toLowerCase();
  if (!value) return undefined;
  if (value === 'direct' || value === 'dm') return 'direct';
  if (value === 'group') return 'group';
  if (value === 'channel') return 'channel';
  return undefined;
}

// --- Re-exports from channels/reply-prefix ---

function createReplyPrefixContext(_params) {
  const ctx = {};
  return {
    prefixContext: ctx,
    responsePrefix: undefined,
    enableSlackInteractiveReplies: undefined,
    responsePrefixContextProvider: () => ctx,
    onModelSelected: () => {},
  };
}

function createReplyPrefixOptions(_params) {
  return {
    responsePrefix: undefined,
    enableSlackInteractiveReplies: undefined,
    responsePrefixContextProvider: () => ({}),
    onModelSelected: () => {},
  };
}

// --- Re-exports from channels/typing ---

function createTypingCallbacks(_params) {
  return { onReplyStart: async () => {}, onIdle: () => {}, onCleanup: () => {} };
}

// --- Re-exports from channels/plugins/normalize/signal ---

function normalizeSignalMessagingTarget(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  let normalized = trimmed;
  if (normalized.toLowerCase().startsWith('signal:')) {
    normalized = normalized.slice('signal:'.length).trim();
  }
  if (!normalized) return undefined;
  const lower = normalized.toLowerCase();
  if (lower.startsWith('group:')) {
    const id = normalized.slice('group:'.length).trim();
    return id ? `group:${id}` : undefined;
  }
  if (lower.startsWith('username:')) {
    const id = normalized.slice('username:'.length).trim();
    return id ? `username:${id}`.toLowerCase() : undefined;
  }
  if (lower.startsWith('u:')) {
    const id = normalized.slice('u:'.length).trim();
    return id ? `username:${id}`.toLowerCase() : undefined;
  }
  if (lower.startsWith('uuid:')) {
    const id = normalized.slice('uuid:'.length).trim();
    return id ? id.toLowerCase() : undefined;
  }
  return normalized.toLowerCase();
}

function looksLikeSignalTargetId(raw, normalized) {
  const candidates = [raw, normalized ?? ''].map((v) => v.trim()).filter(Boolean);
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const UUID_COMPACT = /^[0-9a-f]{32}$/i;
  for (const candidate of candidates) {
    if (/^(signal:)?(group:|username:|u:)/i.test(candidate)) return true;
    if (/^(signal:)?uuid:/i.test(candidate)) {
      const stripped = candidate.replace(/^signal:/i, '').replace(/^uuid:/i, '').trim();
      if (!stripped) continue;
      if (UUID_PATTERN.test(stripped) || UUID_COMPACT.test(stripped)) return true;
      continue;
    }
    const withoutPrefix = candidate.replace(/^signal:/i, '').trim();
    if (UUID_PATTERN.test(withoutPrefix) || UUID_COMPACT.test(withoutPrefix)) return true;
    if (/^\+?\d{3,}$/.test(withoutPrefix)) return true;
  }
  return false;
}

// --- Re-exports from channels/plugins/normalize/whatsapp ---

function normalizeWhatsAppMessagingTarget(_raw) { return undefined; }
function normalizeWhatsAppAllowFromEntries(allowFrom) {
  return (allowFrom ?? []).map((e) => String(e).trim()).filter(Boolean);
}
function looksLikeWhatsAppTargetId(_raw) { return false; }

// --- Re-exports from channels/plugins/outbound/interactive ---

function reduceInteractiveReply(interactive, initialState, reduce) {
  let state = initialState;
  for (const [index, block] of (interactive?.blocks ?? []).entries()) {
    state = reduce(state, block, index);
  }
  return state;
}

// --- Re-exports from channels/plugins/whatsapp-heartbeat ---

function resolveWhatsAppHeartbeatRecipients(_cfg, _opts) {
  return { recipients: [], source: 'allowFrom' };
}

// --- Re-exports from polls ---

function resolvePollMaxSelections(optionCount, allowMultiselect) {
  return allowMultiselect ? Math.max(2, optionCount) : 1;
}

function normalizePollInput(input, options) {
  const question = input.question.trim();
  if (!question) throw new Error('Poll question is required');
  const cleaned = (input.options ?? []).map((o) => o.trim()).filter(Boolean);
  if (cleaned.length < 2) throw new Error('Poll requires at least 2 options');
  if (options?.maxOptions !== undefined && cleaned.length > options.maxOptions) {
    throw new Error(`Poll supports at most ${options.maxOptions} options`);
  }
  const maxSelections = typeof input.maxSelections === 'number' && Number.isFinite(input.maxSelections)
    ? Math.floor(input.maxSelections) : 1;
  if (maxSelections < 1) throw new Error('maxSelections must be at least 1');
  if (maxSelections > cleaned.length) throw new Error('maxSelections cannot exceed option count');
  const durationSeconds = typeof input.durationSeconds === 'number' && Number.isFinite(input.durationSeconds)
    ? Math.floor(input.durationSeconds) : undefined;
  if (durationSeconds !== undefined && durationSeconds < 1) throw new Error('durationSeconds must be at least 1');
  const durationHours = typeof input.durationHours === 'number' && Number.isFinite(input.durationHours)
    ? Math.floor(input.durationHours) : undefined;
  if (durationHours !== undefined && durationHours < 1) throw new Error('durationHours must be at least 1');
  if (durationSeconds !== undefined && durationHours !== undefined) {
    throw new Error('durationSeconds and durationHours are mutually exclusive');
  }
  return { question, options: cleaned, maxSelections, durationSeconds, durationHours };
}

function normalizePollDurationHours(value, options) {
  const base = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : options.defaultHours;
  return Math.min(Math.max(base, 1), options.maxHours);
}

// --- Re-exports from extensions/whatsapp normalize-target ---

function isWhatsAppGroupJid(jid) {
  return typeof jid === 'string' && jid.includes('@g.us');
}

function isWhatsAppUserTarget(target) {
  return typeof target === 'string' && /^\+?\d+$/.test(target.trim());
}

function normalizeWhatsAppTarget(raw) {
  const trimmed = (typeof raw === 'string' ? raw : '').trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

// --- Re-exports from plugin-sdk/channel-lifecycle ---

function createAccountStatusSink(params) {
  return (patch) => {
    params.setStatus({ accountId: params.accountId, ...patch });
  };
}

function keepHttpServerTaskAlive(params) {
  return new Promise((resolve) => {
    params.server.once('close', () => resolve());
    if (params.abortSignal) {
      const trigger = () => {
        Promise.resolve(params.onAbort?.()).catch(() => {});
      };
      if (params.abortSignal.aborted) {
        trigger();
      } else {
        params.abortSignal.addEventListener('abort', trigger, { once: true });
      }
    }
  });
}

function waitUntilAbort(signal, onAbort) {
  return new Promise((resolve, reject) => {
    const complete = () => {
      Promise.resolve(onAbort?.()).then(() => resolve(), reject);
    };
    if (!signal) return;
    if (signal.aborted) { complete(); return; }
    signal.addEventListener('abort', complete, { once: true });
  });
}

module.exports = {
  // chat-type
  normalizeChatType,
  // reply-prefix
  createReplyPrefixContext,
  createReplyPrefixOptions,
  // typing
  createTypingCallbacks,
  // signal normalize
  normalizeSignalMessagingTarget,
  looksLikeSignalTargetId,
  // whatsapp normalize
  normalizeWhatsAppMessagingTarget,
  normalizeWhatsAppAllowFromEntries,
  looksLikeWhatsAppTargetId,
  // interactive
  reduceInteractiveReply,
  // whatsapp heartbeat
  resolveWhatsAppHeartbeatRecipients,
  // polls
  resolvePollMaxSelections,
  normalizePollInput,
  normalizePollDurationHours,
  // whatsapp shared
  isWhatsAppGroupJid,
  isWhatsAppUserTarget,
  normalizeWhatsAppTarget,
  // channel-lifecycle
  createAccountStatusSink,
  keepHttpServerTaskAlive,
  waitUntilAbort,
};
