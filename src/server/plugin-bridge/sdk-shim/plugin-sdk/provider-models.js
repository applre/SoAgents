// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/provider-models.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/provider-models.' + fn + '() not implemented in Bridge mode'); }
}

function buildKilocodeModelDefinition() { _w('buildKilocodeModelDefinition'); return undefined; }
const DEFAULT_CONTEXT_TOKENS = undefined;
function applyXaiModelCompat() { _w('applyXaiModelCompat'); return undefined; }
function hasNativeWebSearchTool() { _w('hasNativeWebSearchTool'); return false; }
const HTML_ENTITY_TOOL_CALL_ARGUMENTS_ENCODING = undefined;
function normalizeModelCompat() { _w('normalizeModelCompat'); return ""; }
function resolveToolCallArgumentsEncoding() { _w('resolveToolCallArgumentsEncoding'); return undefined; }
function usesXaiToolSchemaProfile() { _w('usesXaiToolSchemaProfile'); return undefined; }
const XAI_TOOL_SCHEMA_PROFILE = undefined;
function normalizeProviderId() { _w('normalizeProviderId'); return ""; }
function normalizeXaiModelId() { _w('normalizeXaiModelId'); return ""; }
function createMoonshotThinkingWrapper() { _w('createMoonshotThinkingWrapper'); return undefined; }
function resolveMoonshotThinkingType() { _w('resolveMoonshotThinkingType'); return undefined; }
function cloneFirstTemplateModel() { _w('cloneFirstTemplateModel'); return undefined; }
function matchesExactOrPrefix() { _w('matchesExactOrPrefix'); return undefined; }
const MINIMAX_DEFAULT_MODEL_ID = undefined;
const MINIMAX_DEFAULT_MODEL_REF = undefined;
const MINIMAX_TEXT_MODEL_CATALOG = undefined;
const MINIMAX_TEXT_MODEL_ORDER = undefined;
const MINIMAX_TEXT_MODEL_REFS = undefined;
function isMiniMaxModernModelId() { _w('isMiniMaxModernModelId'); return false; }
function applyGoogleGeminiModelDefault() { _w('applyGoogleGeminiModelDefault'); return undefined; }
const GOOGLE_GEMINI_DEFAULT_MODEL = undefined;
const applyOpenAIConfig = undefined;
const OPENAI_CODEX_DEFAULT_MODEL = undefined;
const OPENAI_DEFAULT_AUDIO_TRANSCRIPTION_MODEL = undefined;
const OPENAI_DEFAULT_EMBEDDING_MODEL = undefined;
const OPENAI_DEFAULT_IMAGE_MODEL = undefined;
const OPENAI_DEFAULT_MODEL = undefined;
const OPENAI_DEFAULT_TTS_MODEL = undefined;
const OPENAI_DEFAULT_TTS_VOICE = undefined;
const OPENCODE_GO_DEFAULT_MODEL_REF = undefined;
const OPENCODE_ZEN_DEFAULT_MODEL = undefined;
const OPENCODE_ZEN_DEFAULT_MODEL_REF = undefined;
function buildCloudflareAiGatewayModelDefinition() { _w('buildCloudflareAiGatewayModelDefinition'); return undefined; }
const CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_REF = undefined;
function resolveCloudflareAiGatewayBaseUrl() { _w('resolveCloudflareAiGatewayBaseUrl'); return undefined; }
function resolveAnthropicVertexRegion() { _w('resolveAnthropicVertexRegion'); return undefined; }
function discoverHuggingfaceModels() { _w('discoverHuggingfaceModels'); return undefined; }
const HUGGINGFACE_BASE_URL = undefined;
const HUGGINGFACE_MODEL_CATALOG = undefined;
function buildHuggingfaceModelDefinition() { _w('buildHuggingfaceModelDefinition'); return undefined; }
function discoverKilocodeModels() { _w('discoverKilocodeModels'); return undefined; }
function buildChutesModelDefinition() { _w('buildChutesModelDefinition'); return undefined; }
const CHUTES_BASE_URL = undefined;
const CHUTES_DEFAULT_MODEL_ID = undefined;
const CHUTES_DEFAULT_MODEL_REF = undefined;
const CHUTES_MODEL_CATALOG = undefined;
function discoverChutesModels() { _w('discoverChutesModels'); return undefined; }
function buildOllamaModelDefinition() { _w('buildOllamaModelDefinition'); return undefined; }
function enrichOllamaModelsWithContext() { _w('enrichOllamaModelsWithContext'); return undefined; }
function fetchOllamaModels() { _w('fetchOllamaModels'); return undefined; }
function queryOllamaContextWindow() { _w('queryOllamaContextWindow'); return undefined; }
function resolveOllamaApiBase() { _w('resolveOllamaApiBase'); return undefined; }
function buildSyntheticModelDefinition() { _w('buildSyntheticModelDefinition'); return undefined; }
const SYNTHETIC_BASE_URL = undefined;
const SYNTHETIC_DEFAULT_MODEL_REF = undefined;
const SYNTHETIC_MODEL_CATALOG = undefined;
function buildDeepSeekModelDefinition() { _w('buildDeepSeekModelDefinition'); return undefined; }
const DEEPSEEK_BASE_URL = undefined;
const DEEPSEEK_MODEL_CATALOG = undefined;
function buildTogetherModelDefinition() { _w('buildTogetherModelDefinition'); return undefined; }
const TOGETHER_BASE_URL = undefined;
const TOGETHER_MODEL_CATALOG = undefined;
function discoverVeniceModels() { _w('discoverVeniceModels'); return undefined; }
const VENICE_BASE_URL = undefined;
const VENICE_DEFAULT_MODEL_REF = undefined;
const VENICE_MODEL_CATALOG = undefined;
function buildVeniceModelDefinition() { _w('buildVeniceModelDefinition'); return undefined; }
const BYTEPLUS_BASE_URL = undefined;
const BYTEPLUS_CODING_BASE_URL = undefined;
const BYTEPLUS_CODING_MODEL_CATALOG = undefined;
const BYTEPLUS_MODEL_CATALOG = undefined;
function buildBytePlusModelDefinition() { _w('buildBytePlusModelDefinition'); return undefined; }
const DOUBAO_BASE_URL = undefined;
const DOUBAO_CODING_BASE_URL = undefined;
const DOUBAO_CODING_MODEL_CATALOG = undefined;
const DOUBAO_MODEL_CATALOG = undefined;
function buildDoubaoModelDefinition() { _w('buildDoubaoModelDefinition'); return undefined; }
const OLLAMA_DEFAULT_BASE_URL = undefined;
const OLLAMA_DEFAULT_CONTEXT_WINDOW = undefined;
const OLLAMA_DEFAULT_COST = undefined;
const OLLAMA_DEFAULT_MAX_TOKENS = undefined;
const VLLM_DEFAULT_BASE_URL = undefined;
const SGLANG_DEFAULT_BASE_URL = undefined;
const KILOCODE_BASE_URL = undefined;
const KILOCODE_DEFAULT_CONTEXT_WINDOW = undefined;
const KILOCODE_DEFAULT_COST = undefined;
const KILOCODE_DEFAULT_MODEL_REF = undefined;
const KILOCODE_DEFAULT_MAX_TOKENS = undefined;
const KILOCODE_DEFAULT_MODEL_ID = undefined;
const KILOCODE_DEFAULT_MODEL_NAME = undefined;
const KILOCODE_MODEL_CATALOG = undefined;
function discoverVercelAiGatewayModels() { _w('discoverVercelAiGatewayModels'); return undefined; }
const VERCEL_AI_GATEWAY_BASE_URL = undefined;
function buildModelStudioDefaultModelDefinition() { _w('buildModelStudioDefaultModelDefinition'); return undefined; }
function buildModelStudioModelDefinition() { _w('buildModelStudioModelDefinition'); return undefined; }
const MODELSTUDIO_CN_BASE_URL = undefined;
const MODELSTUDIO_DEFAULT_COST = undefined;
const MODELSTUDIO_DEFAULT_MODEL_ID = undefined;
const MODELSTUDIO_DEFAULT_MODEL_REF = undefined;
const MODELSTUDIO_GLOBAL_BASE_URL = undefined;

