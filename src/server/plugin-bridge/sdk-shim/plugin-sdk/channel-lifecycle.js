// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/channel-lifecycle.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/channel-lifecycle.' + fn + '() not implemented in Bridge mode'); }
}

async function runPassiveAccountLifecycle() { _w('runPassiveAccountLifecycle'); return undefined; }
async function keepHttpServerTaskAlive() { _w('keepHttpServerTaskAlive'); return undefined; }
function createAccountStatusSink() { _w('createAccountStatusSink'); return undefined; }
function waitUntilAbort() { _w('waitUntilAbort'); return undefined; }
function createRunStateMachine() { _w('createRunStateMachine'); return undefined; }
function createArmableStallWatchdog() { _w('createArmableStallWatchdog'); return undefined; }
async function takeMessageIdAfterStop() { _w('takeMessageIdAfterStop'); return undefined; }
async function clearFinalizableDraftMessage() { _w('clearFinalizableDraftMessage'); return undefined; }
function createFinalizableDraftStreamControls() { _w('createFinalizableDraftStreamControls'); return undefined; }
function createFinalizableDraftStreamControlsForState() { _w('createFinalizableDraftStreamControlsForState'); return undefined; }
function createFinalizableDraftLifecycle() { _w('createFinalizableDraftLifecycle'); return undefined; }
function createDraftStreamLoop() { _w('createDraftStreamLoop'); return undefined; }

module.exports = {
  runPassiveAccountLifecycle,
  keepHttpServerTaskAlive,
  createAccountStatusSink,
  waitUntilAbort,
  createRunStateMachine,
  createArmableStallWatchdog,
  takeMessageIdAfterStop,
  clearFinalizableDraftMessage,
  createFinalizableDraftStreamControls,
  createFinalizableDraftStreamControlsForState,
  createFinalizableDraftLifecycle,
  createDraftStreamLoop,
};
