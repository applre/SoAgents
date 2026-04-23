// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/runtime.' + fn + '() not implemented in Bridge mode'); }
}

function createLoggerBackedRuntime() { _w('createLoggerBackedRuntime'); return undefined; }
function resolveRuntimeEnv() { _w('resolveRuntimeEnv'); return undefined; }
function resolveRuntimeEnvWithUnavailableExit() { _w('resolveRuntimeEnvWithUnavailableExit'); return undefined; }
function createNonExitingRuntime() { _w('createNonExitingRuntime'); return undefined; }
function defaultRuntime() { _w('defaultRuntime'); return undefined; }
function danger() { _w('danger'); return undefined; }
function info() { _w('info'); return undefined; }
function isVerbose() { _w('isVerbose'); return false; }
function isYes() { _w('isYes'); return false; }
function logVerbose() { _w('logVerbose'); return undefined; }
function logVerboseConsole() { _w('logVerboseConsole'); return undefined; }
function setVerbose() { _w('setVerbose'); return undefined; }
function setYes() { _w('setYes'); return undefined; }
function shouldLogVerbose() { _w('shouldLogVerbose'); return false; }
function success() { _w('success'); return undefined; }
function warn() { _w('warn'); return undefined; }
function waitForAbortSignal() { _w('waitForAbortSignal'); return undefined; }
function registerUnhandledRejectionHandler() { _w('registerUnhandledRejectionHandler'); return undefined; }
function enableConsoleCapture() { _w('enableConsoleCapture'); return undefined; }
function getConsoleSettings() { _w('getConsoleSettings'); return undefined; }
function getResolvedConsoleSettings() { _w('getResolvedConsoleSettings'); return undefined; }
function routeLogsToStderr() { _w('routeLogsToStderr'); return undefined; }
function setConsoleSubsystemFilter() { _w('setConsoleSubsystemFilter'); return undefined; }
function setConsoleConfigLoaderForTests() { _w('setConsoleConfigLoaderForTests'); return undefined; }
function setConsoleTimestampPrefix() { _w('setConsoleTimestampPrefix'); return undefined; }
function shouldLogSubsystemToConsole() { _w('shouldLogSubsystemToConsole'); return false; }
const ALLOWED_LOG_LEVELS = undefined;
function levelToMinLevel() { _w('levelToMinLevel'); return undefined; }
function normalizeLogLevel() { _w('normalizeLogLevel'); return ""; }
const DEFAULT_LOG_DIR = undefined;
const DEFAULT_LOG_FILE = undefined;
function getChildLogger() { _w('getChildLogger'); return undefined; }
function getLogger() { _w('getLogger'); return undefined; }
function getResolvedLoggerSettings() { _w('getResolvedLoggerSettings'); return undefined; }
function isFileLogLevelEnabled() { _w('isFileLogLevelEnabled'); return false; }
function resetLogger() { _w('resetLogger'); return undefined; }
function setLoggerOverride() { _w('setLoggerOverride'); return undefined; }
function toPinoLikeLogger() { _w('toPinoLikeLogger'); return undefined; }
function createSubsystemLogger() { _w('createSubsystemLogger'); return undefined; }
function createSubsystemRuntime() { _w('createSubsystemRuntime'); return undefined; }
function runtimeForLogger() { _w('runtimeForLogger'); return undefined; }
function stripRedundantSubsystemPrefixForConsole() { _w('stripRedundantSubsystemPrefixForConsole'); return ""; }

module.exports = {
  createLoggerBackedRuntime,
  resolveRuntimeEnv,
  resolveRuntimeEnvWithUnavailableExit,
  createNonExitingRuntime,
  defaultRuntime,
  danger,
  info,
  isVerbose,
  isYes,
  logVerbose,
  logVerboseConsole,
  setVerbose,
  setYes,
  shouldLogVerbose,
  success,
  warn,
  waitForAbortSignal,
  registerUnhandledRejectionHandler,
  enableConsoleCapture,
  getConsoleSettings,
  getResolvedConsoleSettings,
  routeLogsToStderr,
  setConsoleSubsystemFilter,
  setConsoleConfigLoaderForTests,
  setConsoleTimestampPrefix,
  shouldLogSubsystemToConsole,
  ALLOWED_LOG_LEVELS,
  levelToMinLevel,
  normalizeLogLevel,
  DEFAULT_LOG_DIR,
  DEFAULT_LOG_FILE,
  getChildLogger,
  getLogger,
  getResolvedLoggerSettings,
  isFileLogLevelEnabled,
  resetLogger,
  setLoggerOverride,
  toPinoLikeLogger,
  createSubsystemLogger,
  createSubsystemRuntime,
  runtimeForLogger,
  stripRedundantSubsystemPrefixForConsole,
};
