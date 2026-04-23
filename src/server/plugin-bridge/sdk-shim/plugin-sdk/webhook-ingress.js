// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/webhook-ingress.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/webhook-ingress.' + fn + '() not implemented in Bridge mode'); }
}

function createBoundedCounter() { _w('createBoundedCounter'); return undefined; }
function createFixedWindowRateLimiter() { _w('createFixedWindowRateLimiter'); return undefined; }
function createWebhookAnomalyTracker() { _w('createWebhookAnomalyTracker'); return undefined; }
const WEBHOOK_ANOMALY_COUNTER_DEFAULTS = undefined;
const WEBHOOK_ANOMALY_STATUS_CODES = undefined;
const WEBHOOK_RATE_LIMIT_DEFAULTS = undefined;
function applyBasicWebhookRequestGuards() { _w('applyBasicWebhookRequestGuards'); return undefined; }
function beginWebhookRequestPipelineOrReject() { _w('beginWebhookRequestPipelineOrReject'); return undefined; }
function createWebhookInFlightLimiter() { _w('createWebhookInFlightLimiter'); return undefined; }
function isJsonContentType() { _w('isJsonContentType'); return false; }
function isRequestBodyLimitError() { _w('isRequestBodyLimitError'); return false; }
function readRequestBodyWithLimit() { _w('readRequestBodyWithLimit'); return undefined; }
function readJsonWebhookBodyOrReject() { _w('readJsonWebhookBodyOrReject'); return undefined; }
function readWebhookBodyOrReject() { _w('readWebhookBodyOrReject'); return undefined; }
function requestBodyErrorToText() { _w('requestBodyErrorToText'); return undefined; }
const WEBHOOK_BODY_READ_DEFAULTS = undefined;
const WEBHOOK_IN_FLIGHT_DEFAULTS = undefined;
function registerPluginHttpRoute() { _w('registerPluginHttpRoute'); return undefined; }
function registerWebhookTarget() { _w('registerWebhookTarget'); return undefined; }
function registerWebhookTargetWithPluginRoute() { _w('registerWebhookTargetWithPluginRoute'); return undefined; }
function resolveSingleWebhookTarget() { _w('resolveSingleWebhookTarget'); return undefined; }
function resolveSingleWebhookTargetAsync() { _w('resolveSingleWebhookTargetAsync'); return undefined; }
function resolveWebhookTargetWithAuthOrReject() { _w('resolveWebhookTargetWithAuthOrReject'); return undefined; }
function resolveWebhookTargetWithAuthOrRejectSync() { _w('resolveWebhookTargetWithAuthOrRejectSync'); return undefined; }
function resolveWebhookTargets() { _w('resolveWebhookTargets'); return undefined; }
function withResolvedWebhookRequestPipeline() { _w('withResolvedWebhookRequestPipeline'); return undefined; }
function normalizeWebhookPath() { _w('normalizeWebhookPath'); return ""; }
function resolveWebhookPath() { _w('resolveWebhookPath'); return undefined; }
function resolveRequestClientIp() { _w('resolveRequestClientIp'); return undefined; }
function normalizePluginHttpPath() { _w('normalizePluginHttpPath'); return ""; }

module.exports = {
  createBoundedCounter,
  createFixedWindowRateLimiter,
  createWebhookAnomalyTracker,
  WEBHOOK_ANOMALY_COUNTER_DEFAULTS,
  WEBHOOK_ANOMALY_STATUS_CODES,
  WEBHOOK_RATE_LIMIT_DEFAULTS,
  applyBasicWebhookRequestGuards,
  beginWebhookRequestPipelineOrReject,
  createWebhookInFlightLimiter,
  isJsonContentType,
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  readJsonWebhookBodyOrReject,
  readWebhookBodyOrReject,
  requestBodyErrorToText,
  WEBHOOK_BODY_READ_DEFAULTS,
  WEBHOOK_IN_FLIGHT_DEFAULTS,
  registerPluginHttpRoute,
  registerWebhookTarget,
  registerWebhookTargetWithPluginRoute,
  resolveSingleWebhookTarget,
  resolveSingleWebhookTargetAsync,
  resolveWebhookTargetWithAuthOrReject,
  resolveWebhookTargetWithAuthOrRejectSync,
  resolveWebhookTargets,
  withResolvedWebhookRequestPipeline,
  normalizeWebhookPath,
  resolveWebhookPath,
  resolveRequestClientIp,
  normalizePluginHttpPath,
};
