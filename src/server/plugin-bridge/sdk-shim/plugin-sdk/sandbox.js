// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/sandbox.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/sandbox.' + fn + '() not implemented in Bridge mode'); }
}

function buildExecRemoteCommand() { _w('buildExecRemoteCommand'); return undefined; }
function buildRemoteCommand() { _w('buildRemoteCommand'); return undefined; }
function buildSshSandboxArgv() { _w('buildSshSandboxArgv'); return undefined; }
function createRemoteShellSandboxFsBridge() { _w('createRemoteShellSandboxFsBridge'); return undefined; }
function createWritableRenameTargetResolver() { _w('createWritableRenameTargetResolver'); return undefined; }
function createSshSandboxSessionFromConfigText() { _w('createSshSandboxSessionFromConfigText'); return undefined; }
function createSshSandboxSessionFromSettings() { _w('createSshSandboxSessionFromSettings'); return undefined; }
function disposeSshSandboxSession() { _w('disposeSshSandboxSession'); return undefined; }
function getSandboxBackendFactory() { _w('getSandboxBackendFactory'); return undefined; }
function getSandboxBackendManager() { _w('getSandboxBackendManager'); return undefined; }
function registerSandboxBackend() { _w('registerSandboxBackend'); return undefined; }
function requireSandboxBackendFactory() { _w('requireSandboxBackendFactory'); return undefined; }
function resolveWritableRenameTargets() { _w('resolveWritableRenameTargets'); return undefined; }
function resolveWritableRenameTargetsForBridge() { _w('resolveWritableRenameTargetsForBridge'); return undefined; }
function runSshSandboxCommand() { _w('runSshSandboxCommand'); return undefined; }
function shellEscape() { _w('shellEscape'); return undefined; }
function uploadDirectoryToSshTarget() { _w('uploadDirectoryToSshTarget'); return undefined; }
function runPluginCommandWithTimeout() { _w('runPluginCommandWithTimeout'); return undefined; }
function resolvePreferredOpenClawTmpDir() { _w('resolvePreferredOpenClawTmpDir'); return undefined; }

module.exports = {
  buildExecRemoteCommand,
  buildRemoteCommand,
  buildSshSandboxArgv,
  createRemoteShellSandboxFsBridge,
  createWritableRenameTargetResolver,
  createSshSandboxSessionFromConfigText,
  createSshSandboxSessionFromSettings,
  disposeSshSandboxSession,
  getSandboxBackendFactory,
  getSandboxBackendManager,
  registerSandboxBackend,
  requireSandboxBackendFactory,
  resolveWritableRenameTargets,
  resolveWritableRenameTargetsForBridge,
  runSshSandboxCommand,
  shellEscape,
  uploadDirectoryToSshTarget,
  runPluginCommandWithTimeout,
  resolvePreferredOpenClawTmpDir,
};
