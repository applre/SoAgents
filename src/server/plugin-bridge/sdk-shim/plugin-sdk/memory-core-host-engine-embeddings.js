// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/memory-core-host-engine-embeddings.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/memory-core-host-engine-embeddings.' + fn + '() not implemented in Bridge mode'); }
}

function getMemoryEmbeddingProvider() { _w('getMemoryEmbeddingProvider'); return undefined; }
function listMemoryEmbeddingProviders() { _w('listMemoryEmbeddingProviders'); return []; }
function createLocalEmbeddingProvider() { _w('createLocalEmbeddingProvider'); return undefined; }
const DEFAULT_LOCAL_MODEL = undefined;
function createGeminiEmbeddingProvider() { _w('createGeminiEmbeddingProvider'); return undefined; }
const DEFAULT_GEMINI_EMBEDDING_MODEL = undefined;
function buildGeminiEmbeddingRequest() { _w('buildGeminiEmbeddingRequest'); return undefined; }
function createMistralEmbeddingProvider() { _w('createMistralEmbeddingProvider'); return undefined; }
const DEFAULT_MISTRAL_EMBEDDING_MODEL = undefined;
function createOllamaEmbeddingProvider() { _w('createOllamaEmbeddingProvider'); return undefined; }
const DEFAULT_OLLAMA_EMBEDDING_MODEL = undefined;
function createOpenAiEmbeddingProvider() { _w('createOpenAiEmbeddingProvider'); return undefined; }
const DEFAULT_OPENAI_EMBEDDING_MODEL = undefined;
function createVoyageEmbeddingProvider() { _w('createVoyageEmbeddingProvider'); return undefined; }
const DEFAULT_VOYAGE_EMBEDDING_MODEL = undefined;
function runGeminiEmbeddingBatches() { _w('runGeminiEmbeddingBatches'); return undefined; }
const OPENAI_BATCH_ENDPOINT = undefined;
function runOpenAiEmbeddingBatches() { _w('runOpenAiEmbeddingBatches'); return undefined; }
function runVoyageEmbeddingBatches() { _w('runVoyageEmbeddingBatches'); return undefined; }
function enforceEmbeddingMaxInputTokens() { _w('enforceEmbeddingMaxInputTokens'); return undefined; }
function estimateStructuredEmbeddingInputBytes() { _w('estimateStructuredEmbeddingInputBytes'); return undefined; }
function estimateUtf8Bytes() { _w('estimateUtf8Bytes'); return undefined; }
function hasNonTextEmbeddingParts() { _w('hasNonTextEmbeddingParts'); return false; }
function buildCaseInsensitiveExtensionGlob() { _w('buildCaseInsensitiveExtensionGlob'); return undefined; }
function classifyMemoryMultimodalPath() { _w('classifyMemoryMultimodalPath'); return undefined; }
function getMemoryMultimodalExtensions() { _w('getMemoryMultimodalExtensions'); return undefined; }

module.exports = {
  getMemoryEmbeddingProvider,
  listMemoryEmbeddingProviders,
  createLocalEmbeddingProvider,
  DEFAULT_LOCAL_MODEL,
  createGeminiEmbeddingProvider,
  DEFAULT_GEMINI_EMBEDDING_MODEL,
  buildGeminiEmbeddingRequest,
  createMistralEmbeddingProvider,
  DEFAULT_MISTRAL_EMBEDDING_MODEL,
  createOllamaEmbeddingProvider,
  DEFAULT_OLLAMA_EMBEDDING_MODEL,
  createOpenAiEmbeddingProvider,
  DEFAULT_OPENAI_EMBEDDING_MODEL,
  createVoyageEmbeddingProvider,
  DEFAULT_VOYAGE_EMBEDDING_MODEL,
  runGeminiEmbeddingBatches,
  OPENAI_BATCH_ENDPOINT,
  runOpenAiEmbeddingBatches,
  runVoyageEmbeddingBatches,
  enforceEmbeddingMaxInputTokens,
  estimateStructuredEmbeddingInputBytes,
  estimateUtf8Bytes,
  hasNonTextEmbeddingParts,
  buildCaseInsensitiveExtensionGlob,
  classifyMemoryMultimodalPath,
  getMemoryMultimodalExtensions,
};
