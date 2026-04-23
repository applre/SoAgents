// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/browser-support.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/browser-support.' + fn + '() not implemented in Bridge mode'); }
}

const loadConfig = undefined;
function createConfigIO() { _w('createConfigIO'); return undefined; }
function getRuntimeConfigSnapshot() { _w('getRuntimeConfigSnapshot'); return undefined; }
function writeConfigFile() { _w('writeConfigFile'); return undefined; }
function resolveGatewayPort() { _w('resolveGatewayPort'); return undefined; }
const DEFAULT_BROWSER_CONTROL_PORT = undefined;
function deriveDefaultBrowserCdpPortRange() { _w('deriveDefaultBrowserCdpPortRange'); return undefined; }
function deriveDefaultBrowserControlPort() { _w('deriveDefaultBrowserControlPort'); return undefined; }
function createSubsystemLogger() { _w('createSubsystemLogger'); return undefined; }
function redactSensitiveText() { _w('redactSensitiveText'); return undefined; }
function detectMime() { _w('detectMime'); return undefined; }
const IMAGE_REDUCE_QUALITY_STEPS = undefined;
function buildImageResizeSideGrid() { _w('buildImageResizeSideGrid'); return undefined; }
function getImageMetadata() { _w('getImageMetadata'); return undefined; }
function resizeToJpeg() { _w('resizeToJpeg'); return undefined; }
function ensureMediaDir() { _w('ensureMediaDir'); return undefined; }
function saveMediaBuffer() { _w('saveMediaBuffer'); return undefined; }
const normalizePluginsConfig = undefined;
function resolveEffectiveEnableState() { _w('resolveEffectiveEnableState'); return undefined; }
function startLazyPluginServiceModule() { _w('startLazyPluginServiceModule'); return undefined; }
function resolveGatewayAuth() { _w('resolveGatewayAuth'); return undefined; }
function isLoopbackHost() { _w('isLoopbackHost'); return false; }
function ensureGatewayStartupAuth() { _w('ensureGatewayStartupAuth'); return undefined; }
function imageResultFromFile() { _w('imageResultFromFile'); return undefined; }
function jsonResult() { _w('jsonResult'); return undefined; }
function readStringParam() { _w('readStringParam'); return undefined; }
function callGatewayTool() { _w('callGatewayTool'); return undefined; }
function listNodes() { _w('listNodes'); return []; }
function resolveNodeIdFromList() { _w('resolveNodeIdFromList'); return undefined; }
function selectDefaultNodeFromList() { _w('selectDefaultNodeFromList'); return undefined; }
function danger() { _w('danger'); return undefined; }
function info() { _w('info'); return undefined; }
function defaultRuntime() { _w('defaultRuntime'); return undefined; }
function wrapExternalContent() { _w('wrapExternalContent'); return undefined; }
function safeEqualSecret() { _w('safeEqualSecret'); return undefined; }
function optionalStringEnum() { _w('optionalStringEnum'); return undefined; }
function stringEnum() { _w('stringEnum'); return undefined; }
function formatDocsLink() { _w('formatDocsLink'); return ""; }
function theme() { _w('theme'); return undefined; }
const CONFIG_DIR = undefined;
function escapeRegExp() { _w('escapeRegExp'); return undefined; }
function resolveUserPath() { _w('resolveUserPath'); return undefined; }
function shortenHomePath() { _w('shortenHomePath'); return undefined; }
function parseBooleanValue() { _w('parseBooleanValue'); return undefined; }
function formatCliCommand() { _w('formatCliCommand'); return ""; }
function runCommandWithRuntime() { _w('runCommandWithRuntime'); return undefined; }
function inheritOptionFromParent() { _w('inheritOptionFromParent'); return undefined; }
function addGatewayClientOptions() { _w('addGatewayClientOptions'); return undefined; }
function callGatewayFromCli() { _w('callGatewayFromCli'); return undefined; }
function formatHelpExamples() { _w('formatHelpExamples'); return ""; }
function withTimeout() { _w('withTimeout'); return undefined; }
function isNodeCommandAllowed() { _w('isNodeCommandAllowed'); return false; }
function resolveNodeCommandAllowlist() { _w('resolveNodeCommandAllowlist'); return undefined; }
function ErrorCodes() { _w('ErrorCodes'); return undefined; }
function errorShape() { _w('errorShape'); return undefined; }
function respondUnavailableOnNodeInvokeError() { _w('respondUnavailableOnNodeInvokeError'); return undefined; }
function safeParseJson() { _w('safeParseJson'); return undefined; }
function extractErrorCode() { _w('extractErrorCode'); return undefined; }
function formatErrorMessage() { _w('formatErrorMessage'); return ""; }
function SafeOpenError() { _w('SafeOpenError'); return undefined; }
function openFileWithinRoot() { _w('openFileWithinRoot'); return undefined; }
function writeFileFromPathWithinRoot() { _w('writeFileFromPathWithinRoot'); return undefined; }
function hasProxyEnvConfigured() { _w('hasProxyEnvConfigured'); return false; }
function SsrFBlockedError() { _w('SsrFBlockedError'); return undefined; }
function isPrivateNetworkAllowedByPolicy() { _w('isPrivateNetworkAllowedByPolicy'); return false; }
function resolvePinnedHostnameWithPolicy() { _w('resolvePinnedHostnameWithPolicy'); return undefined; }
function isNotFoundPathError() { _w('isNotFoundPathError'); return false; }
function isPathInside() { _w('isPathInside'); return false; }
function ensurePortAvailable() { _w('ensurePortAvailable'); return undefined; }
function generateSecureToken() { _w('generateSecureToken'); return undefined; }
function resolvePreferredOpenClawTmpDir() { _w('resolvePreferredOpenClawTmpDir'); return undefined; }
function rawDataToString() { _w('rawDataToString'); return undefined; }
function runExec() { _w('runExec'); return undefined; }
function withFetchPreconnect() { _w('withFetchPreconnect'); return undefined; }

