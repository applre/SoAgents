// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/reply-payload.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/reply-payload.' + fn + '() not implemented in Bridge mode'); }
}

async function sendPayloadWithChunkedTextAndMedia() { _w('sendPayloadWithChunkedTextAndMedia'); return undefined; }
async function sendPayloadMediaSequence() { _w('sendPayloadMediaSequence'); return undefined; }
async function sendPayloadMediaSequenceOrFallback() { _w('sendPayloadMediaSequenceOrFallback'); return undefined; }
async function sendPayloadMediaSequenceAndFinalize() { _w('sendPayloadMediaSequenceAndFinalize'); return undefined; }
async function sendTextMediaPayload() { _w('sendTextMediaPayload'); return undefined; }
async function sendMediaWithLeadingCaption() { _w('sendMediaWithLeadingCaption'); return undefined; }
async function deliverTextOrMediaReply() { _w('deliverTextOrMediaReply'); return undefined; }
async function deliverFormattedTextWithAttachments() { _w('deliverFormattedTextWithAttachments'); return undefined; }
function normalizeOutboundReplyPayload() { _w('normalizeOutboundReplyPayload'); return ""; }
function createNormalizedOutboundDeliverer() { _w('createNormalizedOutboundDeliverer'); return undefined; }
function resolveOutboundMediaUrls() { _w('resolveOutboundMediaUrls'); return undefined; }
function resolvePayloadMediaUrls() { _w('resolvePayloadMediaUrls'); return undefined; }
function countOutboundMedia() { _w('countOutboundMedia'); return undefined; }
function hasOutboundMedia() { _w('hasOutboundMedia'); return false; }
function hasOutboundText() { _w('hasOutboundText'); return false; }
function hasOutboundReplyContent() { _w('hasOutboundReplyContent'); return false; }
function resolveSendableOutboundReplyParts() { _w('resolveSendableOutboundReplyParts'); return undefined; }
function resolveTextChunksWithFallback() { _w('resolveTextChunksWithFallback'); return undefined; }
function isNumericTargetId() { _w('isNumericTargetId'); return false; }
function formatTextWithAttachmentLinks() { _w('formatTextWithAttachmentLinks'); return ""; }
function buildMediaPayload() { _w('buildMediaPayload'); return undefined; }

module.exports = {
  sendPayloadWithChunkedTextAndMedia,
  sendPayloadMediaSequence,
  sendPayloadMediaSequenceOrFallback,
  sendPayloadMediaSequenceAndFinalize,
  sendTextMediaPayload,
  sendMediaWithLeadingCaption,
  deliverTextOrMediaReply,
  deliverFormattedTextWithAttachments,
  normalizeOutboundReplyPayload,
  createNormalizedOutboundDeliverer,
  resolveOutboundMediaUrls,
  resolvePayloadMediaUrls,
  countOutboundMedia,
  hasOutboundMedia,
  hasOutboundText,
  hasOutboundReplyContent,
  resolveSendableOutboundReplyParts,
  resolveTextChunksWithFallback,
  isNumericTargetId,
  formatTextWithAttachmentLinks,
  buildMediaPayload,
};
