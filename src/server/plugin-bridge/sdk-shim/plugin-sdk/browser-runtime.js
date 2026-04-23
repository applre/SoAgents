// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/browser-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/browser-runtime.' + fn + '() not implemented in Bridge mode'); }
}

function startBrowserBridgeServer() { _w('startBrowserBridgeServer'); return undefined; }
function stopBrowserBridgeServer() { _w('stopBrowserBridgeServer'); return undefined; }
function browserAct() { _w('browserAct'); return undefined; }
function browserArmDialog() { _w('browserArmDialog'); return undefined; }
function browserArmFileChooser() { _w('browserArmFileChooser'); return undefined; }
function browserConsoleMessages() { _w('browserConsoleMessages'); return undefined; }
function browserNavigate() { _w('browserNavigate'); return undefined; }
function browserPdfSave() { _w('browserPdfSave'); return undefined; }
function browserScreenshotAction() { _w('browserScreenshotAction'); return undefined; }
function browserCloseTab() { _w('browserCloseTab'); return undefined; }
function browserFocusTab() { _w('browserFocusTab'); return undefined; }
function browserOpenTab() { _w('browserOpenTab'); return undefined; }
function browserCreateProfile() { _w('browserCreateProfile'); return undefined; }
function browserDeleteProfile() { _w('browserDeleteProfile'); return undefined; }
function browserProfiles() { _w('browserProfiles'); return undefined; }
function browserResetProfile() { _w('browserResetProfile'); return undefined; }
function browserSnapshot() { _w('browserSnapshot'); return undefined; }
function browserStart() { _w('browserStart'); return undefined; }
function browserStatus() { _w('browserStatus'); return undefined; }
function browserStop() { _w('browserStop'); return undefined; }
function browserTabAction() { _w('browserTabAction'); return undefined; }
function browserTabs() { _w('browserTabs'); return undefined; }
function runBrowserProxyCommand() { _w('runBrowserProxyCommand'); return undefined; }
const resolveBrowserConfig = undefined;
function resolveProfile() { _w('resolveProfile'); return undefined; }
const DEFAULT_AI_SNAPSHOT_MAX_CHARS = undefined;
const DEFAULT_BROWSER_EVALUATE_ENABLED = undefined;
const DEFAULT_OPENCLAW_BROWSER_COLOR = undefined;
const DEFAULT_OPENCLAW_BROWSER_PROFILE_NAME = undefined;
function parseBrowserMajorVersion() { _w('parseBrowserMajorVersion'); return undefined; }
function readBrowserVersion() { _w('readBrowserVersion'); return undefined; }
function resolveGoogleChromeExecutableForPlatform() { _w('resolveGoogleChromeExecutableForPlatform'); return undefined; }
function redactCdpUrl() { _w('redactCdpUrl'); return undefined; }
const DEFAULT_UPLOAD_DIR = undefined;
function resolveExistingPathsWithinRoot() { _w('resolveExistingPathsWithinRoot'); return undefined; }
function getBrowserProfileCapabilities() { _w('getBrowserProfileCapabilities'); return undefined; }
function applyBrowserProxyPaths() { _w('applyBrowserProxyPaths'); return undefined; }
function persistBrowserProxyFiles() { _w('persistBrowserProxyFiles'); return undefined; }
function isPersistentBrowserProfileMutation() { _w('isPersistentBrowserProfileMutation'); return false; }
function normalizeBrowserRequestPath() { _w('normalizeBrowserRequestPath'); return ""; }
function resolveRequestedBrowserProfile() { _w('resolveRequestedBrowserProfile'); return undefined; }
function closeTrackedBrowserTabsForSessions() { _w('closeTrackedBrowserTabsForSessions'); return undefined; }
function trackSessionBrowserTab() { _w('trackSessionBrowserTab'); return undefined; }
function untrackSessionBrowserTab() { _w('untrackSessionBrowserTab'); return undefined; }
function ensureBrowserControlAuth() { _w('ensureBrowserControlAuth'); return undefined; }
function resolveBrowserControlAuth() { _w('resolveBrowserControlAuth'); return undefined; }
function movePathToTrash() { _w('movePathToTrash'); return undefined; }
function createBrowserControlContext() { _w('createBrowserControlContext'); return undefined; }
function getBrowserControlState() { _w('getBrowserControlState'); return undefined; }
const startBrowserControlServiceFromConfig = undefined;
function stopBrowserControlService() { _w('stopBrowserControlService'); return undefined; }
function createBrowserRuntimeState() { _w('createBrowserRuntimeState'); return undefined; }
function stopBrowserRuntime() { _w('stopBrowserRuntime'); return undefined; }
function createBrowserRouteContext() { _w('createBrowserRouteContext'); return undefined; }
function registerBrowserRoutes() { _w('registerBrowserRoutes'); return undefined; }
function createBrowserRouteDispatcher() { _w('createBrowserRouteDispatcher'); return undefined; }
function installBrowserAuthMiddleware() { _w('installBrowserAuthMiddleware'); return undefined; }
function installBrowserCommonMiddleware() { _w('installBrowserCommonMiddleware'); return undefined; }
function normalizeBrowserFormField() { _w('normalizeBrowserFormField'); return ""; }
function normalizeBrowserFormFieldValue() { _w('normalizeBrowserFormFieldValue'); return ""; }

module.exports = {
  startBrowserBridgeServer,
  stopBrowserBridgeServer,
  browserAct,
  browserArmDialog,
  browserArmFileChooser,
  browserConsoleMessages,
  browserNavigate,
  browserPdfSave,
  browserScreenshotAction,
  browserCloseTab,
  browserFocusTab,
  browserOpenTab,
  browserCreateProfile,
  browserDeleteProfile,
  browserProfiles,
  browserResetProfile,
  browserSnapshot,
  browserStart,
  browserStatus,
  browserStop,
  browserTabAction,
  browserTabs,
  runBrowserProxyCommand,
  resolveBrowserConfig,
  resolveProfile,
  DEFAULT_AI_SNAPSHOT_MAX_CHARS,
  DEFAULT_BROWSER_EVALUATE_ENABLED,
  DEFAULT_OPENCLAW_BROWSER_COLOR,
  DEFAULT_OPENCLAW_BROWSER_PROFILE_NAME,
  parseBrowserMajorVersion,
  readBrowserVersion,
  resolveGoogleChromeExecutableForPlatform,
  redactCdpUrl,
  DEFAULT_UPLOAD_DIR,
  resolveExistingPathsWithinRoot,
  getBrowserProfileCapabilities,
  applyBrowserProxyPaths,
  persistBrowserProxyFiles,
  isPersistentBrowserProfileMutation,
  normalizeBrowserRequestPath,
  resolveRequestedBrowserProfile,
  closeTrackedBrowserTabsForSessions,
  trackSessionBrowserTab,
  untrackSessionBrowserTab,
  ensureBrowserControlAuth,
  resolveBrowserControlAuth,
  movePathToTrash,
  createBrowserControlContext,
  getBrowserControlState,
  startBrowserControlServiceFromConfig,
  stopBrowserControlService,
  createBrowserRuntimeState,
  stopBrowserRuntime,
  createBrowserRouteContext,
  registerBrowserRoutes,
  createBrowserRouteDispatcher,
  installBrowserAuthMiddleware,
  installBrowserCommonMiddleware,
  normalizeBrowserFormField,
  normalizeBrowserFormFieldValue,
};