module.exports = {
  loadConfig,
  createConfigIO,
  getRuntimeConfigSnapshot,
  writeConfigFile,
  resolveGatewayPort,
  DEFAULT_BROWSER_CONTROL_PORT,
  deriveDefaultBrowserCdpPortRange,
  deriveDefaultBrowserControlPort,
  createSubsystemLogger,
  redactSensitiveText,
  detectMime,
  IMAGE_REDUCE_QUALITY_STEPS,
  buildImageResizeSideGrid,
  getImageMetadata,
  resizeToJpeg,
  ensureMediaDir,
  saveMediaBuffer,
  normalizePluginsConfig,
  resolveEffectiveEnableState,
  startLazyPluginServiceModule,
  resolveGatewayAuth,
  isLoopbackHost,
  ensureGatewayStartupAuth,
  imageResultFromFile,
  jsonResult,
  readStringParam,
  callGatewayTool,
  listNodes,
  resolveNodeIdFromList,
  selectDefaultNodeFromList,
  danger,
  info,
  defaultRuntime,
  wrapExternalContent,
  safeEqualSecret,
  optionalStringEnum,
  stringEnum,
  formatDocsLink,
  theme,
  CONFIG_DIR,
  escapeRegExp,
  resolveUserPath,
  shortenHomePath,
  parseBooleanValue,
  formatCliCommand,
  runCommandWithRuntime,
  inheritOptionFromParent,
  addGatewayClientOptions,
  callGatewayFromCli,
  formatHelpExamples,
  withTimeout,
  isNodeCommandAllowed,
  resolveNodeCommandAllowlist,
  ErrorCodes,
  errorShape,
  respondUnavailableOnNodeInvokeError,
  safeParseJson,
  extractErrorCode,
  formatErrorMessage,
  SafeOpenError,
  openFileWithinRoot,
  writeFileFromPathWithinRoot,
  hasProxyEnvConfigured,
  SsrFBlockedError,
  isPrivateNetworkAllowedByPolicy,
  resolvePinnedHostnameWithPolicy,
  isNotFoundPathError,
  isPathInside,
  ensurePortAvailable,
  generateSecureToken,
  resolvePreferredOpenClawTmpDir,
  rawDataToString,
  runExec,
  withFetchPreconnect,
};
