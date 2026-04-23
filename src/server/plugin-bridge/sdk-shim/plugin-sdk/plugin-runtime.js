// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/plugin-runtime.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/plugin-runtime.' + fn + '() not implemented in Bridge mode'); }
}

async function executePluginCommand() { _w('executePluginCommand'); return undefined; }
function matchPluginCommand() { _w('matchPluginCommand'); return undefined; }
function listPluginCommands() { _w('listPluginCommands'); return []; }
const __testing = undefined;
function clearPluginCommands() { _w('clearPluginCommands'); return undefined; }
function clearPluginCommandsForPlugin() { _w('clearPluginCommandsForPlugin'); return undefined; }
function getPluginCommandSpecs() { _w('getPluginCommandSpecs'); return undefined; }
function registerPluginCommand() { _w('registerPluginCommand'); return undefined; }
function validateCommandName() { _w('validateCommandName'); return undefined; }
function validatePluginCommandDefinition() { _w('validatePluginCommandDefinition'); return undefined; }
async function runGlobalGatewayStopSafely() { _w('runGlobalGatewayStopSafely'); return undefined; }
function initializeGlobalHookRunner() { _w('initializeGlobalHookRunner'); return undefined; }
function getGlobalHookRunner() { _w('getGlobalHookRunner'); return undefined; }
function getGlobalPluginRegistry() { _w('getGlobalPluginRegistry'); return undefined; }
function hasGlobalHooks() { _w('hasGlobalHooks'); return false; }
function resetGlobalHookRunner() { _w('resetGlobalHookRunner'); return undefined; }
function normalizePluginHttpPath() { _w('normalizePluginHttpPath'); return ""; }
function registerPluginHttpRoute() { _w('registerPluginHttpRoute'); return undefined; }
async function dispatchPluginInteractiveHandler() { _w('dispatchPluginInteractiveHandler'); return undefined; }
function registerPluginInteractiveHandler() { _w('registerPluginInteractiveHandler'); return undefined; }
function clearPluginInteractiveHandlers() { _w('clearPluginInteractiveHandlers'); return undefined; }
function clearPluginInteractiveHandlersForPlugin() { _w('clearPluginInteractiveHandlersForPlugin'); return undefined; }
async function startLazyPluginServiceModule() { _w('startLazyPluginServiceModule'); return undefined; }
const PLUGIN_HOOK_NAMES = undefined;
const isPluginHookName = undefined;
const PROMPT_INJECTION_HOOK_NAMES = undefined;
const isPromptInjectionHookName = undefined;
const PLUGIN_PROMPT_MUTATION_RESULT_FIELDS = undefined;
const stripPromptMutationFieldsFromLegacyHookResult = undefined;

module.exports = {
  executePluginCommand,
  matchPluginCommand,
  listPluginCommands,
  __testing,
  clearPluginCommands,
  clearPluginCommandsForPlugin,
  getPluginCommandSpecs,
  registerPluginCommand,
  validateCommandName,
  validatePluginCommandDefinition,
  runGlobalGatewayStopSafely,
  initializeGlobalHookRunner,
  getGlobalHookRunner,
  getGlobalPluginRegistry,
  hasGlobalHooks,
  resetGlobalHookRunner,
  normalizePluginHttpPath,
  registerPluginHttpRoute,
  dispatchPluginInteractiveHandler,
  registerPluginInteractiveHandler,
  clearPluginInteractiveHandlers,
  clearPluginInteractiveHandlersForPlugin,
  startLazyPluginServiceModule,
  PLUGIN_HOOK_NAMES,
  isPluginHookName,
  PROMPT_INJECTION_HOOK_NAMES,
  isPromptInjectionHookName,
  PLUGIN_PROMPT_MUTATION_RESULT_FIELDS,
  stripPromptMutationFieldsFromLegacyHookResult,
};