module.exports = {
  buildKilocodeModelDefinition,
  DEFAULT_CONTEXT_TOKENS,
  applyXaiModelCompat,
  hasNativeWebSearchTool,
  HTML_ENTITY_TOOL_CALL_ARGUMENTS_ENCODING,
  normalizeModelCompat,
  resolveToolCallArgumentsEncoding,
  usesXaiToolSchemaProfile,
  XAI_TOOL_SCHEMA_PROFILE,
  normalizeProviderId,
  normalizeXaiModelId,
  createMoonshotThinkingWrapper,
  resolveMoonshotThinkingType,
  cloneFirstTemplateModel,
  matchesExactOrPrefix,
  MINIMAX_DEFAULT_MODEL_ID,
  MINIMAX_DEFAULT_MODEL_REF,
  MINIMAX_TEXT_MODEL_CATALOG,
  MINIMAX_TEXT_MODEL_ORDER,
  MINIMAX_TEXT_MODEL_REFS,
  isMiniMaxModernModelId,
  applyGoogleGeminiModelDefault,
  GOOGLE_GEMINI_DEFAULT_MODEL,
  applyOpenAIConfig,
  OPENAI_CODEX_DEFAULT_MODEL,
  OPENAI_DEFAULT_AUDIO_TRANSCRIPTION_MODEL,
  OPENAI_DEFAULT_EMBEDDING_MODEL,
  OPENAI_DEFAULT_IMAGE_MODEL,
  OPENAI_DEFAULT_MODEL,
  OPENAI_DEFAULT_TTS_MODEL,
  OPENAI_DEFAULT_TTS_VOICE,
  OPENCODE_GO_DEFAULT_MODEL_REF,
  OPENCODE_ZEN_DEFAULT_MODEL,
  OPENCODE_ZEN_DEFAULT_MODEL_REF,
  buildCloudflareAiGatewayModelDefinition,
  CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_REF,
  resolveCloudflareAiGatewayBaseUrl,
  resolveAnthropicVertexRegion,
  discoverHuggingfaceModels,
  HUGGINGFACE_BASE_URL,
  HUGGINGFACE_MODEL_CATALOG,
  buildHuggingfaceModelDefinition,
  discoverKilocodeModels,
  buildChutesModelDefinition,
  CHUTES_BASE_URL,
  CHUTES_DEFAULT_MODEL_ID,
  CHUTES_DEFAULT_MODEL_REF,
  CHUTES_MODEL_CATALOG,
  discoverChutesModels,
  buildOllamaModelDefinition,
  enrichOllamaModelsWithContext,
  fetchOllamaModels,
  queryOllamaContextWindow,
  resolveOllamaApiBase,
  buildSyntheticModelDefinition,
  SYNTHETIC_BASE_URL,
  SYNTHETIC_DEFAULT_MODEL_REF,
  SYNTHETIC_MODEL_CATALOG,
  buildDeepSeekModelDefinition,
  DEEPSEEK_BASE_URL,
  DEEPSEEK_MODEL_CATALOG,
  buildTogetherModelDefinition,
  TOGETHER_BASE_URL,
  TOGETHER_MODEL_CATALOG,
  discoverVeniceModels,
  VENICE_BASE_URL,
  VENICE_DEFAULT_MODEL_REF,
  VENICE_MODEL_CATALOG,
  buildVeniceModelDefinition,
  BYTEPLUS_BASE_URL,
  BYTEPLUS_CODING_BASE_URL,
  BYTEPLUS_CODING_MODEL_CATALOG,
  BYTEPLUS_MODEL_CATALOG,
  buildBytePlusModelDefinition,
  DOUBAO_BASE_URL,
  DOUBAO_CODING_BASE_URL,
  DOUBAO_CODING_MODEL_CATALOG,
  DOUBAO_MODEL_CATALOG,
  buildDoubaoModelDefinition,
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_DEFAULT_CONTEXT_WINDOW,
  OLLAMA_DEFAULT_COST,
  OLLAMA_DEFAULT_MAX_TOKENS,
  VLLM_DEFAULT_BASE_URL,
  SGLANG_DEFAULT_BASE_URL,
  KILOCODE_BASE_URL,
  KILOCODE_DEFAULT_CONTEXT_WINDOW,
  KILOCODE_DEFAULT_COST,
  KILOCODE_DEFAULT_MODEL_REF,
  KILOCODE_DEFAULT_MAX_TOKENS,
  KILOCODE_DEFAULT_MODEL_ID,
  KILOCODE_DEFAULT_MODEL_NAME,
  KILOCODE_MODEL_CATALOG,
  discoverVercelAiGatewayModels,
  VERCEL_AI_GATEWAY_BASE_URL,
  buildModelStudioDefaultModelDefinition,
  buildModelStudioModelDefinition,
  MODELSTUDIO_CN_BASE_URL,
  MODELSTUDIO_DEFAULT_COST,
  MODELSTUDIO_DEFAULT_MODEL_ID,
  MODELSTUDIO_DEFAULT_MODEL_REF,
  MODELSTUDIO_GLOBAL_BASE_URL,
};
