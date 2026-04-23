/** Shim for openclaw/plugin-sdk/channel-feedback */

// --- Re-exports from channels/ack-reactions ---

function shouldAckReaction(params) {
  const scope = params.scope ?? 'group-mentions';
  if (scope === 'off' || scope === 'none') return false;
  if (scope === 'all') return true;
  if (scope === 'direct') return params.isDirect;
  if (scope === 'group-all') return params.isGroup;
  if (scope === 'group-mentions') {
    if (!params.isMentionableGroup) return false;
    if (!params.requireMention) return false;
    if (!params.canDetectMention) return false;
    return params.effectiveWasMentioned || params.shouldBypassMention === true;
  }
  return false;
}

function shouldAckReactionForWhatsApp(params) {
  if (!params.emoji) return false;
  if (params.isDirect) return params.directEnabled;
  if (!params.isGroup) return false;
  if (params.groupMode === 'never') return false;
  if (params.groupMode === 'always') return true;
  return shouldAckReaction({
    scope: 'group-mentions',
    isDirect: false,
    isGroup: true,
    isMentionableGroup: true,
    requireMention: true,
    canDetectMention: true,
    effectiveWasMentioned: params.wasMentioned,
    shouldBypassMention: params.groupActivated,
  });
}

function removeAckReactionAfterReply(params) {
  if (!params.removeAfterReply) return;
  if (!params.ackReactionPromise) return;
  if (!params.ackReactionValue) return;
  void params.ackReactionPromise.then((didAck) => {
    if (!didAck) return;
    params.remove().catch((err) => params.onError?.(err));
  });
}

// --- Re-exports from channels/logging ---

function logAckFailure(params) {
  const target = params.target ? ` target=${params.target}` : '';
  params.log(`${params.channel} ack cleanup failed${target}: ${String(params.error)}`);
}

function logTypingFailure(params) {
  const target = params.target ? ` target=${params.target}` : '';
  const action = params.action ? ` action=${params.action}` : '';
  params.log(`${params.channel} typing${action} failed${target}: ${String(params.error)}`);
}

// --- Re-exports from infra/outbound/target-errors ---

function missingTargetError(provider, hint) {
  const hintStr = hint?.trim() ? ` ${hint.trim()}` : '';
  return new Error(`Delivering to ${provider} requires target${hintStr}`);
}

// --- Re-exports from channels/status-reactions ---

const CODING_TOOL_TOKENS = ['exec', 'process', 'read', 'write', 'edit', 'session_status', 'bash'];
const WEB_TOOL_TOKENS = ['web_search', 'web-search', 'web_fetch', 'web-fetch', 'browser'];

const DEFAULT_EMOJIS = {
  queued: '\u{1F440}',
  thinking: '\u{1F914}',
  tool: '\u{1F525}',
  coding: '\u{1F468}\u{200D}\u{1F4BB}',
  web: '\u{26A1}',
  done: '\u{1F44D}',
  error: '\u{1F631}',
  stallSoft: '\u{1F971}',
  stallHard: '\u{1F628}',
  compacting: '\u{270D}',
};

const DEFAULT_TIMING = {
  debounceMs: 700,
  stallSoftMs: 10000,
  stallHardMs: 30000,
  doneHoldMs: 1500,
  errorHoldMs: 2500,
};

function resolveToolEmoji(toolName, emojis) {
  const normalized = toolName?.trim().toLowerCase() ?? '';
  if (!normalized) return emojis.tool;
  if (WEB_TOOL_TOKENS.some((t) => normalized.includes(t))) return emojis.web;
  if (CODING_TOOL_TOKENS.some((t) => normalized.includes(t))) return emojis.coding;
  return emojis.tool;
}

function createStatusReactionController(params) {
  const noop = () => Promise.resolve();
  return {
    setQueued: noop,
    setThinking: noop,
    setTool: noop,
    setCompacting: noop,
    cancelPending: () => {},
    setDone: noop,
    setError: noop,
    clear: noop,
    restoreInitial: noop,
  };
}

module.exports = {
  removeAckReactionAfterReply,
  shouldAckReaction,
  shouldAckReactionForWhatsApp,
  logAckFailure,
  logTypingFailure,
  missingTargetError,
  CODING_TOOL_TOKENS,
  createStatusReactionController,
  DEFAULT_EMOJIS,
  DEFAULT_TIMING,
  resolveToolEmoji,
  WEB_TOOL_TOKENS,
};
