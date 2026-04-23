// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/browser.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/browser.' + fn + '() not implemented in Bridge mode'); }
}

function createBrowserTool() { _w('createBrowserTool'); return undefined; }
function registerBrowserCli() { _w('registerBrowserCli'); return undefined; }
function createBrowserPluginService() { _w('createBrowserPluginService'); return undefined; }
function browserHandlers() { _w('browserHandlers'); return undefined; }
function handleBrowserGatewayRequest() { _w('handleBrowserGatewayRequest'); return undefined; }

module.exports = {
  createBrowserTool,
  registerBrowserCli,
  createBrowserPluginService,
  browserHandlers,
  handleBrowserGatewayRequest,
};
