// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/provider-stream.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/provider-stream.' + fn + '() not implemented in Bridge mode'); }
}

function createBedrockNoCacheWrapper() { _w('createBedrockNoCacheWrapper'); return undefined; }
function isAnthropicBedrockModel() { _w('isAnthropicBedrockModel'); return false; }
function createGoogleThinkingPayloadWrapper() { _w('createGoogleThinkingPayloadWrapper'); return undefined; }
function sanitizeGoogleThinkingPayload() { _w('sanitizeGoogleThinkingPayload'); return ""; }
function createKilocodeWrapper() { _w('createKilocodeWrapper'); return undefined; }
function createOpenRouterSystemCacheWrapper() { _w('createOpenRouterSystemCacheWrapper'); return undefined; }
function createOpenRouterWrapper() { _w('createOpenRouterWrapper'); return undefined; }
function isProxyReasoningUnsupported() { _w('isProxyReasoningUnsupported'); return false; }
function createMoonshotThinkingWrapper() { _w('createMoonshotThinkingWrapper'); return undefined; }
function resolveMoonshotThinkingType() { _w('resolveMoonshotThinkingType'); return undefined; }
function createOpenAIAttributionHeadersWrapper() { _w('createOpenAIAttributionHeadersWrapper'); return undefined; }
function createOpenAIDefaultTransportWrapper() { _w('createOpenAIDefaultTransportWrapper'); return undefined; }
function createToolStreamWrapper() { _w('createToolStreamWrapper'); return undefined; }
function createZaiToolStreamWrapper() { _w('createZaiToolStreamWrapper'); return undefined; }
function getOpenRouterModelCapabilities() { _w('getOpenRouterModelCapabilities'); return undefined; }
function loadOpenRouterModelCapabilities() { _w('loadOpenRouterModelCapabilities'); return undefined; }

module.exports = {
  createBedrockNoCacheWrapper,
  isAnthropicBedrockModel,
  createGoogleThinkingPayloadWrapper,
  sanitizeGoogleThinkingPayload,
  createKilocodeWrapper,
  createOpenRouterSystemCacheWrapper,
  createOpenRouterWrapper,
  isProxyReasoningUnsupported,
  createMoonshotThinkingWrapper,
  resolveMoonshotThinkingType,
  createOpenAIAttributionHeadersWrapper,
  createOpenAIDefaultTransportWrapper,
  createToolStreamWrapper,
  createZaiToolStreamWrapper,
  getOpenRouterModelCapabilities,
  loadOpenRouterModelCapabilities,
};
