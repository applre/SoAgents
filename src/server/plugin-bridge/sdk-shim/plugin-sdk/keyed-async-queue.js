// AUTO-GENERATED STUB — do not edit manually.
// Regenerate: bun scripts/generate-sdk-shims.ts
// Source: openclaw/src/plugin-sdk/keyed-async-queue.ts

const _warned = new Set();
function _w(fn) {
  if (!_warned.has(fn)) { _warned.add(fn); console.warn('[sdk-shim] openclaw/plugin-sdk/keyed-async-queue.' + fn + '() not implemented in Bridge mode'); }
}

function enqueueKeyedTask() { _w('enqueueKeyedTask'); return undefined; }
class KeyedAsyncQueue { constructor() { _w('KeyedAsyncQueue'); } }

module.exports = {
  enqueueKeyedTask,
  KeyedAsyncQueue,
};
