// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/channel-inbound.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/channel-inbound.' + fn + '() not implemented in Bridge mode'); }
}

function createInboundDebouncer() { _w('createInboundDebouncer'); return undefined; }
function resolveInboundDebounceMs() { _w('resolveInboundDebounceMs'); return undefined; }
function createDirectDmPreCryptoGuardPolicy() { _w('createDirectDmPreCryptoGuardPolicy'); return undefined; }
function dispatchInboundDirectDmWithRuntime() { _w('dispatchInboundDirectDmWithRuntime'); return undefined; }
function formatInboundEnvelope() { _w('formatInboundEnvelope'); return ""; }
function formatInboundFromLabel() { _w('formatInboundFromLabel'); return ""; }
function resolveEnvelopeFormatOptions() { _w('resolveEnvelopeFormatOptions'); return undefined; }
function buildMentionRegexes() { _w('buildMentionRegexes'); return undefined; }
function matchesMentionPatterns() { _w('matchesMentionPatterns'); return undefined; }
function matchesMentionWithExplicit() { _w('matchesMentionWithExplicit'); return undefined; }
function normalizeMentionText() { _w('normalizeMentionText'); return ""; }
function createChannelInboundDebouncer() { _w('createChannelInboundDebouncer'); return undefined; }
function shouldDebounceTextInbound() { _w('shouldDebounceTextInbound'); return false; }
function resolveMentionGating() { _w('resolveMentionGating'); return undefined; }
function resolveMentionGatingWithBypass() { _w('resolveMentionGatingWithBypass'); return undefined; }
function formatLocationText() { _w('formatLocationText'); return ""; }
function toLocationContext() { _w('toLocationContext'); return undefined; }
function logInboundDrop() { _w('logInboundDrop'); return undefined; }
function resolveInboundSessionEnvelopeContext() { _w('resolveInboundSessionEnvelopeContext'); return undefined; }

module.exports = {
  createInboundDebouncer,
  resolveInboundDebounceMs,
  createDirectDmPreCryptoGuardPolicy,
  dispatchInboundDirectDmWithRuntime,
  formatInboundEnvelope,
  formatInboundFromLabel,
  resolveEnvelopeFormatOptions,
  buildMentionRegexes,
  matchesMentionPatterns,
  matchesMentionWithExplicit,
  normalizeMentionText,
  createChannelInboundDebouncer,
  shouldDebounceTextInbound,
  resolveMentionGating,
  resolveMentionGatingWithBypass,
  formatLocationText,
  toLocationContext,
  logInboundDrop,
  resolveInboundSessionEnvelopeContext,
};
