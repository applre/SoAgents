// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/provider-catalog.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/provider-catalog.' + fn + '() not implemented in Bridge mode'); }
}

function buildPairedProviderApiKeyCatalog() { _w('buildPairedProviderApiKeyCatalog'); return undefined; }
function buildSingleProviderApiKeyCatalog() { _w('buildSingleProviderApiKeyCatalog'); return undefined; }
function findCatalogTemplate() { _w('findCatalogTemplate'); return undefined; }
const ANTHROPIC_VERTEX_DEFAULT_MODEL_ID = undefined;
function buildAnthropicVertexProvider() { _w('buildAnthropicVertexProvider'); return undefined; }
function buildBytePlusCodingProvider() { _w('buildBytePlusCodingProvider'); return undefined; }
function buildBytePlusProvider() { _w('buildBytePlusProvider'); return undefined; }
function buildHuggingfaceProvider() { _w('buildHuggingfaceProvider'); return undefined; }
function buildKimiCodingProvider() { _w('buildKimiCodingProvider'); return undefined; }
function buildKilocodeProvider() { _w('buildKilocodeProvider'); return undefined; }
function buildKilocodeProviderWithDiscovery() { _w('buildKilocodeProviderWithDiscovery'); return undefined; }
function buildMinimaxPortalProvider() { _w('buildMinimaxPortalProvider'); return undefined; }
function buildMinimaxProvider() { _w('buildMinimaxProvider'); return undefined; }
const MODELSTUDIO_BASE_URL = undefined;
const MODELSTUDIO_DEFAULT_MODEL_ID = undefined;
function buildModelStudioProvider() { _w('buildModelStudioProvider'); return undefined; }
function buildMoonshotProvider() { _w('buildMoonshotProvider'); return undefined; }
function buildNvidiaProvider() { _w('buildNvidiaProvider'); return undefined; }
function buildOpenAICodexProvider() { _w('buildOpenAICodexProvider'); return undefined; }
function buildOpenrouterProvider() { _w('buildOpenrouterProvider'); return undefined; }
const QIANFAN_BASE_URL = undefined;
const QIANFAN_DEFAULT_MODEL_ID = undefined;
function buildQianfanProvider() { _w('buildQianfanProvider'); return undefined; }
function buildSyntheticProvider() { _w('buildSyntheticProvider'); return undefined; }
function buildTogetherProvider() { _w('buildTogetherProvider'); return undefined; }
function buildVeniceProvider() { _w('buildVeniceProvider'); return undefined; }
function buildVercelAiGatewayProvider() { _w('buildVercelAiGatewayProvider'); return undefined; }
function buildDoubaoCodingProvider() { _w('buildDoubaoCodingProvider'); return undefined; }
function buildDoubaoProvider() { _w('buildDoubaoProvider'); return undefined; }
const XIAOMI_DEFAULT_MODEL_ID = undefined;
function buildXiaomiProvider() { _w('buildXiaomiProvider'); return undefined; }

module.exports = {
  buildPairedProviderApiKeyCatalog,
  buildSingleProviderApiKeyCatalog,
  findCatalogTemplate,
  ANTHROPIC_VERTEX_DEFAULT_MODEL_ID,
  buildAnthropicVertexProvider,
  buildBytePlusCodingProvider,
  buildBytePlusProvider,
  buildHuggingfaceProvider,
  buildKimiCodingProvider,
  buildKilocodeProvider,
  buildKilocodeProviderWithDiscovery,
  buildMinimaxPortalProvider,
  buildMinimaxProvider,
  MODELSTUDIO_BASE_URL,
  MODELSTUDIO_DEFAULT_MODEL_ID,
  buildModelStudioProvider,
  buildMoonshotProvider,
  buildNvidiaProvider,
  buildOpenAICodexProvider,
  buildOpenrouterProvider,
  QIANFAN_BASE_URL,
  QIANFAN_DEFAULT_MODEL_ID,
  buildQianfanProvider,
  buildSyntheticProvider,
  buildTogetherProvider,
  buildVeniceProvider,
  buildVercelAiGatewayProvider,
  buildDoubaoCodingProvider,
  buildDoubaoProvider,
  XIAOMI_DEFAULT_MODEL_ID,
  buildXiaomiProvider,
};
