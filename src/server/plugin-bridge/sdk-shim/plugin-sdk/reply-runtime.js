/** Shim for openclaw/plugin-sdk/reply-runtime */

// --- chunk helpers ---

function chunkText(text, limit) {
  if (!text) return [];
  const effectiveLimit = typeof limit === 'number' && limit > 0 ? limit : 4000;
  if (text.length <= effectiveLimit) return [text];
  const chunks = [];
  for (let i = 0; i < text.length; i += effectiveLimit) {
    chunks.push(text.slice(i, i + effectiveLimit));
  }
  return chunks;
}

function chunkTextWithMode(text, limit, _mode) {
  return chunkText(text, limit);
}

function chunkMarkdownText(text, limit) {
  return chunkText(text, limit);
}

function chunkMarkdownTextWithMode(text, limit, _mode) {
  return chunkText(text, limit);
}

function resolveChunkMode(_cfg, _provider, _accountId) {
  return 'length';
}

function resolveTextChunkLimit(_cfg, _provider, _accountId, _opts) {
  return 4000;
}

// --- dispatch helpers ---

async function dispatchInboundMessage(_params) {
  return { status: 'skipped' };
}

async function dispatchInboundMessageWithBufferedDispatcher(_params) {
  return { status: 'skipped' };
}

async function dispatchInboundMessageWithDispatcher(_params) {
  return { status: 'skipped' };
}

// --- group activation ---

function normalizeGroupActivation(raw) {
  const value = raw?.trim().toLowerCase();
  if (value === 'mention') return 'mention';
  if (value === 'always') return 'always';
  return undefined;
}

function parseActivationCommand(raw) {
  if (!raw) return { hasCommand: false };
  const trimmed = raw.trim();
  if (!trimmed) return { hasCommand: false };
  const match = trimmed.match(/^\/activation(?:\s+([a-zA-Z]+))?\s*$/i);
  if (!match) return { hasCommand: false };
  const mode = normalizeGroupActivation(match[1]);
  return { hasCommand: true, mode };
}

// --- heartbeat ---

const HEARTBEAT_PROMPT =
  'Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.';
const DEFAULT_HEARTBEAT_ACK_MAX_CHARS = 300;

function resolveHeartbeatPrompt(_params) {
  return HEARTBEAT_PROMPT;
}

function stripHeartbeatToken(text) {
  if (!text) return '';
  return text.replace(/HEARTBEAT_OK\s*$/i, '').trim();
}

// --- heartbeat reply payload ---

function resolveHeartbeatReplyPayload(_params) {
  return undefined;
}

// --- reply ---

function getReplyFromConfig(_cfg, _params) {
  return undefined;
}

// --- tokens ---

const HEARTBEAT_TOKEN = 'HEARTBEAT_OK';
const SILENT_REPLY_TOKEN = 'NO_REPLY';

function isSilentReplyText(text, token) {
  if (!text) return false;
  const t = token ?? SILENT_REPLY_TOKEN;
  return new RegExp(`^\\s*${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`).test(text);
}

// --- abort ---

function isAbortRequestText(_text) {
  return false;
}

// --- btw command ---

function isBtwRequestText(_text) {
  return false;
}

// --- inbound dedupe ---

function resetInboundDedupe() {}

// --- inbound context ---

function finalizeInboundContext(ctx) {
  return ctx ?? {};
}

// --- provider dispatcher ---

async function dispatchReplyWithBufferedBlockDispatcher(_params) {}
async function dispatchReplyWithDispatcher(_params) {}

// --- reply dispatcher ---

function createReplyDispatcher(_params) {
  return {
    dispatch: async () => {},
    markComplete: () => {},
    waitForIdle: async () => {},
  };
}

function createReplyDispatcherWithTyping(_params) {
  return createReplyDispatcher(_params);
}

// --- reply reference ---

function createReplyReferencePlanner(_params) {
  return {
    plan: () => ({ shouldReference: false }),
  };
}

// --- auto topic label ---

function resolveAutoTopicLabelConfig(_cfg, _params) {
  return { enabled: false };
}

async function generateTopicLabel(_params) {
  return undefined;
}

module.exports = {
  // chunk
  chunkMarkdownText,
  chunkMarkdownTextWithMode,
  chunkText,
  chunkTextWithMode,
  resolveChunkMode,
  resolveTextChunkLimit,
  // dispatch
  dispatchInboundMessage,
  dispatchInboundMessageWithBufferedDispatcher,
  dispatchInboundMessageWithDispatcher,
  // group activation
  normalizeGroupActivation,
  parseActivationCommand,
  // heartbeat
  HEARTBEAT_PROMPT,
  DEFAULT_HEARTBEAT_ACK_MAX_CHARS,
  resolveHeartbeatPrompt,
  stripHeartbeatToken,
  // heartbeat reply payload
  resolveHeartbeatReplyPayload,
  // reply
  getReplyFromConfig,
  // tokens
  HEARTBEAT_TOKEN,
  isSilentReplyText,
  SILENT_REPLY_TOKEN,
  // abort
  isAbortRequestText,
  // btw
  isBtwRequestText,
  // inbound dedupe
  resetInboundDedupe,
  // inbound context
  finalizeInboundContext,
  // provider dispatcher
  dispatchReplyWithBufferedBlockDispatcher,
  dispatchReplyWithDispatcher,
  // reply dispatcher
  createReplyDispatcher,
  createReplyDispatcherWithTyping,
  // reply reference
  createReplyReferencePlanner,
  // auto topic label
  resolveAutoTopicLabelConfig,
  generateTopicLabel,
};
