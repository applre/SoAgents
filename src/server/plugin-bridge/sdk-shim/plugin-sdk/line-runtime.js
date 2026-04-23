// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/line-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/line-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function probeLineBot() { _w('probeLineBot'); return undefined; }
function createQuickReplyItems() { _w('createQuickReplyItems'); return undefined; }
function pushFlexMessage() { _w('pushFlexMessage'); return undefined; }
function pushLocationMessage() { _w('pushLocationMessage'); return undefined; }
function pushMessageLine() { _w('pushMessageLine'); return undefined; }
function pushMessagesLine() { _w('pushMessagesLine'); return undefined; }
function pushTemplateMessage() { _w('pushTemplateMessage'); return undefined; }
function pushTextMessageWithQuickReplies() { _w('pushTextMessageWithQuickReplies'); return undefined; }
function sendMessageLine() { _w('sendMessageLine'); return undefined; }
function buildTemplateMessageFromPayload() { _w('buildTemplateMessageFromPayload'); return undefined; }
const normalizeAllowFrom = undefined;
const normalizeDmAllowFromWithStore = undefined;
const isSenderAllowed = undefined;
function firstDefined() { _w('firstDefined'); return undefined; }
async function handleLineWebhookEvents() { _w('handleLineWebhookEvents'); return undefined; }
function createLineWebhookReplayCache() { _w('createLineWebhookReplayCache'); return undefined; }
async function buildLineMessageContext() { _w('buildLineMessageContext'); return undefined; }
async function buildLinePostbackContext() { _w('buildLinePostbackContext'); return undefined; }
function getLineSourceInfo() { _w('getLineSourceInfo'); return undefined; }
function createLineBot() { _w('createLineBot'); return undefined; }
function createLineWebhookCallback() { _w('createLineWebhookCallback'); return undefined; }
async function downloadLineMedia() { _w('downloadLineMedia'); return undefined; }
async function monitorLineProvider() { _w('monitorLineProvider'); return undefined; }
function getLineRuntimeState() { _w('getLineRuntimeState'); return undefined; }

module.exports = {
  probeLineBot,
  createQuickReplyItems,
  pushFlexMessage,
  pushLocationMessage,
  pushMessageLine,
  pushMessagesLine,
  pushTemplateMessage,
  pushTextMessageWithQuickReplies,
  sendMessageLine,
  buildTemplateMessageFromPayload,
  normalizeAllowFrom,
  normalizeDmAllowFromWithStore,
  isSenderAllowed,
  firstDefined,
  handleLineWebhookEvents,
  createLineWebhookReplayCache,
  buildLineMessageContext,
  buildLinePostbackContext,
  getLineSourceInfo,
  createLineBot,
  createLineWebhookCallback,
  downloadLineMedia,
  monitorLineProvider,
  getLineRuntimeState,
};
