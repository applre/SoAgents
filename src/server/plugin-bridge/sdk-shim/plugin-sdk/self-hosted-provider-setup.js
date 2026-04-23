// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/self-hosted-provider-setup.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/self-hosted-provider-setup.' + fn + '() not implemented in Bridge mode'); }
}

function applyProviderDefaultModel() { _w('applyProviderDefaultModel'); return undefined; }
function configureOpenAICompatibleSelfHostedProviderNonInteractive() { _w('configureOpenAICompatibleSelfHostedProviderNonInteractive'); return undefined; }
function discoverOpenAICompatibleSelfHostedProvider() { _w('discoverOpenAICompatibleSelfHostedProvider'); return undefined; }
function promptAndConfigureOpenAICompatibleSelfHostedProvider() { _w('promptAndConfigureOpenAICompatibleSelfHostedProvider'); return undefined; }
function promptAndConfigureOpenAICompatibleSelfHostedProviderAuth() { _w('promptAndConfigureOpenAICompatibleSelfHostedProviderAuth'); return undefined; }
const SELF_HOSTED_DEFAULT_CONTEXT_WINDOW = undefined;
const SELF_HOSTED_DEFAULT_COST = undefined;
const SELF_HOSTED_DEFAULT_MAX_TOKENS = undefined;
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
  buildSglangProvider,
  buildVllmProvider,
};
