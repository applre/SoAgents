// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/provider-onboard.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/provider-onboard.' + fn + '() not implemented in Bridge mode'); }
}

function applyAgentDefaultModelPrimary() { _w('applyAgentDefaultModelPrimary'); return undefined; }
function applyOnboardAuthAgentModelsAndProviders() { _w('applyOnboardAuthAgentModelsAndProviders'); return undefined; }
function createDefaultModelPresetAppliers() { _w('createDefaultModelPresetAppliers'); return undefined; }
function createDefaultModelsPresetAppliers() { _w('createDefaultModelsPresetAppliers'); return undefined; }
function createModelCatalogPresetAppliers() { _w('createModelCatalogPresetAppliers'); return undefined; }
function applyProviderConfigWithDefaultModelPreset() { _w('applyProviderConfigWithDefaultModelPreset'); return undefined; }
function applyProviderConfigWithDefaultModelsPreset() { _w('applyProviderConfigWithDefaultModelsPreset'); return undefined; }
function applyProviderConfigWithDefaultModel() { _w('applyProviderConfigWithDefaultModel'); return undefined; }
function applyProviderConfigWithDefaultModels() { _w('applyProviderConfigWithDefaultModels'); return undefined; }
function applyProviderConfigWithModelCatalogPreset() { _w('applyProviderConfigWithModelCatalogPreset'); return undefined; }
function applyProviderConfigWithModelCatalog() { _w('applyProviderConfigWithModelCatalog'); return undefined; }
function withAgentModelAliases() { _w('withAgentModelAliases'); return undefined; }
function ensureModelAllowlistEntry() { _w('ensureModelAllowlistEntry'); return undefined; }
const applyCloudflareAiGatewayConfig = undefined;
const applyCloudflareAiGatewayProviderConfig = undefined;
const CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_REF = undefined;
const applyVercelAiGatewayConfig = undefined;
const applyVercelAiGatewayProviderConfig = undefined;
const VERCEL_AI_GATEWAY_DEFAULT_MODEL_REF = undefined;

module.exports = {
  applyAgentDefaultModelPrimary,
  applyOnboardAuthAgentModelsAndProviders,
  createDefaultModelPresetAppliers,
  createDefaultModelsPresetAppliers,
  createModelCatalogPresetAppliers,
  applyProviderConfigWithDefaultModelPreset,
  applyProviderConfigWithDefaultModelsPreset,
  applyProviderConfigWithDefaultModel,
  applyProviderConfigWithDefaultModels,
  applyProviderConfigWithModelCatalogPreset,
  applyProviderConfigWithModelCatalog,
  withAgentModelAliases,
  ensureModelAllowlistEntry,
  applyCloudflareAiGatewayConfig,
  applyCloudflareAiGatewayProviderConfig,
  CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_REF,
  applyVercelAiGatewayConfig,
  applyVercelAiGatewayProviderConfig,
  VERCEL_AI_GATEWAY_DEFAULT_MODEL_REF,
};
