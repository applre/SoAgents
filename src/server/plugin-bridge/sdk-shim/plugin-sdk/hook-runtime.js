// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/hook-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/hook-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function fireAndForgetHook() { _w('fireAndForgetHook'); return undefined; }
async function triggerInternalHook() { _w('triggerInternalHook'); return undefined; }
function registerInternalHook() { _w('registerInternalHook'); return undefined; }
function unregisterInternalHook() { _w('unregisterInternalHook'); return undefined; }
function clearInternalHooks() { _w('clearInternalHooks'); return undefined; }
function getRegisteredEventKeys() { _w('getRegisteredEventKeys'); return undefined; }
function hasInternalHookListeners() { _w('hasInternalHookListeners'); return false; }
function createInternalHookEvent() { _w('createInternalHookEvent'); return undefined; }
function isAgentBootstrapEvent() { _w('isAgentBootstrapEvent'); return false; }
function isGatewayStartupEvent() { _w('isGatewayStartupEvent'); return false; }
function isMessageReceivedEvent() { _w('isMessageReceivedEvent'); return false; }
function isMessageSentEvent() { _w('isMessageSentEvent'); return false; }
function isMessageTranscribedEvent() { _w('isMessageTranscribedEvent'); return false; }
function isMessagePreprocessedEvent() { _w('isMessagePreprocessedEvent'); return false; }
function isSessionPatchEvent() { _w('isSessionPatchEvent'); return false; }
function deriveInboundMessageHookContext() { _w('deriveInboundMessageHookContext'); return undefined; }
function buildCanonicalSentMessageHookContext() { _w('buildCanonicalSentMessageHookContext'); return undefined; }
function toPluginMessageContext() { _w('toPluginMessageContext'); return undefined; }
function toPluginInboundClaimContext() { _w('toPluginInboundClaimContext'); return undefined; }
function toPluginInboundClaimEvent() { _w('toPluginInboundClaimEvent'); return undefined; }
function toPluginMessageReceivedEvent() { _w('toPluginMessageReceivedEvent'); return undefined; }
function toPluginMessageSentEvent() { _w('toPluginMessageSentEvent'); return undefined; }
function toInternalMessageReceivedContext() { _w('toInternalMessageReceivedContext'); return undefined; }
function toInternalMessageTranscribedContext() { _w('toInternalMessageTranscribedContext'); return undefined; }
function toInternalMessagePreprocessedContext() { _w('toInternalMessagePreprocessedContext'); return undefined; }
function toInternalMessageSentContext() { _w('toInternalMessageSentContext'); return undefined; }

module.exports = {
  fireAndForgetHook,
  triggerInternalHook,
  registerInternalHook,
  unregisterInternalHook,
  clearInternalHooks,
  getRegisteredEventKeys,
  hasInternalHookListeners,
  createInternalHookEvent,
  isAgentBootstrapEvent,
  isGatewayStartupEvent,
  isMessageReceivedEvent,
  isMessageSentEvent,
  isMessageTranscribedEvent,
  isMessagePreprocessedEvent,
  isSessionPatchEvent,
  deriveInboundMessageHookContext,
  buildCanonicalSentMessageHookContext,
  toPluginMessageContext,
  toPluginInboundClaimContext,
  toPluginInboundClaimEvent,
  toPluginMessageReceivedEvent,
  toPluginMessageSentEvent,
  toInternalMessageReceivedContext,
  toInternalMessageTranscribedContext,
  toInternalMessagePreprocessedContext,
  toInternalMessageSentContext,
};
