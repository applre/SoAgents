// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/provider-setup.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/provider-setup.' + fn + '() not implemented in Bridge mode'); }
}

function applyProviderDefaultModel() { _w('applyProviderDefaultModel'); return undefined; }
function configureOpenAICompatibleSelfHostedProviderNonInteractive() { _w('configureOpenAICompatibleSelfHostedProviderNonInteractive'); return undefined; }
function discoverOpenAICompatibleSelfHostedProvider() { _w('discoverOpenAICompatibleSelfHostedProvider'); return undefined; }
function promptAndConfigureOpenAICompatibleSelfHostedProvider() { _w('promptAndConfigureOpenAICompatibleSelfHostedProvider'); return undefined; }
function promptAndConfigureOpenAICompatibleSelfHostedProviderAuth() { _w('promptAndConfigureOpenAICompatibleSelfHostedProviderAuth'); return undefined; }
const SELF_HOSTED_DEFAULT_CONTEXT_WINDOW = undefined;
const SELF_HOSTED_DEFAULT_COST = undefined;
const SELF_HOSTED_DEFAULT_MAX_TOKENS = undefined;
const OLLAMA_DEFAULT_BASE_URL = undefined;
const OLLAMA_DEFAULT_MODEL = undefined;
function buildOllamaProvider() { _w('buildOllamaProvider'); return undefined; }
function configureOllamaNonInteractive() { _w('configureOllamaNonInteractive'); return undefined; }
function ensureOllamaModelPulled() { _w('ensureOllamaModelPulled'); return undefined; }
function promptAndConfigureOllama() { _w('promptAndConfigureOllama'); return undefined; }
const VLLM_DEFAULT_BASE_URL = undefined;
const VLLM_DEFAULT_CONTEXT_WINDOW = undefined;
const VLLM_DEFAULT_COST = undefined;
const VLLM_DEFAULT_MAX_TOKENS = undefined;
function promptAndConfigureVllm() { _w('promptAndConfigureVllm'); return undefined; }
function buildSglangProvider() { _w('buildSglangProvider'); return undefined; }
function buildVllmProvider() { _w('buildVllmProvider'); return undefined; }

module.exports = {
  applyProviderDefaultModel,
  configureOpenAICompatibleSelfHostedProviderNonInteractive,
  discoverOpenAICompatibleSelfHostedProvider,
  promptAndConfigureOpenAICompatibleSelfHostedProvider,
  promptAndConfigureOpenAICompatibleSelfHostedProviderAuth,
  SELF_HOSTED_DEFAULT_CONTEXT_WINDOW,
  SELF_HOSTED_DEFAULT_COST,
  SELF_HOSTED_DEFAULT_MAX_TOKENS,
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_DEFAULT_MODEL,
  buildOllamaProvider,
  configureOllamaNonInteractive,
  ensureOllamaModelPulled,
  promptAndConfigureOllama,
  VLLM_DEFAULT_BASE_URL,
  VLLM_DEFAULT_CONTEXT_WINDOW,
  VLLM_DEFAULT_COST,
  VLLM_DEFAULT_MAX_TOKENS,
  promptAndConfigureVllm,
  buildSglangProvider,
  buildVllmProvider,
};
