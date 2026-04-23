// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/provider-web-search.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/provider-web-search.' + fn + '() not implemented in Bridge mode'); }
}

function createPluginBackedWebSearchProvider() { _w('createPluginBackedWebSearchProvider'); return undefined; }
function jsonResult() { _w('jsonResult'); return undefined; }
function readNumberParam() { _w('readNumberParam'); return undefined; }
function readStringArrayParam() { _w('readStringArrayParam'); return undefined; }
function readStringParam() { _w('readStringParam'); return undefined; }
function resolveCitationRedirectUrl() { _w('resolveCitationRedirectUrl'); return undefined; }
function buildSearchCacheKey() { _w('buildSearchCacheKey'); return undefined; }
function buildUnsupportedSearchFilterResponse() { _w('buildUnsupportedSearchFilterResponse'); return undefined; }
const DEFAULT_SEARCH_COUNT = undefined;
const FRESHNESS_TO_RECENCY = undefined;
function isoToPerplexityDate() { _w('isoToPerplexityDate'); return undefined; }
const MAX_SEARCH_COUNT = undefined;
function normalizeFreshness() { _w('normalizeFreshness'); return ""; }
function normalizeToIsoDate() { _w('normalizeToIsoDate'); return ""; }
function parseIsoDateRange() { _w('parseIsoDateRange'); return undefined; }
function readCachedSearchPayload() { _w('readCachedSearchPayload'); return undefined; }
function readConfiguredSecretString() { _w('readConfiguredSecretString'); return undefined; }
function readProviderEnvValue() { _w('readProviderEnvValue'); return undefined; }
function resolveSearchCacheTtlMs() { _w('resolveSearchCacheTtlMs'); return undefined; }
function resolveSearchCount() { _w('resolveSearchCount'); return undefined; }
function resolveSearchTimeoutSeconds() { _w('resolveSearchTimeoutSeconds'); return undefined; }
function resolveSiteName() { _w('resolveSiteName'); return undefined; }
function postTrustedWebToolsJson() { _w('postTrustedWebToolsJson'); return undefined; }
function throwWebSearchApiError() { _w('throwWebSearchApiError'); return undefined; }
function withTrustedWebSearchEndpoint() { _w('withTrustedWebSearchEndpoint'); return undefined; }
function writeCachedSearchPayload() { _w('writeCachedSearchPayload'); return undefined; }
function getScopedCredentialValue() { _w('getScopedCredentialValue'); return undefined; }
function getTopLevelCredentialValue() { _w('getTopLevelCredentialValue'); return undefined; }
const mergeScopedSearchConfig = undefined;
const resolveProviderWebSearchPluginConfig = undefined;
function setScopedCredentialValue() { _w('setScopedCredentialValue'); return undefined; }
function setProviderWebSearchPluginConfigValue() { _w('setProviderWebSearchPluginConfigValue'); return undefined; }
function setTopLevelCredentialValue() { _w('setTopLevelCredentialValue'); return undefined; }
function resolveWebSearchProviderCredential() { _w('resolveWebSearchProviderCredential'); return undefined; }
function withTrustedWebToolsEndpoint() { _w('withTrustedWebToolsEndpoint'); return undefined; }
function markdownToText() { _w('markdownToText'); return undefined; }
function truncateText() { _w('truncateText'); return undefined; }
const DEFAULT_CACHE_TTL_MINUTES = undefined;
const DEFAULT_TIMEOUT_SECONDS = undefined;
function normalizeCacheKey() { _w('normalizeCacheKey'); return ""; }
function readCache() { _w('readCache'); return undefined; }
function readResponseText() { _w('readResponseText'); return undefined; }
function resolveCacheTtlMs() { _w('resolveCacheTtlMs'); return undefined; }
function resolveTimeoutSeconds() { _w('resolveTimeoutSeconds'); return undefined; }
function writeCache() { _w('writeCache'); return undefined; }
const enablePluginInConfig = undefined;
function formatCliCommand() { _w('formatCliCommand'); return ""; }
function wrapWebContent() { _w('wrapWebContent'); return undefined; }

module.exports = {
  createPluginBackedWebSearchProvider,
  jsonResult,
  readNumberParam,
  readStringArrayParam,
  readStringParam,
  resolveCitationRedirectUrl,
  buildSearchCacheKey,
  buildUnsupportedSearchFilterResponse,
  DEFAULT_SEARCH_COUNT,
  FRESHNESS_TO_RECENCY,
  isoToPerplexityDate,
  MAX_SEARCH_COUNT,
  normalizeFreshness,
  normalizeToIsoDate,
  parseIsoDateRange,
  readCachedSearchPayload,
  readConfiguredSecretString,
  readProviderEnvValue,
  resolveSearchCacheTtlMs,
  resolveSearchCount,
  resolveSearchTimeoutSeconds,
  resolveSiteName,
  postTrustedWebToolsJson,
  throwWebSearchApiError,
  withTrustedWebSearchEndpoint,
  writeCachedSearchPayload,
  getScopedCredentialValue,
  getTopLevelCredentialValue,
  mergeScopedSearchConfig,
  resolveProviderWebSearchPluginConfig,
  setScopedCredentialValue,
  setProviderWebSearchPluginConfigValue,
  setTopLevelCredentialValue,
  resolveWebSearchProviderCredential,
  withTrustedWebToolsEndpoint,
  markdownToText,
  truncateText,
  DEFAULT_CACHE_TTL_MINUTES,
  DEFAULT_TIMEOUT_SECONDS,
  normalizeCacheKey,
  readCache,
  readResponseText,
  resolveCacheTtlMs,
  resolveTimeoutSeconds,
  writeCache,
  enablePluginInConfig,
  formatCliCommand,
  wrapWebContent,
};
